import DriveContentPage  from '../../drive/DriveContentPage';
import VideoViewerModal  from '../components/VideoViewerModal';

const VideosPage = () => (
  <DriveContentPage
    apiBase="videos"
    pageTitle="Videos"
    pageDesc="Browse course lecture videos."
    fileTypeHint="MP4 / WebM / MOV video file"
    renderViewer={(file, files, onNavigate) => (
      <VideoViewerModal file={file} files={files} onNavigate={onNavigate} />
    )}
  />
);

export default VideosPage;
