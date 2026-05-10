// Full-screen PDF / Doc viewer — refactored to use shared DrivePdfViewer.
// Public  → Google Drive /preview iframe (no token needed).
// Protected → backend returns SA-signed URL via /notes/files/:id/drivetoken;
//             DrivePdfViewer renders it as an iframe.
import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import apiClient from '../../../core/api/axiosConfig';
import DrivePdfViewer from '../../../shared/components/DrivePdfViewer';

const NoteViewerModal = ({ file, files = [], onNavigate }) => {
  const [viewSrc,    setViewSrc]    = useState(null);
  const [srcLoading, setSrcLoading] = useState(false);

  const currentIndex = files.findIndex((f) => f._id === file?._id);
  const hasPrev      = currentIndex > 0;
  const hasNext      = currentIndex < files.length - 1;

  // ── Resolve view source ───────────────────────────────────────────────────
  useEffect(() => {
    if (!file) { setViewSrc(null); return; }

    if (!file.isProtected) {
      setViewSrc(`https://drive.google.com/file/d/${file.driveFileId}/preview`);
      return;
    }

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
        onNavigate(null);
      })
      .finally(() => { if (!cancelled) setSrcLoading(false); });

    return () => { cancelled = true; };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!file) return null;

  return (
    <DrivePdfViewer
      src={viewSrc}
      title={file.name}
      loading={srcLoading}
      isProtected={file.isProtected}
      onClose={() => onNavigate(null)}
      onPrev={files.length > 1 ? () => hasPrev && onNavigate(files[currentIndex - 1]) : undefined}
      onNext={files.length > 1 ? () => hasNext && onNavigate(files[currentIndex + 1]) : undefined}
      hasPrev={hasPrev}
      hasNext={hasNext}
      pageInfo={files.length > 1 ? `${currentIndex + 1} / ${files.length}` : undefined}
    />
  );
};

export default NoteViewerModal;
