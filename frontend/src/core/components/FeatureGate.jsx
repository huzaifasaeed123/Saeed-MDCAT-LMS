import React from 'react';
import useAuth from '../auth/useAuth';
import LockedFeaturePage from '../../modules/access/pages/LockedFeaturePage';

// ── FeatureGate ─────────────────────────────────────────────────────────────
// Wraps a route's element. If the current user is allowed to use `feature`,
// the wrapped children render normally. Otherwise the user sees the lock page
// with a "Message Admin" CTA. Staff (admin/teacher) always pass through.
//
// Usage in AppRouter:
//   <FeatureGate feature="community">
//     <DashboardLayout><CommunityPage /></DashboardLayout>
//   </FeatureGate>
// ────────────────────────────────────────────────────────────────────────────

const FeatureGate = ({ feature, children }) => {
  const { hasFeature, loading } = useAuth();

  // Wait for AuthContext to hydrate so we don't flash the lock page on cold
  // loads where featureAccess is still all-false defaults.
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!hasFeature(feature)) return <LockedFeaturePage feature={feature} />;
  return children;
};

export default FeatureGate;
