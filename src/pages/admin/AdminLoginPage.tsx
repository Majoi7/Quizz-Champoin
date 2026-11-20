import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, ShieldCheck } from 'lucide-react';
import { PublicHeader } from '../../components/PublicHeader';
import { useQuiz } from '../../context/QuizContext';

export function AdminLoginPage() {
  const { admin, loginAdmin } = useQuiz();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/admin/participants';

  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (admin) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !passcode.trim()) {
      setError('Veuillez saisir votre adresse e-mail et votre code d’accès.');
      return;
    }

    setSubmitting(true);
    try {
      await loginAdmin(email.trim(), passcode.trim());
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants invalides.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#98C1BF] text-[#141414] flex flex-col">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-5">
          <div className="rounded-3xl bg-white overflow-hidden tactile-card">
            <div className="bg-[#F4C424] px-6 py-6 border-b-2 border-[#141414] text-center space-y-2">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#141414] bg-white text-[#141414] shadow-[0_2px_0_#141414]">
                <ShieldCheck className="h-6 w-6 text-[#EA4C2A]" />
              </div>
              <h1 className="font-display text-3xl font-bold text-[#141414]">
                Connexion Régie
              </h1>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-5" noValidate>
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border-2 border-[#141414] bg-[#FADAD2] px-4 py-3 text-sm font-semibold text-[#141414]"
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="admin-email"
                  className="block text-sm font-bold text-[#141414] mb-1.5"
                >
                  E-mail
                </label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@domaine.com"
                  className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-medium text-[#141414] placeholder:text-[#767D8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F4C424]"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-passcode"
                  className="block text-sm font-bold text-[#141414] mb-1.5"
                >
                  Code d&apos;accès
                </label>
                <input
                  id="admin-passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-medium text-[#141414] placeholder:text-[#767D8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F4C424]"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#F4C424] px-5 py-2.5 text-sm font-bold text-[#141414] tactile-btn disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                <span>{submitting ? 'Connexion...' : 'Entrer en régie'}</span>
              </button>
            </form>
          </div>

          <div className="text-center">
            <Link
              to="/"
              className="text-xs font-bold text-[#141414] hover:underline underline-offset-4"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
