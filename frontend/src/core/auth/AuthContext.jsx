import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/axiosConfig';
import { getAccessToken, setAccessToken, clearAccessToken } from './tokenManager';

export const AuthContext = createContext();

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser]                       = useState(null);
  const [loading, setLoading]                 = useState(true);
  // ── Feature & course access ──────────────────────────────────────────────
  // Hydrated from /auth/refresh-token (or /auth/login) on app load and
  // re-synced from the SSE 'connected' frame on every (re)connect. Updated
  // in real time when admin toggles access via the 'feature_access_updated'
  // event. Stored separately from `user` so AuthContext owns a single source
  // of truth that every screen + the FeatureGate wrapper can read.
  const [featureAccess, setFeatureAccess]     = useState({
    autoTest: false, community: false, videos: false, notes: false,
  });
  // When true (and featureAccess.courses === true), the student has access
  // to EVERY course — courseAccess is ignored. Set by the "Grant all courses"
  // toggle in the admin UI or implicitly by the bulk "enable Courses for all".
  const [coursesGrantAll, setCoursesGrantAll] = useState(false);
  const [courseAccess,  setCourseAccess]      = useState([]); // array of course id strings
  const [msgUnreadCount, setMsgUnreadCount]   = useState(0);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  // Notifications list owned here so the bell dropdown can open with zero
  // API calls in the common case. Populated from the SSE 'connected' event,
  // updated on incoming 'notification' events. Capped at 30 in memory; older
  // ones are loaded on-demand by the dropdown's "Load older" button.
  const [notifications, setNotifications]     = useState([]);
  // Same pattern for announcements: hydrated from SSE 'connected', mutated by
  // 'announcement_new'/'announcement_update'/'announcement_delete' events. The
  // dashboard widget renders the first 5 from this list; the slide-in panel
  // renders all of them and lazy-loads more.
  const [announcements, setAnnouncements]     = useState([]);
  const [announcementUnreadCount, setAnnouncementUnreadCount] = useState(0);
  // Syllabus badge — driven by SSE. Holds the due-today count + revision
  // streak so the sidebar pill and dashboard tile render with zero API calls.
  // Updated on the 'connected' frame and bumped on 'syllabus_progress_update'.
  const [syllabusDueCount, setSyllabusDueCount] = useState(0);
  const [syllabusStreak,   setSyllabusStreak]   = useState(0);
  // Admin-only live presence count — populated from the SSE 'connected' frame
  // (initial value) and refreshed on every 'active_users' broadcast. Stored
  // here so any admin component can read it without prop-drilling.
  // Shape: { users: number, connections: number }
  const [activeUsers, setActiveUsers] = useState(null);
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
          // Backend ships featureAccess + coursesGrantAll + courseAccess
          // inside the user payload so the sidebar/dashboard can render the
          // correct lock states on first paint — no extra round-trip.
          if (res.data.user?.featureAccess) setFeatureAccess(res.data.user.featureAccess);
          setCoursesGrantAll(!!res.data.user?.coursesGrantAll);
          if (Array.isArray(res.data.user?.courseAccess)) setCourseAccess(res.data.user.courseAccess);
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
            // Same hydration for announcements — covers dashboard widget AND
            // the slide-in panel up to its first page (15) without any API call.
            setAnnouncements(data.announcements || []);
            setAnnouncementUnreadCount(data.announcementUnreadCount || 0);
            // Syllabus badge — due-count + revision streak.
            if (data.syllabus) {
              setSyllabusDueCount(data.syllabus.dueCount || 0);
              setSyllabusStreak(data.syllabus.streak || 0);
            }
            // Feature + course access — re-synced on every (re)connect so the
            // sidebar lock badges stay accurate even after offline windows.
            if (data.featureAccess) setFeatureAccess(data.featureAccess);
            if (data.coursesGrantAll !== undefined) setCoursesGrantAll(!!data.coursesGrantAll);
            if (Array.isArray(data.courseAccess)) setCourseAccess(data.courseAccess);
            // Admin-only: initial live presence count, included only for
            // role === 'admin' connections by the backend.
            if (data.activeUsers) setActiveUsers(data.activeUsers);
          } else if (data.type === 'active_users') {
            // Live presence broadcast — backend pushes this on every connect
            // /disconnect (debounced server-side). Admin dashboards read it
            // straight from context.
            setActiveUsers({ users: data.users, connections: data.connections });
          } else if (data.type === 'session_replaced') {
            // Single Session mode: another device just logged in as this user.
            // Drop client state immediately so we redirect to /login on the
            // next render. The SSE connection will tear itself down via the
            // user-effect cleanup once `user` becomes null.
            clearAccessToken();
            setUser(null);
            // Reset access flags so nothing leaks across the logout boundary.
            setFeatureAccess({ autoTest: false, community: false, videos: false, notes: false });
            setCoursesGrantAll(false);
            setCourseAccess([]);
            setActiveUsers(null);
            // Surface a UX message — a CustomEvent so any layer (Navbar,
            // login page, toast layer) can show its preferred notification
            // without us coupling AuthContext to react-toastify here.
            window.dispatchEvent(new CustomEvent('auth:session-replaced', {
              detail: { message: data.message || 'You were signed out from this device.' },
            }));
          } else if (data.type === 'feature_access_updated') {
            // Admin toggled this user's access — apply immediately so the
            // lock pages flip without a page refresh.
            if (data.featureAccess) setFeatureAccess(data.featureAccess);
            if (data.coursesGrantAll !== undefined) setCoursesGrantAll(!!data.coursesGrantAll);
            if (Array.isArray(data.courseAccess)) setCourseAccess(data.courseAccess);
          } else if (data.type === 'bulk_access_updated') {
            // Admin flipped a feature for everyone in one shot. We don't know
            // our per-user shape from this payload (intentional — backend
            // doesn't want to compute N personalised SSE frames), so we
            // re-pull our own access via /auth/refresh-token. Single API call.
            apiClient.post('/auth/refresh-token')
              .then((r) => {
                if (r.data?.success && r.data.user) {
                  if (r.data.user.featureAccess) setFeatureAccess(r.data.user.featureAccess);
                  setCoursesGrantAll(!!r.data.user.coursesGrantAll);
                  if (Array.isArray(r.data.user.courseAccess)) setCourseAccess(r.data.user.courseAccess);
                }
              })
              .catch(() => { /* silent — next reconnect will re-sync */ });
          } else if (data.type === 'syllabus_progress_update') {
            // Server doesn't know the new due-count yet (would cost a DB
            // hit). We optimistically nudge the badge here; the next
            // 'connected' frame (on reconnect or refresh) re-syncs from
            // the source of truth.
            setSyllabusDueCount((n) => Math.max(0, n - 1));
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
          } else if (data.type === 'announcement_new' && data.announcement) {
            // Server broadcasts to all sockets; client-side audience filter
            // drops events that don't apply to this user (cheap, no DB hit).
            const a = data.announcement;
            const r = user?.role;
            const audOk = a.audience === 'everyone'
              || (a.audience === 'students' && r === 'student')
              || (a.audience === 'teachers' && r === 'teacher')
              || (a.audience === 'admins'   && r === 'admin');
            if (!audOk) return;
            setAnnouncements((list) => {
              if (list.some((x) => x._id === a._id)) return list;
              // Pinned-first sort is preserved by re-sorting on insert. Cap at 30.
              const next = [a, ...list];
              next.sort((x, y) => {
                if (!!y.pinned !== !!x.pinned) return (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0);
                return new Date(y.createdAt) - new Date(x.createdAt);
              });
              return next.slice(0, 30);
            });
            // The creator shouldn't see their own announcement as unread.
            // Skip the badge bump — race-free, regardless of HTTP/SSE order.
            const createdById = a.createdBy && (a.createdBy._id || a.createdBy);
            if (String(createdById) !== String(user?.id)) {
              setAnnouncementUnreadCount((n) => n + 1);
            }
          } else if (data.type === 'announcement_update' && data.announcement) {
            const a = data.announcement;
            setAnnouncements((list) => {
              const idx = list.findIndex((x) => x._id === a._id);
              if (idx === -1) return list;
              const next = list.slice();
              next[idx] = a;
              next.sort((x, y) => {
                if (!!y.pinned - !!x.pinned !== 0) return (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0);
                return new Date(y.createdAt) - new Date(x.createdAt);
              });
              return next;
            });
          } else if (data.type === 'announcement_delete' && data.id) {
            setAnnouncements((list) => list.filter((x) => x._id !== data.id));
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
    // Sync access state too — login/register responses carry the same shape
    // as /auth/me so the lock badges render correctly on first dashboard hit.
    if (userData?.featureAccess) setFeatureAccess(userData.featureAccess);
    setCoursesGrantAll(!!userData?.coursesGrantAll);
    if (Array.isArray(userData?.courseAccess)) setCourseAccess(userData.courseAccess);
  }, []);

  const clearUser = useCallback(() => {
    clearAccessToken();
    setUser(null);
    setFeatureAccess({ autoTest: false, community: false, videos: false, notes: false });
    setCoursesGrantAll(false);
    setCourseAccess([]);
    setActiveUsers(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, updateUser, clearUser, loading,
      featureAccess, setFeatureAccess,
      coursesGrantAll, setCoursesGrantAll,
      courseAccess,  setCourseAccess,
      msgUnreadCount, notifUnreadCount,
      notifications, setNotifications,
      announcements, setAnnouncements,
      announcementUnreadCount, setAnnouncementUnreadCount,
      syllabusDueCount, setSyllabusDueCount,
      syllabusStreak,   setSyllabusStreak,
      activeUsers,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
