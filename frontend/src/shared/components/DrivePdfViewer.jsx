// Shared full-screen PDF / document viewer powered by Google Drive preview.
// Public files  → driveFileId is passed directly → Drive preview iframe, no backend call.
// Protected files → caller fetches SA-signed URL from backend and passes it as `src`.
//
// Props:
//   src           — full iframe URL (Drive preview OR SA-signed CDN URL)
//   title         — header display name
//   onClose       — () => void
//   loading?      — bool: show spinner instead of iframe while SA-token is being fetched
//   isProtected?  — bool: show lock badge in header
//   onPrev?       — () => void  (undefined hides nav buttons)
//   onNext?       — () => void
//   hasPrev?      — bool
//   hasNext?      — bool
//   pageInfo?     — string "1 / 5"
import { useState, useEffect, useRef } from 'react';
import {
  FiArrowLeft, FiX, FiMaximize2, FiMinimize2,
  FiLock, FiFile, FiChevronLeft, FiChevronRight, FiLoader,
} from 'react-icons/fi';

const DrivePdfViewer = ({
  src,
  title,
  onClose,
  loading   = false,
  isProtected = false,
  onPrev,
  onNext,
  hasPrev   = false,
  hasNext   = false,
  pageInfo,
}) => {
  const containerRef   = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Track native fullscreen state
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = () => {
    if (!isFullscreen) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  // Lock body scroll + Esc-to-close
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.fullscreenElement) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const showNav = onPrev !== undefined || onNext !== undefined;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black/95 flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white border-b border-gray-700 flex-shrink-0">

        {/* Left: close + icon + title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg flex-shrink-0"
            title="Close (Esc)"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          {isProtected
            ? <FiLock className="w-4 h-4 text-green-400 flex-shrink-0" />
            : <FiFile className="w-4 h-4 text-blue-400 flex-shrink-0" />
          }
          <span className="truncate font-medium text-sm">{title}</span>
          {isProtected && (
            <span className="hidden sm:inline text-xs text-green-400 px-2 py-0.5 rounded-full bg-green-900/40 flex-shrink-0">
              Protected
            </span>
          )}
        </div>

        {/* Right: nav + fullscreen + close */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {showNav && (
            <>
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous"
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>
              {pageInfo && (
                <span className="text-xs text-gray-400 tabular-nums w-12 text-center">
                  {pageInfo}
                </span>
              )}
              <button
                onClick={onNext}
                disabled={!hasNext}
                className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Next"
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

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg"
            title="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center gap-3 text-gray-400">
          <FiLoader className="animate-spin w-8 h-8" />
          <span className="text-sm">Loading file…</span>
        </div>
      ) : src ? (
        <iframe
          key={src}
          src={src}
          title={title}
          className="flex-1 w-full bg-white"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          No file to display.
        </div>
      )}
    </div>
  );
};

export default DrivePdfViewer;
