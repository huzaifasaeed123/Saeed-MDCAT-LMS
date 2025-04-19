import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import Loader from './Loader';

const RoleBasedRoute = ({ allowedRoles }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();
  
  // Show loader while auth state is being determined
  if (loading) {
    return <Loader />;
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  // Check if user role is allowed
  if (!allowedRoles.includes(user.role)) {
    // Redirect to dashboard if not authorized
    return <Navigate to="/dashboard" replace />;
  }
  
  // Allow access to protected route
  return <Outlet />;
};

export default RoleBasedRoute;