// config/storage.js
// Central storage configuration. Decides whether uploaded IMAGES go to Amazon
// S3 or to the local `uploads/` folder, based purely on environment variables.
//
//   AWS_ENABLE=TRUE            → use S3 (only if all creds below are present)
//   AWS_REGION                 → e.g. ap-south-1
//   AWS_BUCKET_NAME            → e.g. skn-academy
//   AWS_ACCESS_KEY_ID
//   AWS_SECRET_ACCESS_KEY
//   AWS_PUBLIC_BASE_URL        → optional CDN/custom domain; if unset we derive
//                                https://<bucket>.s3.<region>.amazonaws.com
//   AWS_KEY_PREFIX             → optional base prefix prepended to every S3 key,
//                                so objects land under a known folder. Defaults
//                                to 'public/skn-academy' to match the legacy
//                                upload layout (public/skn-academy/<type>/<file>).
//
// If AWS_ENABLE is not exactly "TRUE" (case-insensitive) OR any required cred is
// missing, S3 is treated as DISABLED and everything falls back to local disk —
// so a half-configured env can never break uploads.

const enabledFlag = String(process.env.AWS_ENABLE || '').trim().toUpperCase() === 'TRUE';

const region          = process.env.AWS_REGION;
const bucket          = process.env.AWS_BUCKET_NAME;
const accessKeyId     = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

// Base prefix for every S3 object key. Trim slashes so we control joining.
// Default matches the legacy path layout `public/skn-academy/...`.
const keyPrefix = String(
  process.env.AWS_KEY_PREFIX != null ? process.env.AWS_KEY_PREFIX : 'public/skn-academy'
).replace(/^\/+|\/+$/g, '');

// S3 is only "really" enabled when the flag is on AND every credential exists.
const s3Enabled = enabledFlag && !!(region && bucket && accessKeyId && secretAccessKey);

// Public base URL used to build the returned image URL. Prefer an explicit
// CDN/custom-domain override; otherwise the virtual-hosted–style S3 URL.
const publicBaseUrl = s3Enabled
  ? (process.env.AWS_PUBLIC_BASE_URL
      || `https://${bucket}.s3.${region}.amazonaws.com`).replace(/\/+$/, '')
  : null;

// Warn loudly if the admin asked for S3 but it couldn't be enabled — this is the
// common "I set AWS_ENABLE but forgot a key" case.
if (enabledFlag && !s3Enabled) {
  // eslint-disable-next-line no-console
  console.warn('[storage] AWS_ENABLE=TRUE but S3 is NOT active — a required AWS_* variable is missing. Falling back to local disk for image uploads.');
}

module.exports = {
  s3Enabled,
  region,
  bucket,
  accessKeyId,
  secretAccessKey,
  publicBaseUrl,
  keyPrefix,
  isS3Enabled: () => s3Enabled,
};
