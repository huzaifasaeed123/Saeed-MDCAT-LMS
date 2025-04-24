import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const TeacherDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Teacher Dashboard</h2>
        <p className="text-gray-600">Welcome, {user?.fullName}! Manage your teaching activities here.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Community */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 p-6">
          <div className="text-3xl mb-4">💬</div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Community</h3>
          <p className="text-gray-600 mb-4">Moderate discussions and provide guidance</p>
          <Link to="/teacher/community" className="btn btn-primary btn-sm">
            View Discussions
          </Link>
        </div>

        {/* Student Queries */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 p-6">
          <div className="text-3xl mb-4">❓</div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Student Queries</h3>
          <p className="text-gray-600 mb-4">Respond to questions from students</p>
          <Link to="/teacher/queries" className="btn btn-primary btn-sm">
            View Queries
          </Link>
        </div>

        {/* Tests & MCQs Management */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 p-6">
          <div className="text-3xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Tests & MCQs</h3>
          <p className="text-gray-600 mb-4">Create and manage tests and questions</p>
          <Link to="/tests" className="btn btn-primary btn-sm">
            Manage Tests
          </Link>
        </div>

        {/* Student Performance */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 p-6">
          <div className="text-3xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Student Performance</h3>
          <p className="text-gray-600 mb-4">View student analytics and progress</p>
          <Link to="/teacher/analytics" className="btn btn-primary btn-sm">
            View Analytics
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Quick Stats</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm text-gray-500 mb-1">Pending Queries</h4>
            <p className="text-2xl font-bold text-primary-600">0</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm text-gray-500 mb-1">Tests Created</h4>
            <p className="text-2xl font-bold text-primary-600">0</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm text-gray-500 mb-1">MCQs Created</h4>
            <p className="text-2xl font-bold text-primary-600">0</p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm text-gray-500 mb-1">Active Students</h4>
            <p className="text-2xl font-bold text-primary-600">0</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;