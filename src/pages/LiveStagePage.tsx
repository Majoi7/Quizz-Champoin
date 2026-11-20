import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  Crown,
  Maximize2,
  Minimize2,
  QrCode,
  Sliders,
  Timer,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Avatar } from '../components/Avatar';
import { AnimatedCounter } from '../components/AnimatedCounter';
import { QuizTiles } from '../components/QuizTiles';
import { useQuiz } from '../context/QuizContext';
import {
  computeElapsedSeconds,
  computeQuestionTimerRemaining,
  formatDuration,
} from '../lib/ranking';

const STATUS_BADGE: Record<string, { label: string; dot: string }> = {
  PREPARATION: { label: 'PRÉPARATION', dot: 'bg-[#525866]' },
  LIVE: { label: 'EN DIRECT', dot: 'bg-emerald-500 animate-pulse' },
  PAUSED: { label: 'EN PAUSE', dot: 'bg-[#EA4C2A]' },
  FINISHED: { label: 'TERMINÉ', dot: 'bg-[#141414]' },
};

const CONFETTI_OFFSETS = [
  { x: -38, y: -32, color: '#10B981' },
  { x: 42, y: -28, color: '#F4C424' },
  { x: -24, y: 24, color: '#8ABBB9' },
  { x: 34, y: 22, color: '#EA4C2A' },
  { x: 0, y: -44, color: '#F4C424' },
];

