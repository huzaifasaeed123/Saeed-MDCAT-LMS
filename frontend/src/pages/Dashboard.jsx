import React from 'react';
import useAuth from '../hooks/useAuth';

// Dashboard components based on role
import StudentDashboard from '../components/dashboard/StudentDashboard';
import TeacherDashboard from '../components/dashboard/TeacherDashboard';
import AdminDashboard from '../components/dashboard/AdminDashboard';

const Dashboard = () => {
  const { user, isAdmin, isTeacher, isStudent } = useAuth();
  
  // Display appropriate dashboard based on user role
  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Welcome, {user?.fullName}!</h1>
      </div>
      
      <div className="dashboard-content">
        {isAdmin && <AdminDashboard />}
        {isTeacher && <TeacherDashboard />}
        {isStudent && <StudentDashboard />}
      </div>
    </div>
  );
};

export default Dashboard;