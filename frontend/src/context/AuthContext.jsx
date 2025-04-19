import React, { createContext, useState, useEffect } from 'react';
import { getCurrentUser, getUser, isAuthenticated } from '../services/authService';

// Create context
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Load user from local storage on initial load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (isAuthenticated()) {
          // Try to get fresh user data from API
          try {
            const response = await getCurrentUser();
            if (response.success) {
              setUser(response.data);
            } else {
              // Fallback to stored user data if API fails
              setUser(getUser());
            }
          } catch (apiError) {
            // If API call fails, use stored user data
            setUser(getUser());
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();
  }, []);
  
  // Update user when they login
  const updateUser = (userData) => {
    setUser(userData);
  };
  
  // Clear user when they logout
  const clearUser = () => {
    setUser(null);
  };
  
  // Context value
  const value = {
    user,
    updateUser,
    clearUser,
    loading,
    error,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};