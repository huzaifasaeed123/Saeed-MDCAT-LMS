import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const AdminDashboard = () => {
  const { user } = useAuth();
  
  return (
    <div className="admin-dashboard">
      <div className="dashboard-welcome">
        <h2>Admin Dashboard</h2>
        <p>Welcome, {user?.fullName}! Manage all aspects of the system here.</p>
      </div>
      
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <div className="card-icon">👥</div>
          <div className="card-content">
            <h3>User Management</h3>
            <p>Manage students, teachers, and admins</p>
            <Link to="/admin/users" className="btn btn-sm">
              Manage Users
            </Link>
          </div>
        </div>
        
        <div className="dashboard-card">
          <div className="card-icon">📚</div>
          <div className="card-content">
            <h3>Course Management</h3>
            <p>Create and manage courses and content</p>
            <Link to="/admin/courses" className="btn btn-sm">
              Manage Courses
            </Link>
          </div>
        </div>
        
        <div className="dashboard-card">
          <div className="card-icon">📝</div>
          <div className="card-content">
            <h3>MCQs Management</h3>
            <p>Upload and manage MCQs for tests</p>
            <Link to="/admin/mcqs" className="btn btn-sm">
              Manage MCQs
            </Link>
          </div>
        </div>
        
        <div className="dashboard-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <h3>System Analytics</h3>
            <p>View platform usage statistics</p>
            <Link to="/admin/analytics" className="btn btn-sm">
              View Analytics
            </Link>
          </div>
        </div>
      </div>
      
      <div className="dashboard-summary">
        <h3>System Summary</h3>
        
        <div className="summary-stats">
          <div className="stat-card">
            <h4>Total Users</h4>
            <p className="stat-number">0</p>
          </div>
          
          <div className="stat-card">
            <h4>Active Courses</h4>
            <p className="stat-number">0</p>
          </div>
          
          <div className="stat-card">
            <h4>Total MCQs</h4>
            <p className="stat-number">0</p>
          </div>
          
          <div className="stat-card">
            <h4>System Uptime</h4>
            <p className="stat-number">100%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;