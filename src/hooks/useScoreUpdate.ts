import { useCallback, useState } from 'react';
import { audioService } from '../lib/audioService';
import { quizApi } from '../services/api';
import type { RankedParticipant, ScoreReason } from '../types/quiz';

interface UseScoreUpdateOptions {
  onBeforeScore?: () => void;
  onScoreApplied?: (payload: {
    delta: number;
    reason: ScoreReason;
    isNewLeader: boolean;
  }) => void;
}

export function useScoreUpdate(options?: UseScoreUpdateOptions) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const applyScore = useCallback(
    async (participant: RankedParticipant, delta: number, reason: ScoreReason) => {
      setError(null);
      setBusyId(participant.id);
      audioService.unlock();
      options?.onBeforeScore?.();
      try {
        const res = await quizApi.adminApplyScore(participant.id, delta, reason);
        const isNewLeader = Boolean(res.newLeaderId);
        audioService.triggerScoreSound(res.event, isNewLeader);
        options?.onScoreApplied?.({ delta, reason, isNewLeader });
        return res;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors du calcul du score.');
        return null;
      } finally {
        setBusyId(null);
      }
    },
    [options]
  );

  const undoLastScore = useCallback(async () => {
    setError(null);
    setUndoBusy(true);
    audioService.unlock();
    try {
      const res = await quizApi.adminUndoLastScore();
      audioService.triggerScoreSound(res.event, false);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'annuler.");
      return null;
    } finally {
      setUndoBusy(false);
    }
  }, []);

  const resetParticipantScore = useCallback(async (participant: RankedParticipant) => {
    setError(null);
    setBusyId(participant.id);
    audioService.unlock();
    try {
      const res = await quizApi.adminResetParticipantScore(participant.id);
      audioService.triggerScoreSound(res.event, false);
      return res;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de réinitialisation.');
      return null;
    } finally {
      setBusyId(null);
    }
  }, []);

  return {
    busyId,
    undoBusy,
    error,
    setError,
    clearError,
    applyScore,
    undoLastScore,
    resetParticipantScore,
  };
}
