import React, { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { useQuiz } from '../../context/QuizContext';
import { quizApi } from '../../services/api';
import type { TieBreakerRule } from '../../types/quiz';

export function AdminSettingsPage() {
  const { competition } = useQuiz();

  const [pointsCorrect, setPointsCorrect] = useState(10);
  const [pointsWrong, setPointsWrong] = useState(-5);
  const [pointsBonus, setPointsBonus] = useState(20);
  const [tieBreaker, setTieBreaker] = useState<TieBreakerRule>('EARLIEST_REACHED');
  const [registrationsOpen, setRegistrationsOpen] = useState(true);
  const [requirePhone, setRequirePhone] = useState(false);
  const [confirmLargeDelta, setConfirmLargeDelta] = useState(true);
  const [largeDeltaThreshold, setLargeDeltaThreshold] = useState(20);
  const [questionTimerSeconds, setQuestionTimerSeconds] = useState(30);

  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!competition) return;
    setPointsCorrect(competition.points_correct);
    setPointsWrong(competition.points_wrong);
    setPointsBonus(competition.points_bonus);
    setTieBreaker(competition.tie_breaker);
    setRegistrationsOpen(competition.registrations_open);
    setRequirePhone(competition.require_phone);
    setConfirmLargeDelta(competition.confirm_large_delta);
    setLargeDeltaThreshold(competition.large_delta_threshold);
    setQuestionTimerSeconds(competition.question_timer_seconds);
  }, [competition]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedBanner(false);
    setSaving(true);
    try {
      await quizApi.adminUpdateCompetition({
        points_correct: Number(pointsCorrect),
        points_wrong: Number(pointsWrong),
        points_bonus: Number(pointsBonus),
        tie_breaker: tieBreaker,
        registrations_open: registrationsOpen,
        require_phone: requirePhone,
        confirm_large_delta: confirmLargeDelta,
        large_delta_threshold: Number(largeDeltaThreshold),
        question_timer_seconds: Number(questionTimerSeconds),
      });
      setSavedBanner(true);
      window.setTimeout(() => setSavedBanner(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="Barème des points & Règles">
      <form onSubmit={handleSave} className="max-w-3xl space-y-6">
        {error && (
          <div className="rounded-xl border-2 border-[#141414] bg-[#FADAD2] px-4 py-3 text-sm font-semibold text-[#141414]">
            {error}
          </div>
        )}
        {savedBanner && (
          <div className="rounded-xl border-2 border-[#141414] bg-emerald-50 px-4 py-3 text-sm font-bold text-[#141414] flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-700" />
            <span>Paramètres enregistrés et diffusés en direct.</span>
          </div>
        )}

        <section className="rounded-2xl bg-white p-6 space-y-5 tactile-card">
          <h2 className="font-display text-2xl font-bold text-[#141414]">Système de points</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label htmlFor="pts-correct" className="block text-sm font-bold text-emerald-700 mb-1.5">
                Bonne réponse (+)
              </label>
              <input
                id="pts-correct"
                type="number"
                value={pointsCorrect}
                onChange={(e) => setPointsCorrect(Number(e.target.value))}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-base font-mono-tabular font-bold text-[#141414]"
              />
            </div>

            <div>
              <label htmlFor="pts-wrong" className="block text-sm font-bold text-[#EA4C2A] mb-1.5">
                Mauvaise réponse (−)
              </label>
              <input
                id="pts-wrong"
                type="number"
                value={pointsWrong}
                onChange={(e) => setPointsWrong(Number(e.target.value))}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-base font-mono-tabular font-bold text-[#141414]"
              />
            </div>

            <div>
              <label htmlFor="pts-bonus" className="block text-sm font-bold text-[#141414] mb-1.5">
                Réponse Bonus
              </label>
              <input
                id="pts-bonus"
                type="number"
                value={pointsBonus}
                onChange={(e) => setPointsBonus(Number(e.target.value))}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#FFFDF2] px-3.5 py-2.5 text-base font-mono-tabular font-bold text-[#141414]"
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 space-y-5 tactile-card">
          <h2 className="font-display text-2xl font-bold text-[#141414]">
            Départage, Chronomètre & Sécurité
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="tie-breaker" className="block text-sm font-bold text-[#141414] mb-1.5">
                Règle de départage en cas d&apos;égalité
              </label>
              <select
                id="tie-breaker"
                value={tieBreaker}
                onChange={(e) => setTieBreaker(e.target.value as TieBreakerRule)}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-medium text-[#141414]"
              >
                <option value="EARLIEST_REACHED">Premier ayant atteint ce score</option>
                <option value="JOIN_ORDER">Ordre d&apos;inscription</option>
                <option value="ALPHABETICAL">Ordre alphabétique</option>
              </select>
            </div>

            <div>
              <label htmlFor="q-timer" className="block text-sm font-bold text-[#141414] mb-1.5">
                Durée du chrono question (secondes)
              </label>
              <input
                id="q-timer"
                type="number"
                min={5}
                max={300}
                value={questionTimerSeconds}
                onChange={(e) => setQuestionTimerSeconds(Number(e.target.value))}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-mono-tabular font-bold text-[#141414]"
              />
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t-2 border-[#141414]/10">
            <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
              <span className="text-sm font-bold text-[#141414]">
                Inscriptions publiques ouvertes
              </span>
              <input
                type="checkbox"
                checked={registrationsOpen}
                onChange={(e) => setRegistrationsOpen(e.target.checked)}
                className="h-5 w-5 accent-[#141414]"
              />
            </label>

            <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
              <span className="text-sm font-bold text-[#141414]">
                Téléphone obligatoire à l&apos;inscription
              </span>
              <input
                type="checkbox"
                checked={requirePhone}
                onChange={(e) => setRequirePhone(e.target.checked)}
                className="h-5 w-5 accent-[#141414]"
              />
            </label>

            <label className="flex items-center justify-between gap-4 py-1 cursor-pointer">
              <span className="text-sm font-bold text-[#141414]">
                Confirmer les gros écarts de points
              </span>
              <input
                type="checkbox"
                checked={confirmLargeDelta}
                onChange={(e) => setConfirmLargeDelta(e.target.checked)}
                className="h-5 w-5 accent-[#141414]"
              />
            </label>

            {confirmLargeDelta && (
              <div className="pt-1 max-w-xs">
                <label htmlFor="threshold-input" className="block text-xs font-bold text-[#525866] mb-1">
                  Seuil de confirmation (points)
                </label>
                <input
                  id="threshold-input"
                  type="number"
                  min={5}
                  value={largeDeltaThreshold}
                  onChange={(e) => setLargeDeltaThreshold(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3 py-2 text-sm font-mono-tabular font-bold text-[#141414]"
                />
              </div>
            )}
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] px-6 py-2.5 text-sm font-bold text-[#141414] tactile-btn disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}</span>
          </button>
        </div>
      </form>
    </AdminLayout>
  );
}
