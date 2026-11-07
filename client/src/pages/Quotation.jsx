import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { Spinner, PdfLink, useToast } from '../components/ui.jsx';
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
          <PdfLink
            href={api.pdfUrl(`/quotes/${saved.id}/quotation.pdf`)}
            filename={`${saved.quoteNumber}-Quotation.pdf`}
            label="Quotation PDF"
            className="btn-primary"
          />
          <PdfLink
            href={api.pdfUrl(`/quotes/${saved.id}/purchase-order.pdf`)}
            filename={`${saved.quoteNumber}-PurchaseOrder.pdf`}
            label="Purchase Order PDF"
            className="btn-accent"
          />
        </div>
      )}
    </div>
  );
}
