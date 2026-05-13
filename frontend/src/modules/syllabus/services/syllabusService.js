import apiClient from '../../../core/api/axiosConfig';

// ── Public read ─────────────────────────────────────────────────────────────
export const getTree     = ()  => apiClient.get('/syllabus/tree').then(r => r.data);
export const getProgress = ()  => apiClient.get('/syllabus/me/progress').then(r => r.data);
export const getToday    = ()  => apiClient.get('/syllabus/me/today').then(r => r.data);
export const getWeek     = (s) => apiClient.get('/syllabus/me/week', { params: s ? { start: s } : {} }).then(r => r.data);

// ── Progress mutations ──────────────────────────────────────────────────────
export const startTopic  = (id)            => apiClient.post(`/syllabus/me/progress/${id}/start`).then(r => r.data);
export const reviewTopic = (id, outcome)   => apiClient.post(`/syllabus/me/progress/${id}/review`, { outcome }).then(r => r.data);
export const masterTopic = (id)            => apiClient.post(`/syllabus/me/progress/${id}/master`).then(r => r.data);
export const setLecture  = (id, done = true) => apiClient.post(`/syllabus/me/topic/${id}/lecture`, { done }).then(r => r.data);
export const setBook     = (id, done = true) => apiClient.post(`/syllabus/me/topic/${id}/book`,    { done }).then(r => r.data);
export const setMcqs     = (id, body)        => apiClient.post(`/syllabus/me/topic/${id}/mcqs`,    body)  .then(r => r.data);

// ── Daily TO-DO ─────────────────────────────────────────────────────────────
export const listTodos   = (day)  => apiClient.get('/syllabus/me/todo', { params: day ? { day } : {} }).then(r => r.data);
export const createTodo  = (b)    => apiClient.post('/syllabus/me/todo', b).then(r => r.data);
export const updateTodo  = (id, b)=> apiClient.patch(`/syllabus/me/todo/${id}`, b).then(r => r.data);
export const deleteTodo  = (id)   => apiClient.delete(`/syllabus/me/todo/${id}`).then(r => r.data);
export const seedTodo    = (b)    => apiClient.post('/syllabus/me/todo/seed', b || {}).then(r => r.data);

// ── Sticky notes ────────────────────────────────────────────────────────────
export const listNotes   = ()      => apiClient.get('/syllabus/me/notes').then(r => r.data);
export const createNote  = (b)     => apiClient.post('/syllabus/me/notes', b).then(r => r.data);
export const updateNote  = (id, b) => apiClient.patch(`/syllabus/me/notes/${id}`, b).then(r => r.data);
export const deleteNote  = (id)    => apiClient.delete(`/syllabus/me/notes/${id}`).then(r => r.data);

// ── Admin (admin + teacher) ─────────────────────────────────────────────────
export const adminListTopics = (params) => apiClient.get('/syllabus/admin/topics', { params }).then(r => r.data);
export const adminListUnits  = ()       => apiClient.get('/syllabus/admin/units').then(r => r.data);
export const adminCreateTopic = (b)            => apiClient.post('/syllabus/admin/topics', b).then(r => r.data);
export const adminUpdateTopic = (id, b)        => apiClient.patch(`/syllabus/admin/topics/${id}`, b).then(r => r.data);
export const adminDeleteTopic = (id)           => apiClient.delete(`/syllabus/admin/topics/${id}`).then(r => r.data);
export const adminRenameUnit  = (subject, n, t) => apiClient.patch(`/syllabus/admin/units/${encodeURIComponent(subject)}/${n}`, { unitTitle: t }).then(r => r.data);
export const adminDeleteUnit  = (subject, n)   => apiClient.delete(`/syllabus/admin/units/${encodeURIComponent(subject)}/${n}`).then(r => r.data);
export const adminBulkImport  = (units)        => apiClient.post('/syllabus/admin/import', { units }).then(r => r.data);
