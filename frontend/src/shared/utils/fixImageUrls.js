// shared/utils/fixImageUrls.js
export const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || '';
  if (apiUrl) return apiUrl.replace(/\/api\/?$/, '');
  return 'http://localhost:5000';
};

// Single-URL variant — for cases where you have one image src (e.g. a user's
// profilePicture) rather than an HTML blob. Prepends the backend URL when
// the src is a server-relative path, leaves absolute URLs (http/https/data)
// untouched, and returns null for empty input so React's <img> falls back
// to the parent's empty-state.
export const fixImageUrl = (url) => {
  if (!url) return null;
  // Already absolute or a data: URI — nothing to fix.
  if (/^(https?:\/\/|data:|blob:)/i.test(url)) return url;
  // Server-relative path (e.g. "/uploads/avatars/...")
  if (url.startsWith('/')) return `${getBackendUrl()}${url}`;
  // Anything else (e.g. "uploads/...") — assume same convention.
  return `${getBackendUrl()}/${url}`;
};

export const fixImageUrls = (htmlContent) => {
  if (!htmlContent) return '';
  const backendUrl = getBackendUrl();

  return htmlContent.replace(/<img\b([^>]*)>/gi, (match, attrs) => {
    // Fix relative src → prepend backendUrl
    let newAttrs = attrs.replace(
      /src=["'](\/[^"']+)["']/g,
      `src="${backendUrl}$1"`
    );
    // Normalise alt → always "Image"
    if (/alt\s*=/i.test(newAttrs)) {
      newAttrs = newAttrs.replace(/alt\s*=\s*["'][^"']*["']/gi, 'alt="Image"');
    } else {
      newAttrs += ' alt="Image"';
    }
    return `<img${newAttrs}>`;
  });
};
