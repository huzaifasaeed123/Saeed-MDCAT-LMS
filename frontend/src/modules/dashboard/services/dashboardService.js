import apiClient from '../../../core/api/axiosConfig';

// One endpoint, role-aware response. Backend chooses the shape based on
// req.user.role and caches per-user (3 min) or globally for admins (15 min).
export const getDashboardSummary = async () => {
  const res = await apiClient.get('/dashboard/summary');
  return res.data;
};

// Force-rebuild on the server side; uses the same getter under the hood.
export const refreshDashboardSummary = async () => {
  const res = await apiClient.post('/dashboard/summary/refresh');
  return res.data;
};
