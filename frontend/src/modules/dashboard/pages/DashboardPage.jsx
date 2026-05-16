import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import useAuth from '../../../core/auth/useAuth';
import AdminDashboard from '../components/AdminDashboard';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';
import { getDashboardSummary, refreshDashboardSummary } from '../services/dashboardService';

// ── DashboardPage ──────────────────────────────────────────────────────────
// Single API call on mount: GET /api/dashboard/summary.
// Backend returns role-aware data so we don't even need to branch the request.
// The data is cached server-side (per-user 3 min OR global admin 15 min), so
// refreshes are cheap.
const DashboardPage = () => {
  const { isAdmin, isTeacher, isStudent } = useAuth();

  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await getDashboardSummary();
      if (res.success) setData(res.data);
    } catch {
      toast.error('Failed to load dashboard');
    }
  }, []);

  useEffect(() => {
    let alive = true;
    load().finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await refreshDashboardSummary();
      if (res.success) {
        setData(res.data);
        toast.success('Refreshed');
      }
    } catch {
      toast.error('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  // Even if `data` is null (e.g. transient error) we still render the role
  // component — each dashboard handles the absence gracefully.
  const shared = { data, refreshing, onRefresh: handleRefresh };

  return (
    <div className="dashboard-page">
      {isAdmin   && <AdminDashboard   {...shared} />}
      {isTeacher && <TeacherDashboard {...shared} />}
      {isStudent && <StudentDashboard {...shared} />}
    </div>
  );
};

export default DashboardPage;
