import { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

const MIN_SCALE  = 0.5;
const MAX_SCALE  = 3.0;
const SCALE_STEP = 0.25;

const PDFViewer = ({ url }) => {
  const canvasRef       = useRef(null);
  const renderTaskRef   = useRef(null);

  const [pdfDoc,      setPdfDoc]      = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages,  setTotalPages]  = useState(0);
  const [scale,       setScale]       = useState(1.0);
  const [pageInput,   setPageInput]   = useState('1');
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);

  // ── Load PDF ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!url) return;
    let cancelled = false;

    setLoading(true);
    setError(null);
    setPdfDoc(null);
    setTotalPages(0);
    setCurrentPage(1);
    setPageInput('1');

    (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const buffer = await res.arrayBuffer();
        if (cancelled) return;

        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        if (cancelled) return;

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  // ── Render page ─────────────────────────────────────────────────────────────
  const renderPage = useCallback(async (doc, pageNum, currentScale) => {
    if (!doc || !canvasRef.current) return;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    try {
      const page     = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: currentScale });
      const canvas   = canvasRef.current;
      const ctx      = canvas.getContext('2d');

      canvas.height = viewport.height;
      canvas.width  = viewport.width;

      renderTaskRef.current = page.render({ canvasContext: ctx, viewport });
      await renderTaskRef.current.promise;
      renderTaskRef.current = null;
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') console.error('render error:', err);
    }
  }, []);

  useEffect(() => {
    if (pdfDoc) renderPage(pdfDoc, currentPage, scale);
  }, [pdfDoc, currentPage, scale, renderPage]);

  // Sync page input whenever currentPage changes
  useEffect(() => { setPageInput(String(currentPage)); }, [currentPage]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentPage((p) => Math.min(p + 1, totalPages));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentPage((p) => Math.max(p - 1, 1));
      } else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setScale((s) => Math.min(+(s + SCALE_STEP).toFixed(2), MAX_SCALE));
      } else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setScale((s) => Math.max(+(s - SCALE_STEP).toFixed(2), MIN_SCALE));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [totalPages]);

  // ── Toolbar actions ─────────────────────────────────────────────────────────
  const goToPrev = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const goToNext = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const zoomOut  = () => setScale((s) => Math.max(+(s - SCALE_STEP).toFixed(2), MIN_SCALE));
  const zoomIn   = () => setScale((s) => Math.min(+(s + SCALE_STEP).toFixed(2), MAX_SCALE));

  const commitPageInput = () => {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n) && n >= 1 && n <= totalPages) setCurrentPage(n);
    else setPageInput(String(currentPage));
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 select-none print:hidden">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-700 flex-shrink-0 flex-wrap">

        {/* Page navigation */}
        <button
          onClick={goToPrev}
          disabled={currentPage <= 1 || !pdfDoc}
          className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Previous page (← Arrow)"
        >
          ‹ Prev
        </button>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={commitPageInput}
            onKeyDown={(e) => { if (e.key === 'Enter') { commitPageInput(); e.target.blur(); } }}
            className="w-12 text-center bg-gray-700 text-white text-sm rounded-lg px-2 py-1.5 border border-gray-600 focus:outline-none focus:border-blue-500"
            disabled={!pdfDoc}
          />
          <span className="text-gray-400 text-sm">/ {totalPages || '—'}</span>
        </div>

        <button
          onClick={goToNext}
          disabled={currentPage >= totalPages || !pdfDoc}
          className="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Next page (→ Arrow)"
        >
          Next ›
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1" />

        {/* Zoom */}
        <button
          onClick={zoomOut}
          disabled={scale <= MIN_SCALE || !pdfDoc}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-lg text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Zoom out (Ctrl −)"
        >
          −
        </button>
        <span className="text-gray-300 text-sm w-14 text-center tabular-nums">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          disabled={scale >= MAX_SCALE || !pdfDoc}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-lg text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Zoom in (Ctrl +)"
        >
          +
        </button>
      </div>

      {/* ── Canvas area ── */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4 bg-gray-600">

        {loading && (
          <div className="flex flex-col items-center gap-3 text-gray-300 mt-24">
            <svg className="animate-spin w-9 h-9" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-sm">Rendering PDF…</span>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center gap-2 text-red-400 mt-24">
            <span className="text-3xl">⚠</span>
            <span className="text-sm">{error}</span>
          </div>
        )}

        {!loading && !error && (
          <canvas
            ref={canvasRef}
            className="shadow-2xl block"
            onContextMenu={(e) => e.preventDefault()}
            draggable={false}
            style={{ maxWidth: '100%' }}
          />
        )}
      </div>
    </div>
  );
};

export default PDFViewer;
