import type {
  AdminUser,
  Competition,
  FullQuizState,
  ParticipantStatus,
  RankedParticipant,
  ScoreEvent,
  ScoreReason,
} from '../types/quiz';

const TOKEN_KEY = 'qcl_admin_token';

export function getStoredAdminToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function requestJson<T>(url: string, init: RequestInit = {}, withAuth = false): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (withAuth) {
    const token = getStoredAdminToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const res = await fetch(url, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 413) {
      throw new Error("La photo envoyée est trop volumineuse.");
    }
    throw new Error(
      typeof data?.error === 'string'
        ? data.error
        : `Le serveur a répondu avec l'erreur ${res.status}. Veuillez réessayer.`
    );
  }
  return data as T;
}

export const quizApi = {
  getState: () => requestJson<FullQuizState>('/api/state'),

  getParticipantDetail: (id: string) =>
    requestJson<{
      participant: RankedParticipant;
      leaderScore: number;
      totalParticipants: number;
      events: ScoreEvent[];
      competition: Competition;
      serverTime: string;
    }>(`/api/participants/${encodeURIComponent(id)}`),

  registerParticipant: (payload: {
    first_name: string;
    last_name: string;
    nickname?: string;
    phone?: string;
    avatar_url?: string;
  }) =>
    requestJson<{ participant: RankedParticipant }>('/api/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  adminLogin: (email: string, passcode: string) =>
    requestJson<{ token: string; admin: AdminUser }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, passcode }),
    }),

  adminMe: () => requestJson<{ admin: AdminUser }>('/api/admin/me', {}, true),

  adminLogout: () => requestJson<{ ok: boolean }>('/api/admin/logout', { method: 'POST' }, true),

  adminAddParticipant: (payload: {
    first_name: string;
    last_name: string;
    nickname?: string;
    phone?: string;
    avatar_url?: string;
  }) =>
    requestJson<{ participant: RankedParticipant }>(
      '/api/admin/participants',
      { method: 'POST', body: JSON.stringify(payload) },
      true
    ),

  adminUpdateParticipant: (
    id: string,
    payload: Partial<{
      first_name: string;
      last_name: string;
      nickname: string | null;
      phone: string | null;
      avatar_url: string | null;
      status: ParticipantStatus;
    }>
  ) =>
    requestJson<{ participant: RankedParticipant }>(
      `/api/admin/participants/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      true
    ),

  adminDeleteParticipant: (id: string) =>
    requestJson<{ ok: boolean }>(
      `/api/admin/participants/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      true
    ),

  adminApplyScore: (participantId: string, delta: number, reason: ScoreReason) =>
    requestJson<{
      event: ScoreEvent;
      participants: RankedParticipant[];
      newLeaderId: string | null;
      previousLeaderId: string | null;
    }>(
      '/api/admin/score',
      { method: 'POST', body: JSON.stringify({ participantId, delta, reason }) },
      true
    ),

  adminResetParticipantScore: (id: string) =>
    requestJson<{
      event: ScoreEvent;
      participants: RankedParticipant[];
    }>(`/api/admin/participants/${encodeURIComponent(id)}/reset`, { method: 'POST' }, true),

  adminUndoLastScore: () =>
    requestJson<{
      event: ScoreEvent;
      participants: RankedParticipant[];
    }>('/api/admin/undo', { method: 'POST' }, true),

  adminUpdateCompetition: (
    payload: Partial<Competition> & { question_timer_action?: 'START' | 'PAUSE' | 'RESET' }
  ) =>
    requestJson<{ competition: Competition; participants: RankedParticipant[] }>(
      '/api/admin/competition',
      { method: 'PATCH', body: JSON.stringify(payload) },
      true
    ),

  adminResetCompetition: (mode: 'scores' | 'full') =>
    requestJson<FullQuizState>(
      '/api/admin/competition/reset',
      { method: 'POST', body: JSON.stringify({ mode }) },
      true
    ),
};
