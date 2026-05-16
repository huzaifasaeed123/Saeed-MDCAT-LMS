// Shared folder/file browser for both Notes and Videos sections.
// Props:
//   apiBase        — 'notes' or 'videos' (maps to /api/{apiBase}/*)
//   pageTitle      — heading text (pushed to top navbar)
//   pageDesc       — subtitle text (pushed to top navbar)
//   fileTypeHint   — shown in AddFile modal (e.g. "PDFs and Google Docs")
//   renderViewer   — (file, files, onClose) => ReactNode
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  FiFolder, FiFile, FiX, FiPlus, FiUpload, FiHome, FiChevronRight,
  FiMoreVertical, FiEdit2, FiTrash2, FiLoader,
  FiLock, FiGlobe, FiVideo, FiSearch, FiGrid, FiList, FiPlayCircle,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import useAuth from '../../core/auth/useAuth';
import apiClient from '../../core/api/axiosConfig';
import { usePageHeader } from '../../core/layouts/PageHeaderContext';

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

const getTypeLabel = (mime = '') =>
  MIME_LABELS[mime] || (mime.startsWith('video/') ? 'Video' : 'File');

// ── Item three-dot menu ──────────────────────────────────────────────────────
const ItemMenu = ({ onRename, onDelete }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className="p-1.5 text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] rounded-lg transition-colors"
        aria-label="Item actions"
      >
        <FiMoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-[var(--bg-surface)] rounded-xl shadow-lg border border-[var(--border)] z-20 py-1">
          <button
            onClick={() => { setOpen(false); onRename(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-muted)]"
          >
            <FiEdit2 className="w-3.5 h-3.5" /> Rename
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            <FiTrash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

// ── Cards ─────────────────────────────────────────────────────────────────────
const FolderCard = ({ folder, isStaff, onOpen, onRename, onDelete }) => (
  <div
    onClick={onOpen}
    className="group bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-3 sm:p-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md cursor-pointer transition-all flex items-center gap-3"
  >
    <div className="w-10 h-10 sm:w-11 sm:h-11 bg-primary-50 dark:bg-primary-950/40 rounded-xl flex items-center justify-center flex-shrink-0">
      <FiFolder className="w-5 h-5 text-primary-600 dark:text-primary-300" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-[var(--text-strong)] truncate">{folder.name}</p>
      <p className="text-[11px] text-[var(--text-faint)] mt-0.5">Folder</p>
    </div>
    {isStaff && <ItemMenu onRename={() => onRename(folder)} onDelete={() => onDelete(folder)} />}
  </div>
);

// Single shared FileCard for both Notes and Videos. Video files get the play
// icon + violet tint, PDFs get the red tint, other files get the muted tint.
const FileCard = ({ file, view, isStaff, onOpen, onRename, onDelete }) => {
  const isVideo = file.mimeType?.startsWith('video/');
  const isPdf   = file.mimeType === 'application/pdf';

  const iconBox = isVideo
    ? 'bg-secondary-50 dark:bg-secondary-950/40 text-secondary-600 dark:text-secondary-300'
    : isPdf
      ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300'
      : 'bg-[var(--bg-muted)] text-[var(--text-muted)]';

  const IconComp = isVideo ? FiPlayCircle : isPdf ? FiFile : FiFile;

  // ── Grid (default): bigger card with icon block on top
  if (view === 'grid') {
    return (
      <div
        onClick={onOpen}
        className="group bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-3 sm:p-4 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-md cursor-pointer transition-all flex items-center gap-3"
      >
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBox}`}>
          {file.isProtected
            ? <FiLock className="w-5 h-5" />
            : <IconComp className="w-5 h-5" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-strong)] truncate">{file.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-[var(--text-faint)]">
            <span>{getTypeLabel(file.mimeType)}</span>
            <span>·</span>
            <span className={file.isProtected ? 'text-emerald-600 dark:text-emerald-300 font-medium' : ''}>
              {file.isProtected ? 'Protected' : 'Public'}
            </span>
            <span>·</span>
            <span>drive</span>
          </div>
        </div>
        {isStaff && <ItemMenu onRename={() => onRename(file)} onDelete={() => onDelete(file)} />}
      </div>
    );
  }

  // ── List view: compact row layout
  return (
    <div
      onClick={onOpen}
      className="group bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2.5 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm cursor-pointer transition-all flex items-center gap-3"
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBox}`}>
        {file.isProtected
          ? <FiLock className="w-4 h-4" />
          : <IconComp className="w-4 h-4" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-strong)] truncate">{file.name}</p>
        <p className="text-[11px] text-[var(--text-faint)] mt-0.5">
          {getTypeLabel(file.mimeType)} · {file.isProtected ? 'Protected' : 'Public'}
        </p>
      </div>
      <FiChevronRight className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0" />
      {isStaff && <ItemMenu onRename={() => onRename(file)} onDelete={() => onDelete(file)} />}
    </div>
  );
};

