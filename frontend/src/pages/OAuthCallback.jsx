// src/pages/OAuthCallback.jsx
import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUser } = useAuth();
  
  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Get token from URL parameters
        const params = new URLSearchParams(location.search);
        const token = params.get('token');
        
        if (!token) {
          navigate('/login');
          return;
        }
        
        // Store the token
        localStorage.setItem('accessToken', token);
        
        // Fetch user data
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const userData = await response.json();
        
        if (userData.success) {
          // Update user context
          updateUser(userData.data);
          
          // Redirect to dashboard
          navigate('/dashboard');
        } else {
          navigate('/login');
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        navigate('/login');
      }
    };
    
    handleOAuthCallback();
  }, [location, navigate, updateUser]);
  
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Completing login...</h2>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    </div>
  );
};

export default OAuthCallback;