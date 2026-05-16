import React from 'react';
import { FiBookmark, FiUser, FiClock, FiBell, FiGlobe } from 'react-icons/fi';
import useAuth from '../../../core/auth/useAuth';
import { TYPE_META, AUDIENCE_LABEL, AUDIENCE_BADGE_CLASS, timeAgo } from './announcementMeta';

// Dashboard card. Reads from the same AuthContext list that powers the slide-in
// panel — no API call of its own. "View all" fires a window event the layout
// listens for; that lets one panel instance live in the layout for both entry
// points without prop-drilling.
const LatestAnnouncementsWidget = () => {
  const { announcements } = useAuth();
  const top5 = (announcements || []).slice(0, 5);

  const openSidebar = () => window.dispatchEvent(new CustomEvent('announcements:open'));

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-[var(--text-strong)] flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 flex items-center justify-center">
            <FiBell className="w-4 h-4" />
          </span>
          Latest Announcements
        </h3>
        <button
          onClick={openSidebar}
          className="text-xs font-semibold text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 transition-colors"
        >
          View all
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 max-h-96">
        {top5.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--bg-muted)] text-[var(--text-faint)] flex items-center justify-center mb-2">
              <FiBell className="w-5 h-5" />
            </div>
            <p className="text-sm text-[var(--text-muted)] font-medium">No announcements yet</p>
          </div>
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
      className={`w-full text-left bg-[var(--bg-muted)] hover:bg-[var(--bg-surface)] hover:border-primary-300 dark:hover:border-primary-700 transition-colors rounded-xl p-3 border border-[var(--border)] border-l-4 ${meta.accent}`}
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.badgeClass}`}>
          {meta.label}
        </span>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${AUDIENCE_BADGE_CLASS}`}>
          <FiGlobe className="w-2.5 h-2.5" />
          {AUDIENCE_LABEL[a.audience] || 'EVERYONE'}
        </span>
        {a.pinned && (
          <FiBookmark className="w-3 h-3 text-amber-500 dark:text-amber-400" title="Pinned" />
        )}
      </div>
      <h4 className="text-sm font-semibold text-[var(--text-strong)] truncate">{a.title}</h4>
      {a.message && (
        <p className="text-xs text-[var(--text-muted)] line-clamp-2 mt-0.5">{a.message}</p>
      )}
      <div className="flex items-center gap-3 text-[11px] text-[var(--text-faint)] mt-1.5">
        <span className="inline-flex items-center gap-1">
          <FiUser className="w-3 h-3" /> {a.createdByName || 'Admin'}
        </span>
        <span className="inline-flex items-center gap-1">
          <FiClock className="w-3 h-3" /> {timeAgo(a.createdAt)}
        </span>
      </div>
    </button>
  );
};

export default LatestAnnouncementsWidget;