// ── Breadcrumb (Home → folder chain) ─────────────────────────────────────────
const Breadcrumb = ({ rootLabel, chain, onNavigate }) => (
  <nav className="flex items-center gap-1 flex-wrap min-w-0">
    <button
      onClick={() => onNavigate(null)}
      className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-[var(--text-muted)] hover:text-primary-600 dark:hover:text-primary-300 hover:bg-[var(--bg-muted)] rounded-lg transition-colors"
    >
      <FiHome className="w-4 h-4" /> {rootLabel}
    </button>
    {chain.map((folder, i) => (
      <div key={folder._id} className="flex items-center gap-1 min-w-0">
        <FiChevronRight className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0" />
        {i === chain.length - 1 ? (
          <span className="px-2 py-1 text-sm font-bold text-[var(--text-strong)] truncate">
            {folder.name}
          </span>
        ) : (
          <button
            onClick={() => onNavigate(folder._id)}
            className="px-2 py-1 text-sm font-medium text-[var(--text-muted)] hover:text-primary-600 dark:hover:text-primary-300 hover:bg-[var(--bg-muted)] rounded-lg transition-colors truncate"
          >
            {folder.name}
          </button>
        )}
      </div>
    ))}
  </nav>
);

// ── Modals ────────────────────────────────────────────────────────────────────
const NewFolderModal = ({ open, onClose, onSubmit, busy }) => {
  const [name, setName] = useState('');
  useEffect(() => { if (open) setName(''); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[var(--text-strong)] mb-4">New folder</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSubmit(name.trim()); }}
          placeholder="Folder name"
          className="w-full px-4 py-2.5 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-muted)] rounded-xl">Cancel</button>
          <button
            onClick={() => name.trim() && onSubmit(name.trim())}
            disabled={!name.trim() || busy}
            className="btn-brand text-sm px-4 py-2 disabled:opacity-50"
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
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[var(--text-strong)] mb-1">Add file from Drive</h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">Paste the share link of a {fileTypeHint}.</p>

        <div className="flex rounded-xl overflow-hidden border border-[var(--border)] mb-4">
          <button
            type="button"
            onClick={() => setIsProtected(false)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              !isProtected
                ? 'bg-primary-500 text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
            }`}
          >
            <FiGlobe className="w-4 h-4" /> Public
          </button>
          <button
            type="button"
            onClick={() => setIsProtected(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              isProtected
                ? 'bg-emerald-600 text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
            }`}
          >
            <FiLock className="w-4 h-4" /> Protected
          </button>
        </div>

        {isProtected ? (
          <div className="flex gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-2.5 mb-3">
            <FiLock className="w-4 h-4 text-emerald-600 dark:text-emerald-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              File stays <span className="font-semibold">private</span> on Drive — streamed via service account.
              {serviceAccountEmail
                ? <> Share it with <span className="font-mono font-semibold break-all"> {serviceAccountEmail}</span>.</>
                : <> Share it with your service account email.</>
              }
            </p>
          </div>
        ) : (
          <div className="flex gap-2 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-900/60 rounded-xl p-2.5 mb-3">
            <FiGlobe className="w-4 h-4 text-primary-600 dark:text-primary-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-primary-700 dark:text-primary-300">
              File must be shared as <span className="font-semibold">"Anyone with the link can view"</span>.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <input
            value={driveUrl}
            onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="https://drive.google.com/file/d/…"
            className="w-full px-4 py-2.5 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name (optional — auto-detected if API key is set)"
            className="w-full px-4 py-2.5 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
          />
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-muted)] rounded-xl">Cancel</button>
          <button
            onClick={() => driveUrl.trim() && onSubmit({ driveUrl: driveUrl.trim(), name: name.trim(), isProtected })}
            disabled={!driveUrl.trim() || busy}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 ${
              isProtected ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary-500 hover:bg-primary-600'
            }`}
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
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[var(--text-strong)] mb-1">Import folder from Drive</h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Paste a Drive folder share link. The entire structure ({fileTypeHint}) will be imported.
        </p>

        <div className="flex rounded-xl overflow-hidden border border-[var(--border)] mb-4">
          <button
            type="button"
            onClick={() => setIsProtected(false)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              !isProtected
                ? 'bg-primary-500 text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
            }`}
          >
            <FiGlobe className="w-4 h-4" /> Public
          </button>
          <button
            type="button"
            onClick={() => setIsProtected(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors ${
              isProtected
                ? 'bg-emerald-600 text-white'
                : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
            }`}
          >
            <FiLock className="w-4 h-4" /> Protected
          </button>
        </div>

        {isProtected ? (
          <div className="flex gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-2.5 mb-3">
            <FiLock className="w-4 h-4 text-emerald-600 dark:text-emerald-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              All files marked <span className="font-semibold">Protected</span> — streamed via service account.
              {serviceAccountEmail
                ? <> Share folder with <span className="font-mono font-semibold break-all"> {serviceAccountEmail}</span>.</>
                : <> Share the folder with your service account email.</>
              }
            </p>
          </div>
        ) : (
          <div className="flex gap-2 bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-900/60 rounded-xl p-2.5 mb-3">
            <FiGlobe className="w-4 h-4 text-primary-600 dark:text-primary-300 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-primary-700 dark:text-primary-300">
              Folder must be shared as <span className="font-semibold">"Anyone with the link can view"</span>. Requires a Drive API key in Settings.
            </p>
          </div>
        )}

        <input
          value={driveUrl}
          onChange={(e) => setDriveUrl(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/…"
          className="w-full px-4 py-2.5 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
        />

        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-muted)] rounded-xl">Cancel</button>
          <button
            onClick={() => driveUrl.trim() && onSubmit(driveUrl.trim(), isProtected)}
            disabled={!driveUrl.trim() || busy}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl disabled:opacity-50 ${
              isProtected ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-secondary-600 hover:bg-secondary-700'
            }`}
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
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-[var(--text-strong)] mb-4">Rename</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSubmit(name.trim()); }}
          className="w-full px-4 py-2.5 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--bg-muted)] rounded-xl">Cancel</button>
          <button
            onClick={() => name.trim() && onSubmit(name.trim())}
            disabled={!name.trim() || busy}
            className="btn-brand text-sm px-4 py-2 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Section label ─────────────────────────────────────────────────────────────
const SectionLabel = ({ children, right }) => (
  <div className="flex items-end justify-between mb-2">
    <h2 className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-faint)]">
      {children}
    </h2>
    {right && <span className="text-[11px] text-[var(--text-faint)]">{right}</span>}
  </div>
);

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

  // Page title + tagline live in the top navbar.
  usePageHeader({ title: pageTitle, subtitle: pageDesc });

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

  // Frontend-only state — search filter (current folder + filename),
  // view toggle (grid vs list). Both reset when entering a new folder so
  // the user starts fresh inside each level of the tree.
  const [search, setSearch] = useState('');
  const [view,   setView]   = useState('grid'); // 'grid' | 'list'

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

  // Reset search when moving between folders — keeps the input from filtering
  // away the contents of a freshly opened folder.
  useEffect(() => { setSearch(''); }, [currentFolder]);

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

  // ── Derived: frontend search filter (matches folder + file names) ─────────
  const q = search.trim().toLowerCase();
  const visibleFolders = useMemo(
    () => q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders,
    [folders, q]
  );
  const visibleFiles = useMemo(
    () => q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files,
    [files, q]
  );
  const totalCount = visibleFiles.length;

  // Section labels — "Lectures" for videos, "Files" for everything else.
  const filesSectionLabel = apiBase === 'videos' ? 'Lectures' : 'Files';
  // Root crumb label — "Videos" or "Notes" depending on the section.
  const rootLabel = apiBase === 'videos' ? 'Videos' : 'Notes';

  return (
    <div>
      {/* ── Staff toolbar (top) ── */}
      {isStaff && (
        <div className="flex gap-2 flex-wrap mb-4">
          <button
            onClick={() => setNewFolderOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-950/60 rounded-xl transition-colors"
          >
            <FiPlus className="w-4 h-4" /> New folder
          </button>
          <button
            onClick={() => setAddFileOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60 rounded-xl transition-colors"
          >
            <FiUpload className="w-4 h-4" /> {apiBase === 'videos' ? 'Add video' : 'Add file'}
          </button>
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-secondary-600 dark:text-secondary-300 bg-secondary-50 dark:bg-secondary-950/40 hover:bg-secondary-100 dark:hover:bg-secondary-950/60 rounded-xl transition-colors"
          >
            <FiPlus className="w-4 h-4" /> Import from Drive
          </button>
        </div>
      )}

      {/* ── Toolbar: breadcrumb (left) + search + view toggle (right) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-2 sm:p-3">
        {/* Breadcrumb — anchors the location, scrolls horizontally on tight phones */}
        <div className="flex-1 min-w-0 overflow-x-auto">
          <Breadcrumb rootLabel={rootLabel} chain={breadcrumb} onNavigate={navigateTo} />
        </div>

        {/* Search + view toggle */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative flex-1 sm:flex-initial">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] w-4 h-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={apiBase === 'videos' ? 'Search videos…' : 'Search notes…'}
              className="w-full sm:w-64 pl-9 pr-8 py-2 text-sm bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-faint)] hover:text-[var(--text)]"
                aria-label="Clear search"
              >
                <FiX className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Grid / List view toggle */}
          <div className="flex bg-[var(--bg-muted)] rounded-xl border border-[var(--border)] p-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => setView('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                view === 'grid'
                  ? 'bg-[var(--bg-surface)] text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-[var(--text-faint)] hover:text-[var(--text)]'
              }`}
              aria-label="Grid view"
              aria-pressed={view === 'grid'}
            >
              <FiGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setView('list')}
              className={`p-1.5 rounded-lg transition-colors ${
                view === 'list'
                  ? 'bg-[var(--bg-surface)] text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-[var(--text-faint)] hover:text-[var(--text)]'
              }`}
              aria-label="List view"
              aria-pressed={view === 'list'}
            >
              <FiList className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-12">
          <FiLoader className="animate-spin w-6 h-6 text-[var(--text-faint)]" />
        </div>
      ) : (folders.length === 0 && files.length === 0) ? (
        <div className="text-center py-16 text-[var(--text-faint)] bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
          <FiFolder className="w-10 h-10 mx-auto mb-2 text-[var(--text-faint)]" />
          <p className="text-sm">This folder is empty.</p>
          {isStaff && <p className="text-xs mt-1">Use the buttons above to add folders or files.</p>}
        </div>
      ) : (visibleFolders.length === 0 && visibleFiles.length === 0) ? (
        <div className="text-center py-16 text-[var(--text-faint)] bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
          <FiSearch className="w-10 h-10 mx-auto mb-2 text-[var(--text-faint)]" />
          <p className="text-sm">No matches for "{search}"</p>
          <p className="text-xs mt-1">Search only looks inside this folder.</p>
        </div>
      ) : (
        <>
          {visibleFolders.length > 0 && (
            <section className="mb-6">
              <SectionLabel>Folders</SectionLabel>
              <div className={
                view === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'
                  : 'grid grid-cols-1 sm:grid-cols-2 gap-2'
              }>
                {visibleFolders.map((f) => (
                  <FolderCard
                    key={f._id} folder={f} isStaff={isStaff}
                    onOpen={() => navigateTo(f._id)}
                    onRename={(item) => setRenaming({ ...item, kind: 'folder' })}
                    onDelete={handleDeleteFolder}
                  />
                ))}
              </div>
            </section>
          )}

          {visibleFiles.length > 0 && (
            <section>
              <SectionLabel right={`${totalCount} ${totalCount === 1 ? 'item' : 'items'}`}>
                {filesSectionLabel}
              </SectionLabel>
              <div className={
                view === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'
                  : 'flex flex-col gap-2'
              }>
                {visibleFiles.map((f) => (
                  <FileCard
                    key={f._id} file={f} view={view} isStaff={isStaff}
                    onOpen={() => setViewingFile(f)}
                    onRename={(item) => setRenaming({ ...item, kind: 'file' })}
                    onDelete={handleDeleteFile}
                  />
                ))}
              </div>
            </section>
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
          onNavigate(file|null): null closes the viewer (returns to grid), a file
          object switches to that file. */}
      {viewingFile && renderViewer(viewingFile, files, (next = null) => setViewingFile(next))}
    </div>
  );
};

export default DriveContentPage;
