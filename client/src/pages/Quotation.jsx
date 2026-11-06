import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Spinner, useToast } from '../components/ui.jsx';
import QuoteForm from '../components/QuoteForm.jsx';

export default function Quotation() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    api
      .get('/pricing/settings')
      .then(({ settings }) => setSettings(settings))
      .catch((e) => toast?.error(e.message));
  }, []); // eslint-disable-line

  if (!settings) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8 text-teal-500" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-slate-800 dark:text-slate-100">New Quotation</h2>
      <QuoteForm
        settings={settings}
        onSaved={(quote) => {
          setSaved(quote);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
      {saved && (
        <div className="card mt-4 flex flex-wrap items-center gap-3 p-4">
          <p className="text-sm font-semibold text-teal-600 dark:text-teal-400">
            Saved: {saved.quoteNumber}
          </p>
          <a
            href={api.pdfUrl(`/quotes/${saved.id}/quotation.pdf`)}
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
          >
            Download Quotation PDF
          </a>
          <a
            href={api.pdfUrl(`/quotes/${saved.id}/purchase-order.pdf`)}
            target="_blank"
            rel="noreferrer"
            className="btn-accent"
          >
            Download Purchase Order PDF
          </a>
        </div>
      )}
    </div>
  );
}
