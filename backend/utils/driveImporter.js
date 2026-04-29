// ─── Google Drive importer ──────────────────────────────────────────────────
// Walks a Drive folder tree and creates NoteFolder + NoteFile records.
// Supports both public (API key) and protected (service account) modes,
// and both 'notes' and 'videos' sections.
// ────────────────────────────────────────────────────────────────────────────

const NoteFolder = require('../models/NoteFolder');
const NoteFile   = require('../models/NoteFile');

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const FOLDER_MIME    = 'application/vnd.google-apps.folder';

const ALLOWED_FILE_MIMES_BY_SECTION = {
  notes: new Set([
    'application/pdf',
    'application/vnd.google-apps.document',
  ]),
  videos: new Set([
    'video/mp4', 'video/webm', 'video/quicktime',
    'video/x-msvideo', 'video/mpeg', 'video/x-matroska',
    'video/3gpp', 'video/ogg',
  ]),
};

// Kept for backward-compat imports in notesController.
const ALLOWED_FILE_MIMES = ALLOWED_FILE_MIMES_BY_SECTION.notes;

// ── ID extraction ────────────────────────────────────────────────────────────
const extractDriveId = (input) => {
  if (!input) return null;
  const s = String(input).trim();
  const folder = s.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (folder) return folder[1];
  const file = s.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
  if (file) return file[1];
  const idParam = s.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idParam) return idParam[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(s)) return s;
  return null;
};

// ── Drive API helpers (public API key) ───────────────────────────────────────
const driveFetch = async (path, apiKey, params = {}) => {
  const url = new URL(`${DRIVE_API_BASE}${path}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive API ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
};

const fetchFolderMeta = (folderId, apiKey) =>
  driveFetch(`/files/${folderId}`, apiKey, { fields: 'id,name,mimeType' });

const listFolderChildren = async (folderId, apiKey) => {
  const all = [];
  let pageToken = null;
  do {
    const params = {
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken,files(id,name,mimeType)',
      pageSize: '100',
    };
    if (pageToken) params.pageToken = pageToken;
    const res = await driveFetch('/files', apiKey, params);
    all.push(...(res.files || []));
    pageToken = res.nextPageToken;
  } while (pageToken);
  return all;
};

const fetchFileMeta = (fileId, apiKey) =>
  driveFetch(`/files/${fileId}`, apiKey, { fields: 'id,name,mimeType' });

// ── Public importer ──────────────────────────────────────────────────────────
const importDriveFolder = async (driveFolderId, parentDbId, userId, apiKey, section = 'notes', depth = 0) => {
  if (depth > 10) throw new Error('Drive import aborted: tree depth exceeds 10 levels');

  const meta = await fetchFolderMeta(driveFolderId, apiKey);
  if (meta.mimeType !== FOLDER_MIME) throw new Error(`Drive ID ${driveFolderId} is not a folder`);

  const folder = await NoteFolder.create({
    name: meta.name, parent: parentDbId, section, driveFolderId, createdBy: userId,
  });

  let folderCount = 1, fileCount = 0;
  const allowedMimes = ALLOWED_FILE_MIMES_BY_SECTION[section] || ALLOWED_FILE_MIMES_BY_SECTION.notes;
  const children = await listFolderChildren(driveFolderId, apiKey);

  for (const child of children) {
    if (child.mimeType === FOLDER_MIME) {
      const sub = await importDriveFolder(child.id, folder._id, userId, apiKey, section, depth + 1);
      folderCount += sub.folderCount;
      fileCount   += sub.fileCount;
    } else if (allowedMimes.has(child.mimeType)) {
      await NoteFile.create({
        name: child.name, folder: folder._id, section,
        driveFileId: child.id, mimeType: child.mimeType, createdBy: userId,
      });
      fileCount += 1;
    }
  }

  return { folder, folderCount, fileCount };
};

// ── Protected importer (Service Account) ────────────────────────────────────
const {
  driveFetchFolderMetaAuth,
  driveListFolderAuth,
} = require('./driveService');

const importDriveFolderProtected = async (driveFolderId, parentDbId, userId, section = 'notes', depth = 0) => {
  if (depth > 10) throw new Error('Drive import aborted: tree depth exceeds 10 levels');

  const meta = await driveFetchFolderMetaAuth(driveFolderId);
  if (meta.mimeType !== FOLDER_MIME) throw new Error(`Drive ID ${driveFolderId} is not a folder`);

  const folder = await NoteFolder.create({
    name: meta.name, parent: parentDbId, section, driveFolderId, createdBy: userId,
  });

  let folderCount = 1, fileCount = 0;
  const allowedMimes = ALLOWED_FILE_MIMES_BY_SECTION[section] || ALLOWED_FILE_MIMES_BY_SECTION.notes;
  const children = await driveListFolderAuth(driveFolderId);

  for (const child of children) {
    if (child.mimeType === FOLDER_MIME) {
      const sub = await importDriveFolderProtected(child.id, folder._id, userId, section, depth + 1);
      folderCount += sub.folderCount;
      fileCount   += sub.fileCount;
    } else if (allowedMimes.has(child.mimeType)) {
      await NoteFile.create({
        name: child.name, folder: folder._id, section,
        driveFileId: child.id, mimeType: child.mimeType,
        isProtected: true, createdBy: userId,
      });
      fileCount += 1;
    }
  }

  return { folder, folderCount, fileCount };
};

module.exports = {
  extractDriveId,
  fetchFolderMeta,
  fetchFileMeta,
  importDriveFolder,
  importDriveFolderProtected,
  ALLOWED_FILE_MIMES,
  ALLOWED_FILE_MIMES_BY_SECTION,
  FOLDER_MIME,
};
