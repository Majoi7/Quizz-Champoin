import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Lock, Upload, UserPlus } from 'lucide-react';
import { PublicHeader } from '../components/PublicHeader';
import { Avatar } from '../components/Avatar';
import { useQuiz } from '../context/QuizContext';
import { quizApi } from '../services/api';
import type { RankedParticipant } from '../types/quiz';

const PRESET_AVATARS = [
  {
    label: 'Portrait studio 1',
    url: '/src/assets/images/avatar_contestant_one_1795157361881.jpg',
  },
  {
    label: 'Portrait studio 2',
    url: '/src/assets/images/avatar_contestant_two_1795157361107.jpg',
  },
];

async function compressAvatarFile(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('READ_FAILED'));
    };
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined') return dataUrl;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('IMG_DECODE_FAILED'));
      el.src = dataUrl;
    });

    const maxSize = 256;
    const scale = Math.min(1, maxSize / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round((img.width || maxSize) * scale));
    const height = Math.max(1, Math.round((img.height || maxSize) * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.drawImage(img, 0, 0, width, height);
    const compressed = canvas.toDataURL('image/jpeg', 0.82);
    return compressed.length < dataUrl.length ? compressed : dataUrl;
  } catch {
    return dataUrl;
  }
}

export function RegisterPage() {
  const { competition } = useQuiz();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<RankedParticipant | null>(null);
  const submitLockRef = useRef(false);

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10_000_000) {
      setError('La photo ne doit pas dépasser 10 Mo.');
      return;
    }
    try {
      const processed = await compressAvatarFile(file);
      if (processed.length > 420_000) {
        setError('La photo reste trop volumineuse après compression.');
        return;
      }
      setAvatarUrl(processed);
      setError(null);
    } catch {
      setError("Impossible de charger l'image sélectionnée.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current) return;
    setError(null);

    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setError('Veuillez renseigner votre prénom et votre nom (2 caractères minimum).');
      return;
    }
    if (competition?.require_phone && phone.trim().length < 6) {
      setError('Le numéro de téléphone est requis pour valider votre inscription.');
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    try {
      const res = await quizApi.registerParticipant({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        nickname: nickname.trim() || undefined,
        phone: phone.trim() || undefined,
        avatar_url: avatarUrl.trim() || undefined,
      });
      setRegistered(res.participant);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de finaliser l'inscription.");
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

  const registrationsClosed = competition && !competition.registrations_open;

  return (
    <div className="min-h-screen bg-[#98C1BF] text-[#141414] flex flex-col">
      <PublicHeader />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl bg-white overflow-hidden tactile-card">
          {/* Sunny Yellow Curved Form Header */}
          <div className="relative bg-[#F4C424] px-6 sm:px-8 pt-7 pb-12">
            <div className="text-xs font-bold uppercase tracking-wider text-[#141414]/80">
              {competition?.name ?? 'QUIZ CHAMPION LIVE'}
            </div>
            <h1 className="mt-1 font-display text-3xl sm:text-4xl font-bold text-[#141414]">
              Inscription des candidats
            </h1>
            <p className="mt-1 text-sm font-semibold text-[#141414]/80">
              Score initial : 0 point · Affichage en direct.
            </p>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 leading-none">
              <svg
                viewBox="0 0 800 40"
                preserveAspectRatio="none"
                className="w-full h-6 fill-white"
                aria-hidden="true"
              >
                <path d="M0,10 C200,40 600,40 800,10 L800,40 L0,40 Z" />
              </svg>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {registrationsClosed && !registered ? (
              <div className="rounded-2xl border-2 border-[#141414] bg-[#FFFDF2] p-6 space-y-4">
                <div className="flex items-center gap-3 text-[#EA4C2A]">
                  <Lock className="h-5 w-5 shrink-0" />
                  <h2 className="font-display text-2xl font-bold text-[#141414]">
                    Inscriptions fermées
                  </h2>
                </div>
                <p className="text-sm font-medium text-[#525866]">
                  Les inscriptions sont temporairement verrouillées pour cette manche.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link
                    to="/live"
                    className="rounded-xl bg-[#F4C424] px-4 py-2 text-sm font-bold text-[#141414] tactile-btn"
                  >
                    Regarder l&apos;Écran Live
                  </Link>
                  <Link
                    to="/classement"
                    className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#141414] tactile-btn"
                  >
                    Voir le classement
                  </Link>
                </div>
              </div>
            ) : registered ? (
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#141414]">
                      Inscription confirmée !
                    </h2>
                    <p className="mt-1 text-sm font-medium text-[#525866]">
                      En lice sur <span className="font-bold text-[#141414]">{competition?.name}</span>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border-2 border-[#141414] bg-[#F4F7F7] p-5">
                  <div className="flex items-center gap-4">
                    <Avatar
                      firstName={registered.first_name}
                      lastName={registered.last_name}
                      avatarUrl={registered.avatar_url}
                      size="lg"
                      rank={registered.rank}
                    />
                    <div>
                      <div className="font-display text-2xl font-bold text-[#141414]">
                        {registered.first_name} {registered.last_name}
                      </div>
                      <div className="text-xs font-semibold text-[#525866]">
                        {registered.nickname ? `Alias : ${registered.nickname} · ` : ''}
                        Rang actuel : #{registered.rank ?? '—'}
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="font-mono-tabular text-3xl font-bold text-emerald-700">
                      {registered.score} pts
                    </div>
                    <div className="text-xs font-semibold text-[#525866]">Score initial</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to={`/participant/${registered.id}`}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] px-5 py-2.5 text-sm font-bold text-[#141414] tactile-btn"
                  >
                    <span>Accéder à mon espace personnel</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/live"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#141414] tactile-btn"
                  >
                    Voir l&apos;Écran Live
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                {error && (
                  <div
                    role="alert"
                    className="rounded-xl border-2 border-[#141414] bg-[#FADAD2] px-4 py-3 text-sm font-semibold text-[#141414]"
                  >
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="reg-firstname"
                      className="block text-sm font-bold text-[#141414] mb-1.5"
                    >
                      Prénom <span className="text-[#EA4C2A]">*</span>
                    </label>
                    <input
                      id="reg-firstname"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Ex. : Camille"
                      className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-medium text-[#141414] placeholder:text-[#767D8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F4C424]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-lastname"
                      className="block text-sm font-bold text-[#141414] mb-1.5"
                    >
                      Nom <span className="text-[#EA4C2A]">*</span>
                    </label>
                    <input
                      id="reg-lastname"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Ex. : Diallo"
                      className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-medium text-[#141414] placeholder:text-[#767D8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F4C424]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label
                      htmlFor="reg-nickname"
                      className="block text-sm font-bold text-[#141414] mb-1.5"
                    >
                      Pseudonyme (facultatif)
                    </label>
                    <input
                      id="reg-nickname"
                      type="text"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      placeholder="Ex. : La Foudre"
                      className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-medium text-[#141414] placeholder:text-[#767D8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F4C424]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-phone"
                      className="block text-sm font-bold text-[#141414] mb-1.5"
                    >
                      Téléphone{' '}
                      {competition?.require_phone ? (
                        <span className="text-[#EA4C2A]">*</span>
                      ) : (
                        '(facultatif)'
                      )}
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      required={Boolean(competition?.require_phone)}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex. : +33 6 12 34 56 78"
                      className="w-full rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3.5 py-2.5 text-sm font-medium text-[#141414] placeholder:text-[#767D8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F4C424]"
                    />
                  </div>
                </div>

                {/* Optional Avatar selection */}
                <div className="space-y-3 pt-1">
                  <div className="text-sm font-bold text-[#141414]">
                    Photo de profil (facultative)
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <Avatar
                      firstName={firstName || 'Q'}
                      lastName={lastName || 'C'}
                      avatarUrl={avatarUrl || null}
                      size="lg"
                    />
                    <div className="flex flex-wrap items-center gap-2.5">
                      {PRESET_AVATARS.map((preset) => (
                        <button
                          key={preset.url}
                          type="button"
                          onClick={() => setAvatarUrl(preset.url)}
                          className={`rounded-xl border-2 border-[#141414] px-3 py-1.5 text-xs font-bold transition-colors ${
                            avatarUrl === preset.url
                              ? 'bg-[#F4C424] text-[#141414]'
                              : 'bg-[#F4F7F7] text-[#141414] hover:bg-[#EAF3F2]'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                      <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border-2 border-[#141414] bg-[#F4F7F7] px-3 py-1.5 text-xs font-bold text-[#141414] hover:bg-[#EAF3F2]">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Importer une image</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoFile}
                          className="sr-only"
                        />
                      </label>
                      {avatarUrl && (
                        <button
                          type="button"
                          onClick={() => setAvatarUrl('')}
                          className="text-xs font-semibold text-[#525866] hover:text-[#EA4C2A] underline"
                        >
                          Utiliser mes initiales
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t-2 border-[#141414]/10">
                  <p className="text-xs font-semibold text-[#525866]">
                    Score de départ : <span className="font-bold text-[#141414]">0 point</span>
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] px-6 py-2.5 text-sm font-bold text-[#141414] tactile-btn disabled:opacity-60 whitespace-nowrap"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>{submitting ? 'Inscription...' : "Valider l'inscription"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
