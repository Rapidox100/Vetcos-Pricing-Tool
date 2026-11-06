import { createContext, useContext, useState, useCallback } from 'react';

// --- Logo -------------------------------------------------------------------
export function Logo({ className = 'h-9' }) {
  return <img src="/logo.png" alt="Vetcos" className={className} />;
}

// --- Spinner ----------------------------------------------------------------
export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

// --- Field ------------------------------------------------------------------
export function Field({ label, children, hint, required, error }) {
  return (
    <div>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-orange-500"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

// --- Toast system -----------------------------------------------------------
const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const toast = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
              t.type === 'success'
                ? 'bg-teal-600'
                : t.type === 'error'
                ? 'bg-red-600'
                : 'bg-slate-700'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}

// --- Modal ------------------------------------------------------------------
export function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`card relative z-10 max-h-[90vh] w-full overflow-y-auto p-6 ${
          wide ? 'max-w-2xl' : 'max-w-md'
        }`}
      >
        {title && <h3 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>}
        <div>{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// --- Badge helpers ----------------------------------------------------------
export function RoleBadge({ role }) {
  const cls =
    role === 'admin'
      ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300'
      : 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300';
  return <span className={`badge ${cls}`}>{role === 'admin' ? 'Admin' : 'Sales'}</span>;
}

export function StatusBadge({ active }) {
  return (
    <span
      className={`badge ${
        active
          ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300'
          : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'
      }`}
    >
      {active ? 'Active' : 'Off'}
    </span>
  );
}
