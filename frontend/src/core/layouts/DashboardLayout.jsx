// src/core/layouts/DashboardLayout.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiMenu, FiX, FiHome, FiUsers, FiBook, FiFileText, FiSettings, FiLogOut, FiBarChart2, FiCheckSquare, FiDatabase, FiZap, FiSliders, FiFlag, FiMessageSquare, FiBell, FiMessageCircle, FiFolder, FiVideo } from 'react-icons/fi';
import useAuth from '../auth/useAuth';
import apiClient from '../api/axiosConfig';

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
  } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);   // we don't know yet — let user try
  const [olderPage,   setOlderPage]   = useState(1);
  const notifRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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

  // Common navigation items for all roles
  navigationItems.push({
    name: 'Profile',
    icon: <FiSettings className="w-5 h-5" />,
    path: '/profile',
  });

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar for larger screens */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white shadow-lg transition duration-300 md:translate-x-0 md:static md:inset-auto md:h-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="Saeed MDCAT" className="w-8 h-8" />
            <span className="text-xl font-semibold text-primary-700">Saeed MDCAT</span>
          </div>
          <button
            className="p-1 rounded-md md:hidden focus:outline-none focus:ring-2 focus:ring-primary-500"
            onClick={toggleSidebar}
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold text-xl">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.fullName || 'User'}
              </p>
              <p className="text-sm text-gray-500 truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        </div>

        <nav className="mt-4 px-2 space-y-1">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            return (
              <Link
                key={item.name}
                to={item.path}
                className={`flex items-center justify-between px-4 py-3 text-sm font-medium rounded-md group ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center">
                  <div className={`mr-3 ${isActive ? 'text-primary-700' : 'text-gray-500 group-hover:text-gray-700'}`}>
                    {item.icon}
                  </div>
                  {item.name}
                </div>
                {item.badge && (
                  <span className="bg-blue-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 group"
          >
            <FiLogOut className="mr-3 w-5 h-5 text-gray-500 group-hover:text-gray-700" />
            Logout
          </button>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top header */}
        <header className="bg-white shadow-sm z-20">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={toggleSidebar}
              className="p-1 text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 md:hidden"
            >
              <FiMenu className="w-6 h-6" />
            </button>

            <div className="flex items-center space-x-4">
              <div className="text-sm font-medium text-gray-500 hidden sm:block">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>

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
    </div>
  );
};

export default DashboardLayout;
