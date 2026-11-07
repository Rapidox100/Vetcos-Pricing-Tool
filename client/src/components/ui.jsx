import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// --- Logo -------------------------------------------------------------------
export function Logo({ className = 'h-9' }) {
  return <img src="/logo.png" alt="Vetcos" className={className} />;
}

// --- PDF link + download ------------------------------------------------
function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// A PDF's preview link (opens in a new tab) plus a small download icon
// (forces a file save - important on mobile, where the inline preview has
// no visible save/share control of its own).
export function PdfLink({ href, label, filename, className }) {
  return (
    <span className="inline-flex items-center gap-1">
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {label}
      </a>
      <a
        href={href}
        download={filename}
        title={`Download ${label}`}
        aria-label={`Download ${label}`}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
      >
        <DownloadIcon />
      </a>
    </span>
  );
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
// While a modal is open, the phone/browser Back button closes the modal
// instead of navigating the page underneath it (which previously made Back
// jump out to an earlier tab/screen instead of just dismissing the popup).
// We do this by pushing one history entry when the modal opens, and treating
// a "popstate" (Back pressed) as a close request.
function useBackButtonClose(open, onClose) {
  const closingViaBack = useRef(false);

  useEffect(() => {
    if (!open) return undefined;

    window.history.pushState({ vetcosModal: true }, '');
    closingViaBack.current = false;

    const onPopState = () => {
      closingViaBack.current = true;
      onClose();
    };
    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      // If the modal is closing for any reason OTHER than the user having
      // already pressed Back, remove the history entry we pushed so Back
      // doesn't later land on a stale "modal was open" state.
      if (!closingViaBack.current) {
        window.history.back();
      }
    };
  }, [open]); // eslint-disable-line
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  useBackButtonClose(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`card relative z-10 flex max-h-[90vh] w-full flex-col ${wide ? 'max-w-2xl' : 'max-w-md'}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-6 pb-4 dark:border-slate-700">
          {title ? (
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-1.5 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto p-6 pt-4">{children}</div>
        {footer && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-700">
            {footer}
          </div>
        )}
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
