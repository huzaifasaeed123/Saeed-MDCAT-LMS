// src/layouts/DashboardLayout.jsx
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FiMenu, FiX, FiHome, FiUsers, FiBook, FiFileText, FiSettings, FiLogOut, FiBarChart2 } from 'react-icons/fi';
import useAuth from '../hooks/useAuth';

const DashboardLayout = ({ children }) => {
  const { user, isAdmin, isTeacher, isStudent, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  // Define navigation items based on user role
  const navigationItems = [];
  
  // Common navigation items
  navigationItems.push({
    name: 'Dashboard',
    icon: <FiHome className="w-5 h-5" />,
    path: '/dashboard',
  });
  
  // Admin-specific navigation
  if (isAdmin) {
    navigationItems.push({
      name: 'User Management',
      icon: <FiUsers className="w-5 h-5" />,
      path: '/admin/users',
    });
    
    navigationItems.push({
      name: 'Course Management',
      icon: <FiBook className="w-5 h-5" />,
      path: '/admin/courses',
    });
    
    navigationItems.push({
      name: 'MCQs Management',
      icon: <FiFileText className="w-5 h-5" />,
      path: '/admin/mcqs',
    });
    
    navigationItems.push({
      name: 'System Analytics',
      icon: <FiBarChart2 className="w-5 h-5" />,
      path: '/admin/analytics',
    });
  }
  
  // Teacher-specific navigation
  if (isTeacher) {
    navigationItems.push({
      name: 'Student Queries',
      icon: <FiUsers className="w-5 h-5" />,
      path: '/teacher/queries',
    });
    
    navigationItems.push({
      name: 'MCQs Management',
      icon: <FiFileText className="w-5 h-5" />,
      path: '/teacher/mcqs',
    });
  }
  
  // Student-specific navigation
  if (isStudent) {
    navigationItems.push({
      name: 'My Courses',
      icon: <FiBook className="w-5 h-5" />,
      path: '/student/courses',
    });
    
    navigationItems.push({
      name: 'Practice Tests',
      icon: <FiFileText className="w-5 h-5" />,
      path: '/student/tests',
    });
    
    navigationItems.push({
      name: 'Performance',
      icon: <FiBarChart2 className="w-5 h-5" />,
      path: '/student/performance',
    });
  }
  
  // Common navigation items for all roles
  navigationItems.push({
    name: 'Profile',
    icon: <FiSettings className="w-5 h-5" />,
    path: '/profile',
  });
  
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar for larger screens */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-white shadow-lg transition duration-300 md:translate-x-0 md:static md:inset-auto md:h-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="Saeed MDCAT" className="w-8 h-8" />
            <span className="text-xl font-semibold text-primary-700">Saeed MDCAT</span>
          </div>
          <button 
            className="p-1 rounded-md md:hidden focus:outline-none focus:ring-2 focus:ring-primary-500"
            onClick={toggleSidebar}
          >
            <FiX className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4 border-b">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold text-xl">
                {user?.fullName?.charAt(0) || 'U'}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.fullName || 'User'}
              </p>
              <p className="text-sm text-gray-500 truncate">
                {user?.email || 'user@example.com'}
              </p>
            </div>
          </div>
        </div>
        
        <nav className="mt-4 px-2 space-y-1">
          {navigationItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-md group ${
                location.pathname === item.path
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className={`mr-3 ${
                location.pathname === item.path
                  ? 'text-primary-700'
                  : 'text-gray-500 group-hover:text-gray-700'
              }`}>
                {item.icon}
              </div>
              {item.name}
            </Link>
          ))}
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 group"
          >
            <FiLogOut className="mr-3 w-5 h-5 text-gray-500 group-hover:text-gray-700" />
            Logout
          </button>
        </nav>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Top header */}
        <header className="bg-white shadow-sm z-20">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={toggleSidebar}
              className="p-1 text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 md:hidden"
            >
              <FiMenu className="w-6 h-6" />
            </button>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm font-medium text-gray-500">
                {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>
        </header>
        
        {/* Main content area */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
        
        {/* Footer */}
        <footer className="bg-white shadow-inner px-6 py-4">
          <div className="text-center text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Saeed MDCAT LMS. All rights reserved.
          </div>
        </footer>
      </div>
      
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black bg-opacity-50 transition-opacity md:hidden"
          onClick={toggleSidebar}
        ></div>
      )}
    </div>
  );
};

export default DashboardLayout;