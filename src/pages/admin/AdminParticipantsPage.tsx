import React, { useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import {
  Ban,
  Edit3,
  Minus,
  PauseCircle,
  PlayCircle,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Undo2,
  UserPlus,
  X,
} from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { Avatar } from '../../components/Avatar';
import { AnimatedCounter } from '../../components/AnimatedCounter';
import { useQuiz } from '../../context/QuizContext';
import { useScoreUpdate } from '../../hooks/useScoreUpdate';
import { requiresLargeDeltaConfirmation } from '../../lib/ranking';
import { quizApi } from '../../services/api';
import type { ParticipantStatus, RankedParticipant, ScoreReason } from '../../types/quiz';

type FilterTab = 'ALL' | ParticipantStatus;

interface PendingConfirm {
  participant: RankedParticipant;
  delta: number;
  reason: ScoreReason;
}

export function AdminParticipantsPage() {
  const { competition, participants, lastScoreBurst } = useQuiz();

  const [query, setQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    busyId: scoreBusyId,
    undoBusy,
    error: scoreError,
    clearError: clearScoreError,
    applyScore,
    undoLastScore,
    resetParticipantScore,
  } = useScoreUpdate();

  const busyId = scoreBusyId ?? actionBusyId;
  const feedbackError = scoreError ?? actionError;
  const setFeedbackError = (msg: string | null) => {
    if (!msg) clearScoreError();
    setActionError(msg);
  };

  // Modals state
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<RankedParticipant | null>(null);
  const [customScoreTarget, setCustomScoreTarget] = useState<RankedParticipant | null>(null);
  const [customDeltaInput, setCustomDeltaInput] = useState('15');
  const [deleteTarget, setDeleteTarget] = useState<RankedParticipant | null>(null);

  // Add/Edit form fields
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formNickname, setFormNickname] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const pointsCorrect = competition?.points_correct ?? 10;
  const pointsWrong = competition?.points_wrong ?? -5;
  const pointsBonus = competition?.points_bonus ?? 20;

  const filtered = participants.filter((p) => {
    if (filterTab !== 'ALL' && p.status !== filterTab) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      (p.nickname ?? '').toLowerCase().includes(q)
    );
  });

  const executeScore = async (participant: RankedParticipant, delta: number, reason: ScoreReason) => {
    await applyScore(participant, delta, reason);
  };

  const requestScoreChange = (
    participant: RankedParticipant,
    delta: number,
    reason: ScoreReason
  ) => {
    if (
      competition &&
      requiresLargeDeltaConfirmation(
        delta,
        competition.confirm_large_delta,
        competition.large_delta_threshold
      )
    ) {
      setPendingConfirm({ participant, delta, reason });
      return;
    }
    executeScore(participant, delta, reason);
  };

  const handleUndo = async () => {
    await undoLastScore();
  };

  const handleResetScore = async (p: RankedParticipant) => {
    await resetParticipantScore(p);
  };

  const handleStatusChange = async (p: RankedParticipant, nextStatus: ParticipantStatus) => {
    setFeedbackError(null);
    setActionBusyId(p.id);
    try {
      await quizApi.adminUpdateParticipant(p.id, { status: nextStatus });
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Erreur de mise à jour du statut.');
    } finally {
      setActionBusyId(null);
    }
  };

  const openAddModal = () => {
    setFormFirstName('');
    setFormLastName('');
    setFormNickname('');
    setFormPhone('');
    setEditingParticipant(null);
    setShowAddModal(true);
  };

  const openEditModal = (p: RankedParticipant) => {
    setFormFirstName(p.first_name);
    setFormLastName(p.last_name);
    setFormNickname(p.nickname ?? '');
    setFormPhone(p.phone ?? '');
    setEditingParticipant(p);
    setShowAddModal(true);
  };

  const handleSaveParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    if (formFirstName.trim().length < 2 || formLastName.trim().length < 2) {
      setFeedbackError('Prénom et nom requis (2 caractères minimum).');
      return;
    }
    setFormSaving(true);
    try {
      if (editingParticipant) {
        await quizApi.adminUpdateParticipant(editingParticipant.id, {
          first_name: formFirstName.trim(),
          last_name: formLastName.trim(),
          nickname: formNickname.trim() || null,
          phone: formPhone.trim() || null,
        });
      } else {
        await quizApi.adminAddParticipant({
          first_name: formFirstName.trim(),
          last_name: formLastName.trim(),
          nickname: formNickname.trim() || undefined,
          phone: formPhone.trim() || undefined,
        });
      }
      setShowAddModal(false);
      setEditingParticipant(null);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setFormSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setFeedbackError(null);
    setActionBusyId(deleteTarget.id);
    try {
      await quizApi.adminDeleteParticipant(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Suppression impossible.');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleApplyCustomScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customScoreTarget) return;
    const val = Number(customDeltaInput);
    if (!Number.isFinite(val) || val === 0) {
      setFeedbackError('Veuillez saisir un nombre de points non nul.');
      return;
    }
    const target = customScoreTarget;
    setCustomScoreTarget(null);
    requestScoreChange(target, Math.trunc(val), 'CUSTOM');
  };

  return (
    <AdminLayout title="Participants & Attribution des points">
      <div className="space-y-6">
        {feedbackError && (
          <div
            role="alert"
            className="rounded-xl border-2 border-[#141414] bg-[#FADAD2] px-4 py-3 text-sm font-semibold text-[#141414] flex items-center justify-between gap-4"
          >
            <span>{feedbackError}</span>
            <button
              type="button"
              onClick={() => setFeedbackError(null)}
              aria-label="Fermer l'alerte"
              className="text-[#141414] hover:text-[#EA4C2A]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 text-[#525866] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un candidat..."
                aria-label="Rechercher un participant"
                className="w-full rounded-xl border-2 border-[#141414] bg-white pl-10 pr-4 py-2 text-sm font-medium text-[#141414] placeholder:text-[#767D8A] focus:outline-none focus:ring-2 focus:ring-[#F4C424]"
              />
            </div>

            {/* Segmented Filter */}
            <div className="inline-flex items-center gap-1 rounded-xl bg-white border-2 border-[#141414] p-1">
              {(
                [
                  { id: 'ALL', label: 'Tous' },
                  { id: 'ACTIVE', label: 'Actifs' },
                  { id: 'PAUSED', label: 'En pause' },
                  { id: 'DISQUALIFIED', label: 'Disqualifiés' },
                ] as { id: FilterTab; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap ${
                    filterTab === tab.id
                      ? 'bg-[#F4C424] text-[#141414] border border-[#141414]'
                      : 'text-[#525866] hover:text-[#141414]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#141414] tactile-btn disabled:opacity-60 whitespace-nowrap"
            >
              <Undo2 className="h-4 w-4 text-[#EA4C2A]" />
              <span>Annuler la dernière opération</span>
            </button>

            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] px-4 py-2 text-sm font-bold text-[#141414] tactile-btn whitespace-nowrap"
            >
              <UserPlus className="h-4 w-4" />
              <span>Ajouter un participant</span>
            </button>
          </div>
        </div>

        {/* Contestant Scoring Rows */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center space-y-3 tactile-card">
            <p className="text-sm font-medium text-[#525866]">Aucun candidat trouvé dans cette vue.</p>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] px-4 py-2 text-sm font-bold text-[#141414] tactile-btn"
            >
              <UserPlus className="h-4 w-4" />
              <span>Ajouter un premier candidat</span>
            </button>
          </div>
        ) : (
          <LayoutGroup id="admin-participants-board">
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {filtered.map((p) => {
                  const isBurst = lastScoreBurst?.event.participant_id === p.id;
                  const burstDelta = lastScoreBurst?.event.delta ?? 0;
                  const isGain = isBurst && burstDelta > 0;
                  const isLoss = isBurst && burstDelta < 0;
                  const isDisabled = p.status === 'DISQUALIFIED' || busyId === p.id;

                  return (
                    <motion.div
                      layout="position"
                      key={p.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{
                        layout: { type: 'spring', stiffness: 380, damping: 32, mass: 0.85 },
                        opacity: { duration: 0.18 },
                      }}
                      data-testid={`admin-participant-${p.id}`}
                      className={`rounded-2xl p-4 sm:px-5 sm:py-4 transition-colors tactile-card ${
                        isGain
                          ? 'bg-emerald-50'
                          : isLoss
                            ? 'bg-[#FADAD2]'
                            : 'bg-white'
                      }`}
                    >
                      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                        {/* Identity & Current Score */}
                        <div className="flex items-center justify-between sm:justify-start gap-4 min-w-0">
                          <div className="flex items-center gap-3.5 min-w-0">
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
                              <div className="font-display text-xl font-bold text-[#141414] truncate">
                                {p.first_name} {p.last_name}
                              </div>
                              <div className="text-xs font-medium text-[#525866] truncate">
                                {p.nickname ? p.nickname : 'Sans pseudonyme'}
                                {p.status === 'PAUSED' && (
                                  <span className="ml-2 text-amber-700 font-bold">· EN PAUSE</span>
                                )}
                                {p.status === 'DISQUALIFIED' && (
                                  <span className="ml-2 text-[#EA4C2A] font-bold">· DISQUALIFIÉ</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="sm:ml-6 text-right shrink-0 flex items-baseline gap-2">
                            <AnimatePresence>
                              {isBurst && (
                                <motion.span
                                  key={`adm-delta-${lastScoreBurst?.event.id}`}
                                  initial={{ opacity: 0, y: 6, scale: 0.85 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  transition={{ duration: 0.25 }}
                                  className={`font-display text-sm font-bold tabular-nums ${
                                    burstDelta > 0 ? 'text-emerald-700' : 'text-[#EA4C2A]'
                                  }`}
                                >
                                  {burstDelta > 0 ? `+${burstDelta}` : burstDelta}
                                </motion.span>
                              )}
                            </AnimatePresence>
                            <div>
                              <AnimatedCounter
                                value={p.score}
                                className="text-3xl font-bold text-[#141414]"
                              />
                              <span className="ml-1 text-xs font-bold text-[#525866]">pts</span>
                            </div>
                          </div>
                        </div>

                    {/* Tactile Scoring Controls (+, Bonus, -) + Row Management */}
                    <div className="flex flex-wrap items-center justify-between xl:justify-end gap-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => requestScoreChange(p, pointsCorrect, 'CORRECT')}
                          aria-label={`Ajouter ${pointsCorrect} points à ${p.first_name} ${p.last_name}`}
                          className="inline-flex h-11 min-w-[84px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 text-base font-bold text-white tactile-btn disabled:opacity-40 cursor-pointer tabular-nums"
                        >
                          <Plus className="h-5 w-5" />
                          <span>{pointsCorrect}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => requestScoreChange(p, pointsBonus, 'BONUS')}
                          aria-label={`Attribuer bonus +${pointsBonus} points à ${p.first_name} ${p.last_name}`}
                          className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-[#F4C424] px-3 text-sm font-bold text-[#141414] tactile-btn disabled:opacity-40 cursor-pointer tabular-nums"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>+{pointsBonus}</span>
                        </button>

                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => requestScoreChange(p, pointsWrong, 'WRONG')}
                          aria-label={`Retirer ${Math.abs(pointsWrong)} points à ${p.first_name} ${p.last_name}`}
                          className="inline-flex h-11 min-w-[84px] items-center justify-center gap-1.5 rounded-xl bg-[#EA4C2A] px-3.5 text-base font-bold text-white tactile-btn disabled:opacity-40 cursor-pointer tabular-nums"
                        >
                          <Minus className="h-5 w-5" />
                          <span>{Math.abs(pointsWrong)}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 border-l-2 border-[#141414]/15 pl-2.5">
                        <button
                          type="button"
                          disabled={isDisabled}
                          onClick={() => {
                            setCustomDeltaInput('15');
                            setCustomScoreTarget(p);
                          }}
                          title="Variation personnalisée"
                          aria-label={`Ajustement personnalisé pour ${p.first_name} ${p.last_name}`}
                          className="h-10 rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-2.5 text-xs font-bold text-[#141414] hover:bg-[#EAF3F2] disabled:opacity-40"
                        >
                          ±
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(p)}
                          title="Modifier les informations"
                          aria-label={`Modifier ${p.first_name} ${p.last_name}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#141414] bg-[#F4F7F7] text-[#141414] hover:bg-[#EAF3F2]"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleStatusChange(p, p.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED')
                          }
                          title={p.status === 'PAUSED' ? 'Réactiver' : 'Mettre en pause'}
                          aria-label={
                            p.status === 'PAUSED'
                              ? `Réactiver ${p.first_name} ${p.last_name}`
                              : `Mettre en pause ${p.first_name} ${p.last_name}`
                          }
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#141414] bg-[#F4F7F7] text-[#141414] hover:bg-[#FFF5CC]"
                        >
                          {p.status === 'PAUSED' ? (
                            <PlayCircle className="h-4 w-4 text-emerald-700" />
                          ) : (
                            <PauseCircle className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleStatusChange(
                              p,
                              p.status === 'DISQUALIFIED' ? 'ACTIVE' : 'DISQUALIFIED'
                            )
                          }
                          title={
                            p.status === 'DISQUALIFIED' ? 'Lever la disqualification' : 'Disqualifier'
                          }
                          aria-label={
                            p.status === 'DISQUALIFIED'
                              ? `Réintégrer ${p.first_name} ${p.last_name}`
                              : `Disqualifier ${p.first_name} ${p.last_name}`
                          }
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#141414] bg-[#F4F7F7] text-[#141414] hover:bg-[#FADAD2] hover:text-[#EA4C2A]"
                        >
                          <Ban className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleResetScore(p)}
                          title="Réinitialiser le score à 0"
                          aria-label={`Réinitialiser le score de ${p.first_name} ${p.last_name}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#141414] bg-[#F4F7F7] text-[#141414] hover:bg-[#EAF3F2]"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          title="Supprimer le participant"
                          aria-label={`Supprimer ${p.first_name} ${p.last_name}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#141414] bg-[#F4F7F7] text-[#141414] hover:bg-[#EA4C2A] hover:text-white"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </LayoutGroup>
        )}
      </div>

      {/* Confirmation modal for large score deltas */}
      {pendingConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delta-title"
          className="fixed inset-0 z-50 bg-[#141414]/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-5 tactile-card">
            <h2 id="confirm-delta-title" className="font-display text-2xl font-bold text-[#141414]">
              Confirmer la modification de score
            </h2>
            <p className="text-sm font-medium text-[#525866]">
              Vous êtes sur le point d&apos;appliquer{' '}
              <strong
                className={pendingConfirm.delta > 0 ? 'text-emerald-700' : 'text-[#EA4C2A]'}
              >
                {pendingConfirm.delta > 0
                  ? `+${pendingConfirm.delta}`
                  : pendingConfirm.delta}{' '}
                points
              </strong>{' '}
              à{' '}
              <strong className="text-[#141414]">
                {pendingConfirm.participant.first_name} {pendingConfirm.participant.last_name}
              </strong>
              .
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#141414] tactile-btn"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const item = pendingConfirm;
                  setPendingConfirm(null);
                  executeScore(item.participant, item.delta, item.reason);
                }}
                className="rounded-xl bg-[#F4C424] px-4 py-2 text-sm font-bold text-[#141414] tactile-btn"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delta Modal */}
      {customScoreTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="custom-delta-title"
          className="fixed inset-0 z-50 bg-[#141414]/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleApplyCustomScore}
            className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4 tactile-card"
          >
            <h2 id="custom-delta-title" className="font-display text-2xl font-bold text-[#141414]">
              Ajustement manuel
            </h2>
            <p className="text-xs font-semibold text-[#525866]">
              Candidat : {customScoreTarget.first_name} {customScoreTarget.last_name}
            </p>
            <div>
              <label
                htmlFor="custom-delta-input"
                className="block text-sm font-bold text-[#141414] mb-1"
              >
                Points à ajouter ou retirer (ex. 25 ou -15)
              </label>
              <input
                id="custom-delta-input"
                type="number"
                value={customDeltaInput}
                onChange={(e) => setCustomDeltaInput(e.target.value)}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2 text-sm text-[#141414] font-mono-tabular focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCustomScoreTarget(null)}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#141414] tactile-btn"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#F4C424] px-4 py-2 text-sm font-bold text-[#141414] tactile-btn"
              >
                Appliquer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add / Edit Participant Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="participant-modal-title"
          className="fixed inset-0 z-50 bg-[#141414]/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveParticipant}
            className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 tactile-card"
          >
            <div className="flex items-center justify-between">
              <h2
                id="participant-modal-title"
                className="font-display text-2xl font-bold text-[#141414]"
              >
                {editingParticipant ? 'Modifier le participant' : 'Ajouter un participant'}
              </h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                aria-label="Fermer"
                className="text-[#525866] hover:text-[#141414]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="adm-fn" className="block text-xs font-bold text-[#141414] mb-1">
                  Prénom
                </label>
                <input
                  id="adm-fn"
                  type="text"
                  required
                  value={formFirstName}
                  onChange={(e) => setFormFirstName(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3 py-2 text-sm text-[#141414]"
                />
              </div>
              <div>
                <label htmlFor="adm-ln" className="block text-xs font-bold text-[#141414] mb-1">
                  Nom
                </label>
                <input
                  id="adm-ln"
                  type="text"
                  required
                  value={formLastName}
                  onChange={(e) => setFormLastName(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3 py-2 text-sm text-[#141414]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="adm-nick" className="block text-xs font-bold text-[#141414] mb-1">
                Pseudonyme (facultatif)
              </label>
              <input
                id="adm-nick"
                type="text"
                value={formNickname}
                onChange={(e) => setFormNickname(e.target.value)}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3 py-2 text-sm text-[#141414]"
              />
            </div>

            <div>
              <label htmlFor="adm-phone" className="block text-xs font-bold text-[#141414] mb-1">
                Téléphone (facultatif)
              </label>
              <input
                id="adm-phone"
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3 py-2 text-sm text-[#141414]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#141414] tactile-btn"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={formSaving}
                className="rounded-xl bg-[#F4C424] px-4 py-2 text-sm font-bold text-[#141414] tactile-btn disabled:opacity-60"
              >
                {formSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
          className="fixed inset-0 z-50 bg-[#141414]/55 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 space-y-4 tactile-card">
            <h2 id="delete-modal-title" className="font-display text-2xl font-bold text-[#141414]">
              Supprimer ce participant ?
            </h2>
            <p className="text-sm font-medium text-[#525866]">
              Confirmez la suppression définitive de{' '}
              <strong className="text-[#141414]">
                {deleteTarget.first_name} {deleteTarget.last_name}
              </strong>{' '}
              ({deleteTarget.score} pts).
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#141414] tactile-btn"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-[#EA4C2A] px-4 py-2 text-sm font-bold text-white tactile-btn"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
