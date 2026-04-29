// Full-screen video player with folder sidebar for quick switching.
// Props:
//   file       — current NoteFile (video)
//   files      — all files in folder (for sidebar + prev/next)
//   onNavigate — (file|null) => void
import { useState, useEffect, useRef } from 'react';
import {
  FiArrowLeft, FiX, FiMaximize2, FiMinimize2,
  FiLock, FiVideo, FiChevronLeft, FiChevronRight,
  FiLoader, FiList, FiPlay,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import apiClient from '../../../core/api/axiosConfig';

const MIME_LABELS = {
  'video/mp4': 'MP4', 'video/webm': 'WebM', 'video/quicktime': 'MOV',
  'video/x-msvideo': 'AVI', 'video/mpeg': 'MPEG', 'video/x-matroska': 'MKV',
};

const VideoViewerModal = ({ file, files = [], onNavigate }) => {
  const containerRef = useRef(null);
  const onNavRef     = useRef(onNavigate);
  const videoRef     = useRef(null);
  useEffect(() => { onNavRef.current = onNavigate; });

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(true);
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

  // ── Resolve video source ──────────────────────────────────────────────────
  useEffect(() => {
    if (!file) { setViewSrc(null); return; }

    if (!file.isProtected) {
      // Public videos: use Google Drive's preview embed player.
      setViewSrc(`https://drive.google.com/file/d/${file.driveFileId}/preview`);
      return;
    }

    let cancelled = false;
    setViewSrc(null);
    setSrcLoading(true);
    apiClient.get(`/videos/files/${file._id}/drivetoken`)
      .then(({ data }) => {
        if (cancelled) return;
        setViewSrc(data.data.url);
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err?.response?.data?.message || 'Cannot load protected video');
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

  const isProtected = file.isProtected;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex flex-col">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 text-white border-b border-gray-800 flex-shrink-0">

        {/* Left: back + icon + title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button onClick={() => onNavigate(null)} className="p-2 hover:bg-gray-800 rounded-lg flex-shrink-0" title="Close (Esc)">
            <FiArrowLeft className="w-5 h-5" />
          </button>
          {isProtected
            ? <FiLock  className="w-4 h-4 text-green-400 flex-shrink-0" />
            : <FiVideo className="w-4 h-4 text-purple-400 flex-shrink-0" />
          }
          <span className="truncate font-medium text-sm">{file.name}</span>
          <span className="hidden sm:inline text-xs text-gray-400 px-2 py-0.5 rounded-full bg-gray-800 flex-shrink-0">
            {MIME_LABELS[file.mimeType] || 'Video'}
          </span>
          {isProtected && (
            <span className="hidden sm:inline text-xs text-green-400 px-2 py-0.5 rounded-full bg-green-900/40 flex-shrink-0">
              Protected
            </span>
          )}
        </div>

        {/* Right: prev/next + counter + sidebar toggle + fullscreen + close */}
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {files.length > 1 && (
            <>
              <button
                onClick={() => hasPrev && onNavigate(files[currentIndex - 1])}
                disabled={!hasPrev}
                className="p-2 hover:bg-gray-800 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Previous video"
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
                title="Next video"
              >
                <FiChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {files.length > 1 && (
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className={`p-2 rounded-lg ${sidebarOpen ? 'bg-gray-700 text-white' : 'hover:bg-gray-800 text-gray-400'}`}
              title="Toggle playlist"
            >
              <FiList className="w-5 h-5" />
            </button>
          )}

          <button onClick={toggleFullscreen} className="p-2 hover:bg-gray-800 rounded-lg" title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? <FiMinimize2 className="w-5 h-5" /> : <FiMaximize2 className="w-5 h-5" />}
          </button>
          <button onClick={() => onNavigate(null)} className="p-2 hover:bg-gray-800 rounded-lg" title="Close">
            <FiX className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Body: player + sidebar ── */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Player area */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-black relative">
          {srcLoading ? (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <FiLoader className="animate-spin w-10 h-10" />
              <span className="text-sm">Loading video…</span>
            </div>
          ) : viewSrc ? (
            isProtected ? (
              // Protected: SA-signed Google Drive API URL — <video> has no CORS
              // restriction, browser follows Google CDN redirect and plays directly.
              <video
                ref={videoRef}
                key={viewSrc}
                src={viewSrc}
                controls
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
                onError={() => toast.error('Video could not be loaded. Check that the file is shared with the Service Account.')}
                className="w-full h-full max-h-full object-contain"
                autoPlay
              />
            ) : (
              // Public: Google Drive embed player
              <iframe
                src={viewSrc}
                title={file.name}
                className="w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            )
          ) : null}
        </div>

        {/* Sidebar — folder playlist */}
        {sidebarOpen && files.length > 1 && (
          <div className="w-72 flex-shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
              <h3 className="text-sm font-semibold text-white">Playlist</h3>
              <p className="text-xs text-gray-400">{files.length} videos</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {files.map((f, i) => {
                const isActive = f._id === file._id;
                return (
                  <button
                    key={f._id}
                    onClick={() => !isActive && onNavigate(f)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-gray-800/50 ${
                      isActive ? 'bg-purple-900/40 cursor-default' : 'hover:bg-gray-800 cursor-pointer'
                    }`}
                  >
                    {/* Number / play indicator */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5 bg-gray-800">
                      {isActive
                        ? <FiPlay className="w-4 h-4 text-purple-400 fill-current" />
                        : <span className="text-xs text-gray-400 font-mono">{i + 1}</span>
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium leading-snug line-clamp-2 ${isActive ? 'text-purple-300' : 'text-gray-200'}`}>
                        {f.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-gray-500">{MIME_LABELS[f.mimeType] || 'Video'}</span>
                        {f.isProtected
                          ? <span className="text-xs text-green-500">· Protected</span>
                          : <span className="text-xs text-gray-500">· Public</span>
                        }
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoViewerModal;
