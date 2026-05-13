import React from 'react';
import { subjectGradient, subjectAbbr, statusStyle, dayLabel } from './syllabusMeta';

// Reusable row used across Today/Browse/Upcoming/etc. Pure — no API calls,
// no state, just renders + dispatches an onClick.
const TopicRow = ({ topic, today, compact, onClick }) => {
  const status = statusStyle(topic.status || 'new');
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/40 rounded-xl ${compact ? 'p-3' : 'p-3.5'} grid grid-cols-[48px_1fr_auto] gap-3 items-center transition-all hover:translate-x-0.5`}
    >
      <div className={`w-12 h-12 rounded-xl ${subjectGradient(topic.subject)} text-white flex flex-col items-center justify-center text-[10px] font-bold leading-none`}>
        <span>{subjectAbbr(topic.subject)}</span>
        <span className="opacity-80 mt-0.5">U{topic.unitNumber}</span>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-slate-500 mb-0.5 truncate">
          {topic.outcomeCode} · {topic.unitTitle}
        </div>
        <div className="text-sm font-semibold text-white leading-snug line-clamp-2">
          {topic.outcomeText}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {topic.status && (
          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${status.cls}`}>
            {status.label}
          </span>
        )}
        {topic.nextReviewDay && (
          <span className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">
            {dayLabel(topic.nextReviewDay, today)}
          </span>
        )}
      </div>
    </button>
  );
};

export default TopicRow;
