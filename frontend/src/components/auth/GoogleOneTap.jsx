// src/components/auth/GoogleOneTap.jsx
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import useAuth from '../../hooks/useAuth';
import { loginWithGoogle } from '../../services/authService';
import { useNavigate, useLocation } from 'react-router-dom';

const GoogleOneTap = () => {
  const { updateUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  
  useEffect(() => {
    // Only show One Tap on specific pages and when user is not authenticated
    const allowedPaths = ['/', '/login', '/register'];
    if (isAuthenticated || !allowedPaths.includes(location.pathname)) {
      return;
    }
    
    const loadGoogleScript = () => {
      if (window.google) {
        setIsGoogleLoaded(true);
        initializeGoogleOneTap();
        return;
      }

      if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
      
      script.onload = () => {
        setIsGoogleLoaded(true);
        initializeGoogleOneTap();
      };
    };
    
    // Delay loading to avoid conflicts with other Google components
    const timer = setTimeout(loadGoogleScript, 1000);
    
    return () => {
      clearTimeout(timer);
      if (window.google) {
        google.accounts.id.cancel();
      }
    };
  }, [isAuthenticated, location.pathname]);
  
  const initializeGoogleOneTap = () => {
    if (window.google) {
      try {
        google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
          auto_select: false, // Set to true if you want automatic sign-in
          cancel_on_tap_outside: true,
          context: 'signin',
          ux_mode: 'popup',
          itp_support: true,
          use_fedcm_for_prompt: true // Add this for newer Chrome versions
        });
        
        // Delay prompt to avoid conflicts
        setTimeout(() => {
          google.accounts.id.prompt((notification) => {
            if (notification.isNotDisplayed()) {
              console.log('One Tap not displayed:', notification.getNotDisplayedReason());
            }
            if (notification.isSkippedMoment()) {
              console.log('One Tap skipped:', notification.getSkippedReason());
            }
          });
        }, 1500);
      } catch (error) {
        console.error('Error initializing Google One Tap:', error);
      }
    }
  };
  
  const handleGoogleResponse = async (response) => {
    try {
      const result = await loginWithGoogle(response.credential);
      
      if (result.success) {
        updateUser(result.user);
        
        if (!result.user.contactNumber || result.user.contactNumber === '') {
          navigate('/profile?newUser=true');
          toast.info('Please complete your profile by adding your contact number.');
        } else {
          navigate('/dashboard');
          toast.success('Successfully logged in with Google!');
        }
      }
    } catch (error) {
      console.error('Google authentication error:', error);
      toast.error(error.response?.data?.message || 'Failed to authenticate with Google');
    }
  };
  
  return null; // This component doesn't render anything visible
};

export default GoogleOneTap;