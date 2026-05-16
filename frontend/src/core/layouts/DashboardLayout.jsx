// src/core/layouts/DashboardLayout.jsx
//
// SKN Academy LMS — main app shell.
//   • Sidebar: SKN wordmark, role-aware nav, theme toggle, profile card.
//     Orange active state (matches new primary palette), gradient soft hover.
//   • Top bar: date eyebrow (desktop), theme toggle, announcements bell,
//     notifications bell with dropdown.
//   • Mobile: sidebar collapses into a slide-in drawer with backdrop.
//     Touch targets ≥ 44px. Hidden date/eyebrow on small screens.
//   • Light + dark mode parity: every surface uses Tailwind dark: variants.
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FiMenu, FiX, FiHome, FiUsers, FiBook, FiBookOpen, FiFileText, FiSettings,
  FiLogOut, FiBarChart2, FiCheckSquare, FiDatabase, FiZap, FiSliders, FiFlag,
  FiMessageSquare, FiBell, FiMessageCircle, FiFolder, FiVideo, FiAward,
  FiChevronLeft, FiChevronRight, FiLock, FiSun, FiMoon,
} from 'react-icons/fi';
import { HiOutlineSpeakerphone } from 'react-icons/hi';
import useAuth from '../auth/useAuth';
import useTheme from '../theme/useTheme';
import apiClient from '../api/axiosConfig';
import AnnouncementsSidebar from '../../modules/announcements/components/AnnouncementsSidebar';
import { PageHeaderProvider, usePageHeaderState } from './PageHeaderContext';

// Collapsed helpful notifications carry a `count > 1` — render accordingly.
const NOTIF_LABELS = {
  reply:   (n) => `${n.actorName} replied to your post`,
  answer:  (n) => `${n.actorName} marked your reply as best answer`,
  helpful: (n) => {
    if (n.count > 1) {
      const others = n.count - 1;
      return `${n.actorName} and ${others} other${others > 1 ? 's' : ''} found your reply helpful`;
    }
    return `${n.actorName} found your reply helpful`;
  },
};

