import React, { useEffect, useRef, useState } from 'react';
import { FiX, FiCheck, FiBookmark, FiUser, FiClock, FiGlobe, FiExternalLink } from 'react-icons/fi';
import useAuth from '../../../core/auth/useAuth';
import { listAnnouncements, markAnnouncementsSeen } from '../services/announcementsService';
import { TYPE_META, AUDIENCE_LABEL, AUDIENCE_BADGE_CLASS, timeAgo } from './announcementMeta';

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
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Panel — slides in from the RIGHT (opposite side of the bell icons). */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-[var(--bg-surface)] text-[var(--text)] shadow-2xl border-l border-[var(--border)] transform transition-transform duration-300 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Announcements"
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-[var(--border)] bg-[var(--bg-muted)]">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300 flex items-center justify-center text-xl leading-none">
              📣
            </span>
            <div>
              <h2 className="text-base font-bold text-[var(--text-strong)] tracking-tight">Announcements</h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">Stay updated on tests &amp; schedule</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setAnnouncementUnreadCount(0);
                markAnnouncementsSeen().catch(() => {});
              }}
              className="p-2 rounded-lg bg-[var(--bg-surface)] hover:bg-primary-50 dark:hover:bg-primary-950/40 border border-[var(--border)] hover:border-primary-300 dark:hover:border-primary-700 text-[var(--text-muted)] hover:text-primary-600 dark:hover:text-primary-300 transition-colors"
              title="Mark all as seen"
              aria-label="Mark all as seen"
            >
              <FiCheck className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-[var(--bg-surface)] hover:bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-strong)] transition-colors"
              title="Close"
              aria-label="Close announcements"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[var(--bg)]">
          {announcements.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-full bg-[var(--bg-muted)] text-[var(--text-faint)] mx-auto mb-3 flex items-center justify-center text-2xl">
                📣
              </div>
              <p className="text-sm font-semibold text-[var(--text-strong)]">Nothing here yet</p>
              <p className="text-xs text-[var(--text-faint)] mt-1">New announcements will show up here</p>
            </div>
          ) : (
            <>
              {announcements.map((a) => (
                <AnnouncementSidebarCard key={a._id} a={a} />
              ))}
              {hasMore && (
                <button
                  onClick={loadOlder}
                  disabled={loadingMore}
                  className="w-full py-2.5 mt-2 text-xs font-bold text-primary-700 dark:text-primary-300 hover:bg-[var(--bg-muted)] border border-[var(--border)] rounded-xl disabled:opacity-50 transition-colors"
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
    <div className={`bg-[var(--bg-surface)] rounded-xl p-4 border border-[var(--border)] border-l-4 ${meta.accent}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${meta.iconWrap}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.badgeClass}`}>
              {meta.label}
            </span>
            {a.pinned && (
              <FiBookmark className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" title="Pinned" />
            )}
            <h3 className="text-sm font-semibold text-[var(--text-strong)]">{a.title}</h3>
          </div>
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mb-2 ${AUDIENCE_BADGE_CLASS}`}>
            <FiGlobe className="w-2.5 h-2.5" />
            {AUDIENCE_LABEL[a.audience] || 'EVERYONE'}
          </span>
          {a.message && (
            <p className="text-sm text-[var(--text)] whitespace-pre-wrap leading-snug">{a.message}</p>
          )}
          {a.link && (
            <a
              href={a.link}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-brand text-xs mt-2 px-3 py-1.5"
            >
              <FiExternalLink className="w-3 h-3" />
              {a.buttonText || 'Open'}
            </a>
          )}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-[var(--text-faint)]">
            <span className="inline-flex items-center gap-1">
              <FiUser className="w-3 h-3" /> {a.createdByName || 'Admin'}
            </span>
            <span className="inline-flex items-center gap-1">
              <FiClock className="w-3 h-3" /> {timeAgo(a.createdAt)}
            </span>
            {expiresLabel && <span>⏳ {expiresLabel}</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementsSidebar;
