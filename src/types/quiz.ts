export type CompetitionStatus = 'PREPARATION' | 'LIVE' | 'PAUSED' | 'FINISHED';

export type ParticipantStatus = 'ACTIVE' | 'PAUSED' | 'DISQUALIFIED';

export type TieBreakerRule = 'EARLIEST_REACHED' | 'ALPHABETICAL' | 'JOIN_ORDER';

export type ScoreReason = 'CORRECT' | 'WRONG' | 'BONUS' | 'CUSTOM' | 'RESET' | 'UNDO';

export interface Competition {
  id: string;
  name: string;
  subtitle: string;
  status: CompetitionStatus;
  registrations_open: boolean;
  require_phone: boolean;
  confirm_large_delta: boolean;
  large_delta_threshold: number;
  tie_breaker: TieBreakerRule;
  points_correct: number;
  points_wrong: number;
  points_bonus: number;
  current_round: number;
  round_title: string;
  started_at: string | null;
  elapsed_seconds: number;
  resumed_at: string | null;
  question_timer_seconds: number;
  question_timer_running: boolean;
  question_timer_started_at: string | null;
}

export interface Participant {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string | null;
  phone: string | null;
  avatar_url: string | null;
  score: number;
  status: ParticipantStatus;
  score_updated_at: string;
  created_at: string;
}

export interface RankedParticipant extends Participant {
  rank: number | null;
  isLeader: boolean;
  displayName: string;
}

export interface ScoreEvent {
  id: string;
  participant_id: string;
  participant_name: string;
  delta: number;
  previous_score: number;
  new_score: number;
  reason: ScoreReason;
  round_number: number;
  admin_name: string;
  reverted: boolean;
  created_at: string;
}

export interface FullQuizState {
  competition: Competition;
  participants: RankedParticipant[];
  recentEvents: ScoreEvent[];
  serverTime: string;
}

export type ServerWsMessage =
  | { type: 'state:sync'; payload: FullQuizState }
  | {
      type: 'score:applied';
      payload: {
        event: ScoreEvent;
        participants: RankedParticipant[];
        newLeaderId: string | null;
        previousLeaderId: string | null;
        serverTime: string;
      };
    }
  | {
      type: 'participants:updated';
      payload: {
        participants: RankedParticipant[];
        serverTime: string;
      };
    }
  | {
      type: 'competition:updated';
      payload: {
        competition: Competition;
        participants: RankedParticipant[];
        serverTime: string;
      };
    };

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'SUPER_ADMIN' | 'HOST';
}
