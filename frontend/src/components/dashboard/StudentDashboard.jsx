import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const StudentDashboard = () => {
  const { user } = useAuth();
  
  return (
    <div className="student-dashboard">
      <div className="dashboard-welcome">
        <h2>Student Dashboard</h2>
        <p>Welcome to your learning journey, {user?.fullName}!</p>
      </div>
      
      <div className="dashboard-cards">
        <div className="dashboard-card">
          <div className="card-icon">📚</div>
          <div className="card-content">
            <h3>My Courses</h3>
            <p>Access your enrolled courses</p>
            <Link to="/student/courses" className="btn btn-sm">
              View Courses
            </Link>
          </div>
        </div>
        
        <div className="dashboard-card">
          <div className="card-icon">📝</div>
          <div className="card-content">
            <h3>Practice Tests</h3>
            <p>Take MCQ tests to prepare for MDCAT</p>
            <Link to="/student/tests" className="btn btn-sm">
              Start Practice
            </Link>
          </div>
        </div>
        
        <div className="dashboard-card">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <h3>Performance</h3>
            <p>View your progress and analytics</p>
            <Link to="/student/performance" className="btn btn-sm">
              View Analytics
            </Link>
          </div>
        </div>
        
        <div className="dashboard-card">
          <div className="card-icon">💬</div>
          <div className="card-content">
            <h3>Community</h3>
            <p>Engage with other students and teachers</p>
            <Link to="/student/community" className="btn btn-sm">
              Join Discussions
            </Link>
          </div>
        </div>
      </div>
      
      <div className="dashboard-activity">
        <h3>Recent Activity</h3>
        
        <div className="activity-placeholder">
          <p>No recent activity to show. Start learning to see your progress here!</p>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;