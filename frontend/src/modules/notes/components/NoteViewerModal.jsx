// Full-screen PDF / Doc viewer.
// Props:
//   file       — current NoteFile
//   files      — all files in folder (for prev/next navigation)
//   onNavigate — (file|null) => void  — null closes, file object switches
//
// Public  → Google Drive /preview embed (Google's viewer UI)
// Protected → backend returns SA-signed Google Drive API URL (/drivetoken)
//             rendered in an <iframe> — no CORS issue, Google CDN serves bytes,
//             browser renders PDF natively inside the iframe.
import { useState, useEffect, useRef } from 'react';
import {
  FiArrowLeft, FiX, FiMaximize2, FiMinimize2,
  FiLock, FiFile, FiChevronLeft, FiChevronRight, FiLoader,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import apiClient from '../../../core/api/axiosConfig';

const MIME_LABELS = {
  'application/pdf':                      'PDF',
  'application/vnd.google-apps.document': 'Doc',
};

const NoteViewerModal = ({ file, files = [], onNavigate }) => {
  const containerRef = useRef(null);
  const onNavRef     = useRef(onNavigate);
  useEffect(() => { onNavRef.current = onNavigate; });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewSrc,      setViewSrc]      = useState(null);
  const [srcLoading,   setSrcLoading]   = useState(false);

  const currentIndex = files.findIndex((f) => f._id === file?._id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < files.length - 1;

  // ── Fullscreen API ────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!isFullscreen) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  // ── Resolve view source ───────────────────────────────────────────────────
  useEffect(() => {
    if (!file) { setViewSrc(null); return; }

    if (!file.isProtected) {
      // Public: Google Drive preview embed — no token needed, file is publicly shared
      setViewSrc(`https://drive.google.com/file/d/${file.driveFileId}/preview`);
      return;
    }

    // Protected: ask backend for a SA-signed Google Drive API URL.
    // The URL is loaded in an <iframe> — browsers load iframe srcs without CORS
    // restrictions, so the Google CDN redirect works perfectly.
    let cancelled = false;
    setViewSrc(null);
    setSrcLoading(true);
    apiClient.get(`/notes/files/${file._id}/drivetoken`)
      .then(({ data }) => {
        if (cancelled) return;
        setViewSrc(data.data.url);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err?.response?.data?.message || 'Cannot load protected file');
        onNavRef.current(null);
      })
      .finally(() => { if (!cancelled) setSrcLoading(false); });

    return () => { cancelled = true; };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Lock body scroll + Esc ────────────────────────────────────────────────
  useEffect(() => {
    if (!file) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onNavRef.current(null);
    };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [file]);

  if (!file) return null;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black/95 flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white border-b border-gray-700 flex-shrink-0">

        {/* Left: back + icon + title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => onNavigate(null)}
            className="p-2 hover:bg-gray-800 rounded-lg flex-shrink-0"
            title="Close (Esc)"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>

          {file.isProtected
            ? <FiLock className="w-4 h-4 text-green-400 flex-shrink-0" />
            : <FiFile className="w-4 h-4 text-blue-400 flex-shrink-0"  />
          }
          <span className="truncate font-medium text-sm">{file.name}</span>
          <span className="hidden sm:inline text-xs text-gray-400 px-2 py-0.5 rounded-full bg-gray-800 flex-shrink-0">
            {MIME_LABELS[file.mimeType] || 'File'}
          </span>
          {file.isProtected && (
            <span className="hidden sm:inline text-xs text-green-400 px-2 py-0.5 rounded-full bg-green-900/40 flex-shrink-0">
              Protected
            </span>
          )}
        </div>

        {/* Right: prev/next arrows + counter + fullscreen + close */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {files.length > 1 && (
            <>
              <button
                onClick={() => hasPrev && onNavigate(files[currentIndex - 1])}
                disabled={!hasPrev}
                className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous file"
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-xs text-gray-400 tabular-nums w-12 text-center">
                {currentIndex + 1} / {files.length}
              </span>
              <button
                onClick={() => hasNext && onNavigate(files[currentIndex + 1])}
                disabled={!hasNext}
                className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next file"
              >
                <FiChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <button
            onClick={toggleFullscreen}
            className="p-2 hover:bg-gray-800 rounded-lg"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <FiMinimize2 className="w-5 h-5" /> : <FiMaximize2 className="w-5 h-5" />}
          </button>
          <button onClick={() => onNavigate(null)} className="p-2 hover:bg-gray-800 rounded-lg" title="Close">
            <FiX className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      {srcLoading ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-gray-400">
          <FiLoader className="animate-spin w-8 h-8" />
          <span className="text-sm">Loading protected file…</span>
        </div>
      ) : viewSrc ? (
        <iframe
          key={viewSrc}
          src={viewSrc}
          title={file.name}
          className="flex-1 w-full bg-white"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : null}
    </div>
  );
};

export default NoteViewerModal;
