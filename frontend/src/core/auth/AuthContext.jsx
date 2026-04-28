import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/axiosConfig';
import { getAccessToken, setAccessToken, clearAccessToken } from './tokenManager';

export const AuthContext = createContext();

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser]                       = useState(null);
  const [loading, setLoading]                 = useState(true);
  const [msgUnreadCount, setMsgUnreadCount]   = useState(0);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  // Notifications list owned here so the bell dropdown can open with zero
  // API calls in the common case. Populated from the SSE 'connected' event,
  // updated on incoming 'notification' events. Capped at 30 in memory; older
  // ones are loaded on-demand by the dropdown's "Load older" button.
  const [notifications, setNotifications]     = useState([]);
  const sseSourceRef                      = useRef(null);
  const sseRetryRef                       = useRef(null);

  // ── Silent refresh on page load ───────────────────────────────────────────
  useEffect(() => {
    const silentRefresh = async () => {
      try {
        const res = await apiClient.post('/auth/refresh-token');
        if (res.data.success) {
          setAccessToken(res.data.accessToken);
          setUser(res.data.user);
        }
      } catch { /* guest */ }
      finally { setLoading(false); }
    };
    silentRefresh();
  }, []);

  // ── Session expired (fired by axios interceptor) ──────────────────────────
  useEffect(() => {
    const onSessionExpired = () => { clearAccessToken(); setUser(null); };
    window.addEventListener('auth:session-expired', onSessionExpired);
    return () => window.removeEventListener('auth:session-expired', onSessionExpired);
  }, []);

  // ── SSE connection — open on login, close on logout ───────────────────────
  // One persistent connection per logged-in user. All push events (messages,
  // notifications, leaderboard, community) flow through this single pipe.
  // Events are broadcast via window CustomEvent so any component can listen
  // without prop-drilling: window.addEventListener('sse:event', handler)
  useEffect(() => {
    if (!user) {
      // Logged out — close any existing connection
      sseSourceRef.current?.close();
      sseSourceRef.current = null;
      clearTimeout(sseRetryRef.current);
      return;
    }

    const connect = () => {
      const token = getAccessToken();
      if (!token) return; // token not ready yet

      const url = `${API_BASE}/stream?token=${encodeURIComponent(token)}`;
      const source = new EventSource(url, { withCredentials: true });
      sseSourceRef.current = source;

      source.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);

          // Badge counter + notifications list managed here so they survive
          // page navigation. AuthContext never re-mounts while the user is
          // logged in.
          if (data.type === 'connected') {
            setMsgUnreadCount(data.unreadTotal || 0);
            setNotifUnreadCount(data.notifUnreadTotal || 0);
            // Hydrate the notifications list from the inlined SSE payload —
            // the bell dropdown can now render without any API call.
            setNotifications(data.notifications || []);
          } else if (data.type === 'new_message') {
            setMsgUnreadCount((n) => n + 1);
          } else if (data.type === 'messages_read') {
            setMsgUnreadCount((n) => Math.max(0, n - (data.decrementBy || 0)));
          } else if (data.type === 'notification' && data.notification) {
            // Single SSE handler covers both NEW notifications (insert) and
            // COLLAPSED helpful notifications (update existing in place).
            const incoming = data.notification;
            setNotifications((list) => {
              const idx = list.findIndex((n) => n._id === incoming._id);
              if (idx !== -1) {
                // Replace existing — collapsed helpful notification got bumped
                const next = list.slice();
                next[idx] = incoming;
                return next;
              }
              // Brand new — prepend, cap at 30
              return [incoming, ...list].slice(0, 30);
            });
            // Only increment unread badge for genuinely new notifications;
            // collapsed updates of an already-unread item don't add a "new" badge.
            setNotifUnreadCount((n) => n + 1);
          } else if (data.type === 'notifications_read') {
            setNotifUnreadCount(0);
            setNotifications((list) => list.map((n) => ({ ...n, isRead: true })));
          }

          // Dispatch to all other interested components (MessagesPage, etc.)
          window.dispatchEvent(new CustomEvent('sse:event', { detail: data }));
        } catch { /* malformed frame */ }
      };

      source.onerror = () => {
        source.close();
        sseSourceRef.current = null;
        // Retry after 3s — refresh access token first in case it expired
        sseRetryRef.current = setTimeout(async () => {
          try {
            const res = await apiClient.post('/auth/refresh-token');
            if (res.data.success) setAccessToken(res.data.accessToken);
          } catch { /* ignore — connect() will handle bad token */ }
          connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      clearTimeout(sseRetryRef.current);
      sseSourceRef.current?.close();
      sseSourceRef.current = null;
    };
  }, [user?.id]); // reconnect only when the logged-in user changes

  const updateUser = useCallback((userData, accessToken) => {
    if (accessToken) setAccessToken(accessToken);
    setUser(userData);
  }, []);

  const clearUser = useCallback(() => {
    clearAccessToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, updateUser, clearUser, loading,
      msgUnreadCount, notifUnreadCount,
      notifications, setNotifications,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
