// Service Account authentication for Google Drive.
// Used by the "Protected" notes mode — files remain private on Drive and are
// streamed through our server after validating the user's JWT session.
//
// Uses google-auth-library (already installed) rather than the heavier googleapis
// package. Authentication is cached for the lifetime of the access token (~1 hour).

const { GoogleAuth } = require('google-auth-library');
const SystemSettings  = require('../models/SystemSettings');

// In-memory token cache — avoids a DB read + Google round-trip on every request.
let _token      = null;
let _expiry     = 0;      // ms timestamp
let _keyLen     = 0;      // used to detect when admin replaces the key

const invalidateTokenCache = () => {
  _token  = null;
  _expiry = 0;
  _keyLen = 0;
};

// Returns a valid Bearer token string (refreshes automatically when expired).
const getServiceAccountToken = async () => {
  const s = await SystemSettings.findOne({ key: 'global' })
    .select('googleServiceAccountKey').lean();
  const keyStr = s?.googleServiceAccountKey?.trim();

  if (!keyStr) {
    throw new Error('Google Service Account key is not configured. Add it in Settings → Google Drive Integration.');
  }

  let credentials;
  try {
    credentials = JSON.parse(keyStr);
  } catch {
    throw new Error('Service Account key in Settings is not valid JSON. Re-paste it from the downloaded .json file.');
  }

  const now = Date.now();
  // Reuse cached token if still valid (60 s buffer) and key hasn't changed.
  if (_token && _expiry > now + 60_000 && _keyLen === keyStr.length) {
    return _token;
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  const client   = await auth.getClient();
  const { token, res } = await client.getAccessToken();

  _token  = token;
  _expiry = res?.data?.expiry_date ?? (now + 3_600_000);
  _keyLen = keyStr.length;

  return _token;
};

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

// Generic authenticated Drive REST call.
// Returns the fetch Response (caller decides whether to parse JSON or stream).
// extraHeaders allows forwarding Range headers for video range requests.
//
// IMPORTANT: we use redirect:'manual' and follow 3xx manually WITHOUT the
// Authorization header.  Node.js fetch strips auth on cross-origin redirects by
// default (security spec), so the token never reaches the CDN and Google returns
// 401.  Google CDN redirect URLs are already signed — they need no auth header.
const driveFetchAuth = async (path, params = {}, extraHeaders = {}) => {
  const token = await getServiceAccountToken();
  const url   = new URL(`${DRIVE_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString(), {
    headers:  { Authorization: `Bearer ${token}`, ...extraHeaders },
    redirect: 'manual',
  });

  // Follow 3xx redirect to Google's signed CDN URL (no auth header needed).
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    if (!location) throw new Error('Drive redirect missing Location header');
    const cdnRes = await fetch(location, { headers: { ...extraHeaders } });
    if (!cdnRes.ok && cdnRes.status !== 206) {
      const text = await cdnRes.text().catch(() => '');
      throw new Error(`Drive CDN ${cdnRes.status}: ${text.slice(0, 300)}`);
    }
    return cdnRes;
  }

  // 206 Partial Content is OK for range requests.
  if (!res.ok && res.status !== 206) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive API ${res.status}: ${text.slice(0, 300)}`);
  }
  return res;
};

// Fetch folder metadata (name, mimeType).
const driveFetchFolderMetaAuth = async (folderId) => {
  const res = await driveFetchAuth(`/files/${folderId}`, { fields: 'id,name,mimeType' });
  return res.json();
};

// List all children of a folder, following pagination.
const driveListFolderAuth = async (folderId) => {
  const all = [];
  let pageToken = null;
  do {
    const params = {
      q:         `'${folderId}' in parents and trashed=false`,
      fields:    'nextPageToken,files(id,name,mimeType)',
      pageSize:  '100',
    };
    if (pageToken) params.pageToken = pageToken;
    const res  = await driveFetchAuth('/files', params);
    const data = await res.json();
    all.push(...(data.files || []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return all;
};

// Fetch file metadata (name, mimeType).
const driveFetchFileMetaAuth = async (fileId) => {
  const res = await driveFetchAuth(`/files/${fileId}`, { fields: 'id,name,mimeType' });
  return res.json();
};

module.exports = {
  getServiceAccountToken,
  invalidateTokenCache,
  driveFetchAuth,
  driveFetchFolderMetaAuth,
  driveListFolderAuth,
  driveFetchFileMetaAuth,
};
