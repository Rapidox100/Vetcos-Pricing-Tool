import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { useTheme } from '../lib/theme.js';
import { Logo, RoleBadge } from './ui.jsx';

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4l1.4-1.4" strokeLinecap="round" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const isAdmin = user.role === 'admin';

  const tabs = [
    { to: '/quotation', label: 'Quotation' },
    { to: '/quotes', label: isAdmin ? 'All Quotes' : 'My Quotes' },
    ...(isAdmin
      ? [
          { to: '/team', label: 'Team' },
          { to: '/pricing', label: 'Pricing Rules' },
          { to: '/activity', label: 'Activity Log' },
        ]
      : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-800/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Logo className="h-8" />
            <span className="hidden text-sm font-semibold text-slate-400 sm:inline">Quote Tool</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block font-medium text-slate-700 dark:text-slate-200">{user.name}</span>
                </span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="card absolute right-0 z-20 mt-2 w-56 p-2">
                    <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
                      <p className="font-medium text-slate-700 dark:text-slate-200">{user.name}</p>
                      <p className="text-xs text-slate-400">@{user.username}</p>
                      <div className="mt-1">
                        <RoleBadge role={user.role} />
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/account/password');
                      }}
                      className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Change password
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full rounded-md px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <nav className="mx-auto max-w-6xl overflow-x-auto px-2">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-slate-400">
        SMS Vetcare Technologies Private Limited · Thiruvananthapuram · The Future of Vet Care
      </footer>
    </div>
  );
}
