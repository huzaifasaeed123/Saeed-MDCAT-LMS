import apiClient from '../../../core/api/axiosConfig';

export const getPosts       = (params)            => apiClient.get('/community/posts', { params }).then(r => r.data);
export const createPost     = (data)              => apiClient.post('/community/posts', data).then(r => r.data);
export const updatePost     = (id, data)          => apiClient.put(`/community/posts/${id}`, data).then(r => r.data);
export const deletePost     = (id)                => apiClient.delete(`/community/posts/${id}`).then(r => r.data);
export const pinPost        = (id)                => apiClient.put(`/community/posts/${id}/pin`).then(r => r.data);
export const savePost       = (id)                => apiClient.put(`/community/posts/${id}/save`).then(r => r.data);
export const votePoll       = (id, optionIndex)   => apiClient.post(`/community/posts/${id}/vote`, { optionIndex }).then(r => r.data);

export const getReplies     = (postId, page = 1)  => apiClient.get(`/community/posts/${postId}/replies`, { params: { page } }).then(r => r.data);
export const createReply    = (postId, data)      => apiClient.post(`/community/posts/${postId}/replies`, data).then(r => r.data);
export const updateReply    = (id, data)          => apiClient.put(`/community/replies/${id}`, data).then(r => r.data);
export const deleteReply    = (id)                => apiClient.delete(`/community/replies/${id}`).then(r => r.data);
export const markAnswer     = (id)                => apiClient.put(`/community/replies/${id}/answer`).then(r => r.data);
export const toggleHelpful  = (id)                => apiClient.put(`/community/replies/${id}/helpful`).then(r => r.data);

export const getNotifications = (page = 1)        => apiClient.get('/community/notifications', { params: { page } }).then(r => r.data);
export const markAllRead      = ()                 => apiClient.put('/community/notifications/read').then(r => r.data);

export const getLeaderboard       = ()  => apiClient.get('/community/leaderboard').then(r => r.data);
export const refreshLeaderboard   = ()  => apiClient.post('/community/leaderboard/refresh').then(r => r.data);
export const getStaffPerformance  = ()  => apiClient.get('/community/staff-performance').then(r => r.data);

// Reuses the existing platform upload endpoint — same as MCQ/course images
export const uploadImage = (file) => {
  const fd = new FormData();
  fd.append('image', file);
  return apiClient.post('/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
};
