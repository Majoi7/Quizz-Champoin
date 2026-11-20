import { Link } from 'react-router-dom';
import { ArrowRight, Award, QrCode, Shield, Star, Tv, UserPlus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PublicHeader } from '../components/PublicHeader';
import { Avatar } from '../components/Avatar';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { QuizTiles } from '../components/QuizTiles';
import { useQuiz } from '../context/QuizContext';

const STATUS_TEXT: Record<string, string> = {
  PREPARATION: 'Préparation',
  LIVE: 'En direct',
  PAUSED: 'En pause',
  FINISHED: 'Terminée',
};

export function HomePage() {
  const { competition, participants, loading } = useQuiz();

  const activeParticipants = participants.filter((p) => p.status !== 'DISQUALIFIED');
  const leader = activeParticipants[0] ?? null;
  const topThree = activeParticipants.slice(0, 3);
  const registerUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/inscription` : '/inscription';

  return (
    <div className="min-h-screen bg-[#F4F7F7] text-[#141414] flex flex-col">
      <PublicHeader />

      <main className="flex-1">
        {/* Sunny Mustard-Yellow Stage Hero with Curved Wave Horizon */}
        <section className="relative bg-[#F4C424] pt-8 sm:pt-12 pb-16 sm:pb-20 overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
                <div className="flex flex-wrap items-center gap-4">
                  <QuizTiles />
                  <div className="text-sm font-bold text-[#141414]/85 tracking-wide">
                    <span>{competition?.round_title ?? 'Manche 1'}</span>
                    <span className="mx-2 text-[#141414]/40" aria-hidden="true">·</span>
                    <span>{STATUS_TEXT[competition?.status ?? 'PREPARATION']}</span>
                  </div>
                </div>

                <h1
                  className="font-display font-bold text-[#141414] leading-[1.03] tracking-tight"
                  style={{ fontSize: 'clamp(2.35rem, 4.4vw, 3.85rem)', textWrap: 'balance' }}
                >
                  {competition?.name ?? 'QUIZ CHAMPION LIVE'}
                </h1>

                <p className="text-base sm:text-lg font-medium text-[#141414]/85 max-w-xl">
                  Inscrivez-vous en quelques secondes et suivez les scores en direct sur le plateau.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-1">
                  <Link
                    to="/inscription"
                    className="inline-flex items-center gap-2.5 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#141414] tactile-btn whitespace-nowrap shrink-0"
                  >
                    <UserPlus className="h-4 w-4 text-[#EA4C2A]" />
                    <span>Rejoindre la compétition</span>
                  </Link>
                  <Link
                    to="/live"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#141414] px-5 py-3 text-sm font-bold text-white border-2 border-[#141414] shadow-[0_3px_0_rgba(20,20,20,0.35)] hover:bg-[#262626] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Tv className="h-4 w-4 text-[#F4C424]" />
                    <span>Ouvrir l&apos;Écran Live</span>
                  </Link>
                  <Link
                    to="/classement"
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-[#141414] hover:text-[#EA4C2A] transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>Classement</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Right Tactile Leader / Stage Preview Card */}
              <div className="lg:col-span-5">
                <div className="rounded-3xl bg-white p-6 tactile-card space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-sm font-bold uppercase tracking-wider text-[#525866]">
                      En tête du plateau
                    </span>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#F4C424] border-2 border-[#141414]">
                      <Star className="h-4 w-4 fill-[#141414] text-[#141414]" />
                    </span>
                  </div>

                  {leader ? (
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#FFFDF2] border-2 border-[#141414] p-4">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <Avatar
                          firstName={leader.first_name}
                          lastName={leader.last_name}
                          avatarUrl={leader.avatar_url}
                          size="lg"
                          rank={1}
                        />
                        <div className="min-w-0">
                          <div className="font-display text-xl font-bold text-[#141414] truncate">
                            {leader.first_name} {leader.last_name}
                          </div>
                          {leader.nickname && (
                            <div className="text-xs font-medium text-[#525866] truncate">
                              {leader.nickname}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display text-3xl font-bold text-[#141414] tabular-nums">
                          {leader.score}
                        </div>
                        <div className="text-xs font-bold text-[#525866]">POINTS</div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-[#F4F7F7] border-2 border-dashed border-[#141414]/25 p-5 text-center space-y-1.5">
                      <div className="font-display text-lg font-bold text-[#141414]">
                        Plateau prêt
                      </div>
                      <p className="text-xs text-[#525866]">
                        Les candidats inscrits s&apos;affichent ici en temps réel.
                      </p>
                    </div>
                  )}

                  {/* 4-metric mini grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-[#F4F7F7] border border-[#141414]/15 p-3">
                      <div className="text-xs font-medium text-[#525866]">Candidats</div>
                      <div className="mt-0.5 font-display text-2xl font-bold text-[#141414] tabular-nums">
                        {loading ? '—' : activeParticipants.length}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F4F7F7] border border-[#141414]/15 p-3">
                      <div className="text-xs font-medium text-[#525866]">Barème</div>
                      <div className="mt-0.5 font-display text-2xl font-bold text-[#141414] tabular-nums">
                        +{competition?.points_correct ?? 10} / {competition?.points_wrong ?? -5}
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F4F7F7] border border-[#141414]/15 p-3">
                      <div className="text-xs font-medium text-[#525866]">Bonus</div>
                      <div className="mt-0.5 font-display text-2xl font-bold text-[#EA4C2A] tabular-nums">
                        +{competition?.points_bonus ?? 20} pts
                      </div>
                    </div>
                    <div className="rounded-xl bg-[#F4F7F7] border border-[#141414]/15 p-3">
                      <div className="text-xs font-medium text-[#525866]">Inscriptions</div>
                      <div className="mt-0.5 font-display text-xl font-bold text-[#141414]">
                        {competition?.registrations_open ? 'Ouvertes' : 'Fermées'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Smooth curved white wave separating yellow stage from light canvas */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 leading-none">
            <svg
              viewBox="0 0 1440 72"
              preserveAspectRatio="none"
              className="w-full h-9 sm:h-12 fill-[#F4F7F7]"
              aria-hidden="true"
            >
              <path d="M0,18 C360,72 1080,72 1440,18 L1440,72 L0,72 Z" />
            </svg>
          </div>
        </section>

        {/* Podium Preview + QR Quick Join */}
        <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Top 3 Standings */}
            <div className="lg:col-span-8 space-y-5">
              <div className="flex items-end justify-between gap-4">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141414]">
                  Classement provisoire
                </h2>
                <Link
                  to="/classement"
                  className="text-sm font-bold text-[#141414] hover:text-[#EA4C2A] underline decoration-[#F4C424] decoration-2 underline-offset-4 whitespace-nowrap"
                >
                  Classement complet
                </Link>
              </div>

              {topThree.length === 0 ? (
                <div className="rounded-2xl bg-white p-8 text-center tactile-card space-y-3">
                  <p className="text-sm font-medium text-[#525866]">
                    Aucun participant inscrit pour le moment.
                  </p>
                  <Link
                    to="/inscription"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] px-5 py-2.5 text-sm font-bold text-[#141414] tactile-btn"
                  >
                    Devenir le premier candidat
                  </Link>
                </div>
              ) : (
                <div className="divide-y-2 divide-[#141414]/10 rounded-2xl bg-white overflow-hidden tactile-card">
                  {topThree.map((p) => (
                    <Link
                      key={p.id}
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
                                : 'bg-[#EA4C2A] text-white'
                          }`}
                        >
                          {p.rank}
                        </span>
                        <Avatar
                          firstName={p.first_name}
                          lastName={p.last_name}
                          avatarUrl={p.avatar_url}
                          rank={p.rank}
                        />
                        <div className="min-w-0">
                          <div className="font-display text-lg font-bold text-[#141414] truncate">
                            {p.first_name} {p.last_name}
                          </div>
                          {p.nickname && (
                            <div className="text-xs font-medium text-[#525866] truncate">
                              {p.nickname}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <AnimatedCounter
                          value={p.score}
                          className="text-2xl font-bold text-[#141414]"
                        />
                        <span className="ml-1.5 text-xs font-bold text-[#525866]">pts</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* QR Registration Card + Regie Access */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl bg-white p-6 space-y-4 tactile-card">
                <div className="flex items-center gap-2 text-sm font-bold text-[#141414]">
                  <QrCode className="h-4 w-4 text-[#EA4C2A]" />
                  <span>Inscription QR Code</span>
                </div>
                <p className="text-xs text-[#525866]">
                  Scannez pour rejoindre la partie avec 0 pt.
                </p>
                <div className="flex justify-center rounded-xl border-2 border-[#141414]/15 bg-[#F4F7F7] p-4">
                  <QRCodeSVG value={registerUrl} size={156} level="M" />
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-[#525866] pt-1">
                  <span className="truncate">{registerUrl}</span>
                  <Link
                    to="/inscription"
                    className="font-bold text-[#141414] hover:text-[#EA4C2A] underline decoration-[#F4C424] decoration-2 whitespace-nowrap shrink-0"
                  >
                    Ouvrir
                  </Link>
                </div>
              </div>

              <div className="rounded-2xl bg-[#98C1BF] p-5 flex items-center justify-between gap-4 tactile-card">
                <div className="flex items-center gap-2 text-sm font-bold text-[#141414]">
                  <Shield className="h-4 w-4 text-[#141414]" />
                  <span>Régie & Animation</span>
                </div>
                <Link
                  to="/admin/login"
                  className="rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#141414] tactile-btn whitespace-nowrap shrink-0"
                >
                  Connexion
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t-2 border-[#141414] bg-white py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-[#525866]">
          <div className="flex items-center gap-2 text-[#141414]">
            <Award className="h-4 w-4 text-[#EA4C2A]" />
            <span className="font-display font-bold">QUIZ CHAMPION LIVE</span>
          </div>
          <div className="flex items-center gap-5">
            <Link to="/live" className="hover:text-[#141414]">
              Écran Live
            </Link>
            <Link to="/classement" className="hover:text-[#141414]">
              Classement
            </Link>
            <Link to="/admin/login" className="hover:text-[#141414]">
              Administration
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
