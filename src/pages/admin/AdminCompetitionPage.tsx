import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Pause,
  Play,
  RotateCcw,
  Save,
  Square,
  Timer,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { useQuiz } from '../../context/QuizContext';
import { quizApi } from '../../services/api';
import type { CompetitionStatus } from '../../types/quiz';

export function AdminCompetitionPage() {
  const { competition } = useQuiz();

  const [name, setName] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [currentRound, setCurrentRound] = useState(1);
  const [roundTitle, setRoundTitle] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [confirmResetMode, setConfirmResetMode] = useState<'scores' | 'full' | null>(null);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!competition) return;
    setName(competition.name);
    setSubtitle(competition.subtitle);
    setCurrentRound(competition.current_round);
    setRoundTitle(competition.round_title);
  }, [competition]);

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInfo(true);
    try {
      await quizApi.adminUpdateCompetition({
        name,
        subtitle,
        current_round: Number(currentRound),
        round_title: roundTitle,
      });
      setSavedMsg(true);
      window.setTimeout(() => setSavedMsg(false), 2500);
    } finally {
      setSavingInfo(false);
    }
  };

  const changeStatus = async (status: CompetitionStatus) => {
    await quizApi.adminUpdateCompetition({ status });
  };

  const controlQuestionTimer = async (action: 'START' | 'PAUSE' | 'RESET') => {
    await quizApi.adminUpdateCompetition({ question_timer_action: action });
  };

  const handleConfirmReset = async () => {
    if (!confirmResetMode) return;
    setResetting(true);
    try {
      await quizApi.adminResetCompetition(confirmResetMode);
      setConfirmResetMode(null);
    } finally {
      setResetting(false);
    }
  };

  return (
    <AdminLayout title="Contrôle de la compétition">
      <div className="max-w-4xl space-y-8">
        {/* Status & Lifecycle Controls */}
        <section className="rounded-2xl bg-white p-6 space-y-5 tactile-card">
          <h2 className="font-display text-2xl font-bold text-[#141414]">Statut de la partie</h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              type="button"
              onClick={() => changeStatus('PREPARATION')}
              className={`rounded-xl px-4 py-3 text-sm font-bold tactile-btn ${
                competition?.status === 'PREPARATION'
                  ? 'bg-[#F4C424] text-[#141414]'
                  : 'bg-[#F4F7F7] text-[#525866] hover:text-[#141414]'
              }`}
            >
              Préparation
            </button>

            <button
              type="button"
              onClick={() => changeStatus('LIVE')}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold tactile-btn ${
                competition?.status === 'LIVE'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#F4F7F7] text-[#525866] hover:text-[#141414]'
              }`}
            >
              <Play className="h-4 w-4" />
              <span>En direct</span>
            </button>

            <button
              type="button"
              onClick={() => changeStatus('PAUSED')}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold tactile-btn ${
                competition?.status === 'PAUSED'
                  ? 'bg-[#8ABBB9] text-[#141414]'
                  : 'bg-[#F4F7F7] text-[#525866] hover:text-[#141414]'
              }`}
            >
              <Pause className="h-4 w-4" />
              <span>En pause</span>
            </button>

            <button
              type="button"
              onClick={() => changeStatus('FINISHED')}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold tactile-btn ${
                competition?.status === 'FINISHED'
                  ? 'bg-[#141414] text-white'
                  : 'bg-[#F4F7F7] text-[#525866] hover:text-[#141414]'
              }`}
            >
              <Square className="h-4 w-4" />
              <span>Terminée</span>
            </button>
          </div>
        </section>

        {/* Question Timer Remote Control */}
        <section className="rounded-2xl bg-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 tactile-card">
          <div className="flex items-center gap-2.5 font-display text-xl font-bold text-[#141414]">
            <Timer className="h-5 w-5 text-[#EA4C2A]" />
            <span>Chrono question ({competition?.question_timer_seconds ?? 30}s)</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => controlQuestionTimer('START')}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white tactile-btn"
            >
              Lancer ({competition?.question_timer_seconds ?? 30}s)
            </button>
            <button
              type="button"
              onClick={() => controlQuestionTimer('PAUSE')}
              className="rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#141414] tactile-btn"
            >
              Arrêter
            </button>
            <button
              type="button"
              onClick={() => controlQuestionTimer('RESET')}
              className="rounded-xl bg-[#F4F7F7] px-3.5 py-2 text-xs font-bold text-[#141414] tactile-btn"
            >
              Reset
            </button>
          </div>
        </section>

        {/* Competition Title & Round Editor */}
        <form onSubmit={handleSaveDetails} className="rounded-2xl bg-white p-6 space-y-5 tactile-card">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-[#141414]">
              Identité & Manche active
            </h2>
            {savedMsg && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                <Check className="h-4 w-4" /> Enregistré
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="comp-name" className="block text-xs font-bold text-[#141414] mb-1">
                Nom de la compétition
              </label>
              <input
                id="comp-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-medium text-[#141414]"
              />
            </div>

            <div>
              <label htmlFor="comp-sub" className="block text-xs font-bold text-[#141414] mb-1">
                Sous-titre / Édition
              </label>
              <input
                id="comp-sub"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-medium text-[#141414]"
              />
            </div>

            <div>
              <label
                htmlFor="comp-round-num"
                className="block text-xs font-bold text-[#141414] mb-1"
              >
                Numéro de manche
              </label>
              <input
                id="comp-round-num"
                type="number"
                min={1}
                value={currentRound}
                onChange={(e) => setCurrentRound(Number(e.target.value))}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-mono-tabular font-bold text-[#141414]"
              />
            </div>

            <div>
              <label
                htmlFor="comp-round-title"
                className="block text-xs font-bold text-[#141414] mb-1"
              >
                Intitulé de la manche
              </label>
              <input
                id="comp-round-title"
                type="text"
                value={roundTitle}
                onChange={(e) => setRoundTitle(e.target.value)}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-medium text-[#141414]"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingInfo}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] px-5 py-2.5 text-sm font-bold text-[#141414] tactile-btn disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              <span>{savingInfo ? 'Mise à jour...' : 'Mettre à jour'}</span>
            </button>
          </div>
        </form>

        {/* Danger Zone: Reset */}
        <section className="rounded-2xl bg-[#FADAD2] p-6 space-y-4 tactile-card">
          <div className="flex items-center gap-2 text-[#141414]">
            <AlertTriangle className="h-5 w-5 text-[#EA4C2A]" />
            <h2 className="font-display text-2xl font-bold">Réinitialisation de la compétition</h2>
          </div>
          <p className="text-xs font-semibold text-[#525866]">
            Actions irréversibles synchronisées en direct.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setConfirmResetMode('scores')}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#141414] tactile-btn"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Remettre tous les scores à 0</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmResetMode('full')}
              className="inline-flex items-center gap-2 rounded-xl bg-[#EA4C2A] px-4 py-2.5 text-sm font-bold text-white tactile-btn"
            >
              <span>Réinitialiser toute la compétition (vider la liste)</span>
            </button>
          </div>
        </section>
      </div>

      {confirmResetMode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-dialog-title"
          className="fixed inset-0 z-50 bg-[#141414]/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 tactile-card">
            <h2 id="reset-dialog-title" className="font-display text-2xl font-bold text-[#141414]">
              {confirmResetMode === 'full'
                ? 'Réinitialiser toute la compétition ?'
                : 'Remettre tous les scores à 0 ?'}
            </h2>
            <p className="text-sm font-medium text-[#525866]">
              {confirmResetMode === 'full'
                ? "Tous les participants et tout l'historique des scores seront supprimés."
                : "Les participants restent inscrits, mais tous les scores et l'historique seront remis à zéro."}
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmResetMode(null)}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#141414] tactile-btn"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={resetting}
                onClick={handleConfirmReset}
                className="rounded-xl bg-[#EA4C2A] px-4 py-2 text-sm font-bold text-white tactile-btn disabled:opacity-60"
              >
                {resetting ? 'Réinitialisation...' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
