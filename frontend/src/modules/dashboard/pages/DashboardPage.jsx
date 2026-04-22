import React from 'react';
import useAuth from '../../../core/auth/useAuth';
import AdminDashboard from '../components/AdminDashboard';
import TeacherDashboard from '../components/TeacherDashboard';
import StudentDashboard from '../components/StudentDashboard';

const DashboardPage = () => {
  const { isAdmin, isTeacher, isStudent } = useAuth();

  return (
    <div className="dashboard-page">
      {isAdmin && <AdminDashboard />}
      {isTeacher && <TeacherDashboard />}
      {isStudent && <StudentDashboard />}
    </div>
  );
};

export default DashboardPage;
