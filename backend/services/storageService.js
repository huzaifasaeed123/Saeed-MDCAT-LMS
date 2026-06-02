// services/storageService.js
// Single place that persists uploaded IMAGES and returns their public URL.
// Callers don't care where the bytes land — this service routes to Amazon S3
// when configured (config/storage.js → s3Enabled) and to the local uploads/
// folder otherwise. Only images are handled here; documents (.docx/.pdf/.xlsx)
// continue to use their existing local handling.
//
// Returned URL shape:
//   • S3 enabled  → absolute  https://<bucket-or-cdn>/<folder>/<uuid>.<ext>
//   • local       → relative  /uploads/<folder>/<uuid>.<ext>
// Both forms are already understood by the frontend's fixImageUrls helper
// (absolute http(s) URLs pass through untouched; /uploads paths get the backend
// origin prepended), so no frontend change is needed.

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const storageConfig = require('../config/storage');

// Lazily-created S3 client so the SDK isn't initialised when S3 is off.
let _s3Client = null;
const getS3Client = () => {
  if (_s3Client) return _s3Client;
  const { S3Client } = require('@aws-sdk/client-s3');
  _s3Client = new S3Client({
    region: storageConfig.region,
    credentials: {
      accessKeyId: storageConfig.accessKeyId,
      secretAccessKey: storageConfig.secretAccessKey,
    },
  });
  return _s3Client;
};

const EXT_CONTENT_TYPE = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp', '.emf': 'image/emf', '.wmf': 'image/wmf',
};

const guessContentType = (ext, fallback) =>
  EXT_CONTENT_TYPE[(ext || '').toLowerCase()] || fallback || 'application/octet-stream';

// ── Save an image buffer ─────────────────────────────────────────────────────
// opts: { folder = 'images', originalName, ext, contentType, filename }
// Returns the public URL string. On S3 failure with S3 enabled, falls back to
// local disk so an upload is never lost (logs a warning).
const saveImageBuffer = async (buffer, opts = {}) => {
  const folder = (opts.folder || 'images').replace(/^\/+|\/+$/g, '');
  const ext = (opts.ext || path.extname(opts.originalName || '') || '').toLowerCase();
  const filename = opts.filename || `${uuidv4()}${ext}`;
  const contentType = opts.contentType || guessContentType(ext, opts.contentType);

  if (storageConfig.s3Enabled) {
    try {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      // Final S3 key = <keyPrefix>/<folder>/<filename>, e.g.
      // public/skn-academy/images/<uuid>.png — matching the legacy layout.
      const key = [storageConfig.keyPrefix, folder, filename].filter(Boolean).join('/');
      await getS3Client().send(new PutObjectCommand({
        Bucket: storageConfig.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        // No ACL — bucket policy grants public read on the upload prefix.
      }));
      return `${storageConfig.publicBaseUrl}/${key}`;
    } catch (err) {
      // Fallback to local so the upload still succeeds.
      // eslint-disable-next-line no-console
      console.error('[storage] S3 upload failed, falling back to local disk:', err?.message || err);
    }
  }

  // Local disk path (default, or S3 fallback).
  return saveLocal(buffer, folder, filename);
};

const saveLocal = (buffer, folder, filename) => {
  const dir = path.join(__dirname, '..', 'uploads', folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `/uploads/${folder}/${filename}`;
};

// ── Delete an image by the URL we previously returned ────────────────────────
// Best-effort: S3 object if it's an absolute URL into our bucket, else local
// file if it's a /uploads/... path. Never throws.
const deleteImage = async (url) => {
  if (!url) return;
  try {
    const isAbsolute = /^https?:\/\//i.test(url);
    if (isAbsolute) {
      if (!storageConfig.s3Enabled || !storageConfig.publicBaseUrl) return;
      if (!url.startsWith(storageConfig.publicBaseUrl)) return; // not our bucket
      const key = url.slice(storageConfig.publicBaseUrl.length).replace(/^\/+/, '');
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      await getS3Client().send(new DeleteObjectCommand({ Bucket: storageConfig.bucket, Key: key }));
      return;
    }
    // Relative /uploads/... → local file.
    if (url.startsWith('/uploads/')) {
      const abs = path.join(__dirname, '..', url.replace(/^\//, ''));
      if (fs.existsSync(abs)) fs.unlinkSync(abs);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[storage] deleteImage failed (ignored):', err?.message || err);
  }
};

module.exports = { saveImageBuffer, deleteImage, guessContentType };
