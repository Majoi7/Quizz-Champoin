import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import {
  Activity,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Sliders,
  Tv,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useQuiz } from '../context/QuizContext';

interface AdminLayoutProps {
  title: string;
  children: React.ReactNode;
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  PREPARATION: { text: 'Préparation', color: 'text-[#525866]' },
  LIVE: { text: 'En direct', color: 'text-emerald-700 font-semibold' },
  PAUSED: { text: 'En pause', color: 'text-amber-700 font-semibold' },
  FINISHED: { text: 'Terminée', color: 'text-[#EA4C2A] font-semibold' },
};

export function AdminLayout({ title, children }: AdminLayoutProps) {
  const { admin, adminAuthChecked, logoutAdmin, competition, connectionStatus, soundEnabled, toggleSound } =
    useQuiz();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  if (!adminAuthChecked) {
    return (
      <div className="min-h-screen bg-[#F4F7F7] flex items-center justify-center text-[#525866] font-medium">
        Vérification de la session régie...
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  const navLinks = [
    { to: '/admin/dashboard', label: 'Vue générale', icon: LayoutDashboard },
    { to: '/admin/participants', label: 'Participants & Points', icon: Users },
    { to: '/admin/historique', label: 'Historique des scores', icon: History },
    { to: '/admin/parametres', label: 'Barème & Règles', icon: Sliders },
    { to: '/admin/competition', label: 'Contrôle partie', icon: Activity },
  ];

  const statusMeta = STATUS_LABELS[competition?.status ?? 'PREPARATION'];

  return (
    <div className="min-h-screen bg-[#F4F7F7] text-[#141414] flex">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 border-r-2 border-[#141414] bg-white flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#141414] bg-[#F4C424]">
          <Link
            to="/"
            className="font-display text-lg font-bold tracking-tight text-[#141414] whitespace-nowrap"
          >
            QUIZ CHAMPION <span className="text-[#EA4C2A]">LIVE</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer la barre latérale"
            className="lg:hidden p-1.5 rounded-lg text-[#141414] hover:bg-black/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Menu d'administration" className="flex-1 px-3 py-4 space-y-1.5">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-[#F4C424] text-[#141414] border-2 border-[#141414] shadow-[0_2px_0_#141414]'
                    : 'text-[#525866] hover:bg-[#EAF3F2] hover:text-[#141414] border-2 border-transparent'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 text-[#141414]" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-[#141414]/15 space-y-1">
            <Link
              to="/live"
              className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-[#141414] hover:bg-[#FFF5CC] transition-colors whitespace-nowrap"
            >
              <Tv className="h-4 w-4 shrink-0 text-[#EA4C2A]" />
              <span>Ouvrir Écran Live</span>
            </Link>
          </div>
        </nav>

        <div className="border-t-2 border-[#141414]/15 p-4 space-y-3 bg-[#FAFBFB]">
          <div className="text-xs text-[#525866]">
            <div className="font-bold text-[#141414] truncate">{admin.name}</div>
            <div className="truncate">{admin.email}</div>
          </div>
          <button
            type="button"
            onClick={() => logoutAdmin()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#141414] bg-white px-3 py-2 text-xs font-bold text-[#141414] hover:bg-[#F4F7F7] transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b-2 border-[#141414] bg-white/95 backdrop-blur-md px-4 py-3.5 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu d'administration"
              className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#141414] bg-white text-[#141414]"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#525866]">
                <span>Régie</span>
                <span aria-hidden="true">/</span>
                <span className={statusMeta.color}>{statusMeta.text}</span>
                {connectionStatus !== 'connected' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-700 font-medium">Synchronisation...</span>
                  </>
                )}
              </div>
              <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#141414] truncate">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleSound}
              aria-label={soundEnabled ? 'Couper les effets sonores' : 'Activer les effets sonores'}
              title={soundEnabled ? 'Effets sonores activés' : 'Effets sonores coupés'}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#141414] transition-colors ${
                soundEnabled
                  ? 'bg-[#8ABBB9] text-[#141414]'
                  : 'bg-white text-[#525866] hover:text-[#141414]'
              }`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            <Link
              to="/live"
              className="inline-flex items-center gap-2 rounded-xl bg-[#F4C424] px-4 py-2 text-sm font-bold text-[#141414] tactile-btn whitespace-nowrap shrink-0"
            >
              <Tv className="h-4 w-4" />
              <span>Écran Live</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
