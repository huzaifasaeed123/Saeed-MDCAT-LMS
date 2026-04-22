import apiClient from '../../../core/api/axiosConfig';

// Register — returns { success, accessToken, user }
export const registerUser = async (userData) => {
  const response = await apiClient.post('/auth/register', userData);
  return response.data;
};

// Login — returns { success, accessToken, user }
export const loginUser = async (credentials) => {
  const response = await apiClient.post('/auth/login', credentials);
  return response.data;
};

// Google Identity Services login — returns { success, accessToken, user }
export const loginWithGoogle = async (credential) => {
  const response = await apiClient.post('/auth/google', { credential });
  return response.data;
};

// Logout — calls backend to expire refresh cookie + null DB hash
export const logoutUser = async () => {
  try {
    await apiClient.post('/auth/logout');
    return { success: true };
  } catch {
    return { success: true }; // treat as success even if server unreachable
  }
};

// Silent refresh — called by AuthContext on mount; interceptor calls it on 401
export const refreshToken = async () => {
  const response = await apiClient.post('/auth/refresh-token');
  return response.data;
};

// Get current user profile (protected route — needs valid access token)
export const getCurrentUser = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};
