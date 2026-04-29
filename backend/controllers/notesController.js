const jwt            = require('jsonwebtoken');
const { Readable }   = require('node:stream');
const https          = require('node:https');
const NoteFolder     = require('../models/NoteFolder');
const NoteFile       = require('../models/NoteFile');
const SystemSettings = require('../models/SystemSettings');
const {
  extractDriveId,
  fetchFileMeta,
  importDriveFolder,
  importDriveFolderProtected,
  ALLOWED_FILE_MIMES_BY_SECTION,
} = require('../utils/driveImporter');
const {
  getServiceAccountToken,
  driveFetchAuth,
  driveFetchFileMetaAuth,
} = require('../utils/driveService');

// ── Helpers ──────────────────────────────────────────────────────────────────
const getDriveApiKey = async () => {
  const s = await SystemSettings.findOne({ key: 'global' }).select('googleDriveApiKey').lean();
  return s?.googleDriveApiKey?.trim() || null;
};

const buildBreadcrumb = async (folderId) => {
  const chain = [];
  let current = folderId;
  for (let i = 0; i < 20 && current; i++) {
    const f = await NoteFolder.findById(current).select('name parent').lean();
    if (!f) break;
    chain.unshift({ _id: f._id, name: f.name });
    current = f.parent;
  }
  return chain;
};

const VIEW_TOKEN_SECRET = () => (process.env.JWT_SECRET || 'fallback') + '_nv';

