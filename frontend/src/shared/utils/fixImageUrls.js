// shared/utils/fixImageUrls.js
export const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || '';
  if (apiUrl) return apiUrl.replace(/\/api\/?$/, '');
  return 'http://localhost:5000';
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
