import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Spinner } from './ui.jsx';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

/**
 * Renders a PDF (fetched from `url`) page-by-page onto canvases, with our
 * own zoom and download controls — so the preview lives inside the app's UI
 * instead of handing off to the OS/browser's bare PDF viewer.
 */
export default function PdfViewer({ url, filename }) {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1);
  const docRef = useRef(null);
  const renderTokenRef = useRef(0);

  // Load the document once per URL.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setPageCount(0);

    const loadingTask = pdfjsLib.getDocument(url);
    loadingTask.promise
      .then((pdf) => {
        if (cancelled) return;
        docRef.current = pdf;
        setPageCount(pdf.numPages);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('PDF load failed:', err);
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      loadingTask.destroy?.();
      docRef.current = null;
    };
  }, [url]);

  // Render all pages whenever the doc or scale changes.
  useEffect(() => {
    if (status !== 'ready' || !docRef.current || !containerRef.current) return;
    const myToken = ++renderTokenRef.current;
    const pdf = docRef.current;
    const container = containerRef.current;
    container.innerHTML = '';

    (async () => {
      for (let i = 1; i <= pdf.numPages; i++) {
        if (renderTokenRef.current !== myToken) return; // superseded by a newer render
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        // Render at full resolution (for crispness) but never let the
        // display size exceed the container width - avoids a horizontal
        // scrollbar on narrow/mobile screens.
        const displayWidth = viewport.width / (window.devicePixelRatio || 1);
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${viewport.height / (window.devicePixelRatio || 1)}px`;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        canvas.className = 'mx-auto mb-3 block rounded-md border border-slate-200 shadow-sm dark:border-slate-700';

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (renderTokenRef.current !== myToken) return;
        container.appendChild(canvas);
      }
    })();
  }, [status, scale]);

  const zoomOut = () => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)));
  const zoomIn = () => setScale((s) => Math.min(2.5, +(s + 0.2).toFixed(2)));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={zoomOut}
            disabled={status !== 'ready'}
            className="btn-ghost px-2 py-1 text-sm disabled:opacity-40"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="w-12 text-center text-xs text-slate-500 dark:text-slate-400">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={zoomIn}
            disabled={status !== 'ready'}
            className="btn-ghost px-2 py-1 text-sm disabled:opacity-40"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
        {status === 'ready' && (
          <span className="text-xs text-slate-400">
            {pageCount} page{pageCount === 1 ? '' : 's'}
          </span>
        )}
        <a href={url} download={filename} className="btn-primary px-3 py-1.5 text-sm">
          Download
        </a>
      </div>

      <div className="rounded-lg bg-slate-100 p-3 dark:bg-slate-900/40">
        {status === 'loading' && (
          <div className="flex justify-center py-16">
            <Spinner className="h-7 w-7 text-teal-500" />
          </div>
        )}
        {status === 'error' && (
          <div className="py-10 text-center text-sm text-red-500">
            Couldn't load the preview.{' '}
            <a href={url} download={filename} className="underline">
              Download the PDF instead
            </a>
            .
          </div>
        )}
        <div ref={containerRef} className={status === 'ready' ? '' : 'hidden'} />
      </div>
    </div>
  );
}
