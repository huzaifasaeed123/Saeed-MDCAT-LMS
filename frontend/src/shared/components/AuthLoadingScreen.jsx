import React from 'react';

// SKN-branded splash shown while we silently refresh the access token on
// app boot. Brand-gradient mark + wordmark, mono caption underneath, brand-
// gradient spinner ring.
const AuthLoadingScreen = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--bg)] z-50">
    <div className="flex flex-col items-center gap-5">
      <img src="/skn-logo-mark.png" alt="" className="w-16 h-16 rounded-2xl shadow-lg" />

      <div className="text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-brand-gradient">SKN Academy</h1>
        <p className="text-[11px] font-mono tracking-[0.18em] uppercase text-gray-400 mt-1">Restoring your session</p>
      </div>

      <div className="w-10 h-10 rounded-full animate-spin" style={{
        background: 'conic-gradient(from 0deg, transparent 0deg, #7c3aed 90deg, #f97316 270deg, transparent 360deg)',
        WebkitMask: 'radial-gradient(circle, transparent 50%, black 52%)',
                mask: 'radial-gradient(circle, transparent 50%, black 52%)',
      }} />
    </div>
  </div>
);

export default AuthLoadingScreen;
