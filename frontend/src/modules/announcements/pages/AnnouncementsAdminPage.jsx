import React, { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { FiEdit2, FiTrash2, FiBookmark, FiRefreshCw, FiSend } from 'react-icons/fi';
import useAuth from '../../../core/auth/useAuth';
import {
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  togglePinAnnouncement,
} from '../services/announcementsService';

// Pinned-first, then newest. Used after every list mutation so insert order
// stays canonical regardless of which side (HTTP response vs SSE event)
// reaches the client first.
const sortAnnouncements = (list) => list.slice().sort((x, y) => {
  if (!!y.pinned !== !!x.pinned) return (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0);
  return new Date(y.createdAt) - new Date(x.createdAt);
});
import { TYPE_META, AUDIENCE_LABEL, timeAgo } from '../components/announcementMeta';

const TYPES = [
  { value: 'info',   label: 'Info' },
  { value: 'test',   label: 'Test Schedule' },
  { value: 'update', label: 'Update' },
  { value: 'urgent', label: 'Urgent' },
];

const AUDIENCES = [
  { value: 'everyone', label: 'All students' },
  { value: 'students', label: 'Students only' },
  { value: 'teachers', label: 'Teachers only' },
  { value: 'admins',   label: 'Admins only' },
];

// Admin/teacher console. The list on the right uses the SAME 16-fetch hasMore
// pattern as the rest of the app. The SSE stream keeps it live: when one staff
// member creates/edits/pins, every other open admin tab sees the change.
const AnnouncementsAdminPage = () => {
  const { announcements: liveList, setAnnouncements } = useAuth();
  const [page, setPage]       = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const empty = {
    title: '', message: '', type: 'info', audience: 'everyone',
    link: '', buttonText: 'Open', pinned: false, expiresAt: '',
  };
  const [form, setForm]       = useState(empty);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Initial fetch — pulls the full first page (15 items). After this we keep
  // the cache fresh via SSE events handled in AuthContext.
  const fetchFirstPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listAnnouncements(1);
      setAnnouncements(res.data || []);
      setPage(1);
      setHasMore(!!res.hasMore);
    } catch {
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [setAnnouncements]);

  useEffect(() => { fetchFirstPage(); }, [fetchFirstPage]);

  const loadMore = async () => {
    try {
      const res = await listAnnouncements(page + 1);
      const older = res.data || [];
      setAnnouncements((list) => {
        const seen = new Set(list.map((a) => a._id));
        return [...list, ...older.filter((a) => !seen.has(a._id))];
      });
      setPage((p) => p + 1);
      setHasMore(!!res.hasMore);
    } catch {
      toast.error('Failed to load more');
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form, expiresAt: form.expiresAt || null };
      if (editingId) {
        const res = await updateAnnouncement(editingId, payload);
        // map() replaces in place — no duplicate possible. SSE will arrive
        // with the same payload and the announcement_update handler will be
        // a no-op (same _id, same content).
        setAnnouncements((list) => sortAnnouncements(list.map((a) => (a._id === editingId ? res.data : a))));
        toast.success('Announcement updated');
      } else {
        const res = await createAnnouncement(payload);
        // Server pushes 'announcement_new' to ALL connected sockets BEFORE the
        // HTTP response returns. So by the time we land here, AuthContext may
        // have already inserted this doc. Dedupe by _id to prevent the same
        // announcement appearing twice (the bug seen on the dashboard widget,
        // sidebar, and admin list — all read from the same AuthContext array).
        setAnnouncements((list) => {
          if (list.some((a) => a._id === res.data._id)) return list;
          return sortAnnouncements([res.data, ...list]);
        });
        toast.success('Announcement sent');
      }
      setForm(empty);
      setEditingId(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const onEdit = (a) => {
    setEditingId(a._id);
    setForm({
      title:      a.title || '',
      message:    a.message || '',
      type:       a.type || 'info',
      audience:   a.audience || 'everyone',
      link:       a.link || '',
      buttonText: a.buttonText || 'Open',
      pinned:     !!a.pinned,
      expiresAt:  a.expiresAt ? new Date(a.expiresAt).toISOString().slice(0, 16) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try {
      await deleteAnnouncement(id);
      setAnnouncements((list) => list.filter((a) => a._id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const onTogglePin = async (a) => {
    try {
      const res = await togglePinAnnouncement(a._id, !a.pinned);
      setAnnouncements((list) => {
        const next = list.map((x) => (x._id === a._id ? res.data : x));
        next.sort((x, y) => {
          if (!!y.pinned - !!x.pinned !== 0) return (y.pinned ? 1 : 0) - (x.pinned ? 1 : 0);
          return new Date(y.createdAt) - new Date(x.createdAt);
        });
        return next;
      });
    } catch {
      toast.error('Pin toggle failed');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <div className="bg-slate-900 text-white rounded-2xl shadow-lg p-5 border border-slate-800">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <span className="text-amber-400">📣</span>
          {editingId ? 'Edit Announcement' : 'Create Announcement'}
        </h2>

        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Title *">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. MDCAT Mock Test - Sunday 10am"
              maxLength={200}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              required
            />
          </Field>

          <Field label="Message">
            <textarea
              rows={4}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Full details students should see"
              maxLength={5000}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400 resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              >
                {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Audience (who will get it)">
              <select
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              >
                {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Link (optional)">
              <input
                type="url"
                value={form.link}
                onChange={(e) => setForm({ ...form, link: e.target.value })}
                placeholder="https://..."
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              />
            </Field>
            <Field label="Button Text">
              <input
                type="text"
                value={form.buttonText}
                onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                maxLength={40}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              />
            </Field>
          </div>

          <Field label="Expires (optional)">
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
            />
          </Field>

          <label className="flex items-center gap-3 cursor-pointer">
            <span className="relative inline-block w-10 h-5">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="sr-only peer"
              />
              <span className="absolute inset-0 rounded-full bg-slate-700 peer-checked:bg-amber-500 transition-colors" />
              <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full peer-checked:translate-x-5 transition-transform" />
            </span>
            <span className="text-sm">Pin to top</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-medium py-2.5 rounded-md text-sm flex items-center justify-center gap-2"
            >
              <FiSend className="w-4 h-4" />
              {editingId ? 'Save Changes' : 'Send Announcement'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { setForm(empty); setEditingId(null); }}
                className="px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-md text-sm"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={fetchFirstPage}
              className="p-2.5 bg-slate-700 hover:bg-slate-600 rounded-md"
              title="Refresh list"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <div className="bg-slate-900 text-white rounded-2xl shadow-lg p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">≡ All Announcements</h2>
          <button
            onClick={fetchFirstPage}
            className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1"
          >
            <FiRefreshCw className="w-3 h-3" />
            Refresh
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 py-6 text-center">Loading…</p>
        ) : liveList.length === 0 ? (
          <p className="text-sm text-slate-400 py-6 text-center">No announcements yet</p>
        ) : (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {liveList.map((a) => (
              <AdminAnnouncementRow
                key={a._id}
                a={a}
                onEdit={onEdit}
                onDelete={onDelete}
                onTogglePin={onTogglePin}
              />
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                className="w-full py-2 text-xs font-medium text-amber-400 hover:bg-slate-800 rounded-md"
              >
                Load more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-300 mb-1">{label}</label>
    {children}
  </div>
);

const AdminAnnouncementRow = ({ a, onEdit, onDelete, onTogglePin }) => {
  const meta = TYPE_META[a.type] || TYPE_META.info;
  const Icon = meta.Icon;
  return (
    <div className={`bg-slate-800/60 rounded-lg p-3 border-l-4 ${meta.accent}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${meta.iconWrap}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${meta.badgeClass}`}>
              {meta.label}
            </span>
            {a.pinned && <FiBookmark className="w-3 h-3 text-amber-400" />}
            <h3 className="text-sm font-semibold">{a.title}</h3>
          </div>
          {a.message && (
            <p className="text-xs text-slate-300 whitespace-pre-wrap line-clamp-3">{a.message}</p>
          )}
          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 mt-2">
            🌐 For {AUDIENCE_LABEL[a.audience]?.toLowerCase() || 'everyone'}
          </span>
          <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
            <span>{timeAgo(a.createdAt)}</span>
            {a.expiresAt && <span>expires {new Date(a.expiresAt).toLocaleDateString()}</span>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => onEdit(a)}
              className="px-2 py-1 text-xs rounded border border-slate-600 hover:bg-slate-700 flex items-center gap-1"
            >
              <FiEdit2 className="w-3 h-3" /> Edit
            </button>
            <button
              onClick={() => onTogglePin(a)}
              className={`px-2 py-1 text-xs rounded border flex items-center gap-1 ${
                a.pinned ? 'border-amber-400 text-amber-300 hover:bg-amber-500/10' : 'border-slate-600 hover:bg-slate-700'
              }`}
            >
              <FiBookmark className="w-3 h-3" /> {a.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              onClick={() => onDelete(a._id)}
              className="px-2 py-1 text-xs rounded border border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center gap-1"
            >
              <FiTrash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementsAdminPage;