export function LiveStagePage() {
  const {
    competition,
    participants,
    lastScoreBurst,
    serverTimeOffsetMs,
    soundEnabled,
    toggleSound,
  } = useQuiz();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore fullscreen denial in embedded sandboxes
    }
  };

  const serverNowMs = nowMs + serverTimeOffsetMs;
  const elapsedSec = competition ? computeElapsedSeconds(competition, serverNowMs) : 0;
  const questionRemaining = competition
    ? computeQuestionTimerRemaining(competition, serverNowMs)
    : 0;

  const activeParticipants = participants.filter((p) => p.status !== 'DISQUALIFIED');
  const topThree = activeParticipants.slice(0, 3);
  const remainingParticipants = activeParticipants.slice(3);
  const statusMeta = STATUS_BADGE[competition?.status ?? 'PREPARATION'];

  // Desktop Olympic podium ordering: [#2 left, #1 elevated center, #3 right] when >= 3
  const podiumList =
    topThree.length === 3 ? [topThree[1], topThree[0], topThree[2]] : topThree;

  const registerUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/inscription` : '/inscription';

  const burstParticipantId = lastScoreBurst?.event.participant_id;
  const burstDelta = lastScoreBurst?.event.delta ?? 0;

  return (
    <LayoutGroup id="live-stage-leaderboard">
      <div
        data-testid="live-stage"
        data-game-status={competition?.status ?? 'PREPARATION'}
        className="min-h-screen bg-white text-[#141414] flex flex-col relative overflow-x-hidden"
      >
      {/* Upper Sunny Yellow Curved Stage (Header + Score Burst + Top-3 Podium) */}
      <section className="relative bg-[#F4C424] pb-16 sm:pb-20">
        {/* Broadcast Header Bar */}
        <header className="relative z-20 px-4 sm:px-8 pt-4 pb-3">
          <div className="mx-auto max-w-[1440px] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <Link
                to="/"
                aria-label="Retour à l'accueil"
                className="hidden sm:inline-flex shrink-0 hover:scale-105 transition-transform"
              >
                <QuizTiles compact />
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold text-[#141414]/85">
                  <span className="inline-flex items-center gap-1.5 tracking-wider">
                    {competition?.status === 'LIVE' && (
                      <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} />
                    )}
                    <span>{statusMeta.label}</span>
                  </span>
                  <span className="text-[#141414]/40" aria-hidden="true">·</span>
                  <span className="truncate">{competition?.round_title ?? 'Manche 1'}</span>
                </div>
                <h1 className="font-display text-lg sm:text-2xl font-bold tracking-tight text-[#141414] truncate">
                  {competition?.name ?? 'QUIZ CHAMPION LIVE'}
                </h1>
              </div>
            </div>

            {/* Broadcast Controls */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-2 rounded-xl border-2 border-[#141414] bg-white px-3 py-1.5 text-xs font-bold text-[#141414]">
                <Users className="h-3.5 w-3.5 text-[#EA4C2A]" />
                <span className="font-mono-tabular">{activeParticipants.length}</span>
                <span className="text-[#525866]">candidats</span>
              </div>

              <button
                type="button"
                onClick={toggleSound}
                aria-label={soundEnabled ? 'Couper les effets sonores' : 'Activer les effets sonores'}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl tactile-btn ${
                  soundEnabled ? 'bg-[#8ABBB9] text-[#141414]' : 'bg-white text-[#525866]'
                }`}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                aria-label="Afficher le QR Code d'inscription"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-3.5 text-xs font-bold text-[#141414] tactile-btn"
              >
                <QrCode className="h-4 w-4 text-[#EA4C2A]" />
                <span className="hidden md:inline">Rejoindre</span>
              </button>

              <button
                type="button"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Quitter le plein écran' : 'Passer en plein écran'}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#141414] tactile-btn"
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>

              <Link
                to="/admin/participants"
                aria-label="Ouvrir la régie administrateur"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#141414] px-3.5 text-xs font-bold text-white border-2 border-[#141414] hover:bg-[#262626] transition-colors"
              >
                <Sliders className="h-3.5 w-3.5 text-[#F4C424]" />
                <span className="hidden md:inline">Régie</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Live Score Event Notification Banner */}
        <div className="relative z-20 mx-auto w-full max-w-[1440px] px-4 sm:px-8 pt-2 min-h-[64px]">
          <AnimatePresence mode="wait">
            {lastScoreBurst ? (
              <motion.div
                key={lastScoreBurst.event.id}
                initial={{ opacity: 0, y: -12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                data-testid="live-score-banner"
                className={`rounded-2xl px-5 py-3 flex flex-wrap items-center justify-between gap-4 tactile-card ${
                  lastScoreBurst.event.delta > 0
                    ? 'bg-emerald-50 text-[#141414]'
                    : lastScoreBurst.event.delta < 0
                      ? 'bg-[#FADAD2] text-[#141414]'
                      : 'bg-white text-[#141414]'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span
                    className={`font-display text-3xl font-bold tabular-nums ${
                      lastScoreBurst.event.delta > 0
                        ? 'text-emerald-700'
                        : lastScoreBurst.event.delta < 0
                          ? 'text-[#EA4C2A]'
                          : 'text-[#141414]'
                    }`}
                  >
                    {lastScoreBurst.event.delta > 0
                      ? `+${lastScoreBurst.event.delta}`
                      : lastScoreBurst.event.delta}{' '}
                    PTS
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-xl font-bold text-[#141414] truncate">
                      {lastScoreBurst.event.participant_name}
                    </div>
                    <div className="text-xs font-semibold text-[#525866]">
                      {lastScoreBurst.event.reason === 'BONUS'
                        ? 'Bonus'
                        : lastScoreBurst.event.reason === 'CORRECT'
                          ? 'Bonne réponse'
                          : lastScoreBurst.event.reason === 'WRONG'
                            ? 'Mauvaise réponse'
                            : lastScoreBurst.event.reason === 'UNDO'
                              ? 'Annulation'
                              : 'Score modifié'}{' '}
                      · Total : {lastScoreBurst.event.new_score} pts
                    </div>
                  </div>
                </div>

                {lastScoreBurst.newLeaderId && (
                  <div className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] border-2 border-[#141414] px-3.5 py-1.5 text-sm font-bold text-[#141414]">
                    <Crown className="h-4 w-4" />
                    <span>Nouveau leader !</span>
                  </div>
                )}
              </motion.div>
            ) : competition?.status === 'PAUSED' ? (
              <motion.div
                key="paused-banner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-2xl bg-white px-5 py-3 text-center text-sm font-bold text-[#141414] tactile-card"
              >
                Partie en pause — scores figés
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Finished Champion Banner + Top 3 Center-Elevated Podium */}
        <div className="relative z-10 mx-auto w-full max-w-[1440px] px-4 sm:px-8 pt-4 space-y-6">
          {competition?.status === 'FINISHED' && topThree.length > 0 && (
            <motion.section
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl bg-white p-6 text-center space-y-2 tactile-card"
            >
              <div className="inline-flex items-center gap-2 text-[#EA4C2A] text-sm font-bold tracking-wider">
                <Trophy className="h-5 w-5" />
                <span>COMPÉTITION TERMINÉE — CHAMPION OFFICIEL</span>
              </div>
              <h2 className="font-display text-3xl sm:text-5xl font-bold text-[#141414]">
                {topThree[0].first_name} {topThree[0].last_name}
              </h2>
              <div className="font-mono-tabular text-2xl sm:text-3xl font-bold text-[#141414]">
                {topThree[0].score} POINTS
              </div>
            </motion.section>
          )}

          {activeParticipants.length === 0 ? (
            <div className="rounded-3xl bg-white p-10 sm:p-14 text-center space-y-4 tactile-card max-w-2xl mx-auto">
              <h2 className="font-display text-3xl font-bold text-[#141414]">
                En attente des candidats
              </h2>
              <p className="text-sm font-medium text-[#525866] max-w-md mx-auto">
                Les participants apparaîtront ici dès leur inscription.
              </p>
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] px-5 py-2.5 text-sm font-bold text-[#141414] tactile-btn"
              >
                <QrCode className="h-4 w-4" />
                <span>Afficher le QR Code d&apos;inscription</span>
              </button>
            </div>
          ) : (
            <section
              aria-label="Podium en direct"
              className={`grid grid-cols-1 gap-5 items-end ${
                podiumList.length === 1
                  ? 'md:grid-cols-1 max-w-md mx-auto'
                  : podiumList.length === 2
                    ? 'md:grid-cols-2 max-w-3xl mx-auto'
                    : 'md:grid-cols-3'
              }`}
            >
              {podiumList.map((p) => {
                const isHit = burstParticipantId === p.id;
                const isGain = isHit && burstDelta > 0;
                const isLoss = isHit && burstDelta < 0;

                const isFirst = p.rank === 1;
                const cardBg = isFirst
                  ? 'bg-[#FFFDF2] champion-glow md:-translate-y-3'
                  : p.rank === 2
                    ? 'bg-[#EEF7F6]'
                    : 'bg-white';

                const orderClass =
                  topThree.length === 3
                    ? p.rank === 1
                      ? 'order-1 md:order-2'
                      : p.rank === 2
                        ? 'order-2 md:order-1'
                        : 'order-3'
                    : '';

                return (
                  <motion.div
                    layout="position"
                    layoutId={`live-card-${p.id}`}
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{
                      layout: { type: 'spring', stiffness: 320, damping: 28, mass: 0.9 },
                      opacity: { duration: 0.22 },
                    }}
                    data-testid={`live-card-${p.id}`}
                    className={`relative rounded-3xl p-5 sm:p-6 tactile-card ${cardBg} ${orderClass} ${
                      isGain ? 'ring-4 ring-emerald-400' : ''
                    } ${isLoss ? 'ring-4 ring-[#EA4C2A] animate-stage-shake' : ''}`}
                  >
                    <AnimatePresence>
                      {isHit && (
                        <motion.div
                          key={`burst-${lastScoreBurst?.event.id}`}
                          initial={{ opacity: 0, y: 12, scale: 0.8 }}
                          animate={{ opacity: 1, y: -12, scale: 1.15 }}
                          exit={{ opacity: 0, y: -32 }}
                          transition={{ duration: 0.45 }}
                          className={`pointer-events-none absolute right-5 top-4 z-20 font-display text-4xl font-bold tabular-nums ${
                            burstDelta > 0 ? 'text-emerald-600' : 'text-[#EA4C2A]'
                          }`}
                        >
                          {burstDelta > 0 ? `+${burstDelta}` : burstDelta}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {isGain &&
                      CONFETTI_OFFSETS.map((dot, idx) => (
                        <motion.span
                          key={`conf-${lastScoreBurst?.event.id}-${idx}`}
                          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                          animate={{ opacity: 0, x: dot.x, y: dot.y, scale: 0.4 }}
                          transition={{ duration: 0.75, ease: 'easeOut' }}
                          style={{ backgroundColor: dot.color }}
                          className="pointer-events-none absolute right-10 top-8 h-2.5 w-2.5 rounded-full"
                        />
                      ))}

                    <div className="flex flex-col items-center text-center space-y-3 pt-1">
                      <Avatar
                        firstName={p.first_name}
                        lastName={p.last_name}
                        avatarUrl={p.avatar_url}
                        size={isFirst ? 'xl' : 'lg'}
                        rank={p.rank}
                      />

                      <div className="min-w-0 w-full">
                        <div className="text-xs font-bold tracking-wider uppercase text-[#525866]">
                          {p.rank === 1
                            ? '1er · Leader'
                            : p.rank === 2
                              ? '2ème place'
                              : '3ème place'}
                          {p.status === 'PAUSED' ? ' · En pause' : ''}
                        </div>
                        <h2 className="mt-0.5 font-display text-2xl sm:text-3xl font-bold text-[#141414] truncate">
                          {p.first_name} {p.last_name}
                        </h2>
                        {p.nickname && (
                          <div className="text-xs font-semibold text-[#525866] truncate">
                            {p.nickname}
                          </div>
                        )}
                      </div>

                      <div className="w-full pt-3 border-t-2 border-[#141414]/10 flex items-baseline justify-center gap-2">
                        <AnimatedCounter
                          value={p.score}
                          className={`font-display font-bold ${
                            isFirst ? 'text-5xl text-[#141414]' : 'text-4xl text-[#141414]'
                          } ${isGain ? 'text-emerald-700' : ''} ${isLoss ? 'text-[#EA4C2A]' : ''}`}
                        />
                        <span className="text-xs font-bold text-[#525866]">PTS</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </section>
          )}
        </div>

        {/* Curved White Horizon Wave */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 leading-none">
          <svg
            viewBox="0 0 1440 72"
            preserveAspectRatio="none"
            className="w-full h-10 sm:h-14 fill-white"
            aria-hidden="true"
          >
            <path d="M0,18 C360,72 1080,72 1440,18 L1440,72 L0,72 Z" />
          </svg>
        </div>

        {/* Centered Outlined Chronometer Capsule Straddling the Horizon */}
        <div className="absolute left-1/2 -bottom-5 -translate-x-1/2 z-20 flex items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#141414] bg-white px-5 py-2 shadow-[0_3px_0_#141414]">
            <span className="font-mono-tabular text-lg font-bold text-[#141414]">
              {formatDuration(elapsedSec)}
            </span>
          </div>
          {competition?.question_timer_running && (
            <div
              className={`inline-flex items-center gap-1.5 rounded-full border-2 border-[#141414] px-4 py-2 font-mono-tabular text-lg font-bold shadow-[0_3px_0_#141414] ${
                questionRemaining <= 5
                  ? 'bg-[#EA4C2A] text-white'
                  : 'bg-[#8ABBB9] text-[#141414]'
              }`}
            >
              <Timer className="h-4 w-4" />
              <span>{questionRemaining}s</span>
            </div>
          )}
        </div>
      </section>

      {/* Lower Crisp White Contenders Arena */}
      <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-8 pt-12 pb-12">
        {remainingParticipants.length > 0 ? (
          <section aria-label="Suite du classement" className="space-y-4">
            <h3 className="font-display text-lg font-bold tracking-wide text-[#525866]">
              Candidats suivants
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
              {remainingParticipants.map((p) => {
                const isHit = burstParticipantId === p.id;
                const isGain = isHit && burstDelta > 0;
                const isLoss = isHit && burstDelta < 0;

                return (
                  <motion.div
                    layout="position"
                    layoutId={`live-card-${p.id}`}
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{
                      layout: { type: 'spring', stiffness: 320, damping: 28, mass: 0.9 },
                      opacity: { duration: 0.2 },
                    }}
                    data-testid={`live-card-${p.id}`}
                    className={`relative rounded-2xl border-2 border-[#141414] px-5 py-3.5 flex items-center justify-between gap-4 shadow-[0_3px_0_#141414] ${
                      isGain
                        ? 'bg-emerald-50'
                        : isLoss
                          ? 'bg-[#FADAD2] animate-stage-shake'
                          : 'bg-[#F4F7F7]'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#141414] bg-white font-display text-base font-bold text-[#141414] tabular-nums shrink-0">
                        {p.rank}
                      </span>
                      <Avatar
                        firstName={p.first_name}
                        lastName={p.last_name}
                        avatarUrl={p.avatar_url}
                        size="md"
                      />
                      <div className="min-w-0">
                        <div className="font-display text-xl font-bold text-[#141414] truncate">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="text-xs font-medium text-[#525866] truncate">
                          {p.nickname ? p.nickname : 'Candidat'}
                          {p.status === 'PAUSED' ? ' · En pause' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <AnimatePresence>
                        {isHit && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1.1 }}
                            exit={{ opacity: 0 }}
                            className={`font-display text-2xl font-bold tabular-nums ${
                              burstDelta > 0 ? 'text-emerald-700' : 'text-[#EA4C2A]'
                            }`}
                          >
                            {burstDelta > 0 ? `+${burstDelta}` : burstDelta}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      <div className="text-right">
                        <AnimatedCounter
                          value={p.score}
                          className="font-display text-3xl font-bold text-[#141414]"
                        />{' '}
                        <span className="text-xs font-bold text-[#525866]">pts</span>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </section>
        ) : (
          activeParticipants.length > 0 && (
            <div className="text-center text-xs font-semibold text-[#525866]">
              Tous les candidats en lice sont affichés sur le podium.
            </div>
          )
        )}
      </main>

      {/* QR Code Registration Modal */}
      {showQrModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          className="fixed inset-0 z-50 bg-[#141414]/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 space-y-5 text-center tactile-card">
            <div className="flex items-center justify-between">
              <h2 id="qr-modal-title" className="font-display text-2xl font-bold text-[#141414]">
                Rejoindre la partie
              </h2>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                aria-label="Fermer la fenêtre QR Code"
                className="rounded-xl p-1.5 text-[#525866] hover:bg-[#F4F7F7] hover:text-[#141414]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="inline-block rounded-2xl border-2 border-[#141414]/15 bg-[#F4F7F7] p-4">
              <QRCodeSVG value={registerUrl} size={210} level="M" />
            </div>
            <p className="text-xs font-medium text-[#525866] break-all">{registerUrl}</p>
            <Link
              to="/inscription"
              className="block w-full rounded-xl bg-[#F4C424] px-4 py-2.5 text-sm font-bold text-[#141414] tactile-btn"
            >
              Ouvrir le formulaire d&apos;inscription
            </Link>
          </div>
        </div>
      )}
    </div>
    </LayoutGroup>
  );
}
