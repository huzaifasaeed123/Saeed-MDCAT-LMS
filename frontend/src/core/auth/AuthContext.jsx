import React, { createContext, useState, useEffect, useCallback } from 'react';
import apiClient from '../api/axiosConfig';
import { setAccessToken, clearAccessToken } from './tokenManager';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true); // true only during the initial silent refresh

  // ── Silent refresh — runs once on mount (page load / hard refresh) ──────────
  // Browser sends the httpOnly refresh-token cookie automatically.
  // On success: store access token in memory, hydrate user state.
  // On failure: user is not logged in — no redirect here, PrivateRoute handles it.
  useEffect(() => {
    const silentRefresh = async () => {
      try {
        const res = await apiClient.post('/auth/refresh-token');
        if (res.data.success) {
          setAccessToken(res.data.accessToken);
          setUser(res.data.user);
        }
      } catch {
        // No valid refresh token — guest state, do nothing
      } finally {
        setLoading(false);
      }
    };

    silentRefresh();
  }, []);

  // ── Listen for session-expired events fired by the axios interceptor ────────
  // Fired when the refresh token itself is invalid/expired — force logout.
  useEffect(() => {
    const onSessionExpired = () => {
      clearAccessToken();
      setUser(null);
    };

    window.addEventListener('auth:session-expired', onSessionExpired);
    return () => window.removeEventListener('auth:session-expired', onSessionExpired);
  }, []);

  // Called after login / register / google auth — receives user + raw access token
  const updateUser = useCallback((userData, accessToken) => {
    if (accessToken) setAccessToken(accessToken);
    setUser(userData);
  }, []);

  // Called on explicit logout
  const clearUser = useCallback(() => {
    clearAccessToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, updateUser, clearUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