// ── GET /api/notes/contents  or  /api/videos/contents ───────────────────────
exports.getContents = async (req, res) => {
  try {
    const section     = req.section;
    const folderParam = req.query.folder;
    const parent      = (!folderParam || folderParam === 'root') ? null : folderParam;

    const [folders, files, breadcrumb] = await Promise.all([
      NoteFolder.find({ parent, section }).sort({ name: 1 }).select('name createdAt').lean(),
      NoteFile.find({ folder: parent, section }).sort({ name: 1 })
        .select('name driveFileId mimeType isProtected createdAt').lean(),
      parent ? buildBreadcrumb(parent) : Promise.resolve([]),
    ]);

    res.json({ success: true, data: { folders, files, breadcrumb, currentFolder: parent } });
  } catch (err) {
    console.error('getContents error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── POST /api/notes/folders  or  /api/videos/folders ────────────────────────
exports.createFolder = async (req, res) => {
  try {
    const { name, parent = null } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    if (parent) {
      const exists = await NoteFolder.exists({ _id: parent });
      if (!exists) return res.status(400).json({ success: false, message: 'Parent folder not found' });
    }

    const folder = await NoteFolder.create({
      name: name.trim(), parent: parent || null,
      section: req.section, createdBy: req.user.id,
    });

    res.status(201).json({ success: true, data: folder });
  } catch (err) {
    console.error('createFolder error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/notes/folders/:id ───────────────────────────────────────────────
exports.renameFolder = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    const updated = await NoteFolder.findByIdAndUpdate(
      req.params.id,
      { $set: { name: name.trim() } },
      { new: true, lean: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Folder not found' });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('renameFolder error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── DELETE /api/notes/folders/:id ────────────────────────────────────────────
exports.deleteFolder = async (req, res) => {
  try {
    const rootId = req.params.id;
    const exists = await NoteFolder.exists({ _id: rootId });
    if (!exists) return res.status(404).json({ success: false, message: 'Folder not found' });

    const allFolderIds = [rootId];
    let frontier = [rootId];
    while (frontier.length) {
      const children = await NoteFolder.find({ parent: { $in: frontier } }).select('_id').lean();
      const nextIds  = children.map((c) => c._id);
      allFolderIds.push(...nextIds);
      frontier = nextIds;
    }

    await Promise.all([
      NoteFile.deleteMany({ folder: { $in: allFolderIds } }),
      NoteFolder.deleteMany({ _id: { $in: allFolderIds } }),
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('deleteFolder error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── POST /api/notes/files  or  /api/videos/files ────────────────────────────
exports.createFile = async (req, res) => {
  try {
    const section = req.section;
    const { folder, driveUrl, name, isProtected = false } = req.body;
    if (!driveUrl) return res.status(400).json({ success: false, message: 'Drive URL is required' });

    const driveFileId = extractDriveId(driveUrl);
    if (!driveFileId) {
      return res.status(400).json({ success: false, message: 'Could not extract a Drive file ID from the URL' });
    }

    if (folder) {
      const exists = await NoteFolder.exists({ _id: folder });
      if (!exists) return res.status(400).json({ success: false, message: 'Folder not found' });
    }

    const allowedMimes = ALLOWED_FILE_MIMES_BY_SECTION[section] || ALLOWED_FILE_MIMES_BY_SECTION.notes;
    const defaultMime  = section === 'videos' ? 'video/mp4' : 'application/pdf';

    let resolvedName = name?.trim();
    let mimeType     = defaultMime;

    if (isProtected) {
      try {
        const meta = await driveFetchFileMetaAuth(driveFileId);
        if (!resolvedName) resolvedName = meta.name;
        mimeType = meta.mimeType;
        if (!allowedMimes.has(mimeType)) {
          return res.status(400).json({ success: false, message: `File type not allowed for ${section} section` });
        }
      } catch (err) {
        if (!resolvedName) resolvedName = 'Untitled';
        console.warn('createFile (protected): meta lookup failed:', err.message);
      }
    } else {
      const apiKey = await getDriveApiKey();
      if (apiKey) {
        try {
          const meta = await fetchFileMeta(driveFileId, apiKey);
          if (!resolvedName) resolvedName = meta.name;
          mimeType = meta.mimeType;
          if (!allowedMimes.has(mimeType)) {
            return res.status(400).json({ success: false, message: `File type not allowed for ${section} section` });
          }
        } catch (err) {
          console.warn('createFile (public): Drive metadata lookup failed:', err.message);
        }
      }
    }

    if (!resolvedName) resolvedName = 'Untitled';

    const file = await NoteFile.create({
      name: resolvedName, folder: folder || null, section,
      driveFileId, mimeType, isProtected: !!isProtected, createdBy: req.user.id,
    });

    res.status(201).json({ success: true, data: file });
  } catch (err) {
    console.error('createFile error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── PUT /api/notes/files/:id ─────────────────────────────────────────────────
exports.renameFile = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: 'Name is required' });

    const updated = await NoteFile.findByIdAndUpdate(
      req.params.id,
      { $set: { name: name.trim() } },
      { new: true, lean: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'File not found' });

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('renameFile error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── DELETE /api/notes/files/:id ──────────────────────────────────────────────
exports.deleteFile = async (req, res) => {
  try {
    const result = await NoteFile.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ success: false, message: 'File not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('deleteFile error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── POST /api/notes/import-drive  or  /api/videos/import-drive ──────────────
exports.importDrive = async (req, res) => {
  try {
    const section = req.section;
    const { driveUrl, parent = null, isProtected = false } = req.body;
    if (!driveUrl) return res.status(400).json({ success: false, message: 'Drive folder URL is required' });

    const driveFolderId = extractDriveId(driveUrl);
    if (!driveFolderId) {
      return res.status(400).json({ success: false, message: 'Could not extract a Drive folder ID from the URL' });
    }

    if (parent) {
      const exists = await NoteFolder.exists({ _id: parent });
      if (!exists) return res.status(400).json({ success: false, message: 'Parent folder not found' });
    }

    let result;
    if (isProtected) {
      await getServiceAccountToken();
      result = await importDriveFolderProtected(driveFolderId, parent, req.user.id, section);
    } else {
      const apiKey = await getDriveApiKey();
      if (!apiKey) {
        return res.status(400).json({
          success: false,
          message: 'Google Drive API key is not configured. Add it in Settings first.',
        });
      }
      result = await importDriveFolder(driveFolderId, parent, req.user.id, apiKey, section);
    }

    res.json({
      success: true,
      data: { rootFolder: result.folder, folderCount: result.folderCount, fileCount: result.fileCount },
    });
  } catch (err) {
    console.error('importDrive error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server Error' });
  }
};

// ── Helper: resolve Google Drive CDN signed URL ───────────────────────────────
// Node.js 18 native fetch() with redirect:'manual' follows the WHATWG spec and
// returns status 0 (opaque redirect) — we cannot read the Location header.
// node:https gives the real 3xx status and Location header directly.
//
// acknowledgeAbuse=true is required for large binary files (videos) that
// Google has not yet virus-scanned — without it the API returns 403.
const resolveDriveCdnUrl = (fileId, bearerToken) => new Promise((resolve, reject) => {
  const req = https.request({
    hostname: 'www.googleapis.com',
    path:     `/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&acknowledgeAbuse=true`,
    method:   'GET',
    headers:  { Authorization: `Bearer ${bearerToken}` },
  }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume(); // discard body — we only need the Location header
      resolve(res.headers.location);
    } else {
      // Read Google's error body so we return a useful message
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const msg    = parsed?.error?.message
                      || parsed?.error?.errors?.[0]?.message
                      || body.slice(0, 200);
          reject(new Error(`Drive ${res.statusCode}: ${msg}`));
        } catch {
          reject(new Error(`Drive ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    }
  });
  req.on('error', reject);
  req.end();
});

// ── GET /api/notes/files/:id/drivetoken  (shared by notes + videos) ──────────
// Returns the Google CDN signed URL for a protected file.
// The CDN URL is on *.googleusercontent.com / storage.googleapis.com —
// a different domain from googleapis.com, so the browser's Google account
// cookies do NOT interfere.  <video src> / <iframe src> load directly from
// the CDN; all range requests (seeking) hit the CDN with no re-authentication.
exports.getDriveToken = async (req, res) => {
  try {
    const file = await NoteFile.findById(req.params.id)
      .select('driveFileId mimeType isProtected').lean();
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    if (!file.isProtected) {
      return res.status(400).json({ success: false, message: 'File is not protected — use Drive embed' });
    }

    const token     = await getServiceAccountToken();
    const DRIVE_API = 'https://www.googleapis.com/drive/v3';
    const isDoc     = file.mimeType === 'application/vnd.google-apps.document';

    let url;
    if (isDoc) {
      // Google Docs export: no CDN redirect — embed access_token so <iframe> can load it.
      url = `${DRIVE_API}/files/${file.driveFileId}/export?mimeType=application/pdf&access_token=${encodeURIComponent(token)}`;
    } else {
      // Binary files (PDFs stored as-is, videos, etc.) — resolve the CDN signed URL.
      url = await resolveDriveCdnUrl(file.driveFileId, token);
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: { url, mimeType: isDoc ? 'application/pdf' : file.mimeType },
    });
  } catch (err) {
    console.error('getDriveToken error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server Error' });
  }
};

// ── GET /api/notes/files/:id/view ────────────────────────────────────────────
exports.getFileView = async (req, res) => {
  try {
    const file = await NoteFile.findById(req.params.id)
      .select('name driveFileId mimeType isProtected').lean();
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    res.json({ success: true, data: file });
  } catch (err) {
    console.error('getFileView error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── GET /api/notes/files/:id/viewtoken  (shared by notes + videos) ───────────
exports.getViewToken = async (req, res) => {
  try {
    const file = await NoteFile.findById(req.params.id).select('isProtected').lean();
    if (!file) return res.status(404).json({ success: false, message: 'File not found' });
    if (!file.isProtected) {
      return res.status(400).json({ success: false, message: 'File is not protected — no token needed' });
    }

    const token = jwt.sign(
      { fileId: String(req.params.id), userId: req.user.id },
      VIEW_TOKEN_SECRET(),
      { expiresIn: '30m' }
    );

    res.json({ success: true, token });
  } catch (err) {
    console.error('getViewToken error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ── GET /api/notes/files/:id/stream  and  /api/videos/files/:id/stream ───────
// Auth via ?vt= view token. No protect middleware (iframes / <video> tags
// cannot send Authorization headers).
exports.streamFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { vt  } = req.query;

    if (!vt) return res.status(401).send('View token required');

    let payload;
    try {
      payload = jwt.verify(vt, VIEW_TOKEN_SECRET());
    } catch {
      return res.status(401).send('Invalid or expired view token');
    }

    if (payload.fileId !== id) return res.status(403).send('Forbidden');

    const file = await NoteFile.findById(id).select('driveFileId mimeType isProtected').lean();
    if (!file || !file.isProtected) return res.status(404).send('File not found');

    const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${frontendOrigin}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const isVideo = file.mimeType.startsWith('video/');
    const isDoc   = file.mimeType === 'application/vnd.google-apps.document';

    const driveUrl = isDoc
      ? `/files/${file.driveFileId}/export?mimeType=application/pdf`
      : `/files/${file.driveFileId}?alt=media`;

    if (isVideo) {
      // Forward Range header so the browser's media engine can seek.
      const rangeHeader  = req.headers.range;
      const extraHeaders = rangeHeader ? { Range: rangeHeader } : {};

      const driveRes = await driveFetchAuth(driveUrl, {}, extraHeaders);

      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

      const contentLength = driveRes.headers.get('content-length');
      const contentRange  = driveRes.headers.get('content-range');
      if (contentLength) res.setHeader('Content-Length', contentLength);
      if (contentRange)  res.setHeader('Content-Range', contentRange);

      res.status(rangeHeader ? 206 : 200);

      const nodeStream = Readable.fromWeb
        ? Readable.fromWeb(driveRes.body)
        : (() => {
            const reader = driveRes.body.getReader();
            return new Readable({
              async read() {
                const { done, value } = await reader.read().catch(() => ({ done: true }));
                if (done) this.push(null);
                else this.push(Buffer.from(value));
              },
            });
          })();

      nodeStream.pipe(res);
      req.on('close', () => nodeStream.destroy?.());

    } else {
      // Buffer the full PDF — required so Chrome's double-request pattern works correctly.
      const driveRes    = await driveFetchAuth(driveUrl);
      const arrayBuffer = await driveRes.arrayBuffer();
      const buffer      = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Accept-Ranges', 'none');
      res.end(buffer);
    }
  } catch (err) {
    console.error('streamFile error:', err);
    if (!res.headersSent) res.status(500).send(err.message || 'Server Error');
  }
};
