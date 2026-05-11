import React from 'react';
import { FiBookmark } from 'react-icons/fi';
import useAuth from '../../../core/auth/useAuth';
import { TYPE_META, AUDIENCE_LABEL, timeAgo } from './announcementMeta';

// Dashboard card. Reads from the same AuthContext list that powers the slide-in
// panel — no API call of its own. "View all" fires a window event the layout
// listens for; that lets one panel instance live in the layout for both entry
// points without prop-drilling.
const LatestAnnouncementsWidget = () => {
  const { announcements } = useAuth();
  const top5 = (announcements || []).slice(0, 5);

  const openSidebar = () => window.dispatchEvent(new CustomEvent('announcements:open'));

  return (
    <div className="bg-slate-900 text-white rounded-2xl shadow-lg p-5 border border-slate-800 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <span className="text-amber-400">📣</span>
          Latest Announcements
        </h3>
        <button
          onClick={openSidebar}
          className="text-xs font-medium text-amber-400 hover:text-amber-300"
        >
          View all
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-3 max-h-96">
        {top5.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-6">No announcements yet</p>
        ) : (
          top5.map((a) => <CompactCard key={a._id} a={a} onOpenAll={openSidebar} />)
        )}
      </div>
    </div>
  );
};

const CompactCard = ({ a, onOpenAll }) => {
  const meta = TYPE_META[a.type] || TYPE_META.info;
  return (
    <button
      onClick={onOpenAll}
      className={`w-full text-left bg-slate-800/60 hover:bg-slate-800 transition-colors rounded-lg p-3 border-l-4 ${meta.accent}`}
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-1">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${meta.badgeClass}`}>
          {meta.label}
        </span>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
          🌐 {AUDIENCE_LABEL[a.audience] || 'EVERYONE'}
        </span>
        {a.pinned && <FiBookmark className="w-3 h-3 text-amber-400" />}
      </div>
      <h4 className="text-sm font-semibold text-white truncate">{a.title}</h4>
      {a.message && (
        <p className="text-xs text-slate-300 line-clamp-2 mt-0.5">{a.message}</p>
      )}
      <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1.5">
        <span>👤 {a.createdByName || 'Admin'}</span>
        <span>🕒 {timeAgo(a.createdAt)}</span>
      </div>
    </button>
  );
};

export default LatestAnnouncementsWidget;
