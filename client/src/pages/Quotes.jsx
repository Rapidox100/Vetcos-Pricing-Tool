import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { rupees, fmtDateTime, fmtDate } from '../lib/format.js';
import { Spinner, Modal, PdfLink, useToast } from '../components/ui.jsx';
import QuoteForm from '../components/QuoteForm.jsx';

export default function Quotes() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === 'admin';
  const [quotes, setQuotes] = useState(null);
  const [q, setQ] = useState('');
  const [detailId, setDetailId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [settings, setSettings] = useState(null);

  const load = () =>
    api
      .get('/quotes')
      .then(({ quotes }) => setQuotes(quotes))
      .catch((e) => toast?.error(e.message));

  useEffect(() => {
    load();
    api.get('/pricing/settings').then(({ settings }) => setSettings(settings)).catch(() => {});
  }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    if (!quotes) return [];
    const term = q.trim().toLowerCase();
    if (!term) return quotes;
    return quotes.filter(
      (x) =>
        x.clinicName.toLowerCase().includes(term) ||
        x.quoteNumber.toLowerCase().includes(term) ||
        (x.issuedByName || '').toLowerCase().includes(term)
    );
  }, [quotes, q]);

  if (!quotes) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="h-8 w-8 text-teal-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          {isAdmin ? 'All Quotes' : 'My Quotes'}
        </h2>
        <input
          className="input max-w-xs"
          placeholder="Search clinic, quote no, user…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-400">
          {quotes.length === 0 ? 'No quotes issued yet.' : 'No quotes match your search.'}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-900/40">
              <tr>
                <th className="th">Quote No</th>
                <th className="th">Date</th>
                <th className="th">Clinic</th>
                <th className="th">Appts/day</th>
                <th className="th">Rate</th>
                <th className="th">Monthly</th>
                {isAdmin && <th className="th">Issued by</th>}
                <th className="th">Documents</th>
                <th className="th">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {filtered.map((x) => (
                <tr
                  key={x.id}
                  onClick={() => setDetailId(x.id)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30"
                  title="Click to view details"
                >
                  <td className="td font-medium text-teal-600 dark:text-teal-400">{x.quoteNumber}</td>
                  <td className="td whitespace-nowrap">{fmtDateTime(x.createdAt)}</td>
                  <td className="td">{x.clinicName}</td>
                  <td className="td">{x.apptsPerDay}</td>
                  <td className="td">{rupees(x.rate)}</td>
                  <td className="td">{rupees(x.monthlyTotal)}</td>
                  {isAdmin && <td className="td">{x.issuedByName}</td>}
                  <td className="td" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      <PdfLink
                        href={api.pdfUrl(`/quotes/${x.id}/quotation.pdf`)}
                        filename={`${x.quoteNumber}-Quotation.pdf`}
                        label="Quotation"
                        className="text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400"
                      />
                      <span className="text-slate-300">·</span>
                      <PdfLink
                        href={api.pdfUrl(`/quotes/${x.id}/purchase-order.pdf`)}
                        filename={`${x.quoteNumber}-PurchaseOrder.pdf`}
                        label="PO"
                        className="text-xs font-semibold text-orange-600 hover:underline dark:text-orange-400"
                      />
                    </div>
                  </td>
                  <td className="td" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setEditId(x.id)}
                      className="text-xs font-semibold text-slate-600 hover:underline dark:text-slate-300"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <QuoteDetailModal
        id={detailId}
        onClose={() => setDetailId(null)}
        isAdmin={isAdmin}
        onEdit={(id) => {
          setDetailId(null);
          setEditId(id);
        }}
      />

      <EditQuoteModal
        id={editId}
        settings={settings}
        onClose={() => setEditId(null)}
        onSaved={() => {
          setEditId(null);
          load();
        }}
      />
    </div>
  );
}

// --- Detail popup -------------------------------------------------------
function QuoteDetailModal({ id, onClose, isAdmin, onEdit }) {
  const toast = useToast();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setQuote(null);
      return;
    }
    setLoading(true);
    api
      .get(`/quotes/${id}`)
      .then(({ quote }) => setQuote(quote))
      .catch((e) => {
        toast?.error(e.message);
        onClose();
      })
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line

  return (
    <Modal
      open={!!id}
      onClose={onClose}
      wide
      title={quote ? `Quotation ${quote.quoteNumber}` : 'Quotation details'}
      footer={
        quote && (
          <>
            <button type="button" className="btn-ghost" onClick={() => onEdit(quote.id)}>
              Edit
            </button>
            <PdfLink
              href={api.pdfUrl(`/quotes/${quote.id}/purchase-order.pdf`)}
              filename={`${quote.quoteNumber}-PurchaseOrder.pdf`}
              label="Purchase Order PDF"
              className="btn-accent"
            />
            <PdfLink
              href={api.pdfUrl(`/quotes/${quote.id}/quotation.pdf`)}
              filename={`${quote.quoteNumber}-Quotation.pdf`}
              label="Quotation PDF"
              className="btn-primary"
            />
          </>
        )
      }
    >
      {loading || !quote ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-7 w-7 text-teal-500" />
        </div>
      ) : (
        <div className="space-y-5 text-sm">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>Issued {fmtDateTime(quote.createdAt)}</span>
            <span>·</span>
            <span>Valid {quote.validityDays} day(s)</span>
            {isAdmin && (
              <>
                <span>·</span>
                <span>
                  by <span className="font-medium text-slate-500 dark:text-slate-300">{quote.issuedByName}</span>
                </span>
              </>
            )}
          </div>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
              Customer
            </h4>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
              <Row label="Clinic" value={quote.clinicName} />
              <Row label="Contact doctor" value={quote.contactDoctor} />
              <Row label="Number of doctors" value={quote.numDoctors} />
              <Row label="City" value={quote.city} />
              <Row label="Mobile" value={quote.mobile} />
              <Row label="Email" value={quote.email} />
              <Row label="GSTIN" value={quote.gstin} />
              <Row label="Address" value={quote.address} full />
            </dl>
          </section>

          <section>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
              Commercials
            </h4>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
              <Row label="Appointments / day" value={quote.apptsPerDay} />
              <Row label="Appointments / month" value={quote.apptsPerMonth} />
              <Row label="Rate / appointment" value={rupees(quote.rate)} accent />
              <Row label="Doctor's fee (reference)" value={quote.doctorFee != null ? rupees(quote.doctorFee) : null} />
              <Row label="Monthly estimate (pre-GST)" value={rupees(quote.monthlyEstimate)} />
              <Row label={`GST @ ${quote.settings?.gst_pct ?? ''}%`} value={rupees(quote.gstAmount)} />
              <Row label="Monthly total" value={rupees(quote.monthlyTotal)} accent strong />
              <Row label="Valid until" value={fmtDate(addDays(quote.createdAt, quote.validityDays))} />
            </dl>
          </section>

          {quote.specialNote && (
            <section>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-600 dark:text-teal-400">
                Special note
              </h4>
              <p className="text-slate-600 dark:text-slate-300">{quote.specialNote}</p>
            </section>
          )}
        </div>
      )}
    </Modal>
  );
}

