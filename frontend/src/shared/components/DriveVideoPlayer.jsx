// Shared full-screen video player powered by Google Drive.
// Public videos   → Google Drive preview iframe (src = Drive preview URL).
// Protected videos → SA-signed CDN URL rendered as <video> tag (pass isNativeSrc=true).
//
// Props:
//   src              — full URL (Drive preview OR SA-signed CDN URL)
//   title            — header display name
//   onClose          — () => void
//   loading?         — bool: show spinner
//   isProtected?     — bool: show lock badge
//   isNativeSrc?     — bool: true → <video> tag, false → <iframe> (default false)
//   onPrev?          — () => void  (undefined hides nav buttons)
//   onNext?          — () => void
//   hasPrev?         — bool
//   hasNext?         — bool
//   pageInfo?        — string "1 / 5"
//   sidebarSlot?     — ReactNode rendered inside the sidebar panel
//   sidebarOpen?     — bool
//   onToggleSidebar? — () => void
import { useState, useEffect, useRef } from 'react';
import {
  FiArrowLeft, FiX, FiMaximize2, FiMinimize2,
  FiLock, FiVideo, FiChevronLeft, FiChevronRight,
  FiLoader, FiList,
} from 'react-icons/fi';
import { toast } from 'react-toastify';

const DriveVideoPlayer = ({
  src,
  title,
  onClose,
  loading          = false,
  isProtected      = false,
  isNativeSrc      = false,
  onPrev,
  onNext,
  hasPrev          = false,
  hasNext          = false,
  pageInfo,
  sidebarSlot,
  sidebarOpen      = false,
  onToggleSidebar,
}) => {
  const containerRef = useRef(null);
  const videoRef     = useRef(null);
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

  const showNav      = onPrev !== undefined || onNext !== undefined;
  const hasSidebar   = sidebarSlot !== undefined;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex flex-col">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white border-b border-gray-800 flex-shrink-0">

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
            ? <FiLock  className="w-4 h-4 text-green-400 flex-shrink-0" />
            : <FiVideo className="w-4 h-4 text-purple-400 flex-shrink-0" />
          }
          <span className="truncate font-medium text-sm">{title}</span>
          {isProtected && (
            <span className="hidden sm:inline text-xs text-green-400 px-2 py-0.5 rounded-full bg-green-900/40 flex-shrink-0">
              Protected
            </span>
          )}
        </div>

        {/* Right: nav + sidebar toggle + fullscreen + close */}
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

          {hasSidebar && (
            <button
              onClick={onToggleSidebar}
              className={`p-2 rounded-lg ${sidebarOpen ? 'bg-gray-700 text-white' : 'hover:bg-gray-800 text-gray-400'}`}
              title="Toggle playlist"
            >
              <FiList className="w-5 h-5" />
            </button>
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

      {/* ── Body: player + optional sidebar ─────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Player area */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-black relative">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <FiLoader className="animate-spin w-10 h-10" />
              <span className="text-sm">Loading video…</span>
            </div>
          ) : src ? (
            isNativeSrc ? (
              // SA-signed CDN URL — <video> plays directly without CORS issues
              <video
                ref={videoRef}
                key={src}
                src={src}
                controls
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                onError={() => toast.error('Video could not be loaded.')}
                className="w-full h-full max-h-full object-contain"
                autoPlay
              />
            ) : (
              // Public Google Drive preview embed
              <iframe
                key={src}
                src={src}
                title={title}
                className="w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            )
          ) : (
            <div className="text-gray-500 text-sm">No video to display.</div>
          )}
        </div>

        {/* Sidebar */}
        {hasSidebar && sidebarOpen && sidebarSlot && (
          <div className="w-72 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
            {sidebarSlot}
          </div>
        )}
      </div>
    </div>
  );
};

export default DriveVideoPlayer;
