import { useContext } from 'react';
import { AuthContext } from './AuthContext';
import { loginUser, registerUser, logoutUser } from '../../modules/auth/services/authService';

const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const {
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
  } = context;

  const login = async (credentials) => {
    const response = await loginUser(credentials);
    if (response.success) {
      updateUser(response.user, response.accessToken);
    }
    return response;
  };

  const register = async (userData) => {
    const response = await registerUser(userData);
    if (response.success) {
      updateUser(response.user, response.accessToken);
    }
    return response;
  };

  const logout = async () => {
    await logoutUser();
    clearUser();
    return { success: true };
  };

  const hasRole = (role) => user?.role === role;
  const isAdmin   = hasRole('admin');
  const isTeacher = hasRole('teacher');
  const isStudent = hasRole('student');

  // Staff (admin/teacher) bypass all feature locks — must match the backend
  // featureGate middleware exactly so client + server agree.
  const isStaff = isAdmin || isTeacher;

  // hasFeature(key) — true if staff OR the flag is set.
  // 'courses' is special: derived from grant-all OR per-course allowlist
  // (there's no separate master flag on the User model).
  const hasFeature = (key) => {
    if (isStaff) return true;
    if (key === 'courses') return !!coursesGrantAll || courseAccess.length > 0;
    return !!featureAccess?.[key];
  };

  // hasCourseAccess(courseId) — true if:
  //   • user is staff, OR
  //   • coursesGrantAll is on, OR
  //   • the course id is in the per-course allowlist.
  const hasCourseAccess = (courseId) => {
    if (isStaff) return true;
    if (coursesGrantAll) return true;
    return !!courseId && courseAccess.includes(String(courseId));
  };

  return {
    user,
    updateUser,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin,
    isTeacher,
    isStudent,
    isStaff,
    featureAccess,
    setFeatureAccess,
    coursesGrantAll,
    setCoursesGrantAll,
    courseAccess,
    setCourseAccess,
    hasFeature,
    hasCourseAccess,
    msgUnreadCount,
    notifUnreadCount,
    notifications,
    setNotifications,
    announcements,
    setAnnouncements,
    announcementUnreadCount,
    setAnnouncementUnreadCount,
    syllabusDueCount,
    setSyllabusDueCount,
    syllabusStreak,
    setSyllabusStreak,
    // Admin-only: live presence count streamed via SSE. Shape is
    // { users, connections } or null until the first SSE frame arrives.
    activeUsers,
  };
};

export default useAuth;
