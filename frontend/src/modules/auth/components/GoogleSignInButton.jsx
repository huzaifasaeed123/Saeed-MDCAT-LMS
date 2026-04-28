import { useEffect, useRef } from 'react';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

// Renders the official Google "Sign in with Google" button.
// GoogleOneTap (always mounted in AppRouter) owns the initialize() call and the
// credential callback. This component only calls renderButton() — never
// initialize() — so it never overrides the One Tap callback or cancels the prompt.
const GoogleSignInButton = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const render = () => {
      if (!window.google?.accounts?.id || !containerRef.current) return;
      window.google.accounts.id.renderButton(containerRef.current, {
        theme:         'outline',
        size:          'large',
        text:          'signin_with',
        shape:         'rectangular',
        logo_alignment: 'left',
        width:         '100%',
      });
    };

    // GSI already loaded (navigated from another page)
    if (window.google?.accounts?.id) { render(); return; }

    // Script already injected but not yet executed
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', render);
      return () => existing.removeEventListener('load', render);
    }

    // Should not reach here — GoogleOneTap always injects the script first.
    // Fallback: wait for the script GoogleOneTap will inject.
    const observer = new MutationObserver(() => {
      const s = document.querySelector(`script[src="${GSI_SRC}"]`);
      if (s) { observer.disconnect(); s.addEventListener('load', render); }
    });
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full flex justify-center">
      <div ref={containerRef} style={{ width: '100%' }} />
    </div>
  );
};

export default GoogleSignInButton;
