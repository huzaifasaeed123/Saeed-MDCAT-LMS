// Shared folder/file browser for both Notes and Videos sections.
// Props:
//   apiBase        — 'notes' or 'videos' (maps to /api/{apiBase}/*)
//   pageTitle      — heading text
//   pageDesc       — subtitle text
//   fileTypeHint   — shown in AddFile modal (e.g. "PDFs and Google Docs")
//   renderViewer   — (file, files, onClose) => ReactNode
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiFolder, FiFile, FiX, FiPlus, FiUpload, FiHome, FiChevronRight,
  FiMoreVertical, FiEdit2, FiTrash2, FiLoader,
  FiLock, FiGlobe, FiVideo,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import useAuth from '../../core/auth/useAuth';
import apiClient from '../../core/api/axiosConfig';

// ── MIME type label map ───────────────────────────────────────────────────────
const MIME_LABELS = {
  'application/pdf':                      'PDF',
  'application/vnd.google-apps.document': 'Doc',
  'video/mp4':                            'MP4',
  'video/webm':                           'WebM',
  'video/quicktime':                      'MOV',
  'video/x-msvideo':                      'AVI',
  'video/mpeg':                           'MPEG',
  'video/x-matroska':                     'MKV',
};

const getTypeLabel = (mime = '') => MIME_LABELS[mime] || (mime.startsWith('video/') ? 'Video' : 'File');

// ── Small reusable components ─────────────────────────────────────────────────

