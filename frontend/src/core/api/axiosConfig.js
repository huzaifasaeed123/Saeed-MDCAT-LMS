import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from '../auth/tokenManager';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // sends httpOnly refresh-token cookie automatically
  headers: { 'Content-Type': 'application/json' },
});

// ── Request: attach access token from React memory ────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response: silent token renewal on 401 tokenExpired ───────────────────────
let _refreshPromise = null; // deduplicate concurrent refresh calls

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    const isTokenExpired =
      error.response?.status === 401 &&
      error.response?.data?.tokenExpired === true;

    const isRefreshRoute = originalRequest.url?.includes('/auth/refresh-token');

    // Do NOT silently replay non-idempotent uploads. The bulk MCQ import is a
    // large multipart POST; auto-resending it after a token refresh would run
    // the whole import twice and duplicate every question. For these, we refresh
    // the token but reject the original so the user retries from a clean state.
    const isNonReplayable = originalRequest.url?.includes('/mcqs/import-document');

    if (isTokenExpired && isNonReplayable && !originalRequest._retry && !isRefreshRoute) {
      // Refresh the token (so the next manual attempt succeeds) but do not
      // re-send this request body.
      originalRequest._retry = true;
      try {
        if (!_refreshPromise) {
          _refreshPromise = apiClient
            .post('/auth/refresh-token')
            .finally(() => { _refreshPromise = null; });
        }
        const refreshResponse = await _refreshPromise;
        setAccessToken(refreshResponse.data.accessToken);
      } catch (refreshError) {
        clearAccessToken();
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(refreshError);
      }
      return Promise.reject(error); // surface to caller; no auto-replay
    }

    if (isTokenExpired && !originalRequest._retry && !isRefreshRoute) {
      originalRequest._retry = true;

      try {
        // If multiple requests expire at the same time, only one refresh fires
        if (!_refreshPromise) {
          _refreshPromise = apiClient
            .post('/auth/refresh-token')
            .finally(() => { _refreshPromise = null; });
        }

        const refreshResponse = await _refreshPromise;
        const newToken = refreshResponse.data.accessToken;
        setAccessToken(newToken);

        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh token is gone / expired / reuse detected → force logout
        clearAccessToken();
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