// Inner component renders the actual chrome. Wrapped by an outer
// PageHeaderProvider so child pages can call usePageHeader() and have their
// title/subtitle/action surface in the top bar.
const DashboardLayoutInner = ({ children }) => {
  const {
    user, isAdmin, isTeacher, isStudent, logout,
    msgUnreadCount, notifUnreadCount,
    notifications, setNotifications,
    announcementUnreadCount,
    hasFeature,
  } = useAuth();
  const { theme, toggle: toggleTheme } = useTheme();
  // Page-pushed header content (title + subtitle + action button).
  const pageHeader = usePageHeaderState();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const [olderPage,   setOlderPage]   = useState(1);
  const notifRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const toggleCollapse = () => {
    setSidebarCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch { /* noop */ }
      return next;
    });
  };

  // Close mobile drawer when navigating — feels right on touch devices and
  // prevents the drawer from staying open after a link tap.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cross-component opener: the dashboard widget's "View all" button fires this.
  useEffect(() => {
    const open = () => setAnnounceOpen(true);
    window.addEventListener('announcements:open', open);
    return () => window.removeEventListener('announcements:open', open);
  }, []);

  // Bell click: NO API call in the common case. The notifications list is
  // already in AuthContext.
  const openNotifs = () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening && notifUnreadCount > 0) {
      apiClient.put('/community/notifications/read').catch(() => {});
    }
  };

  const loadOlder = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await apiClient.get('/community/notifications', { params: { page: olderPage + 1 } });
      const older = res.data.data || [];
      setNotifications((list) => {
        const seen = new Set(list.map((n) => n._id));
        return [...list, ...older.filter((n) => !seen.has(n._id))];
      });
      setOlderPage((p) => p + 1);
      setHasMore(!!res.data.hasMore);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // ── Navigation items (role-aware) ────────────────────────────────────────
  const navigationItems = [];

  navigationItems.push({ name: 'Dashboard', icon: <FiHome className="w-5 h-5" />, path: '/dashboard' });

  if (isAdmin || isTeacher) {
    navigationItems.push({ name: 'Announcements', icon: <HiOutlineSpeakerphone className="w-5 h-5" />, path: '/admin/announcements' });
  }

  if (isAdmin) {
    navigationItems.push({ name: 'User Management',   icon: <FiUsers className="w-5 h-5" />,       path: '/admin/users' });
    navigationItems.push({ name: 'Course Management', icon: <FiBook className="w-5 h-5" />,        path: '/admin/courses' });
    navigationItems.push({ name: 'Tests & MCQs',      icon: <FiCheckSquare className="w-5 h-5" />, path: '/tests' });
    navigationItems.push({ name: 'Question Banks',    icon: <FiDatabase className="w-5 h-5" />,    path: '/admin/question-banks' });
    navigationItems.push({ name: 'Auto Test Generator', icon: <FiZap className="w-5 h-5" />,       path: '/admin/auto-test' });
    navigationItems.push({ name: 'MCQ Reports',       icon: <FiFlag className="w-5 h-5" />,        path: '/admin/mcq-reports' });
    navigationItems.push({ name: 'System Analytics',  icon: <FiBarChart2 className="w-5 h-5" />,   path: '/admin/analytics' });
    navigationItems.push({ name: 'Settings',          icon: <FiSliders className="w-5 h-5" />,     path: '/admin/settings' });
  }

  if (isTeacher) {
    navigationItems.push({ name: 'MCQ Reports',        icon: <FiFlag className="w-5 h-5" />,        path: '/teacher/mcq-reports' });
    navigationItems.push({ name: 'Tests & MCQs',       icon: <FiCheckSquare className="w-5 h-5" />, path: '/tests' });
    navigationItems.push({ name: 'Auto Test Generator', icon: <FiZap className="w-5 h-5" />,        path: '/auto-test' });
    navigationItems.push({ name: 'Test History',       icon: <FiFileText className="w-5 h-5" />,    path: '/student/tests' });
  }

  if (isStudent) {
    navigationItems.push({ name: 'My Courses',           icon: <FiBook className="w-5 h-5" />,     path: '/student/courses',     feature: 'courses' });
    navigationItems.push({ name: 'Create Practice Test', icon: <FiZap className="w-5 h-5" />,      path: '/auto-test',           feature: 'autoTest' });
    navigationItems.push({ name: 'Test History',         icon: <FiFileText className="w-5 h-5" />, path: '/student/tests' });
    navigationItems.push({ name: 'My MCQ Reports',       icon: <FiFlag className="w-5 h-5" />,     path: '/student/mcq-reports' });
  }

  navigationItems.push({ name: 'Leaderboard', icon: <FiAward className="w-5 h-5" />,       path: '/leaderboard' });
  navigationItems.push({ name: 'Community',   icon: <FiMessageCircle className="w-5 h-5" />, path: '/community', feature: 'community' });
  navigationItems.push({ name: 'Notes',       icon: <FiFolder className="w-5 h-5" />,      path: '/notes',     feature: 'notes' });
  navigationItems.push({ name: 'Videos',      icon: <FiVideo className="w-5 h-5" />,       path: '/videos',    feature: 'videos' });
  navigationItems.push({
    name:  'Messages',
    icon:  <FiMessageSquare className="w-5 h-5" />,
    path:  '/messages',
    badge: msgUnreadCount > 0 ? (msgUnreadCount > 99 ? '99+' : String(msgUnreadCount)) : null,
  });

  // ── Component output ─────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* ─── Sidebar ────────────────────────────────────────────────────────
          Mobile: fixed-position drawer, slides in from left, backdrop dims rest.
          Desktop: static column, optionally collapsed to 76px.                */}
      {/* Sidebar positioning:
            • Mobile (<md): `fixed inset-y-0 left-0`, slides in via translate.
              Because the element is fixed, it takes no flow space — main
              content fills the full viewport width. Empty space on the left
              was a bug when this had a trailing `relative` class that won
              source-order in Tailwind's base layer.
            • md+: `md:relative` so it sits inside the parent flex row and
              provides a positioning context for the absolute collapse tab. */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 md:inset-auto z-30 md:z-auto
                    transform transition-all duration-300 md:translate-x-0
                    bg-[var(--bg-surface)] border-r border-[var(--border)]
                    flex flex-col
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                    ${sidebarCollapsed ? 'w-64 md:w-[76px]' : 'w-64'}`}
      >
        {/* Desktop collapse toggle — floating tab on right edge */}
        <button
          onClick={toggleCollapse}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex absolute -right-3 top-20 z-40 w-6 h-6 items-center justify-center rounded-full
                     bg-[var(--bg-surface)] border border-[var(--border)] shadow-md
                     hover:shadow-lg text-[var(--text-muted)]
                     hover:text-primary-600 dark:hover:text-primary-400
                     hover:border-primary-300 dark:hover:border-primary-700 transition-all"
        >
          {sidebarCollapsed ? <FiChevronRight className="w-3.5 h-3.5" /> : <FiChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Logo bar */}
        <div className={`flex items-center border-b border-[var(--border)] ${sidebarCollapsed ? 'md:justify-center md:px-2 md:py-4 px-4 py-4 justify-between' : 'p-4 justify-between'}`}>
          <div className={`flex items-center gap-2 min-w-0 ${sidebarCollapsed ? 'md:gap-0' : ''}`}>
            <img src="/skn-logo-mark.png" alt="SKN Academy LMS" className="w-9 h-9 flex-shrink-0 rounded-lg object-cover" />
            <span
              className={`font-display text-xl font-extrabold truncate text-brand-gradient ${sidebarCollapsed ? 'md:hidden' : ''}`}
              style={{ letterSpacing: '-0.025em' }}
            >
              SKN Academy
            </span>
          </div>
          {/* Mobile close (×) */}
          <button
            className="p-2 -m-2 rounded-md md:hidden text-[var(--text-muted)] hover:bg-[var(--bg-muted)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            onClick={toggleSidebar}
            aria-label="Close menu"
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Nav (scrollable) */}
        <nav className={`mt-3 space-y-1 overflow-y-auto flex-1 ${sidebarCollapsed ? 'md:px-2 px-2' : 'px-3'}`}>
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const isLocked = item.feature && !hasFeature(item.feature);
            return (
              <Link
                key={item.name}
                to={item.path}
                title={sidebarCollapsed ? (isLocked ? `${item.name} (locked)` : item.name) : undefined}
                className={`relative flex items-center text-sm font-semibold rounded-lg group transition-colors min-h-[44px]
                  ${sidebarCollapsed ? 'md:justify-center md:px-2 md:py-2.5 px-3 py-2.5 justify-between' : 'justify-between px-3 py-2.5'}
                  ${isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300'
                    : isLocked
                      ? 'text-[var(--text-faint)] hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-700 dark:hover:text-amber-400'
                      : 'text-[var(--text)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-strong)]'
                  }`}
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center' : ''}`}>
                  <div className={`flex-shrink-0
                    ${isActive
                      ? 'text-primary-600 dark:text-primary-400'
                      : isLocked
                        ? 'text-[var(--text-faint)] group-hover:text-amber-500'
                        : 'text-[var(--text-muted)] group-hover:text-gray-700 dark:group-hover:text-gray-200'}
                    ${sidebarCollapsed ? 'md:mr-0 mr-3' : 'mr-3'}`}
                  >
                    {item.icon}
                  </div>
                  <span className={sidebarCollapsed ? 'md:hidden' : ''}>{item.name}</span>
                </div>

                {/* Lock pill for gated items (expanded sidebar only) */}
                {isLocked && !sidebarCollapsed && (
                  <span className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900 text-[10px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5">
                    <FiLock className="w-3 h-3" />
                  </span>
                )}
                {/* Lock dot when collapsed */}
                {isLocked && sidebarCollapsed && (
                  <span className="hidden md:block absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-[var(--bg-surface)]" />
                )}
                {/* Unread badge (e.g. Messages count) */}
                {item.badge && !isLocked && !sidebarCollapsed && (
                  <span className="bg-primary-500 text-white text-[10px] font-extrabold rounded-full px-1.5 py-0.5 min-w-[20px] text-center shadow-sm">
                    {item.badge}
                  </span>
                )}
                {item.badge && !isLocked && sidebarCollapsed && (
                  <span className="hidden md:block absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full ring-2 ring-[var(--bg-surface)]" />
                )}
                {/* Active indicator — 3px solid orange bar on the left edge. */}
                {isActive && (
                  <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-primary-500" />
                )}
              </Link>
            );
          })}

          {/* Logout button at the end of nav */}
          <button
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Logout' : undefined}
            className={`w-full flex items-center text-sm font-semibold rounded-lg group transition-colors min-h-[44px]
              text-[var(--text)]
              hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400
              ${sidebarCollapsed ? 'md:justify-center md:px-2 md:py-2.5 px-3 py-2.5' : 'px-3 py-2.5'}`}
          >
            <FiLogOut className={`w-5 h-5 text-[var(--text-muted)] group-hover:text-red-500 flex-shrink-0 ${sidebarCollapsed ? 'md:mr-0 mr-3' : 'mr-3'}`} />
            <span className={sidebarCollapsed ? 'md:hidden' : ''}>Logout</span>
          </button>
        </nav>

        {/* User card pinned to bottom (click → /profile) */}
        <Link
          to="/profile"
          title={sidebarCollapsed ? `${user?.fullName || 'Profile'}\n${user?.email || ''}` : undefined}
          className={`mt-auto border-t border-[var(--border)] hover:bg-[var(--bg-muted)] transition-colors
            ${location.pathname.startsWith('/profile') ? 'bg-primary-50 dark:bg-primary-950/40' : ''}
            ${sidebarCollapsed ? 'md:px-2 md:py-3 p-4' : 'p-4'}`}
        >
          <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'md:justify-center md:gap-0' : ''}`}>
            {user?.profilePicture ? (
              <img
                src={user.profilePicture.startsWith('http') ? user.profilePicture : `http://localhost:5000${user.profilePicture}`}
                alt=""
                className="flex-shrink-0 w-10 h-10 rounded-full object-cover ring-2 ring-[var(--bg-surface)] shadow-sm"
              />
            ) : (
              <div className="flex-shrink-0 w-10 h-10 bg-brand-gradient rounded-full flex items-center justify-center text-white font-extrabold text-sm shadow-sm ring-2 ring-[var(--bg-surface)]">
                {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            )}
            <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
              <p className="text-sm font-bold text-[var(--text-strong)] truncate">{user?.fullName || 'User'}</p>
              <p className="text-xs text-[var(--text-muted)] truncate">{user?.email || 'user@example.com'}</p>
            </div>
          </div>
        </Link>
      </aside>

      {/* ─── Main content column ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top header — taller to accommodate page title + subtitle.
            Layout (left→right):
              • mobile menu toggle (mobile only)
              • page title + subtitle (pushed via PageHeaderContext)
              • action button slot (pushed via PageHeaderContext)
              • theme toggle, announcements, notifications
              • date eyebrow (lg+)                                        */}
        <header className="bg-[var(--bg-surface)] border-b border-[var(--border)] z-20">
          <div className="flex items-center min-h-[64px] sm:min-h-[80px] px-3 sm:px-5 gap-2 sm:gap-4 py-2">
            {/* Mobile menu toggle */}
            <button
              onClick={toggleSidebar}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-muted)] focus:outline-none focus:ring-2 focus:ring-primary-500 md:hidden flex-shrink-0"
              aria-label="Open menu"
            >
              <FiMenu className="w-6 h-6" />
            </button>

            {/* Page title + subtitle — set by usePageHeader() in each page.
                On mobile the title shrinks; subtitle hides below sm.        */}
            <div className="min-w-0 flex-1">
              {pageHeader.title && (
                <h1 className="font-display text-lg sm:text-xl md:text-2xl font-extrabold tracking-[-0.02em] text-[var(--text-strong)] leading-tight truncate">
                  {pageHeader.title}
                </h1>
              )}
              {pageHeader.subtitle && (
                <p className="hidden sm:block text-xs sm:text-sm text-[var(--text-muted)] mt-0.5 truncate">
                  {pageHeader.subtitle}
                </p>
              )}
            </div>

            {/* Right cluster — page action + theme toggle, announcements, notifications, date */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Page-pushed action button (e.g. "New practice test"). Hidden
                  below md to save space; pages may render it inline on mobile. */}
              {pageHeader.action && (
                <div className="hidden md:block mr-1">{pageHeader.action}</div>
              )}
              <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-[var(--text-faint)] hidden lg:block mr-2">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-muted)] focus:outline-none transition-colors"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <FiSun className="w-5 h-5" /> : <FiMoon className="w-5 h-5" />}
              </button>

              {/* Announcements megaphone */}
              <button
                onClick={() => setAnnounceOpen(true)}
                className="relative p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-muted)] focus:outline-none transition-colors"
                title="Announcements"
              >
                <HiOutlineSpeakerphone className="w-5 h-5" />
                {announcementUnreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center px-1 bg-primary-500 text-white text-[10px] font-extrabold rounded-full ring-2 ring-[var(--bg-surface)]">
                    {announcementUnreadCount > 99 ? '99+' : announcementUnreadCount}
                  </span>
                )}
              </button>

              {/* Notification bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={openNotifs}
                  className="relative p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-strong)] hover:bg-[var(--bg-muted)] focus:outline-none transition-colors"
                  title="Notifications"
                  aria-label="Notifications"
                >
                  <FiBell className="w-5 h-5" />
                  {notifUnreadCount > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center px-1 bg-brand-gradient text-white text-[10px] font-extrabold rounded-full ring-2 ring-[var(--bg-surface)]">
                      {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown — anchored RIGHT, width capped on mobile to avoid overflow */}
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-[90vw] max-w-[20rem] sm:w-80 bg-[var(--bg-surface)] rounded-xl shadow-xl border border-[var(--border)] z-50 max-h-[70vh] overflow-y-auto">
                    <div className="px-4 py-3 border-b border-[var(--border)] font-semibold text-[var(--text-strong)] text-sm">Notifications</div>
                    {notifications.length === 0 ? (
                      <p className="text-center text-sm text-[var(--text-faint)] py-6">No notifications yet</p>
                    ) : (
                      <>
                        {notifications.map((n) => (
                          <Link
                            key={n._id}
                            to="/community"
                            onClick={() => setNotifOpen(false)}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-[var(--bg-muted)] border-b border-[var(--border)] transition-colors
                              ${!n.isRead ? 'bg-primary-50/60 dark:bg-primary-950/30' : ''}`}
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-700 dark:text-primary-300 text-xs font-bold">
                              {n.actorName?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-[var(--text-strong)] leading-snug">
                                {NOTIF_LABELS[n.type]?.(n) || 'New notification'}
                              </p>
                              {n.snippet && <p className="text-xs text-[var(--text-faint)] mt-0.5 truncate">{n.snippet}</p>}
                              <p className="text-xs text-[var(--text-faint)] mt-0.5">
                                {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            {!n.isRead && <span className="flex-shrink-0 w-2 h-2 bg-primary-500 rounded-full mt-1" />}
                          </Link>
                        ))}
                        {hasMore && (
                          <button
                            onClick={loadOlder}
                            disabled={loadingMore}
                            className="w-full px-4 py-3 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30 disabled:opacity-50 transition-colors"
                          >
                            {loadingMore ? 'Loading…' : 'Load older notifications'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main scrollable content area */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-[var(--bg-surface)] border-t border-[var(--border)] px-6 py-3">
          <div className="text-center text-xs text-[var(--text-faint)] font-medium">
            &copy; {new Date().getFullYear()} <span className="text-brand-gradient font-bold">SKN Academy</span> · All rights reserved.
          </div>
        </footer>
      </div>

      {/* Mobile backdrop — closes drawer on tap */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Announcements slide-in panel */}
      <AnnouncementsSidebar open={announceOpen} onClose={() => setAnnounceOpen(false)} />
    </div>
  );
};

// Public wrapper — adds PageHeaderProvider so pages mounted via {children} can
// call usePageHeader() to push title/subtitle/action up into the top bar.
const DashboardLayout = ({ children }) => (
  <PageHeaderProvider>
    <DashboardLayoutInner>{children}</DashboardLayoutInner>
  </PageHeaderProvider>
);

export default DashboardLayout;
