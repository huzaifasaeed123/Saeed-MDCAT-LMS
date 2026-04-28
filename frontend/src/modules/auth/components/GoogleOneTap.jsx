import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import useAuth from '../../../core/auth/useAuth';
import { loginWithGoogle } from '../services/authService';
import { useNavigate, useLocation } from 'react-router-dom';

const ALLOWED_PATHS = ['/', '/login', '/register'];
const GSI_SRC = 'https://accounts.google.com/gsi/client';

const GoogleOneTap = () => {
  const { updateUser, isAuthenticated } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const promptRef = useRef(null); // track prompt timer so we can cancel it

  useEffect(() => {
    if (isAuthenticated || !ALLOWED_PATHS.includes(location.pathname)) return;

    const init = () => {
      if (!window.google?.accounts?.id) return;
      try {
        window.google.accounts.id.initialize({
          client_id:            import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback:             handleGoogleResponse,
          auto_select:          false,
          cancel_on_tap_outside: true,
          context:              'signin',
          itp_support:          true,
          // ux_mode and use_fedcm_for_prompt intentionally omitted:
          // ux_mode:'popup' belongs to renderButton, not One Tap;
          // use_fedcm_for_prompt suppresses the prompt in many browsers.
        });

        // A short delay lets the page finish painting before the overlay appears.
        promptRef.current = setTimeout(() => {
          window.google.accounts.id.prompt((n) => {
            if (n.isNotDisplayed()) {
              console.log('[OneTap] not displayed:', n.getNotDisplayedReason());
            }
            if (n.isSkippedMoment()) {
              console.log('[OneTap] skipped:', n.getSkippedReason());
            }
          });
        }, 150);
      } catch (e) {
        console.error('[OneTap] init error:', e);
      }
    };

    // If Google library is already loaded (navigated from another page), init immediately.
    if (window.google?.accounts?.id) {
      init();
      return () => {
        clearTimeout(promptRef.current);
        window.google?.accounts?.id?.cancel();
      };
    }

    // Script already injected but not yet loaded — wait for it.
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', init);
      return () => {
        clearTimeout(promptRef.current);
        existing.removeEventListener('load', init);
        window.google?.accounts?.id?.cancel();
      };
    }

    // First time — inject the script now (no artificial delay).
    const script = document.createElement('script');
    script.src   = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = init;
    document.body.appendChild(script);

    return () => {
      clearTimeout(promptRef.current);
      window.google?.accounts?.id?.cancel();
    };
  }, [isAuthenticated, location.pathname]);

  const handleGoogleResponse = async (response) => {
    try {
      const result = await loginWithGoogle(response.credential);
      if (result.success) {
        updateUser(result.user, result.accessToken);
        if (!result.user.contactNumber) {
          navigate('/profile?newUser=true');
          toast.info('Please complete your profile by adding your contact number.');
        } else {
          navigate('/dashboard');
          toast.success('Logged in with Google!');
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Google authentication failed');
    }
  };

  return null;
};

export default GoogleOneTap;
