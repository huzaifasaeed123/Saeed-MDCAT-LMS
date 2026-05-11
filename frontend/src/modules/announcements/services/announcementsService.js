import apiClient from '../../../core/api/axiosConfig';

// Reads
export const listAnnouncements = (page = 1) =>
  apiClient.get('/announcements', { params: { page } }).then(r => r.data);

export const markAnnouncementsSeen = () =>
  apiClient.put('/announcements/seen').then(r => r.data);

// Mutations (admin/teacher)
export const createAnnouncement = (data)        => apiClient.post('/announcements', data).then(r => r.data);
export const updateAnnouncement = (id, data)    => apiClient.put(`/announcements/${id}`, data).then(r => r.data);
export const deleteAnnouncement = (id)          => apiClient.delete(`/announcements/${id}`).then(r => r.data);
export const togglePinAnnouncement = (id, pinned) =>
  apiClient.put(`/announcements/${id}/pin`, { pinned }).then(r => r.data);
