import { useEffect } from 'react';

// Force the <html> element out of dark mode for the lifetime of the
// caller component, then restore the previous state on unmount.
//
// Used by Login / Register / forgot-password / reset-password screens —
// these are always rendered in light mode regardless of the user's saved
// theme choice. Brand decision: auth flows feel cleaner & more universal
// on the light palette.
//
// Doesn't touch localStorage, so the user's actual preference is preserved
// — once they navigate into the app, their theme is reapplied.
const useForceLightMode = () => {
  useEffect(() => {
    const root  = document.documentElement;
    const wasDark = root.classList.contains('dark');
    if (wasDark) root.classList.remove('dark');
    return () => {
      if (wasDark) root.classList.add('dark');
    };
  }, []);
};

export default useForceLightMode;
