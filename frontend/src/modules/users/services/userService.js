import apiClient from '../../../core/api/axiosConfig';

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

export const bulkUploadUsers = async (file) => {
  const form = new FormData();
  form.append('file', file);
  const response = await apiClient.post('/users/bulk-upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// ── Feature & course access (admin-only) ───────────────────────────────────
// Each method targets exactly one backend endpoint. The backend invalidates
// userAccessCache + pushes 'feature_access_updated' over SSE on success, so
// the affected user's tabs flip lock states without a refresh.

// Partial update: only the keys present in `flags` are touched. Optionally
// pass `coursesGrantAll` to flip the grant-all sub-toggle in the same call.
// flags shape: { autoTest?, courses?, community?, videos?, notes? }
export const updateUserFeatureAccess = async (userId, flags, opts = {}) => {
  const body = { featureAccess: flags };
  if (opts.coursesGrantAll !== undefined) body.coursesGrantAll = !!opts.coursesGrantAll;
  const response = await apiClient.patch(`/users/${userId}/access`, body);
  return response.data;
};

// Flip ONLY the coursesGrantAll sub-flag — useful from the per-user panel.
export const setUserCoursesGrantAll = async (userId, value) => {
  const response = await apiClient.patch(`/users/${userId}/access`, { coursesGrantAll: !!value });
  return response.data;
};

// Apply one feature toggle to users matching the optional filter set. Without
// filters this falls back to "every user of `role`". With filters it scopes
// the bulk write to exactly the rows the admin is seeing in the table.
// feature ∈ { autoTest, courses, community, videos, notes }
// filters shape mirrors the UsersPage filter state (search, role, dateFrom,
// dateTo, signupSource, province, district, studentClass, studentStatus).
export const bulkApplyAccess = async (feature, value, role = 'student', filters = {}) => {
  const response = await apiClient.patch('/users/access/bulk', {
    feature, value: !!value, role,
    filters,
  });
  return response.data;
};

// Replace the user's per-course allowlist in one shot.
export const replaceUserCourseAccess = async (userId, courseIds) => {
  const response = await apiClient.put(`/users/${userId}/course-access`, { courseIds });
  return response.data;
};

// Grant / revoke one course at a time.
export const grantUserCourse  = async (userId, courseId) => {
  const response = await apiClient.post(`/users/${userId}/course-access/${courseId}`);
  return response.data;
};
export const revokeUserCourse = async (userId, courseId) => {
  const response = await apiClient.delete(`/users/${userId}/course-access/${courseId}`);
  return response.data;
};

// One-click bulk for the per-user course-access page.
export const grantAllCoursesToUser  = async (userId) => {
  const response = await apiClient.post(`/users/${userId}/course-access/grant-all`);
  return response.data;
};
export const revokeAllCoursesFromUser = async (userId) => {
  const response = await apiClient.post(`/users/${userId}/course-access/revoke-all`);
  return response.data;
};
