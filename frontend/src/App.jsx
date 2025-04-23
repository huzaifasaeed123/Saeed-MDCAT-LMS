import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Context Providers
import { AuthProvider } from './context/AuthContext';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Components
import PrivateRoute from './components/common/PrivateRoute';
import RoleBasedRoute from './components/common/RoleBasedRoute';
import Loader from './components/common/Loader';

// Public Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';

// Dashboard Pages
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';

// Admin Pages
import Users from './pages/admin/Users';
import NewUser from './pages/admin/NewUser';
import EditUser from './pages/admin/EditUser';
import GoogleOneTap from './components/auth/GoogleOneTap';  // Add this import


function AppContent() {
  return (
    <Router>
      <GoogleOneTap /> {/* Add One Tap component here */}
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes with Dashboard Layout */}
        <Route element={<PrivateRoute />}>
          <Route
            path="/dashboard"
            element={
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            }
          />
          <Route
            path="/profile"
            element={
              <DashboardLayout>
                <Profile />
              </DashboardLayout>
            }
          />
          
          {/* Admin Routes */}
          <Route element={<RoleBasedRoute allowedRoles={['admin']} />}>
            <Route
              path="/admin/users"
              element={
                <DashboardLayout>
                  <Users />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/users/new"
              element={
                <DashboardLayout>
                  <NewUser />
                </DashboardLayout>
              }
            />
            <Route
              path="/admin/users/:id"
              element={
                <DashboardLayout>
                  <EditUser />
                </DashboardLayout>
              }
            />
          </Route>
        </Route>
        
        {/* 404 Route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} />
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;