import apiClient from '../utils/axiosConfig';

// Register user
export const registerUser = async (userData) => {
  const response = await apiClient.post('/auth/register', userData);
  
  if (response.data.success) {
    // Store access token in memory
    localStorage.setItem('accessToken', response.data.accessToken);
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }
  
  return response.data;
};

// Login user
export const loginUser = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials);
  
  if (response.data.success) {
    // Store access token in memory
    localStorage.setItem('accessToken', response.data.accessToken);
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }
  
  return response.data;
};

// Google login redirect
export const googleLogin = () => {
  window.location.href = `${apiClient.defaults.baseURL}/auth/google`;
};

// Get current user profile
export const getCurrentUser = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

// Logout user
export const logoutUser = async () => {
  try {
    await apiClient.get('/auth/logout');
    // Clear tokens from storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
};

// Refresh token
export const refreshToken = async () => {
  const response = await apiClient.post('/auth/refresh-token');
  
  if (response.data.success && response.data.accessToken) {
    localStorage.setItem('accessToken', response.data.accessToken);
  }
  
  return response.data;
};

// Check if user is authenticated
export const isAuthenticated = () => {
  return !!localStorage.getItem('accessToken');
};

// Get current user from local storage
export const getUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};


// Google Identity Services login
export const loginWithGoogle = async (credential) => {
  try {
    const response = await apiClient.post('/auth/google', { credential });
    
    if (response.data.success) {
      // Store access token
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  } catch (error) {
    console.error('Google login error:', error);
    throw error;
  }
};