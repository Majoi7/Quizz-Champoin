import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { ArrowRight, Pause, Play, Square, Users } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { Avatar } from '../../components/Avatar';
import { useQuiz } from '../../context/QuizContext';
import { quizApi } from '../../services/api';

const STATUS_DISPLAY: Record<string, string> = {
  PREPARATION: 'En préparation',
  LIVE: 'En direct',
  PAUSED: 'En pause',
  FINISHED: 'Terminée',
};

export function AdminDashboardPage() {
  const { competition, participants, recentEvents } = useQuiz();
  const [busyStatus, setBusyStatus] = useState(false);

  const activeParticipants = participants.filter((p) => p.status === 'ACTIVE');
  const leader = participants.find((p) => p.isLeader) ?? null;
  const averageScore =
    activeParticipants.length > 0
      ? Math.round(
          activeParticipants.reduce((acc, p) => acc + p.score, 0) / activeParticipants.length
        )
      : 0;
  const validEventsCount = recentEvents.filter((e) => !e.reverted).length;

  const setGameStatus = async (status: 'LIVE' | 'PAUSED' | 'FINISHED') => {
    setBusyStatus(true);
    try {
      await quizApi.adminUpdateCompetition({ status });
    } finally {
      setBusyStatus(false);
    }
  };

  return (
    <AdminLayout title="Vue générale de la compétition">
      <div className="space-y-8">
        {/* Top KPI Strip */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white p-5 tactile-card">
            <div className="text-xs font-semibold text-[#525866]">Candidats actifs</div>
            <div className="mt-1.5 font-display text-3xl font-bold text-[#141414] tabular-nums">
              {activeParticipants.length}
              <span className="ml-2 text-sm font-semibold text-[#525866]">
                / {participants.length} inscrits
              </span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#FFFDF2] p-5 tactile-card">
            <div className="text-xs font-semibold text-[#525866]">Leader actuel</div>
            <div className="mt-1.5 font-display text-2xl font-bold text-[#141414] truncate">
              {leader ? `${leader.first_name} ${leader.last_name}` : 'Aucun'}
            </div>
            <div className="text-xs font-bold text-[#EA4C2A] font-mono-tabular">
              {leader ? `${leader.score} pts` : '0 pt'}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 tactile-card">
            <div className="text-xs font-semibold text-[#525866]">Score moyen (actifs)</div>
            <div className="mt-1.5 font-display text-3xl font-bold text-[#141414] tabular-nums">
              {averageScore} <span className="text-sm font-semibold text-[#525866]">pts</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 tactile-card">
            <div className="text-xs font-semibold text-[#525866]">Opérations validées</div>
            <div className="mt-1.5 font-display text-3xl font-bold text-[#141414] tabular-nums">
              {validEventsCount}
            </div>
          </div>
        </section>

        {/* Quick Competition State Control */}
        <section className="rounded-2xl bg-[#F4C424] p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 tactile-card">
          <div className="space-y-1">
            <div className="text-xs font-bold text-[#141414]/80">
              {competition?.round_title} · Statut :{' '}
              <span className="text-[#141414]">
                {STATUS_DISPLAY[competition?.status ?? 'PREPARATION']}
              </span>
            </div>
            <h2 className="font-display text-2xl font-bold text-[#141414]">
              {competition?.name ?? 'QUIZ CHAMPION LIVE'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {competition?.status !== 'LIVE' && (
              <button
                type="button"
                disabled={busyStatus}
                onClick={() => setGameStatus('LIVE')}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white tactile-btn disabled:opacity-60"
              >
                <Play className="h-4 w-4" />
                <span>
                  {competition?.status === 'PAUSED' ? 'Reprendre la partie' : 'Démarrer le direct'}
                </span>
              </button>
            )}
            {competition?.status === 'LIVE' && (
              <button
                type="button"
                disabled={busyStatus}
                onClick={() => setGameStatus('PAUSED')}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#141414] tactile-btn disabled:opacity-60"
              >
                <Pause className="h-4 w-4 text-[#EA4C2A]" />
                <span>Suspendre (Pause)</span>
              </button>
            )}
            {competition?.status !== 'FINISHED' && (
              <button
                type="button"
                disabled={busyStatus}
                onClick={() => setGameStatus('FINISHED')}
                className="inline-flex items-center gap-2 rounded-xl bg-[#EA4C2A] px-4 py-2.5 text-sm font-bold text-white tactile-btn disabled:opacity-60"
              >
                <Square className="h-4 w-4" />
                <span>Terminer</span>
              </button>
            )}
            <Link
              to="/admin/participants"
              className="inline-flex items-center gap-2 rounded-xl bg-[#141414] px-4 py-2.5 text-sm font-bold text-white border-2 border-[#141414] hover:bg-[#262626]"
            >
              <Users className="h-4 w-4 text-[#F4C424]" />
              <span>Attribuer des points</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Two-column summary: Top 5 Standings + Latest Operations */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-2xl bg-white overflow-hidden tactile-card">
            <div className="px-5 py-4 border-b-2 border-[#141414]/10 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#141414]">Top 5 en direct</h3>
              <Link
                to="/admin/participants"
                className="text-xs font-bold text-[#141414] hover:text-[#EA4C2A] underline decoration-[#F4C424] decoration-2"
              >
                Gérer tous les candidats
              </Link>
            </div>
            <LayoutGroup id="admin-dashboard-top5">
              <div className="divide-y-2 divide-[#141414]/10">
                <AnimatePresence initial={false}>
                  {participants.slice(0, 5).map((p) => (
                    <motion.div
                      layout="position"
                      key={p.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        layout: { type: 'spring', stiffness: 380, damping: 32 },
                        opacity: { duration: 0.18 },
                      }}
                      className="px-5 py-3.5 flex items-center justify-between gap-4 bg-white"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#141414] bg-[#F4F7F7] font-display text-sm font-bold text-[#141414] tabular-nums shrink-0">
                          {p.rank ?? 'DQ'}
                        </span>
                        <Avatar
                          firstName={p.first_name}
                          lastName={p.last_name}
                          avatarUrl={p.avatar_url}
                          size="sm"
                          rank={p.rank}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#141414] truncate">
                            {p.first_name} {p.last_name}
                          </div>
                          {p.nickname && (
                            <div className="text-xs font-medium text-[#525866] truncate">
                              {p.nickname}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="font-mono-tabular text-lg font-bold text-[#141414]">
                        {p.score} pts
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {participants.length === 0 && (
                  <div className="p-6 text-sm font-medium text-[#525866] text-center">
                    Aucun participant inscrit pour le moment.
                  </div>
                )}
              </div>
            </LayoutGroup>
          </div>

          <div className="lg:col-span-5 rounded-2xl bg-white overflow-hidden tactile-card">
            <div className="px-5 py-4 border-b-2 border-[#141414]/10 flex items-center justify-between">
              <h3 className="font-display text-xl font-bold text-[#141414]">Dernières opérations</h3>
              <Link
                to="/admin/historique"
                className="text-xs font-bold text-[#141414] hover:text-[#EA4C2A] underline decoration-[#F4C424] decoration-2"
              >
                Tout voir
              </Link>
            </div>
            <div className="divide-y-2 divide-[#141414]/10">
              <AnimatePresence initial={false}>
                {recentEvents.slice(0, 6).map((ev) => (
                  <motion.div
                    layout="position"
                    key={ev.id}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-5 py-3 flex items-center justify-between gap-3 bg-white"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#141414] truncate">
                        {ev.participant_name}
                      </div>
                      <div className="text-xs font-medium text-[#525866] tabular-nums">
                        {new Date(ev.created_at).toLocaleTimeString('fr-FR')} · {ev.admin_name}
                      </div>
                    </div>
                    <div
                      className={`font-mono-tabular text-base font-bold shrink-0 ${
                        ev.delta > 0
                          ? 'text-emerald-700'
                          : ev.delta < 0
                            ? 'text-[#EA4C2A]'
                            : 'text-[#525866]'
                      }`}
                    >
                      {ev.delta > 0 ? `+${ev.delta}` : ev.delta}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {recentEvents.length === 0 && (
                <div className="p-6 text-sm font-medium text-[#525866] text-center">
                  Aucune opération enregistrée.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
