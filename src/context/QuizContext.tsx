import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { audioService } from '../lib/audioService';
import { getStoredAdminToken, quizApi, setStoredAdminToken } from '../services/api';
import type {
  AdminUser,
  Competition,
  FullQuizState,
  RankedParticipant,
  ScoreEvent,
  ServerWsMessage,
} from '../types/quiz';

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
  soundEnabled: boolean;
  toggleSound: () => void;
  loginAdmin: (email: string, passcode: string) => Promise<AdminUser>;
  logoutAdmin: () => Promise<void>;
  refreshState: () => Promise<void>;
}

const QuizContext = createContext<QuizContextValue | null>(null);

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

    const token = getStoredAdminToken();
    if (token) {
      quizApi
        .adminMe()
        .then((res) => {
          if (mountedRef.current) setAdmin(res.admin);
        })
        .catch(() => {
          setStoredAdminToken(null);
          if (mountedRef.current) setAdmin(null);
        })
        .finally(() => {
          if (mountedRef.current) setAdminAuthChecked(true);
        });
    } else {
      setAdminAuthChecked(true);
    }

    const startHttpPolling = () => {
      if (pollingTimerRef.current !== null || !mountedRef.current) return;
      pollingTimerRef.current = window.setInterval(() => {
        refreshState();
      }, 1800);
    };

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
        if (pollingTimerRef.current !== null) {
          window.clearInterval(pollingTimerRef.current);
          pollingTimerRef.current = null;
        }
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

        // On serverless deployments (e.g. Vercel) WebSockets are unavailable: switch cleanly to HTTP sync
        if (!wsEverConnectedRef.current && attempt >= 1) {
          startHttpPolling();
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

    connectWs();

    return () => {
      mountedRef.current = false;
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

  const loginAdmin = useCallback(async (email: string, passcode: string) => {
    const res = await quizApi.adminLogin(email, passcode);
    setStoredAdminToken(res.token);
    setAdmin(res.admin);
    return res.admin;
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await quizApi.adminLogout();
    } catch {
      // ignore
    }
    setStoredAdminToken(null);
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
        soundEnabled,
        toggleSound,
        loginAdmin,
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
