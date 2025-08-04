// utils/fixImageUrls.js
export const fixImageUrls = (htmlContent) => {
  const backendUrl = import.meta.env.BACKEND_URL || 'http://localhost:5000';
  if (!htmlContent) return '';

  // Replace <img src="/..."> with <img src="http://backend/...">
  return htmlContent.replace(
    /<img\s+([^>]*?)src=["'](\/[^"']+)["']([^>]*?)>/g,
    `<img $1src="${backendUrl}$2"$3>`
  );
};
