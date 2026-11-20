import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { audioService } from '../lib/audioService.ts';
import {
  getOrCreateSupabaseClient,
  getSupabaseClient,
  supabaseClient,
} from '../lib/supabase.ts';
import { quizApi, setInMemoryAuthToken } from '../services/api.ts';
import type {
  AdminUser,
  Competition,
  FullQuizState,
  RankedParticipant,
  ScoreEvent,
  ServerWsMessage,
} from '../types/quiz.ts';

export type WsConnectionStatus = 'connecting' | 'connected' | 'reconnecting';

export interface ActiveScoreBurst {
  event: ScoreEvent;
  newLeaderId: string | null;
  receivedAt: number;
}

interface QuizContextValue {
  competition: Competition | null;
  participants: RankedParticipant[];
  recentEvents: ScoreEvent[];
  loading: boolean;
  connectionStatus: WsConnectionStatus;
  serverTimeOffsetMs: number;
  lastScoreBurst: ActiveScoreBurst | null;
  admin: AdminUser | null;
  adminAuthChecked: boolean;
  supabaseReady: boolean;
  soundEnabled: boolean;
  toggleSound: () => void;
  loginWithSupabase: (email: string, password: string) => Promise<AdminUser>;
  logoutAdmin: () => Promise<void>;
  refreshState: () => Promise<void>;
}

const QuizContext = createContext<QuizContextValue | null>(null);

function translateSupabaseAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Adresse e-mail ou mot de passe incorrect.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Adresse e-mail non confirmée. Confirmez-la dans Supabase Authentication.';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Trop de tentatives. Veuillez patienter quelques instants.';
  }
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Impossible de joindre Supabase Auth. Vérifiez votre connexion.';
  }
  return message || 'Impossible de vous connecter avec Supabase.';
}

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [participants, setParticipants] = useState<RankedParticipant[]>([]);
  const [recentEvents, setRecentEvents] = useState<ScoreEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<WsConnectionStatus>('connecting');
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState(0);
  const [lastScoreBurst, setLastScoreBurst] = useState<ActiveScoreBurst | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [adminAuthChecked, setAdminAuthChecked] = useState(false);
  const [supabaseReady, setSupabaseReady] = useState(Boolean(supabaseClient));
  const [soundEnabled, setSoundEnabled] = useState(() => audioService.isEnabled());

  const wsRef = useRef<WebSocket | null>(null);
  const wsEverConnectedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const pollingTimerRef = useRef<number | null>(null);
  const burstTimeoutRef = useRef<number | null>(null);
  const latestEventIdRef = useRef<string | null>(null);
  const previousLeaderIdRef = useRef<string | null>(null);
  const hasHydratedRef = useRef(false);
  const mountedRef = useRef(true);

  const triggerBurst = useCallback((event: ScoreEvent, newLeaderId: string | null) => {
    setLastScoreBurst({
      event,
      newLeaderId,
      receivedAt: Date.now(),
    });
    audioService.triggerScoreSound(event, Boolean(newLeaderId));
    if (burstTimeoutRef.current) {
      window.clearTimeout(burstTimeoutRef.current);
    }
    burstTimeoutRef.current = window.setTimeout(() => {
      if (mountedRef.current) {
        setLastScoreBurst(null);
      }
    }, 4200);
  }, []);

  const applyFullState = useCallback(
    (state: FullQuizState) => {
      const nextLeaderId = state.participants.find((p) => p.isLeader)?.id ?? null;
      const newestEvent = state.recentEvents[0] ?? null;

      if (hasHydratedRef.current && newestEvent && newestEvent.id !== latestEventIdRef.current) {
        const isNewLeader =
          nextLeaderId !== null && nextLeaderId !== previousLeaderIdRef.current;
        triggerBurst(newestEvent, isNewLeader ? nextLeaderId : null);
      }

      latestEventIdRef.current = newestEvent?.id ?? null;
      previousLeaderIdRef.current = nextLeaderId;
      hasHydratedRef.current = true;

      setCompetition(state.competition);
      setParticipants(state.participants);
      setRecentEvents(state.recentEvents);
      const parsedServerMs = Date.parse(state.serverTime);
      if (!Number.isNaN(parsedServerMs)) {
        setServerTimeOffsetMs(parsedServerMs - Date.now());
      }
      setLoading(false);
    },
    [triggerBurst]
  );

  const refreshState = useCallback(async () => {
    try {
      const state = await quizApi.getState();
      if (mountedRef.current) {
        applyFullState(state);
        if (!wsEverConnectedRef.current) {
          setConnectionStatus('connected');
        }
      }
    } catch {
      if (mountedRef.current) setLoading(false);
    }
  }, [applyFullState]);

  useEffect(() => {
    mountedRef.current = true;
    refreshState();

    const handleGestureUnlock = () => {
      audioService.unlock();
    };
    window.addEventListener('pointerdown', handleGestureUnlock, { once: true, passive: true });
    window.addEventListener('keydown', handleGestureUnlock, { once: true, passive: true });

    let activeSupabaseClient = getSupabaseClient();
    let supabaseChannel: ReturnType<NonNullable<typeof supabaseClient>['channel']> | null = null;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const attachSupabaseAuth = (client: NonNullable<typeof supabaseClient>) => {
      if (!mountedRef.current || authSubscription) return;
      setSupabaseReady(true);

      void client.auth
        .getSession()
        .then(async ({ data }) => {
          if (!mountedRef.current) return;
          const token = data.session?.access_token ?? null;
          if (!token) {
            setInMemoryAuthToken(null);
            setAdmin(null);
            setAdminAuthChecked(true);
            return;
          }
          try {
            setInMemoryAuthToken(token);
            const res = await quizApi.adminMe();
            if (mountedRef.current) {
              setAdmin(res.admin);
            }
          } catch {
            setInMemoryAuthToken(null);
            await client.auth.signOut().catch(() => undefined);
            if (mountedRef.current) {
              setAdmin(null);
            }
          } finally {
            if (mountedRef.current) {
              setAdminAuthChecked(true);
            }
          }
        })
        .catch(() => {
          if (mountedRef.current) {
            setInMemoryAuthToken(null);
            setAdmin(null);
            setAdminAuthChecked(true);
          }
        });

      const { data } = client.auth.onAuthStateChange((event, session) => {
        if (!mountedRef.current) return;
        if (event === 'SIGNED_OUT' || !session?.access_token) {
          setInMemoryAuthToken(null);
          setAdmin(null);
          return;
        }
        setInMemoryAuthToken(session.access_token);
      });
      authSubscription = data.subscription;
    };

    const startHttpPolling = () => {
      if (pollingTimerRef.current !== null || !mountedRef.current) return;
      pollingTimerRef.current = window.setInterval(() => {
        refreshState();
      }, 2000);
    };

    const stopHttpPolling = () => {
      if (pollingTimerRef.current !== null) {
        window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };

    const attachSupabaseRealtime = (client: NonNullable<typeof supabaseClient>) => {
      if (!mountedRef.current || supabaseChannel) return;
      activeSupabaseClient = client;
      supabaseChannel = client
        .channel('quiz-champion-live-sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'participants' },
          () => {
            void refreshState();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'competitions' },
          () => {
            void refreshState();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'score_events' },
          () => {
            void refreshState();
          }
        )
        .subscribe((status) => {
          if (!mountedRef.current) return;
          if (status === 'SUBSCRIBED') {
            stopHttpPolling();
            setConnectionStatus('connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            startHttpPolling();
          }
        });
    };

    if (activeSupabaseClient) {
      attachSupabaseAuth(activeSupabaseClient);
      attachSupabaseRealtime(activeSupabaseClient);
    }

    const connectWs = () => {
      if (!mountedRef.current) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!mountedRef.current) return;
        wsEverConnectedRef.current = true;
        reconnectAttemptRef.current = 0;
        stopHttpPolling();
        setConnectionStatus('connected');
      };

      socket.onmessage = (evt) => {
        if (!mountedRef.current) return;
        try {
          const msg = JSON.parse(evt.data) as ServerWsMessage;
          if (msg.type === 'state:sync') {
            applyFullState(msg.payload);
          } else if (msg.type === 'participants:updated') {
            setParticipants(msg.payload.participants);
            previousLeaderIdRef.current =
              msg.payload.participants.find((p) => p.isLeader)?.id ?? null;
          } else if (msg.type === 'competition:updated') {
            setCompetition(msg.payload.competition);
            setParticipants(msg.payload.participants);
            previousLeaderIdRef.current =
              msg.payload.participants.find((p) => p.isLeader)?.id ?? null;
          } else if (msg.type === 'score:applied') {
            latestEventIdRef.current = msg.payload.event.id;
            previousLeaderIdRef.current =
              msg.payload.participants.find((p) => p.isLeader)?.id ?? null;
            setParticipants(msg.payload.participants);
            setRecentEvents((prev) => {
              const filtered = prev.filter((e) => e.id !== msg.payload.event.id);
              const updatedPrev =
                msg.payload.event.reason === 'UNDO'
                  ? filtered.map((item, idx) =>
                      idx === 0 && !item.reverted ? { ...item, reverted: true } : item
                    )
                  : filtered;
              return [msg.payload.event, ...updatedPrev].slice(0, 100);
            });
            triggerBurst(msg.payload.event, msg.payload.newLeaderId);
          }
        } catch {
          // ignore malformed messages
        }
      };

      socket.onclose = () => {
        if (!mountedRef.current) return;
        const attempt = reconnectAttemptRef.current;
        reconnectAttemptRef.current += 1;

        if (!wsEverConnectedRef.current && attempt >= 1) {
          if (!supabaseChannel) {
            startHttpPolling();
          }
          setConnectionStatus('connected');
          return;
        }

        setConnectionStatus('reconnecting');
        const delay = Math.min(8000, 800 * Math.pow(1.6, attempt));
        reconnectTimerRef.current = window.setTimeout(() => {
          connectWs();
        }, delay);
      };

      socket.onerror = () => {
        socket.close();
      };
    };

    fetch('/api/realtime-config')
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          cfg: {
            supabaseUrl?: string | null;
            supabaseAnonKey?: string | null;
            wsEnabled?: boolean;
          } | null
        ) => {
          if (!mountedRef.current) return;
          if (!activeSupabaseClient && cfg?.supabaseUrl && cfg?.supabaseAnonKey) {
            const client = getOrCreateSupabaseClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
            if (client) {
              activeSupabaseClient = client;
              attachSupabaseAuth(client);
              attachSupabaseRealtime(client);
            }
          }
          if (!activeSupabaseClient) {
            setSupabaseReady(false);
            setAdminAuthChecked(true);
          }
          if (cfg?.wsEnabled === true) {
            connectWs();
          } else {
            if (!supabaseChannel) {
              startHttpPolling();
            }
            setConnectionStatus('connected');
          }
        }
      )
      .catch(() => {
        if (!mountedRef.current) return;
        if (!activeSupabaseClient) {
          setSupabaseReady(false);
          setAdminAuthChecked(true);
        }
        if (!supabaseChannel) {
          startHttpPolling();
        }
        setConnectionStatus('connected');
      });

    return () => {
      mountedRef.current = false;
      authSubscription?.unsubscribe();
      if (supabaseChannel && activeSupabaseClient) {
        void activeSupabaseClient.removeChannel(supabaseChannel);
      }
      window.removeEventListener('pointerdown', handleGestureUnlock);
      window.removeEventListener('keydown', handleGestureUnlock);
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (pollingTimerRef.current) window.clearInterval(pollingTimerRef.current);
      if (burstTimeoutRef.current) window.clearTimeout(burstTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [applyFullState, refreshState, triggerBurst]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      audioService.setEnabled(next);
      return next;
    });
  }, []);

  const loginWithSupabase = useCallback(async (email: string, password: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      throw new Error('Veuillez saisir votre adresse e-mail et votre mot de passe.');
    }

    let client = getSupabaseClient();
    if (!client) {
      const cfgRes = await fetch('/api/realtime-config').catch(() => null);
      const cfg = cfgRes?.ok
        ? ((await cfgRes.json()) as {
            supabaseUrl?: string | null;
            supabaseAnonKey?: string | null;
          })
        : null;
      client = getOrCreateSupabaseClient(cfg?.supabaseUrl, cfg?.supabaseAnonKey);
    }

    if (!client) {
      throw new Error(
        'Authentification Supabase non configurée. Ajoutez SUPABASE_URL et SUPABASE_ANON_KEY dans vos variables d’environnement.'
      );
    }
    setSupabaseReady(true);

    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (error || !data.session?.access_token) {
      throw new Error(translateSupabaseAuthError(error?.message ?? ''));
    }

    setInMemoryAuthToken(data.session.access_token);
    try {
      const res = await quizApi.adminMe();
      setAdmin(res.admin);
      return res.admin;
    } catch (verifyErr) {
      setInMemoryAuthToken(null);
      await client.auth.signOut().catch(() => undefined);
      setAdmin(null);
      throw verifyErr;
    }
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await getSupabaseClient()?.auth.signOut();
    } catch {
      // ignore
    }
    setInMemoryAuthToken(null);
    setAdmin(null);
  }, []);

  return (
    <QuizContext.Provider
      value={{
        competition,
        participants,
        recentEvents,
        loading,
        connectionStatus,
        serverTimeOffsetMs,
        lastScoreBurst,
        admin,
        adminAuthChecked,
        supabaseReady,
        soundEnabled,
        toggleSound,
        loginWithSupabase,
        logoutAdmin,
        refreshState,
      }}
    >
      {children}
    </QuizContext.Provider>
  );
}

export function useQuiz(): QuizContextValue {
  const ctx = useContext(QuizContext);
  if (!ctx) {
    throw new Error('useQuiz must be used within QuizProvider');
  }
  return ctx;
}
