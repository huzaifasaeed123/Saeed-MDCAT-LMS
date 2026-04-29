import DriveContentPage from '../../drive/DriveContentPage';
import NoteViewerModal  from '../components/NoteViewerModal';

const NotesPage = () => (
  <DriveContentPage
    apiBase="notes"
    pageTitle="Notes"
    pageDesc="Browse course notes and reference materials."
    fileTypeHint="PDF or Google Doc"
    renderViewer={(file, files, onNavigate) => (
      <NoteViewerModal file={file} files={files} onNavigate={onNavigate} />
    )}
  />
);

export default NotesPage;
