import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import useAuth from '../../../core/auth/useAuth';

// Compact dashboard tile — drops into the existing dashboard grid alongside
// the announcements widget. State (dueCount + streak) comes straight from
// AuthContext (hydrated by the SSE 'connected' frame), so this widget makes
// ZERO API calls per render.
const SyllabusDueWidget = () => {
  const { syllabusDueCount, syllabusStreak } = useAuth();
  const due = syllabusDueCount || 0;
  const streak = syllabusStreak || 0;

  const flame = streak >= 30 ? '🔥🔥🔥' : streak >= 7 ? '🔥🔥' : streak > 0 ? '🔥' : '';

  return (
    <Link
      to="/syllabus/today"
      className="block bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-2xl shadow-lg p-5 hover:shadow-xl transition-shadow"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider opacity-90">Syllabus · Today</span>
        <FiArrowRight className="opacity-90" />
      </div>
      <div className="flex items-end justify-between">
        <div>
          {due > 0 ? (
            <>
              <p className="text-4xl font-bold leading-none">{due}</p>
              <p className="text-xs opacity-90 mt-1">
                topic{due === 1 ? '' : 's'} due for revision
              </p>
            </>
          ) : (
            <>
              <FiCheckCircle className="w-10 h-10 mb-1" />
              <p className="text-sm font-semibold">All caught up!</p>
              <p className="text-xs opacity-90 mt-0.5">Nothing due today.</p>
            </>
          )}
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold leading-none">{streak} {flame}</p>
          <p className="text-[10px] opacity-90 mt-1">day streak</p>
        </div>
      </div>
    </Link>
  );
};

export default SyllabusDueWidget;
