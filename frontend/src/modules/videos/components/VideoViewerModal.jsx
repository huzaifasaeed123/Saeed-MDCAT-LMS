// Full-screen video player — refactored to use shared DriveVideoPlayer.
// Public videos   → Google Drive preview iframe.
// Protected videos → SA-signed CDN URL rendered as <video> tag (isNativeSrc=true).
import { useState, useEffect } from 'react';
import { FiPlay } from 'react-icons/fi';
import { toast } from 'react-toastify';
import apiClient from '../../../core/api/axiosConfig';
import DriveVideoPlayer from '../../../shared/components/DriveVideoPlayer';

const MIME_LABELS = {
  'video/mp4': 'MP4', 'video/webm': 'WebM', 'video/quicktime': 'MOV',
  'video/x-msvideo': 'AVI', 'video/mpeg': 'MPEG', 'video/x-matroska': 'MKV',
};

const VideoViewerModal = ({ file, files = [], onNavigate }) => {
  const [viewSrc,     setViewSrc]     = useState(null);
  const [srcLoading,  setSrcLoading]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const currentIndex = files.findIndex((f) => f._id === file?._id);
  const hasPrev      = currentIndex > 0;
  const hasNext      = currentIndex < files.length - 1;

  // ── Resolve video source ──────────────────────────────────────────────────
  useEffect(() => {
    if (!file) { setViewSrc(null); return; }

    if (!file.isProtected) {
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
        onNavigate(null);
      })
      .finally(() => { if (!cancelled) setSrcLoading(false); });

    return () => { cancelled = true; };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!file) return null;

  // ── Playlist sidebar content ──────────────────────────────────────────────
  const PlaylistSidebar = files.length > 1 ? (
    <div className="flex flex-col h-full">
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
  ) : undefined;

  return (
    <DriveVideoPlayer
      src={viewSrc}
      title={file.name}
      loading={srcLoading}
      isProtected={file.isProtected}
      isNativeSrc={file.isProtected}
      onClose={() => onNavigate(null)}
      onPrev={files.length > 1 ? () => hasPrev && onNavigate(files[currentIndex - 1]) : undefined}
      onNext={files.length > 1 ? () => hasNext && onNavigate(files[currentIndex + 1]) : undefined}
      hasPrev={hasPrev}
      hasNext={hasNext}
      pageInfo={files.length > 1 ? `${currentIndex + 1} / ${files.length}` : undefined}
      sidebarSlot={PlaylistSidebar}
      sidebarOpen={sidebarOpen && files.length > 1}
      onToggleSidebar={() => setSidebarOpen((v) => !v)}
    />
  );
};

export default VideoViewerModal;
