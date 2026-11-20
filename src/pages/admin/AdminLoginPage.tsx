import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, ShieldCheck } from 'lucide-react';
import { PublicHeader } from '../../components/PublicHeader';
import { useQuiz } from '../../context/QuizContext';

export function AdminLoginPage() {
  const { admin, loginWithGoogle } = useQuiz();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/admin/participants';

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (admin) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleGoogleSignIn = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de finaliser la connexion Google.'
      );
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

            <div className="p-6 sm:p-7 space-y-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border-2 border-[#141414] bg-[#FADAD2] px-4 py-3 text-sm font-semibold text-[#141414]"
                >
                  {error}
                </div>
              )}

              <p className="text-sm font-medium text-[#525866] text-center">
                Authentifiez-vous avec votre compte Google pour piloter le plateau en direct.
              </p>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#F4C424] px-5 py-3 text-sm font-bold text-[#141414] tactile-btn disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" />
                <span>{submitting ? 'Connexion en cours...' : 'Continuer avec Google'}</span>
              </button>
            </div>
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
