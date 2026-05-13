// src/core/layouts/DashboardLayout.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiMenu, FiX, FiHome, FiUsers, FiBook, FiBookOpen, FiFileText, FiSettings, FiLogOut, FiBarChart2, FiCheckSquare, FiDatabase, FiZap, FiSliders, FiFlag, FiMessageSquare, FiBell, FiMessageCircle, FiFolder, FiVideo, FiAward, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { HiOutlineSpeakerphone } from 'react-icons/hi';
import useAuth from '../auth/useAuth';
import apiClient from '../api/axiosConfig';
import AnnouncementsSidebar from '../../modules/announcements/components/AnnouncementsSidebar';

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

const DashboardLayout = ({ children }) => {
  const {
    user, isAdmin, isTeacher, isStudent, logout,
    msgUnreadCount, notifUnreadCount,
    notifications, setNotifications,
    announcementUnreadCount,
    syllabusDueCount,
  } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);   // we don't know yet — let user try
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

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cross-component opener: the dashboard widget's "View all" button fires this.
  // CustomEvent avoids prop-drilling and keeps the layout the single mount point
  // for the sidebar (only one instance ever exists in the DOM).
  useEffect(() => {
    const open = () => setAnnounceOpen(true);
    window.addEventListener('announcements:open', open);
    return () => window.removeEventListener('announcements:open', open);
  }, []);

  // Bell click: NO API call in the common case. The notifications list is
  // already in AuthContext (hydrated from the SSE 'connected' event and kept
  // fresh by 'notification' events). We only call markAllRead if there are
  // unread items, and that's optimistic — UI updates immediately.
  const openNotifs = () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening && notifUnreadCount > 0) {
      apiClient.put('/community/notifications/read').catch(() => {});
      // Optimistic: SSE 'notifications_read' will sync other tabs.
      // (AuthContext also handles that event, so no double-update needed here.)
    }
  };

  // Lazy fallback: user wants older notifications than the 10 we got via SSE.
  const loadOlder = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await apiClient.get('/community/notifications', { params: { page: olderPage + 1 } });
      const older = res.data.data || [];
      // Merge by _id — avoid duplicates if some are already in the list.
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

  // Define navigation items based on user role
  const navigationItems = [];

  // Common navigation items
  navigationItems.push({
    name: 'Dashboard',
    icon: <FiHome className="w-5 h-5" />,
    path: '/dashboard',
  });

  // Syllabus — STUDENTS only. Admin/teacher get the management page instead.
  if (isStudent) {
    navigationItems.push({
      name: 'Syllabus',
      icon: <FiBookOpen className="w-5 h-5" />,
      path: '/syllabus',
      badge: syllabusDueCount > 0 ? (syllabusDueCount > 99 ? '99+' : String(syllabusDueCount)) : null,
    });
  }

  // Announcements admin + Syllabus admin — admin AND teacher can manage.
  // (No student-facing syllabus link for staff — they only manage the catalog.)
  if (isAdmin || isTeacher) {
    navigationItems.push({
      name: 'Announcements',
      icon: <HiOutlineSpeakerphone className="w-5 h-5" />,
      path: '/admin/announcements',
    });
    navigationItems.push({
      name: 'Syllabus Admin',
      icon: <FiBookOpen className="w-5 h-5" />,
      path: '/admin/syllabus',
    });
  }

  // Admin-specific navigation
  if (isAdmin) {
    navigationItems.push({
      name: 'User Management',
      icon: <FiUsers className="w-5 h-5" />,
      path: '/admin/users',
    });

    navigationItems.push({
      name: 'Course Management',
      icon: <FiBook className="w-5 h-5" />,
      path: '/admin/courses',
    });

    navigationItems.push({
      name: 'Tests & MCQs',
      icon: <FiCheckSquare className="w-5 h-5" />,
      path: '/tests',
    });

    navigationItems.push({
      name: 'Question Banks',
      icon: <FiDatabase className="w-5 h-5" />,
      path: '/admin/question-banks',
    });

    navigationItems.push({
      name: 'Auto Test Generator',
      icon: <FiZap className="w-5 h-5" />,
      path: '/admin/auto-test',
    });

    navigationItems.push({
      name: 'MCQ Reports',
      icon: <FiFlag className="w-5 h-5" />,
      path: '/admin/mcq-reports',
    });

    navigationItems.push({
      name: 'System Analytics',
      icon: <FiBarChart2 className="w-5 h-5" />,
      path: '/admin/analytics',
    });

    navigationItems.push({
      name: 'Settings',
      icon: <FiSliders className="w-5 h-5" />,
      path: '/admin/settings',
    });
  }

  // Teacher-specific navigation
  if (isTeacher) {
    navigationItems.push({
      name: 'MCQ Reports',
      icon: <FiFlag className="w-5 h-5" />,
      path: '/teacher/mcq-reports',
    });

    navigationItems.push({
      name: 'Tests & MCQs',
      icon: <FiCheckSquare className="w-5 h-5" />,
      path: '/tests',
    });

    navigationItems.push({
      name: 'Auto Test Generator',
      icon: <FiZap className="w-5 h-5" />,
      path: '/auto-test',
    });

    navigationItems.push({
      name: 'Test History',
      icon: <FiFileText className="w-5 h-5" />,
      path: '/student/tests',
    });
  }

  // Student-specific navigation
  if (isStudent) {
    navigationItems.push({
      name: 'My Courses',
      icon: <FiBook className="w-5 h-5" />,
      path: '/student/courses',
    });

    navigationItems.push({
      name: 'Create Practice Test',
      icon: <FiZap className="w-5 h-5" />,
      path: '/auto-test',
    });

    navigationItems.push({
      name: 'Test History',
      icon: <FiFileText className="w-5 h-5" />,
      path: '/student/tests',
    });

    navigationItems.push({
      name: 'My MCQ Reports',
      icon: <FiFlag className="w-5 h-5" />,
      path: '/student/mcq-reports',
    });
  }

  // Leaderboard — available to all roles
  navigationItems.push({
    name: 'Leaderboard',
    icon: <FiAward className="w-5 h-5" />,
    path: '/leaderboard',
  });

  // Community — available to all roles
  navigationItems.push({
    name: 'Community',
    icon: <FiMessageCircle className="w-5 h-5" />,
    path: '/community',
  });

  // Notes — available to all roles (managed by admin/teacher)
  navigationItems.push({
    name: 'Notes',
    icon: <FiFolder className="w-5 h-5" />,
    path: '/notes',
  });

  // Videos — available to all roles
  navigationItems.push({
    name: 'Videos',
    icon: <FiVideo className="w-5 h-5" />,
    path: '/videos',
  });

  // Messages — available to all roles
  navigationItems.push({
    name:  'Messages',
    icon:  <FiMessageSquare className="w-5 h-5" />,
    path:  '/messages',
    badge: msgUnreadCount > 0 ? (msgUnreadCount > 99 ? '99+' : String(msgUnreadCount)) : null,
  });

  // Profile is no longer in the nav list — the user card at the bottom of
  // the sidebar links to /profile, so a separate entry would be redundant.

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 transform bg-white shadow-lg transition-all duration-300 md:translate-x-0 md:static md:inset-auto md:h-auto md:flex md:flex-col ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } ${
        sidebarCollapsed ? 'w-64 md:w-[76px]' : 'w-64'
      } relative`}>

        {/* Desktop collapse toggle — floating tab on right edge */}
        <button
          onClick={toggleCollapse}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="hidden md:flex absolute -right-3 top-20 z-40 w-6 h-6 items-center justify-center rounded-full bg-white border border-gray-200 shadow-md hover:shadow-lg text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-all"
        >
          {sidebarCollapsed ? <FiChevronRight className="w-3.5 h-3.5" /> : <FiChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Logo bar */}
        <div className={`flex items-center border-b border-gray-100 ${sidebarCollapsed ? 'md:justify-center md:px-2 md:py-4 px-4 py-4 justify-between' : 'p-4 justify-between'}`}>
          <div className={`flex items-center space-x-2 min-w-0 ${sidebarCollapsed ? 'md:space-x-0' : ''}`}>
            <img src="/logo.png" alt="Saeed MDCAT" className="w-8 h-8 flex-shrink-0" />
            <span className={`text-xl font-semibold text-primary-700 truncate ${sidebarCollapsed ? 'md:hidden' : ''}`}>
              Saeed MDCAT
            </span>
          </div>
          <button
            className="p-1 rounded-md md:hidden focus:outline-none focus:ring-2 focus:ring-primary-500"
            onClick={toggleSidebar}
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        {/* Nav */}
        <nav className={`mt-3 space-y-1 overflow-y-auto flex-1 ${sidebarCollapsed ? 'md:px-2 px-2' : 'px-3'}`}>
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.name}
                to={item.path}
                title={sidebarCollapsed ? item.name : undefined}
                className={`relative flex items-center text-sm font-medium rounded-lg group transition-colors ${
                  sidebarCollapsed ? 'md:justify-center md:px-2 md:py-2.5 px-3 py-2.5 justify-between' : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center' : ''}`}>
                  <div className={`flex-shrink-0 ${isActive ? 'text-primary-600' : 'text-gray-500 group-hover:text-gray-700'} ${sidebarCollapsed ? 'md:mr-0 mr-3' : 'mr-3'}`}>
                    {item.icon}
                  </div>
                  <span className={sidebarCollapsed ? 'md:hidden' : ''}>{item.name}</span>
                </div>
                {item.badge && !sidebarCollapsed && (
                  <span className="bg-blue-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
                {item.badge && sidebarCollapsed && (
                  <span className="hidden md:block absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                )}
                {/* Active indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full" />
                )}
              </Link>
            );
          })}

          <button
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Logout' : undefined}
            className={`w-full flex items-center text-sm font-medium text-gray-700 rounded-lg hover:bg-red-50 hover:text-red-600 group transition-colors ${
              sidebarCollapsed ? 'md:justify-center md:px-2 md:py-2.5 px-3 py-2.5' : 'px-3 py-2.5'
            }`}
          >
            <FiLogOut className={`w-5 h-5 text-gray-500 group-hover:text-red-500 flex-shrink-0 ${sidebarCollapsed ? 'md:mr-0 mr-3' : 'mr-3'}`} />
            <span className={sidebarCollapsed ? 'md:hidden' : ''}>Logout</span>
          </button>
        </nav>

        {/* User card pinned to the BOTTOM of the sidebar — replaces the old
            top card and the separate "Profile" nav entry. Clicking it
            navigates to /profile (active highlight when already there). */}
        <Link
          to="/profile"
          title={sidebarCollapsed ? `${user?.fullName || 'Profile'}\n${user?.email || ''}` : undefined}
          className={`mt-auto border-t border-gray-100 hover:bg-gray-50 transition-colors ${
            location.pathname.startsWith('/profile') ? 'bg-primary-50' : ''
          } ${sidebarCollapsed ? 'md:px-2 md:py-3 p-4' : 'p-4'}`}
        >
          <div className={`flex items-center ${sidebarCollapsed ? 'md:justify-center space-x-3' : 'space-x-3'}`}>
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-lg shadow-sm ring-2 ring-white">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className={`flex-1 min-w-0 ${sidebarCollapsed ? 'md:hidden' : ''}`}>
              <p className="text-sm font-semibold text-gray-900 truncate">
                {user?.fullName || 'User'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top header */}
        <header className="bg-white shadow-sm z-20">
          <div className="flex items-center h-16 px-4">
            {/* LEFT cluster — only the mobile-menu toggle (md:hidden on desktop) */}
            <button
              onClick={toggleSidebar}
              className="p-1 text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 md:hidden"
            >
              <FiMenu className="w-6 h-6" />
            </button>

            {/* RIGHT cluster — date + announcement + bell.
                ml-auto pushes us to the right edge regardless of whether the
                mobile-menu button is rendered (it's md:hidden on desktop, so
                without ml-auto we'd be the only child and snap to the left). */}
            <div className="flex items-center space-x-4 ml-auto">
              <div className="text-sm font-medium text-gray-500 hidden sm:block">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>

              {/* Announcements Megaphone */}
              <button
                onClick={() => setAnnounceOpen(true)}
                className="relative p-1.5 text-gray-500 hover:text-gray-700 focus:outline-none"
                title="Announcements"
              >
                <HiOutlineSpeakerphone className="w-5 h-5" />
                {announcementUnreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5">
                    {announcementUnreadCount > 99 ? '99+' : announcementUnreadCount}
                  </span>
                )}
              </button>

              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={openNotifs}
                  className="relative p-1.5 text-gray-500 hover:text-gray-700 focus:outline-none"
                  title="Notifications"
                >
                  <FiBell className="w-5 h-5" />
                  {notifUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5">
                      {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown anchored RIGHT — bell sits on the right edge of the header. */}
                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
                    <div className="px-4 py-3 border-b font-semibold text-gray-800 text-sm">Notifications</div>
                    {notifications.length === 0 ? (
                      <p className="text-center text-sm text-gray-400 py-6">No notifications yet</p>
                    ) : (
                      <>
                        {notifications.map((n) => (
                          <Link
                            key={n._id}
                            to="/community"
                            onClick={() => setNotifOpen(false)}
                            className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 transition-colors ${!n.isRead ? 'bg-blue-50' : ''}`}
                          >
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                              {n.actorName?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-800 leading-snug">
                                {NOTIF_LABELS[n.type]?.(n) || 'New notification'}
                              </p>
                              {n.snippet && <p className="text-xs text-gray-400 mt-0.5 truncate">{n.snippet}</p>}
                              <p className="text-xs text-gray-400 mt-0.5">
                                {new Date(n.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                            {!n.isRead && <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1" />}
                          </Link>
                        ))}
                        {hasMore && (
                          <button
                            onClick={loadOlder}
                            disabled={loadingMore}
                            className="w-full px-4 py-3 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 transition-colors"
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

        {/* Main content area */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white shadow-inner px-6 py-4">
          <div className="text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Saeed MDCAT LMS. All rights reserved.
          </div>
        </footer>
      </div>

      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 transition-opacity md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}

      {/* Announcements slide-in panel — single mount point, opened from header
          megaphone or via the 'announcements:open' window event (Dashboard widget). */}
      <AnnouncementsSidebar open={announceOpen} onClose={() => setAnnounceOpen(false)} />
    </div>
  );
};

export default DashboardLayout;
