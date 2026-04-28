import apiClient from '../../../core/api/axiosConfig';

export const getConversations  = (page = 1, limit = 20) =>
  apiClient.get('/messages/conversations', { params: { page, limit } }).then(r => r.data);

export const startConversation = (participantId) =>
  apiClient.post('/messages/conversations', { participantId }).then(r => r.data);

export const getMessages       = (convId, page = 1) =>
  apiClient.get(`/messages/conversations/${convId}/messages`, { params: { page, limit: 50 } }).then(r => r.data);

export const sendMessage       = (convId, content) =>
  apiClient.post(`/messages/conversations/${convId}/messages`, { content }).then(r => r.data);

export const searchUsers       = (q) =>
  apiClient.get('/messages/users', { params: { q } }).then(r => r.data);

export const markConversationRead = (convId) =>
  apiClient.put(`/messages/conversations/${convId}/read`).then(r => r.data);

export const createBroadcast   = (content) =>
  apiClient.post('/messages/broadcast', { content }).then(r => r.data);