// --- Edit popup -----------------------------------------------------------
function EditQuoteModal({ id, settings, onClose, onSaved }) {
  const toast = useToast();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) {
      setQuote(null);
      return;
    }
    setLoading(true);
    api
      .get(`/quotes/${id}`)
      .then(({ quote }) => setQuote(quote))
      .catch((e) => {
        toast?.error(e.message);
        onClose();
      })
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line

  return (
    <Modal open={!!id} onClose={onClose} wide title={quote ? `Edit Quotation ${quote.quoteNumber}` : 'Edit quotation'}>
      {loading || !quote || !settings ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-7 w-7 text-teal-500" />
        </div>
      ) : (
        <QuoteForm
          key={quote.id}
          editing={quote}
          settings={settings}
          layout="modal"
          onCancel={onClose}
          onSaved={onSaved}
        />
      )}
    </Modal>
  );
}

function Row({ label, value, accent, strong, full }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className={`flex justify-between gap-4 border-b border-slate-100 py-1 dark:border-slate-700/60 ${full ? 'sm:col-span-2' : ''}`}>
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        className={`text-right font-medium ${accent ? 'text-orange-500' : 'text-slate-700 dark:text-slate-100'} ${
          strong ? 'text-base' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

// Returns a SQLite-style "YYYY-MM-DD HH:MM:SS" string (UTC), matching the
// format fmtDate()/fmtDateTime() expect everywhere else in this app.
function addDays(dateStr, days) {
  const base = new Date(String(dateStr).replace(' ', 'T') + 'Z');
  if (isNaN(base)) return null;
  const d = new Date(base.getTime() + Number(days || 0) * 86400000);
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}
