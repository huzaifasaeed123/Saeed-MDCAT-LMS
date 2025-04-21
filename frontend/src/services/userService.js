import apiClient from '../utils/axiosConfig';

// Get all users (admin only)
export const getUsers = async () => {
  const response = await apiClient.get('/users');
  return response.data;
};

// Get user by ID (admin only)
export const getUserById = async (userId) => {
  const response = await apiClient.get(`/users/${userId}`);
  return response.data;
};

// Create new user (admin only)
export const createUser = async (userData) => {
  const response = await apiClient.post('/users', userData);
  return response.data;
};

// Update user (admin only)
export const updateUser = async (userId, userData) => {
  const response = await apiClient.put(`/users/${userId}`, userData);
  return response.data;
};

// Delete user (admin only)
export const deleteUser = async (userId) => {
  const response = await apiClient.delete(`/users/${userId}`);
  return response.data;
};

export const updateProfile = async (userData) => {
  const response = await apiClient.put('/users/profile', userData);
  return response.data;
};