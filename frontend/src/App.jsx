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
import GoogleOneTap from './components/auth/GoogleOneTap';

// Test Management Components
import TestList from './components/Tests/TestList';
import TestForm from './components/Tests/TestForm';
import TestDetail from './components/Tests/TestDetail';
import MCQForm from './components/MCQs/MCQForm';

function AppContent() {
  return (
    <Router>
      <GoogleOneTap />
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

          {/* Test Management Routes - For Admin and Teachers */}
          <Route element={<RoleBasedRoute allowedRoles={['admin', 'teacher']} />}>
            {/* Test Routes */}
            <Route
              path="/tests"
              element={
                <DashboardLayout>
                  <TestList />
                </DashboardLayout>
              }
            />
            <Route
              path="/tests/create"
              element={
                <DashboardLayout>
                  <TestForm />
                </DashboardLayout>
              }
            />
            <Route
              path="/tests/:id"
              element={
                <DashboardLayout>
                  <TestDetail />
                </DashboardLayout>
              }
            />
            <Route
              path="/tests/:id/edit"
              element={
                <DashboardLayout>
                  <TestForm />
                </DashboardLayout>
              }
            />
            
            {/* MCQ Routes */}
            <Route
              path="/tests/:testId/mcqs/create"
              element={
                <DashboardLayout>
                  <MCQForm />
                </DashboardLayout>
              }
            />
            <Route
              path="/tests/:testId/mcqs/:mcqId/edit"
              element={
                <DashboardLayout>
                  <MCQForm />
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