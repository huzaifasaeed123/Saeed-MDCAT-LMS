import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiMessageSquare, FiCreditCard, FiArrowLeft } from 'react-icons/fi';

// ── LockedFeaturePage ──────────────────────────────────────────────────────
// Shown by the FeatureGate wrapper whenever a student visits a route they
// don't have access to. The "Send Message to Admin" button hops over to
// /messages where the student can DM an admin (search admin → start chat).
// We deliberately don't pre-select an admin recipient here because admins
// rotate; the Messages page already supports user search.
// ───────────────────────────────────────────────────────────────────────────

const FEATURE_META = {
  autoTest:  { title: 'Auto Test Generator', blurb: 'Create unlimited practice tests from the question banks.' },
  courses:   { title: 'Courses',             blurb: 'Access the full course library, lectures, notes, and tests.' },
  community: { title: 'Community',           blurb: 'Join discussions, ask questions, and earn community points.' },
  videos:    { title: 'Videos',              blurb: 'Watch the complete video lecture library.' },
  notes:     { title: 'Notes',               blurb: 'Download study notes and reference PDFs.' },
};

const LockedFeaturePage = ({ feature, courseId }) => {
  const navigate = useNavigate();
  const meta = FEATURE_META[feature] || { title: 'This feature', blurb: 'Access is currently restricted.' };

  // If a courseId was provided, the lock is for a specific course (per-course
  // allowlist), not the master Courses feature. Adjust the copy slightly.
  const isCourseLevel = !!courseId;
  const title = isCourseLevel ? 'Course Locked' : `${meta.title} Locked`;
  const blurb = isCourseLevel
    ? 'You do not have access to this specific course yet. Contact the admin to unlock it.'
    : meta.blurb;

  return (
    <div className="flex items-center justify-center py-12 px-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header band */}
        <div className="bg-gradient-to-br from-amber-50 to-rose-50 px-6 py-8 text-center border-b border-amber-100">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-sm border border-amber-200 mb-3">
            <FiLock className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-800">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">{blurb}</p>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          <p className="text-sm text-gray-700 leading-relaxed">
            This feature is part of a premium plan. To get access:
          </p>
          <ol className="mt-3 space-y-2 text-sm text-gray-600">
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">1</span>
              <span>Send a message to the admin and confirm your plan.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">2</span>
              <span>Complete the payment using the details the admin shares.</span>
            </li>
            <li className="flex gap-2">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">3</span>
              <span>Access unlocks automatically the moment the admin enables it.</span>
            </li>
          </ol>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/messages')}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <FiMessageSquare className="w-4 h-4" />
              Message Admin
            </button>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              <FiArrowLeft className="w-4 h-4" />
              Go Back
            </button>
          </div>

          <div className="mt-4 flex items-start gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3">
            <FiCreditCard className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
            <span>Payment details and pricing are confirmed by the administrator over chat.</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LockedFeaturePage;
