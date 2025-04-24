import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const AdminDashboard = () => {
  const { user } = useAuth();
  
  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
        <p className="text-gray-600">Welcome, {user?.fullName}! Manage all aspects of the system here.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 p-6">
          <div className="text-3xl mb-4">👥</div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">User Management</h3>
          <p className="text-gray-600 mb-4">Manage students, teachers, and admins</p>
          <Link to="/admin/users" className="btn btn-primary btn-sm">
            Manage Users
          </Link>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 p-6">
          <div className="text-3xl mb-4">📚</div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Course Management</h3>
          <p className="text-gray-600 mb-4">Create and manage courses and content</p>
          <Link to="/admin/courses" className="btn btn-primary btn-sm">
            Manage Courses
          </Link>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 p-6">
          <div className="text-3xl mb-4">📝</div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">Tests & MCQs</h3>
          <p className="text-gray-600 mb-4">Create and manage tests and questions</p>
          <Link to="/tests" className="btn btn-primary btn-sm">
            Manage Tests
          </Link>
        </div>
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300 p-6">
          <div className="text-3xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-800 mb-2">System Analytics</h3>
          <p className="text-gray-600 mb-4">View platform usage statistics</p>
          <Link to="/admin/analytics" className="btn btn-primary btn-sm">
            View Analytics
          </Link>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">System Summary</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm text-gray-500 mb-1">Total Users</h4>
            <p className="text-2xl font-bold text-primary-600">0</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm text-gray-500 mb-1">Active Courses</h4>
            <p className="text-2xl font-bold text-primary-600">0</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm text-gray-500 mb-1">Total MCQs</h4>
            <p className="text-2xl font-bold text-primary-600">0</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="text-sm text-gray-500 mb-1">System Uptime</h4>
            <p className="text-2xl font-bold text-primary-600">100%</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;