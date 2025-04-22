// App.js
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

// Test & MCQ Pages
import TestList from './components/Tests/TestList';
import TestForm from './components/Tests/TestForm';
import TestDetail from './components/Tests/TestDetail';
import MCQForm from './components/MCQs/MCQForm';

function AppContent() {
  return (
    <Router>
      {/* Add One Tap component here */}
      <GoogleOneTap />
      
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected Routes with Dashboard Layout */}
        <Route element={<PrivateRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            
            {/* Test Routes - View only for users */}
            <Route path="/tests" element={<TestList />} />
            <Route path="/tests/:id" element={<TestDetail />} />
            
            {/* Test Routes - Create, Edit, Delete for admin and teacher only */}
            <Route element={<RoleBasedRoute roles={['admin', 'teacher']} />}>
              <Route path="/tests/create" element={<TestForm />} />
              <Route path="/tests/:id/edit" element={<TestForm />} />
              <Route path="/tests/:testId/mcqs/create" element={<MCQForm />} />
              <Route path="/tests/:testId/mcqs/:mcqId/edit" element={<MCQForm />} />
            </Route>
            
            {/* Admin Routes */}
            <Route element={<RoleBasedRoute roles={['admin']} />}>
              <Route path="/admin/users" element={<Users />} />
              <Route path="/admin/users/new" element={<NewUser />} />
              <Route path="/admin/users/:id/edit" element={<EditUser />} />
            </Route>
          </Route>
        </Route>
        
        {/* 404 Route */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
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