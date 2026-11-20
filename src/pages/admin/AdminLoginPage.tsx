import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { PublicHeader } from '../../components/PublicHeader';
import { useQuiz } from '../../context/QuizContext';

export function AdminLoginPage() {
  const { admin, adminAuthChecked, supabaseReady, loginWithSupabase } = useQuiz();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/admin/participants';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (admin) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await loginWithSupabase(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de finaliser la connexion Supabase.'
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
              <p className="text-xs font-semibold text-[#141414]/80">
                Authentification administrateur Supabase
              </p>
            </div>

            <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-xl border-2 border-[#141414] bg-[#FADAD2] px-4 py-3 text-sm font-semibold text-[#141414]"
                >
                  {error}
                </div>
              )}

              {adminAuthChecked && !supabaseReady && !error && (
                <div
                  role="status"
                  className="rounded-xl border-2 border-[#141414] bg-[#FFF5CC] px-4 py-3 text-xs font-semibold text-[#141414] leading-relaxed"
                >
                  Supabase Auth n&apos;est pas encore configuré sur cet environnement. Ajoutez{' '}
                  <span className="font-mono">SUPABASE_URL</span> et{' '}
                  <span className="font-mono">SUPABASE_ANON_KEY</span> dans vos variables
                  d&apos;environnement.
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="admin-email"
                  className="block text-xs font-bold uppercase tracking-wide text-[#141414]"
                >
                  Adresse e-mail
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#525866]" />
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@exemple.com"
                    className="w-full rounded-xl border-2 border-[#141414] bg-white pl-10 pr-4 py-2.5 text-sm font-medium text-[#141414] placeholder:text-[#525866]/60 focus:outline-none focus:ring-2 focus:ring-[#F4C424]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-xs font-bold uppercase tracking-wide text-[#141414]"
                >
                  Mot de passe
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#525866]" />
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Votre mot de passe Supabase"
                    className="w-full rounded-xl border-2 border-[#141414] bg-white pl-10 pr-11 py-2.5 text-sm font-medium text-[#141414] placeholder:text-[#525866]/60 focus:outline-none focus:ring-2 focus:ring-[#F4C424]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={
                      showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#525866] hover:text-[#141414]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#F4C424] px-5 py-3 text-sm font-bold text-[#141414] tactile-btn disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" />
                <span>{submitting ? 'Connexion en cours...' : 'Se connecter à la régie'}</span>
              </button>

              <p className="text-xs text-[#525866] text-center leading-relaxed pt-1">
                Créez votre compte administrateur dans{' '}
                <span className="font-semibold text-[#141414]">
                  Supabase → Authentication → Users
                </span>
                .
              </p>
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
