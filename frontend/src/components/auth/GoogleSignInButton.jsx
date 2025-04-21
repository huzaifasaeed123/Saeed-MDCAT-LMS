// src/components/auth/GoogleSignInButton.jsx
import React, { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import useAuth from '../../hooks/useAuth';
import { loginWithGoogle } from '../../services/authService';
import { useNavigate } from 'react-router-dom';

const GoogleSignInButton = () => {
  const googleButtonRef = useRef(null);
  const { updateUser } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Load the Google Identity Services library
    const loadGoogleScript = () => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
      
      script.onload = initializeGoogleSignIn;
    };
    
    loadGoogleScript();
    
    return () => {
      // Cleanup
      const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
      if (script) {
        document.body.removeChild(script);
      }
    };
  }, []);
  
  const initializeGoogleSignIn = () => {
    if (window.google) {
      google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      
      google.accounts.id.renderButton(
        googleButtonRef.current,
        { 
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 250
        }
      );
      
      // Optional: Prompt One Tap
      // google.accounts.id.prompt((notification) => {
      //   if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
      //     console.log('One Tap not displayed or skipped');
      //   }
      // });
    }
  };
  
  const handleGoogleResponse = async (response) => {
    try {
      const result = await loginWithGoogle(response.credential);
      
      if (result.success) {
        updateUser(result.user);
        
        // Check if user needs to complete profile
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
  
  return (
    <div className="w-full flex justify-center">
      <div ref={googleButtonRef}></div>
    </div>
  );
};

export default GoogleSignInButton;