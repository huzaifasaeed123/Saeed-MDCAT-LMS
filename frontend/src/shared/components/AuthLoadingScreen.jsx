import React from 'react';

const AuthLoadingScreen = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50">
    <div className="flex flex-col items-center gap-6">
      {/* Logo / brand */}
      <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
        <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>

      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800">Saeed MDCAT LMS</h1>
        <p className="text-sm text-gray-500 mt-1">Restoring your session…</p>
      </div>

      {/* Spinner */}
      <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
    </div>
  </div>
);

export default AuthLoadingScreen;
