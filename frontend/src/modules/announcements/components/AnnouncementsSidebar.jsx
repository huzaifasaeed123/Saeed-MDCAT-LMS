import React, { useEffect, useRef, useState } from 'react';
import { FiX, FiCheck, FiBookmark } from 'react-icons/fi';
import useAuth from '../../../core/auth/useAuth';
import { listAnnouncements, markAnnouncementsSeen } from '../services/announcementsService';
import { TYPE_META, AUDIENCE_LABEL, timeAgo } from './announcementMeta';

// Slide-in panel mounted at the layout root. Hydration is free: the first 15
// announcements arrive with the SSE 'connected' event. Older items are paged
// in 15-at-a-time using the limit+1 hasMore pattern (no countDocuments).
const AnnouncementsSidebar = ({ open, onClose }) => {
  const {
    announcements, setAnnouncements,
    announcementUnreadCount, setAnnouncementUnreadCount,
  } = useAuth();
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [page, setPage]               = useState(1);
  const seenSentRef = useRef(false);

  // First time the panel opens for this session, send a single mark-seen ping.
  // This zeroes the badge for everyone-but-this-tab (other tabs would observe
  // the next 'connected' frame). One DB write per session — not per open.
  useEffect(() => {
    if (!open || seenSentRef.current) return;
    if (announcementUnreadCount === 0) { seenSentRef.current = true; return; }
    seenSentRef.current = true;
    setAnnouncementUnreadCount(0);
    markAnnouncementsSeen().catch(() => { seenSentRef.current = false; });
  }, [open, announcementUnreadCount, setAnnouncementUnreadCount]);

  const loadOlder = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await listAnnouncements(page + 1);
      const older = res.data || [];
      setAnnouncements((list) => {
        const seen = new Set(list.map((a) => a._id));
        return [...list, ...older.filter((a) => !seen.has(a._id))];
      });
      setPage((p) => p + 1);
      setHasMore(!!res.hasMore);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Panel — slides in from the RIGHT (opposite side of the bell icons). */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-slate-900 text-white shadow-2xl transform transition-transform duration-300 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Announcements"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-slate-800">
          <div className="flex items-start gap-2">
            <span className="text-amber-400 text-2xl leading-none">📣</span>
            <div>
              <h2 className="text-lg font-semibold">Announcements</h2>
              <p className="text-xs text-slate-400">Stay updated on tests &amp; schedule</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAnnouncementUnreadCount(0);
                markAnnouncementsSeen().catch(() => {});
              }}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Mark all as seen"
            >
              <FiCheck className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Close"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {announcements.length === 0 ? (
            <div className="text-center text-slate-400 text-sm py-12">No announcements yet</div>
          ) : (
            <>
              {announcements.map((a) => (
                <AnnouncementSidebarCard key={a._id} a={a} />
              ))}
              {hasMore && (
                <button
                  onClick={loadOlder}
                  disabled={loadingMore}
                  className="w-full py-2.5 mt-2 text-xs font-medium text-amber-400 hover:bg-slate-800 rounded-md disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
};

const AnnouncementSidebarCard = ({ a }) => {
  const meta = TYPE_META[a.type] || TYPE_META.info;
  const Icon = meta.Icon;
  const expiresLabel = a.expiresAt
    ? `until ${new Date(a.expiresAt).toLocaleDateString()}`
    : null;
  return (
    <div className={`bg-slate-800/60 rounded-lg p-4 border-l-4 ${meta.accent}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${meta.iconWrap}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${meta.badgeClass}`}>
              {meta.label}
            </span>
            {a.pinned && <FiBookmark className="w-3.5 h-3.5 text-amber-400" title="Pinned" />}
            <h3 className="text-sm font-semibold text-white">{a.title}</h3>
          </div>
          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 mb-2">
            🌐 {AUDIENCE_LABEL[a.audience] || 'EVERYONE'}
          </span>
          {a.message && (
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-snug">{a.message}</p>
          )}
          {a.link && (
            <a
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 px-3 py-1 rounded-md bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium"
            >
              {a.buttonText || 'Open'}
            </a>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
            <span>👤 {a.createdByName || 'Admin'}</span>
            <span>🕒 {timeAgo(a.createdAt)}</span>
            {expiresLabel && <span>⏳ {expiresLabel}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementsSidebar;
