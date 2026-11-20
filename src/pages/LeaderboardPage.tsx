import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGroup, motion } from 'motion/react';
import { Download, Search, Tv } from 'lucide-react';
import { PublicHeader } from '../components/PublicHeader';
import { Avatar } from '../components/Avatar';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { useQuiz } from '../context/QuizContext';
import { buildLeaderboardCsv } from '../lib/ranking';

const TIE_BREAKER_LABEL: Record<string, string> = {
  EARLIEST_REACHED: 'Premier candidat ayant atteint le score',
  ALPHABETICAL: 'Ordre alphabétique',
  JOIN_ORDER: "Ordre d'inscription",
};

export function LeaderboardPage() {
  const { competition, participants, recentEvents, loading } = useQuiz();
  const [query, setQuery] = useState('');

  const filtered = participants.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      (p.nickname ?? '').toLowerCase().includes(q)
    );
  });

  const handleExportCsv = () => {
    const csv = buildLeaderboardCsv(participants, recentEvents);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'classement-quiz-champion-live.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F4F7F7] text-[#141414] flex flex-col">
      <PublicHeader />

      {/* Sunny Yellow Curved Banner */}
      <section className="relative bg-[#F4C424] pt-7 pb-12">
        <div className="mx-auto max-w-5xl w-full px-4 sm:px-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#141414]/80">
              {competition?.name ?? 'QUIZ CHAMPION LIVE'}
            </div>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-[#141414]">
              Classement général
            </h1>
            <p className="mt-1 text-xs font-semibold text-[#141414]/75">
              Égalité : {TIE_BREAKER_LABEL[competition?.tie_breaker ?? 'EARLIEST_REACHED']}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#141414] tactile-btn whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exporter CSV</span>
            </button>
            <Link
              to="/live"
              className="inline-flex items-center gap-2 rounded-xl bg-[#141414] px-4 py-2 text-xs font-bold text-white border-2 border-[#141414] hover:bg-[#262626] whitespace-nowrap"
            >
              <Tv className="h-3.5 w-3.5 text-[#F4C424]" />
              <span>Vue Plateau</span>
            </Link>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 leading-none">
          <svg
            viewBox="0 0 1440 48"
            preserveAspectRatio="none"
            className="w-full h-6 sm:h-8 fill-[#F4F7F7]"
            aria-hidden="true"
          >
            <path d="M0,12 C360,48 1080,48 1440,12 L1440,48 L0,48 Z" />
          </svg>
        </div>
      </section>

      <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6 sm:px-6 space-y-5">
        <div className="relative">
          <Search className="h-4 w-4 text-[#525866] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un candidat par nom ou pseudonyme..."
            aria-label="Rechercher un candidat"
            className="w-full rounded-xl border-2 border-[#141414] bg-white pl-11 pr-4 py-2.5 text-sm font-medium text-[#141414] placeholder:text-[#767D8A] focus:outline-none focus:ring-2 focus:ring-[#F4C424]"
          />
        </div>

        {loading ? (
          <div className="space-y-3" aria-label="Chargement du classement">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-[72px] rounded-2xl border-2 border-[#141414]/15 bg-white animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center text-sm font-medium text-[#525866] tactile-card">
            Aucun candidat ne correspond à votre recherche.
          </div>
        ) : (
          <LayoutGroup id="public-leaderboard">
            <div className="rounded-2xl bg-white overflow-hidden divide-y-2 divide-[#141414]/10 tactile-card">
              {filtered.map((p) => (
                <motion.div
                  layout="position"
                  key={p.id}
                  transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                  className="bg-white"
                >
                  <Link
                    to={`/participant/${p.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#FFFDF2] transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#141414] font-display text-base font-bold tabular-nums shrink-0 ${
                          p.rank === 1
                            ? 'bg-[#F4C424] text-[#141414]'
                            : p.rank === 2
                              ? 'bg-[#8ABBB9] text-[#141414]'
                              : p.rank === 3
                                ? 'bg-[#EA4C2A] text-white'
                                : 'bg-[#F4F7F7] text-[#525866]'
                        }`}
                      >
                        {p.rank ? p.rank : 'DQ'}
                      </span>
                      <Avatar
                        firstName={p.first_name}
                        lastName={p.last_name}
                        avatarUrl={p.avatar_url}
                        size="md"
                        rank={p.rank}
                      />
                      <div className="min-w-0">
                        <div className="font-display text-lg font-bold text-[#141414] truncate">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="text-xs font-medium text-[#525866] truncate">
                          {p.nickname ? p.nickname : 'Candidat'}
                          {p.status === 'PAUSED' ? ' · En pause' : ''}
                          {p.status === 'DISQUALIFIED' ? ' · Disqualifié' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <AnimatedCounter
                        value={p.score}
                        className="text-2xl font-bold text-[#141414]"
                      />{' '}
                      <span className="text-xs font-bold text-[#525866]">pts</span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </LayoutGroup>
        )}
      </main>
    </div>
  );
}
