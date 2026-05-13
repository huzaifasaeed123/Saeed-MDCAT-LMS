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
    msgUnreadCount, notifUnreadCount,
    notifications, setNotifications,
    announcements, setAnnouncements,
    announcementUnreadCount, setAnnouncementUnreadCount,
    syllabusDueCount, setSyllabusDueCount,
    syllabusStreak,   setSyllabusStreak,
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

  return {
    user,
    updateUser,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin:          hasRole('admin'),
    isTeacher:        hasRole('teacher'),
    isStudent:        hasRole('student'),
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
  };
};

export default useAuth;
