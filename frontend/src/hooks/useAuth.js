import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { loginUser, registerUser, logoutUser, googleLogin } from '../services/authService';

// Custom hook to use the auth context
const useAuth = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  const { user, updateUser, clearUser, loading, error } = context;
  
  // Login function
  const login = async (credentials) => {
    try {
      const response = await loginUser(credentials);
      if (response.success) {
        updateUser(response.user);
      }
      return response;
    } catch (error) {
      throw error;
    }
  };
  
  // Register function
  const register = async (userData) => {
    try {
      const response = await registerUser(userData);
      if (response.success) {
        updateUser(response.user);
      }
      return response;
    } catch (error) {
      throw error;
    }
  };
  
  // Logout function
  const logout = async () => {
    try {
      const response = await logoutUser();
      if (response.success) {
        clearUser();
      }
      return response;
    } catch (error) {
      throw error;
    }
  };
  
  // Google login function
  const loginWithGoogle = () => {
    googleLogin();
  };
  
  // Check if user has a specific role
  const hasRole = (role) => {
    return user && user.role === role;
  };
  
  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    loginWithGoogle,
    isAuthenticated: !!user,
    isAdmin: hasRole('admin'),
    isTeacher: hasRole('teacher'),
    isStudent: hasRole('student'),
  };
};

export default useAuth;