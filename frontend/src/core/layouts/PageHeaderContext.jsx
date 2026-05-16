// SKN Academy LMS — page header context
//
// Pages push their title / subtitle / right-side action button up to the
// DashboardLayout's top bar via the usePageHeader() hook. This keeps page
// files focused on body content while the layout owns the consistent
// chrome around them.
//
// Usage from a page:
//   usePageHeader({
//     title:    'Test History',
//     subtitle: '43 total attempts · 38 completed · 5 abandoned',
//     action:   <Link to="/auto-test" className="btn-brand">New practice test</Link>,
//   });
// Pass `null` (or skip the hook) to clear / leave defaults.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export const PageHeaderContext = createContext(null);

export const PageHeaderProvider = ({ children }) => {
  const [header, setHeaderState] = useState({ title: '', subtitle: '', action: null });

  // Stable setter — pages can call this in a useEffect without re-firing.
  const setHeader = useCallback((next) => {
    setHeaderState({
      title:    next?.title    ?? '',
      subtitle: next?.subtitle ?? '',
      action:   next?.action   ?? null,
    });
  }, []);

  return (
    <PageHeaderContext.Provider value={{ header, setHeader }}>
      {children}
    </PageHeaderContext.Provider>
  );
};

// Convenience hook for pages: set header on mount, clear on unmount.
// Each render re-syncs whenever any of title/subtitle/action change.
// Rules of Hooks: NEVER return early between hook calls — useEffect must
// run unconditionally so the call order stays stable across renders.
export const usePageHeader = ({ title, subtitle, action } = {}) => {
  const ctx = useContext(PageHeaderContext);
  const setHeader = ctx?.setHeader;
  useEffect(() => {
    if (!setHeader) return; // no provider — no-op (e.g. on auth pages)
    setHeader({ title, subtitle, action });
    return () => setHeader({ title: '', subtitle: '', action: null });
    // Intentionally re-runs whenever any of these change so pages can update
    // the subtitle live (e.g. when stats finish loading).
  }, [title, subtitle, action, setHeader]);
};

// Read-only hook for the layout to render the current header.
export const usePageHeaderState = () => {
  const ctx = useContext(PageHeaderContext);
  return ctx?.header ?? { title: '', subtitle: '', action: null };
};
