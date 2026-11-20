import { useState } from 'react';
import { Download, Search, Undo2 } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { useQuiz } from '../../context/QuizContext';
import { buildLeaderboardCsv } from '../../lib/ranking';
import { quizApi } from '../../services/api';

const REASON_LABELS: Record<string, string> = {
  CORRECT: 'Bonne réponse',
  WRONG: 'Mauvaise réponse',
  BONUS: 'Question bonus',
  CUSTOM: 'Ajustement manuel',
  RESET: 'Réinitialisation',
  UNDO: 'Annulation',
};

export function AdminHistoryPage() {
  const { recentEvents, participants } = useQuiz();
  const [query, setQuery] = useState('');
  const [undoBusy, setUndoBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = recentEvents.filter((ev) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      ev.participant_name.toLowerCase().includes(q) ||
      ev.admin_name.toLowerCase().includes(q) ||
      (REASON_LABELS[ev.reason] ?? ev.reason).toLowerCase().includes(q)
    );
  });

  const handleUndo = async () => {
    setError(null);
    setUndoBusy(true);
    try {
      await quizApi.adminUndoLastScore();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'annuler.");
    } finally {
      setUndoBusy(false);
    }
  };

  const handleExportCsv = () => {
    const csv = buildLeaderboardCsv(participants, recentEvents);
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'historique-quiz-champion-live.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout title="Historique complet des opérations">
      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border-2 border-[#141414] bg-[#FADAD2] px-4 py-3 text-sm font-semibold text-[#141414]">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="h-4 w-4 text-[#525866] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filtrer par candidat, motif ou administrateur..."
              aria-label="Filtrer l'historique"
              className="w-full rounded-xl border-2 border-[#141414] bg-white pl-10 pr-4 py-2 text-sm font-medium text-[#141414] placeholder:text-[#767D8A] focus:outline-none focus:ring-2 focus:ring-[#F4C424]"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoBusy}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#141414] tactile-btn disabled:opacity-60"
            >
              <Undo2 className="h-3.5 w-3.5 text-[#EA4C2A]" />
              <span>Annuler la dernière opération</span>
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] px-4 py-2 text-xs font-bold text-[#141414] tactile-btn"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Exporter CSV</span>
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-white overflow-x-auto tactile-card">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-[#141414] bg-[#F4F7F7] text-xs font-bold text-[#525866]">
                <th className="py-3.5 px-4">Heure</th>
                <th className="py-3.5 px-4">Participant</th>
                <th className="py-3.5 px-4">Motif</th>
                <th className="py-3.5 px-4">Manche</th>
                <th className="py-3.5 px-4 text-right">Variation</th>
                <th className="py-3.5 px-4 text-right">Score</th>
                <th className="py-3.5 px-4">Administrateur</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141414]/10 text-sm">
              {filtered.map((ev) => (
                <tr key={ev.id} className={ev.reverted ? 'opacity-50' : 'hover:bg-[#FFFDF2]'}>
                  <td className="py-3 px-4 font-mono-tabular text-xs font-medium text-[#525866] whitespace-nowrap">
                    {new Date(ev.created_at).toLocaleTimeString('fr-FR')}
                  </td>
                  <td className="py-3 px-4 font-bold text-[#141414] whitespace-nowrap">
                    {ev.participant_name}
                  </td>
                  <td className="py-3 px-4 font-medium text-[#141414] whitespace-nowrap">
                    {REASON_LABELS[ev.reason] ?? ev.reason}
                    {ev.reverted && (
                      <span className="ml-2 text-xs font-bold text-[#EA4C2A]"> · Annulée</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-[#525866] font-mono-tabular font-semibold">
                    M{ev.round_number}
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-mono-tabular font-bold whitespace-nowrap ${
                      ev.delta > 0
                        ? 'text-emerald-700'
                        : ev.delta < 0
                          ? 'text-[#EA4C2A]'
                          : 'text-[#525866]'
                    }`}
                  >
                    {ev.delta > 0 ? `+${ev.delta}` : ev.delta}
                  </td>
                  <td className="py-3 px-4 text-right font-mono-tabular text-[#525866] whitespace-nowrap">
                    {ev.previous_score} → <strong className="text-[#141414]">{ev.new_score}</strong>
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-[#525866] whitespace-nowrap">
                    {ev.admin_name}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-sm font-medium text-[#525866]">
                    Aucune opération de score enregistrée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
