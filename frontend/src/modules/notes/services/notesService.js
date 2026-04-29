import apiClient from '../../../core/api/axiosConfig';

// Browse
export const getContents   = (folder) =>
  apiClient.get('/notes/contents', { params: { folder: folder || 'root' } }).then(r => r.data);

export const getFileView   = (id) =>
  apiClient.get(`/notes/files/${id}/view`).then(r => r.data);

// Issues a 30-minute view token for streaming a protected file.
// The token is placed in the iframe src (?vt=...) because iframes cannot
// send Authorization headers.
export const getViewToken  = (id) =>
  apiClient.get(`/notes/files/${id}/viewtoken`).then(r => r.data);

// Folders (admin/teacher)
export const createFolder  = (data)         => apiClient.post('/notes/folders', data).then(r => r.data);
export const renameFolder  = (id, data)     => apiClient.put(`/notes/folders/${id}`, data).then(r => r.data);
export const deleteFolder  = (id)           => apiClient.delete(`/notes/folders/${id}`).then(r => r.data);

// Files (admin/teacher)
export const createFile    = (data)         => apiClient.post('/notes/files', data).then(r => r.data);
export const renameFile    = (id, data)     => apiClient.put(`/notes/files/${id}`, data).then(r => r.data);
export const deleteFile    = (id)           => apiClient.delete(`/notes/files/${id}`).then(r => r.data);

// Drive import — isProtected flag tells backend which auth method to use
export const importDrive   = (data)         => apiClient.post('/notes/import-drive', data).then(r => r.data);
