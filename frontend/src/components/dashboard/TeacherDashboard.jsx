import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const TeacherDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="teacher-dashboard">
      <div className="dashboard-welcome">
        <h2>Teacher Dashboard</h2>
        <p>Welcome, {user?.fullName}! Manage your teaching activities here.</p>
      </div>

      <div className="dashboard-cards">
        {/* Community */}
        <div className="dashboard-card">
          <div className="card-icon">💬</div>
          <div className="card-content">
            <h3>Community</h3>
            <p>Moderate discussions and provide guidance</p>
            <Link to="/teacher/community" className="btn btn-sm">
              View Discussions
            </Link>
          </div>
        </div>

        {/* Student Queries */}
        <div className="dashboard-card">
          <div className="card-icon">❓</div>
          <div className="card-content">
            <h3>Student Queries</h3>
            <p>Respond to questions from students</p>
            <Link to="/teacher/queries" className="btn btn-sm">
              View Queries
            </Link>
          </div>
        </div>

        {/* MCQs Management */}
        <div className="dashboard-card">
          <div className="card-icon">📝</div>
          <div className="card-content">
            <h3>MCQs Management</h3>
            <p>Create and edit MCQs for tests</p>
            <Link to="/teacher/mcqs" className="btn btn-sm">
              Manage MCQs
            </Link>
          </div>
        </div>

        {/* Student Performance */}
        <div className="dashboard-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <h3>Student Performance</h3>
            <p>View student analytics and progress</p>
            <Link to="/teacher/analytics" className="btn btn-sm">
              View Analytics
            </Link>
          </div>
        </div>
      </div>

      <div className="dashboard-stats">
        <h3>Quick Stats</h3>
        <div className="stats-container">
          <div className="stat-card">
            <h4>Pending Queries</h4>
            <p className="stat-number">0</p>
          </div>

          <div className="stat-card">
            <h4>MCQs Created</h4>
            <p className="stat-number">0</p>
          </div>

          <div className="stat-card">
            <h4>Active Students</h4>
            <p className="stat-number">0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