const ItemMenu = ({ onRename, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
      >
        <FiMoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-white rounded-xl shadow-lg border border-gray-200 z-20 py-1">
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onRename(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <FiEdit2 className="w-3.5 h-3.5" /> Rename
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <FiTrash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

const FolderCard = ({ folder, isStaff, onOpen, onRename, onDelete }) => (
  <div
    onClick={onOpen}
    className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all flex items-center gap-3"
  >
    <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
      <FiFolder className="w-5 h-5 text-blue-600" />
    </div>
    <p className="flex-1 min-w-0 text-sm font-medium text-gray-800 truncate">{folder.name}</p>
    {isStaff && <ItemMenu onRename={() => onRename(folder)} onDelete={() => onDelete(folder)} />}
  </div>
);

const FileCard = ({ file, isStaff, onOpen, onRename, onDelete }) => {
  const isVideo = file.mimeType?.startsWith('video/');
  return (
    <div
      onClick={onOpen}
      className="group bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all flex items-center gap-3"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${file.isProtected ? 'bg-green-50' : isVideo ? 'bg-purple-50' : 'bg-red-50'}`}>
        {file.isProtected
          ? <FiLock   className="w-5 h-5 text-green-600" />
          : isVideo
            ? <FiVideo  className="w-5 h-5 text-purple-600" />
            : <FiFile   className="w-5 h-5 text-red-600" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-400">{getTypeLabel(file.mimeType)}</span>
          {file.isProtected
            ? <span className="text-xs text-green-600 font-medium">· Protected</span>
            : <span className="text-xs text-gray-400 font-medium">· Public</span>
          }
        </div>
      </div>
      {isStaff && <ItemMenu onRename={() => onRename(file)} onDelete={() => onDelete(file)} />}
    </div>
  );
};

const Breadcrumb = ({ chain, onNavigate }) => (
  <div className="flex items-center gap-1 flex-wrap mb-4 bg-white rounded-xl border border-gray-200 px-3 py-2">
    <button
      onClick={() => onNavigate(null)}
      className="flex items-center gap-1 px-2 py-1 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
    >
      <FiHome className="w-4 h-4" /> Root
    </button>
    {chain.map((folder, i) => (
      <div key={folder._id} className="flex items-center gap-1">
        <FiChevronRight className="w-4 h-4 text-gray-300" />
        {i === chain.length - 1 ? (
          <span className="px-2 py-1 text-sm font-semibold text-gray-900">{folder.name}</span>
        ) : (
          <button
            onClick={() => onNavigate(folder._id)}
            className="px-2 py-1 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            {folder.name}
          </button>
        )}
      </div>
    ))}
  </div>
);

// ── Modals ────────────────────────────────────────────────────────────────────

const NewFolderModal = ({ open, onClose, onSubmit, busy }) => {
  const [name, setName] = useState('');
  useEffect(() => { if (open) setName(''); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-4">New folder</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSubmit(name.trim()); }}
          placeholder="Folder name"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button
            onClick={() => name.trim() && onSubmit(name.trim())}
            disabled={!name.trim() || busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
          >
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AddFileModal = ({ open, onClose, onSubmit, busy, serviceAccountEmail, fileTypeHint }) => {
  const [name,        setName]        = useState('');
  const [driveUrl,    setDriveUrl]    = useState('');
  const [isProtected, setIsProtected] = useState(false);
  useEffect(() => { if (open) { setName(''); setDriveUrl(''); setIsProtected(false); } }, [open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Add file from Drive</h2>
        <p className="text-xs text-gray-500 mb-4">Paste the share link of a {fileTypeHint}.</p>

        <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-4">
          <button
            type="button"
            onClick={() => setIsProtected(false)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${!isProtected ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <FiGlobe className="w-4 h-4" /> Public
          </button>
          <button
            type="button"
            onClick={() => setIsProtected(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${isProtected ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <FiLock className="w-4 h-4" /> Protected
          </button>
        </div>

        {isProtected ? (
          <div className="flex gap-2 bg-green-50 border border-green-200 rounded-xl p-2.5 mb-3">
            <FiLock className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-green-700">
              File stays <span className="font-semibold">private</span> on Drive — streamed via service account.
              {serviceAccountEmail
                ? <> Share it with <span className="font-mono font-semibold break-all"> {serviceAccountEmail}</span>.</>
                : <> Share it with your service account email.</>
              }
            </p>
          </div>
        ) : (
          <div className="flex gap-2 bg-blue-50 border border-blue-200 rounded-xl p-2.5 mb-3">
            <FiGlobe className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              File must be shared as <span className="font-semibold">"Anyone with the link can view"</span>.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <input
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/…"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name (optional — auto-detected if API key is set)"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button
            onClick={() => driveUrl.trim() && onSubmit({ driveUrl: driveUrl.trim(), name: name.trim(), isProtected })}
            disabled={!driveUrl.trim() || busy}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 ${isProtected ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {busy ? 'Adding…' : 'Add file'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ImportDriveModal = ({ open, onClose, onSubmit, busy, serviceAccountEmail, fileTypeHint }) => {
  const [driveUrl,    setDriveUrl]    = useState('');
  const [isProtected, setIsProtected] = useState(false);
  useEffect(() => { if (open) { setDriveUrl(''); setIsProtected(false); } }, [open]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Import folder from Drive</h2>
        <p className="text-xs text-gray-500 mb-4">
          Paste a Drive folder share link. The entire structure ({fileTypeHint}) will be imported.
        </p>

        <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-4">
          <button
            type="button"
            onClick={() => setIsProtected(false)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${!isProtected ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <FiGlobe className="w-4 h-4" /> Public
          </button>
          <button
            type="button"
            onClick={() => setIsProtected(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${isProtected ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <FiLock className="w-4 h-4" /> Protected
          </button>
        </div>

        {isProtected ? (
          <div className="flex gap-2 bg-green-50 border border-green-200 rounded-xl p-2.5 mb-3">
            <FiLock className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-green-700">
              All files marked <span className="font-semibold">Protected</span> — streamed via service account.
              {serviceAccountEmail
                ? <> Share folder with <span className="font-mono font-semibold break-all"> {serviceAccountEmail}</span>.</>
                : <> Share the folder with your service account email.</>
              }
            </p>
          </div>
        ) : (
          <div className="flex gap-2 bg-blue-50 border border-blue-200 rounded-xl p-2.5 mb-3">
            <FiGlobe className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Folder must be shared as <span className="font-semibold">"Anyone with the link can view"</span>. Requires a Drive API key in Settings.
            </p>
          </div>
        )}

        <input
          value={driveUrl}
          onChange={(e) => setDriveUrl(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/…"
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button
            onClick={() => driveUrl.trim() && onSubmit(driveUrl.trim(), isProtected)}
            disabled={!driveUrl.trim() || busy}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 ${isProtected ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'}`}
          >
            {busy ? 'Importing…' : 'Start import'}
          </button>
        </div>
      </div>
    </div>
  );
};

const RenameModal = ({ item, onClose, onSubmit, busy }) => {
  const [name, setName] = useState('');
  useEffect(() => { if (item) setName(item.name); }, [item]);
  if (!item) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Rename</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSubmit(name.trim()); }}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
          <button
            onClick={() => name.trim() && onSubmit(name.trim())}
            disabled={!name.trim() || busy}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main exported component ───────────────────────────────────────────────────

const DriveContentPage = ({
  apiBase,
  pageTitle,
  pageDesc,
  fileTypeHint = 'file',
  renderViewer,
}) => {
  const { isAdmin, isTeacher } = useAuth();
  const isStaff = isAdmin || isTeacher;

  const [currentFolder, setCurrentFolder] = useState(null);
  const [folders,       setFolders]       = useState([]);
  const [files,         setFiles]         = useState([]);
  const [breadcrumb,    setBreadcrumb]    = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');

  const [viewingFile,   setViewingFile]   = useState(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [addFileOpen,   setAddFileOpen]   = useState(false);
  const [importOpen,    setImportOpen]    = useState(false);
  const [renaming,      setRenaming]      = useState(null);
  const [busy,          setBusy]          = useState(false);

  useEffect(() => {
    if (!isStaff) return;
    apiClient.get('/settings')
      .then((r) => setServiceAccountEmail(r.data.data?.serviceAccountEmail || ''))
      .catch(() => {});
  }, [isStaff]);

  const load = useCallback(async (folderId) => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/${apiBase}/contents`, { params: { folder: folderId || 'root' } });
      const d = res.data.data;
      setFolders(d.folders || []);
      setFiles(d.files || []);
      setBreadcrumb(d.breadcrumb || []);
    } catch {
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => { load(currentFolder); }, [currentFolder, load]);

  const navigateTo = (folderId) => {
    setCurrentFolder(folderId);
    setViewingFile(null);
  };

  // ── Admin actions ───────────────────────────────────────────────────────────
  const handleCreateFolder = async (name) => {
    setBusy(true);
    try {
      const res = await apiClient.post(`/${apiBase}/folders`, { name, parent: currentFolder });
      setFolders((f) => [...f, res.data.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderOpen(false);
      toast.success('Folder created');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create folder');
    } finally { setBusy(false); }
  };

  const handleAddFile = async ({ driveUrl, name, isProtected }) => {
    setBusy(true);
    try {
      const res = await apiClient.post(`/${apiBase}/files`, { folder: currentFolder, driveUrl, name, isProtected });
      setFiles((f) => [...f, res.data.data].sort((a, b) => a.name.localeCompare(b.name)));
      setAddFileOpen(false);
      toast.success('File added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add file');
    } finally { setBusy(false); }
  };

  const handleImportDrive = async (driveUrl, isProtected) => {
    setBusy(true);
    try {
      const res = await apiClient.post(`/${apiBase}/import-drive`, { driveUrl, parent: currentFolder, isProtected });
      const d = res.data.data;
      toast.success(`Imported ${d.folderCount} folder${d.folderCount !== 1 ? 's' : ''} and ${d.fileCount} file${d.fileCount !== 1 ? 's' : ''}`);
      setImportOpen(false);
      await load(currentFolder);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Drive import failed');
    } finally { setBusy(false); }
  };

  const handleRename = async (newName) => {
    if (!renaming) return;
    setBusy(true);
    try {
      const isFolder = renaming.kind === 'folder';
      const res = await apiClient.put(
        `/${apiBase}/${isFolder ? 'folders' : 'files'}/${renaming._id}`,
        { name: newName }
      );
      if (isFolder) {
        setFolders((arr) => arr.map((x) => x._id === renaming._id ? res.data.data : x).sort((a, b) => a.name.localeCompare(b.name)));
      } else {
        setFiles((arr) => arr.map((x) => x._id === renaming._id ? res.data.data : x).sort((a, b) => a.name.localeCompare(b.name)));
      }
      setRenaming(null);
      toast.success('Renamed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Rename failed');
    } finally { setBusy(false); }
  };

  const handleDeleteFolder = async (folder) => {
    if (!window.confirm(`Delete "${folder.name}" and all its contents? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/${apiBase}/folders/${folder._id}`);
      setFolders((arr) => arr.filter((x) => x._id !== folder._id));
      toast.success('Folder deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Delete "${file.name}"?`)) return;
    try {
      await apiClient.delete(`/${apiBase}/files/${file._id}`);
      setFiles((arr) => arr.filter((x) => x._id !== file._id));
      toast.success('File deleted');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-sm text-gray-500">{pageDesc}</p>
        </div>
        {isStaff && (
          <div className="flex gap-2 flex-wrap justify-end">
            <button
              onClick={() => setNewFolderOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl"
            >
              <FiPlus className="w-4 h-4" /> New folder
            </button>
            <button
              onClick={() => setAddFileOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-green-600 bg-green-50 hover:bg-green-100 rounded-xl"
            >
              <FiPlus className="w-4 h-4" /> Add file
            </button>
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-xl"
            >
              <FiUpload className="w-4 h-4" /> Import from Drive
            </button>
          </div>
        )}
      </div>

      {/* Breadcrumb */}
      <Breadcrumb chain={breadcrumb} onNavigate={navigateTo} />

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <FiLoader className="animate-spin w-6 h-6 text-gray-400" />
        </div>
      ) : (folders.length === 0 && files.length === 0) ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
          <FiFolder className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">This folder is empty.</p>
          {isStaff && <p className="text-xs mt-1">Use the buttons above to add folders or files.</p>}
        </div>
      ) : (
        <>
          {folders.length > 0 && (
            <>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Folders</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                {folders.map((f) => (
                  <FolderCard
                    key={f._id} folder={f} isStaff={isStaff}
                    onOpen={() => navigateTo(f._id)}
                    onRename={(item) => setRenaming({ ...item, kind: 'folder' })}
                    onDelete={handleDeleteFolder}
                  />
                ))}
              </div>
            </>
          )}
          {files.length > 0 && (
            <>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Files</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {files.map((f) => (
                  <FileCard
                    key={f._id} file={f} isStaff={isStaff}
                    onOpen={() => setViewingFile(f)}
                    onRename={(item) => setRenaming({ ...item, kind: 'file' })}
                    onDelete={handleDeleteFile}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Modals */}
      <NewFolderModal open={newFolderOpen} onClose={() => setNewFolderOpen(false)} onSubmit={handleCreateFolder} busy={busy} />
      <AddFileModal
        open={addFileOpen} onClose={() => setAddFileOpen(false)}
        onSubmit={handleAddFile} busy={busy}
        serviceAccountEmail={serviceAccountEmail} fileTypeHint={fileTypeHint}
      />
      <ImportDriveModal
        open={importOpen} onClose={() => setImportOpen(false)}
        onSubmit={handleImportDrive} busy={busy}
        serviceAccountEmail={serviceAccountEmail} fileTypeHint={fileTypeHint}
      />
      <RenameModal item={renaming} onClose={() => setRenaming(null)} onSubmit={handleRename} busy={busy} />

      {/* Viewer — rendered via render prop so Notes/Videos can use different viewers.
          onNavigate(file|null): null closes, a file object switches to that file. */}
      {viewingFile && renderViewer(viewingFile, files, (next = null) => setViewingFile(next))}
    </div>
  );
};

export default DriveContentPage;
