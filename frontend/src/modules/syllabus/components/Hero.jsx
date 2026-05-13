import React from 'react';
import { FiPlay, FiTrendingUp, FiRefreshCw } from 'react-icons/fi';

// Top-of-page hero: eyebrow + dynamic title + CTA + streak card + manual
// refresh button. Pure presentational — gets the numbers from the parent
// (which derives them via useMemo from local state).
const Hero = ({ due, mastered, totalTopics, streak, onStart, onRefresh, refreshing }) => {
  const ctaLabel = due > 0
    ? `Start today's revision · ${due} due`
    : 'No revisions due — explore topics';

  const title = totalTopics === 0
    ? 'Syllabus is not seeded yet'
    : due > 0
      ? `You have ${due} topic${due === 1 ? '' : 's'} due today`
      : `${mastered} of ${totalTopics} outcomes mastered`;

  return (
    <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-7 mb-5">
      {/* Top accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500" />

      {/* Refresh — top right, ghost button (no extra layout column) */}
      <button
        onClick={onRefresh}
        disabled={refreshing}
        title="Refresh from server"
        className="absolute top-4 right-4 p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40"
      >
        <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-5 items-center">
        <div>
          <p className="text-[11px] uppercase tracking-[1.5px] font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
            <FiTrendingUp className="w-3 h-3" /> PMDC MDCAT 2025 · Check &amp; Balance
          </p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight mb-1.5">
            {title}
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed mb-4">
            Plan, revise and track every official PMDC outcome. The system reschedules each topic with the Leitner box (1 / 3 / 7 / 14 / 30 / 60 days).
          </p>
          <button
            onClick={onStart}
            disabled={totalTopics === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0"
          >
            <FiPlay className="w-4 h-4" /> {ctaLabel}
          </button>
        </div>
        <div className="bg-gradient-to-br from-amber-500/15 to-red-500/15 border border-amber-500/35 rounded-2xl px-6 py-5 text-center min-w-[140px]">
          <div className="text-2xl mb-1">🔥</div>
          <div className="text-3xl font-extrabold text-amber-400 leading-none">{streak}</div>
          <div className="text-[10px] uppercase tracking-[1px] font-bold text-slate-400 mt-1.5">Day Streak</div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
