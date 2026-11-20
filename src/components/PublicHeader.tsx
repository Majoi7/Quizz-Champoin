import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export function PublicHeader() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { to: '/', label: 'Accueil' },
    { to: '/live', label: 'Écran Live' },
    { to: '/classement', label: 'Classement' },
    { to: '/admin/dashboard', label: 'Régie Admin' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[#141414] bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3 sm:px-6">
        {/* Zone 1: Single-line brand wordmark */}
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight text-[#141414] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414] rounded"
        >
          QUIZ CHAMPION <span className="text-[#EA4C2A]">LIVE</span>
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-7 text-sm font-semibold">
          {navItems.map((item) => {
            const active =
              item.to === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.to.replace('/dashboard', ''));
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                  active
                    ? 'text-[#141414] border-[#F4C424]'
                    : 'text-[#525866] border-transparent hover:text-[#141414] hover:border-[#8ABBB9]'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Zone 3: Single primary CTA + mobile drawer button */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to="/inscription"
            className="hidden sm:inline-flex items-center justify-center rounded-xl bg-[#F4C424] px-4 py-2 text-sm font-bold text-[#141414] tactile-btn whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#141414]"
          >
            S&apos;inscrire
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#141414] bg-white text-[#141414] hover:bg-[#F4F7F7]"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          aria-label="Menu mobile"
          className="md:hidden border-t-2 border-[#141414] bg-white px-4 py-3 space-y-1"
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-[#141414] hover:bg-[#F4F7F7]"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/inscription"
            onClick={() => setMobileOpen(false)}
            className="mt-2 block rounded-xl bg-[#F4C424] px-4 py-2.5 text-center text-sm font-bold text-[#141414] tactile-btn"
          >
            S&apos;inscrire
          </Link>
        </nav>
      )}
    </header>
  );
}
