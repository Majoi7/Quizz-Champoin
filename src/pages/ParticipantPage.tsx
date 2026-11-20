import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Award, History, Tv } from 'lucide-react';
import { PublicHeader } from '../components/PublicHeader';
import { Avatar } from '../components/Avatar';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useQuiz } from '../context/QuizContext';
import { quizApi } from '../services/api';
import type { ScoreEvent } from '../types/quiz';

const REASON_LABELS: Record<string, string> = {
  CORRECT: 'Bonne réponse',
  WRONG: 'Mauvaise réponse',
  BONUS: 'Question bonus',
  CUSTOM: 'Ajustement régie',
  RESET: 'Réinitialisation',
  UNDO: 'Annulation',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'En lice', color: 'text-emerald-700 font-bold' },
  PAUSED: { label: 'En pause', color: 'text-amber-700 font-bold' },
  DISQUALIFIED: { label: 'Disqualifié', color: 'text-[#EA4C2A] font-bold' },
};

export function ParticipantPage() {
  const { id } = useParams<{ id: string }>();
  const { participants, recentEvents, competition } = useQuiz();
  const [fallbackEvents, setFallbackEvents] = useState<ScoreEvent[]>([]);
  const [notFound, setNotFound] = useState(false);

  const liveParticipant = participants.find((p) => p.id === id) ?? null;

  useEffect(() => {
    if (!id) return;
    quizApi
      .getParticipantDetail(id)
      .then((res) => {
        setFallbackEvents(res.events);
        setNotFound(false);
      })
      .catch(() => {
        if (!liveParticipant) setNotFound(true);
      });
  }, [id, liveParticipant]);

  const activeList = participants.filter((p) => p.status !== 'DISQUALIFIED');
  const leaderScore = activeList[0]?.score ?? 0;

  const liveParticipantEvents = recentEvents.filter((e) => e.participant_id === id);
  const mergedEventsMap = new Map<string, ScoreEvent>();
  for (const ev of [...liveParticipantEvents, ...fallbackEvents]) {
    mergedEventsMap.set(ev.id, ev);
  }
  const participantEvents = Array.from(mergedEventsMap.values()).sort(
    (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
  );

  if (notFound && !liveParticipant) {
    return (
      <div className="min-h-screen bg-[#F4F7F7] text-[#141414] flex flex-col">
        <PublicHeader />
        <main className="flex-1 mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
          <h1 className="font-display text-3xl font-bold text-[#141414]">Candidat introuvable</h1>
          <p className="text-sm font-medium text-[#525866]">
            Ce profil n&apos;existe pas ou a été retiré de la compétition.
          </p>
          <Link
            to="/classement"
            className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] px-5 py-2.5 text-sm font-bold text-[#141414] tactile-btn"
          >
            Voir le classement général
          </Link>
        </main>
      </div>
    );
  }

  if (!liveParticipant) {
    return (
      <div className="min-h-screen bg-[#F4F7F7] text-[#141414] flex flex-col">
        <PublicHeader />
        <main className="flex-1 mx-auto max-w-4xl w-full px-4 py-10 space-y-6">
          <div className="h-40 rounded-2xl bg-white animate-pulse border-2 border-[#141414]/15" />
          <div className="h-64 rounded-2xl bg-white animate-pulse border-2 border-[#141414]/15" />
        </main>
      </div>
    );
  }

  const gapToLeader = Math.max(0, leaderScore - liveParticipant.score);
  const statusMeta = STATUS_LABELS[liveParticipant.status] ?? STATUS_LABELS.ACTIVE;

  return (
    <div className="min-h-screen bg-[#F4F7F7] text-[#141414] flex flex-col">
      <PublicHeader />

      <main className="flex-1 mx-auto max-w-4xl w-full px-4 py-8 sm:px-6 space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/classement"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#525866] hover:text-[#141414] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour au classement</span>
          </Link>
          <Link
            to="/live"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#141414] tactile-btn"
          >
            <Tv className="h-3.5 w-3.5 text-[#EA4C2A]" />
            <span>Écran Live</span>
          </Link>
        </div>

        {/* Contestant Hero Card */}
        <section className="rounded-3xl bg-white overflow-hidden tactile-card">
          <div className="bg-[#F4C424] px-6 sm:px-8 py-6 border-b-2 border-[#141414]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-5 min-w-0">
                <Avatar
                  firstName={liveParticipant.first_name}
                  lastName={liveParticipant.last_name}
                  avatarUrl={liveParticipant.avatar_url}
                  size="xl"
                  rank={liveParticipant.rank}
                />
                <div className="min-w-0 space-y-1">
                  <div className="text-xs font-bold text-[#141414]/80">
                    <span>{competition?.name ?? 'QUIZ CHAMPION LIVE'}</span>
                    <span className="mx-1.5" aria-hidden="true">·</span>
                    <span className={statusMeta.color}>{statusMeta.label}</span>
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#141414] truncate">
                    {liveParticipant.first_name} {liveParticipant.last_name}
                  </h1>
                  {liveParticipant.nickname && (
                    <p className="text-sm font-semibold text-[#141414]/80">
                      Alias : {liveParticipant.nickname}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6 bg-white rounded-2xl border-2 border-[#141414] px-5 py-3.5 shrink-0">
                <div>
                  <div className="text-xs font-semibold text-[#525866]">Classement</div>
                  <div className="font-display text-3xl font-bold text-[#141414] tabular-nums">
                    {liveParticipant.rank ? `#${liveParticipant.rank}` : 'DQ'}
                  </div>
                </div>
                <div className="h-10 w-0.5 bg-[#141414]/15" aria-hidden="true" />
                <div>
                  <div className="text-xs font-semibold text-[#525866]">Score actuel</div>
                  <div className="font-display text-3xl font-bold text-[#141414] tabular-nums">
                    <AnimatedCounter value={liveParticipant.score} />
                    <span className="ml-1 text-sm font-bold text-[#525866]">pts</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-4 text-sm font-semibold text-[#141414] bg-white">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-[#EA4C2A]" />
              {liveParticipant.isLeader ? (
                <span className="font-bold">En tête du classement !</span>
              ) : liveParticipant.status === 'DISQUALIFIED' ? (
                <span className="text-[#EA4C2A]">Disqualifié</span>
              ) : (
                <span>
                  Écart leader : <strong className="tabular-nums">{gapToLeader} pts</strong>
                </span>
              )}
            </div>
            <div className="text-xs font-bold text-[#525866] tabular-nums">
              {activeList.length} actifs
            </div>
          </div>
        </section>

        {/* Personal Score History */}
        <section className="rounded-2xl bg-white overflow-hidden tactile-card">
          <div className="px-6 py-4 border-b-2 border-[#141414]/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#EA4C2A]" />
              <h2 className="font-display text-xl font-bold text-[#141414]">
                Historique personnel des points
              </h2>
            </div>
            <span className="text-xs font-bold text-[#525866] tabular-nums">
              {participantEvents.length} opération{participantEvents.length > 1 ? 's' : ''}
            </span>
          </div>

          {participantEvents.length === 0 ? (
            <div className="p-8 text-center text-sm font-medium text-[#525866]">
              Aucun point attribué ou retiré pour le moment.
            </div>
          ) : (
            <div className="divide-y-2 divide-[#141414]/10">
              {participantEvents.map((ev) => (
                <div
                  key={ev.id}
                  className={`px-6 py-3.5 flex items-center justify-between gap-4 ${
                    ev.reverted ? 'opacity-50' : ''
                  }`}
                >
                  <div>
                    <div className="text-sm font-bold text-[#141414]">
                      {REASON_LABELS[ev.reason] ?? ev.reason}
                      {ev.reverted && (
                        <span className="ml-2 text-xs text-[#EA4C2A]"> · Annulée</span>
                      )}
                    </div>
                    <div className="text-xs font-medium text-[#525866] tabular-nums">
                      Manche {ev.round_number} · {new Date(ev.created_at).toLocaleTimeString('fr-FR')} ·{' '}
                      {ev.admin_name}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`font-mono-tabular text-lg font-bold ${
                        ev.delta > 0
                          ? 'text-emerald-700'
                          : ev.delta < 0
                            ? 'text-[#EA4C2A]'
                            : 'text-[#525866]'
                      }`}
                    >
                      {ev.delta > 0 ? `+${ev.delta}` : ev.delta}
                    </div>
                    <div className="text-xs text-[#525866] font-mono-tabular">
                      {ev.previous_score} → {ev.new_score}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
