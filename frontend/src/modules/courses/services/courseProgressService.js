// modules/courses/services/courseProgressService.js
//
// Thin axios wrappers around the per-user course-progress endpoints.
// Optimistic-friendly: every method returns the response or throws — callers
// roll back their local state on rejection.
import apiClient from '../../../core/api/axiosConfig';

export const getCourseProgress = async (courseId) => {
  const res = await apiClient.get(`/courses/${courseId}/progress`);
  return res.data?.data;
};

export const markResourceComplete = async (courseId, resourceId) => {
  await apiClient.post(`/courses/${courseId}/progress/resource/${resourceId}`);
};

export const unmarkResourceComplete = async (courseId, resourceId) => {
  await apiClient.delete(`/courses/${courseId}/progress/resource/${resourceId}`);
};

// Debounced caller — frontend wires this on every resource open. Lightweight
// PATCH; doesn't return anything useful but resolves so callers can chain.
export const updateLastViewed = async (courseId, resourceId) => {
  if (!resourceId) return;
  try {
    await apiClient.patch(`/courses/${courseId}/progress/last`, { resourceId });
  } catch {
    // Silent — last-viewed is a UX nicety, not a correctness signal.
  }
};
