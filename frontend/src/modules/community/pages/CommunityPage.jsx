import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiSend, FiX, FiMoreVertical, FiEdit2, FiTrash2, FiMapPin,
  FiBookmark, FiThumbsUp, FiChevronDown, FiChevronUp,
  FiLoader, FiBarChart2, FiAward, FiCheck, FiImage,
  FiPlusSquare, FiSearch, FiRefreshCw, FiSliders, FiMessageCircle,
  FiCornerDownRight,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import useAuth from '../../../core/auth/useAuth';
import * as svc from '../services/communityService';
import { getBackendUrl, fixImageUrls } from '../../../shared/utils/fixImageUrls';
import RichTextEditor from '../../../shared/components/RichTextEditor';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',               label: 'All' },
  { key: 'physics',           label: 'Physics' },
  { key: 'chemistry',         label: 'Chemistry' },
  { key: 'biology',           label: 'Biology' },
  { key: 'english',           label: 'English' },
  { key: 'logical_reasoning', label: 'Logical Reasoning' },
  { key: 'general',           label: 'General' },
];

// Dark-mode aware semantic chips. Light values unchanged from before.
const TYPE_COLORS = {
  doubt:        'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  discussion:   'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  poll:         'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  announcement: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

const CAT_COLORS = {
  physics:           'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
  chemistry:         'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  biology:           'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
  english:           'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  logical_reasoning: 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300',
  general:           'bg-[var(--bg-muted)] text-[var(--text-muted)]',
};

const BADGE_STYLES = {
  Beginner: 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
  Scholar:  'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  Expert:   'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  Legend:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300',
  Pro:      'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};

const getBadge = (pts = 0) => {
  if (pts >= 4000) return 'Pro';
  if (pts >= 3000) return 'Legend';
  if (pts >= 2000) return 'Expert';
  if (pts >= 1000) return 'Scholar';
  return 'Beginner';
};

// Community-points badges (Beginner/Scholar/Expert/Legend/Pro) are a student
// progression tier — they don't apply to admins or teachers. Use this to decide
// whether to render BadgeChip alongside the author's name on posts and replies.
const isStaffRole = (role) => role === 'admin' || role === 'teacher';

const fmtTime = (date) => {
  const d    = new Date(date);
  const diff = Date.now() - d;
  if (diff < 60000)     return 'just now';
  if (diff < 3600000)   return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000)  return `${Math.floor(diff / 3600000)}h`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const fixImg = (url) => (url && url.startsWith('/') ? `${getBackendUrl()}${url}` : url);

// ── Avatar ────────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['bg-purple-500','bg-blue-500','bg-green-500','bg-orange-500','bg-rose-500','bg-teal-500'];
const avatarColor   = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const initials      = (name = '') => name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

const Avatar = ({ name = '', picture, size = 'md' }) => {
  const sz  = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  const src = fixImg(picture);
  if (src) return <img src={src} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
  return (
    <div className={`${sz} ${avatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials(name)}
    </div>
  );
};

const BadgeChip = ({ pts }) => {
  const label = getBadge(pts);
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE_STYLES[label]}`}>{label}</span>;
};

const RoleBadge = ({ role }) => (
  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${
    role === 'admin' ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' :
    role === 'teacher' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' :
    'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
  }`}>{role}</span>
);

// ── Poll Builder ──────────────────────────────────────────────────────────────
const PollBuilder = ({ poll, onChange }) => {
  const setOptions = (opts) => onChange({ ...poll, options: opts });
  const addOption  = () => { if (poll.options.length < 5) setOptions([...poll.options, { text: '' }]); };
  const removeOpt  = (i) => setOptions(poll.options.filter((_, idx) => idx !== i));
  const editOpt    = (i, text) => setOptions(poll.options.map((o, idx) => idx === i ? { ...o, text } : o));

  return (
    <div className="mt-3 p-4 bg-[var(--bg-muted)] rounded-xl border border-[var(--border)]">
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text)]">
          <FiBarChart2 className="w-4 h-4" /> Poll options
        </span>
        <label className="flex items-center gap-2 text-sm text-[var(--text-muted)] cursor-pointer select-none">
          <input
            type="checkbox" checked={poll.isQuizMode}
            onChange={(e) => onChange({ ...poll, isQuizMode: e.target.checked, correctOption: null })}
            className="accent-primary-500"
          />
          Quiz mode
          <span className="text-xs text-[var(--text-faint)] cursor-help" title="Mark the correct answer; voters get instant feedback after voting">ⓘ</span>
        </label>
      </div>

      {poll.options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2 mb-2">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] text-xs flex items-center justify-center font-semibold">
            {String.fromCharCode(65 + i)}
          </span>
          <input
            value={opt.text}
            onChange={(e) => editOpt(i, e.target.value)}
            placeholder={`Option ${String.fromCharCode(65 + i)}`}
            className="flex-1 px-3 py-1.5 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          {poll.isQuizMode && (
            <button
              type="button"
              onClick={() => onChange({ ...poll, correctOption: poll.correctOption === i ? null : i })}
              title="Mark as correct answer"
              className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                poll.correctOption === i ? 'border-green-500 bg-green-500 text-white' : 'border-[var(--border)] hover:border-green-400'
              }`}
            >
              {poll.correctOption === i && <FiCheck className="w-3 h-3" />}
            </button>
          )}
          {poll.options.length > 2 && (
            <button onClick={() => removeOpt(i)} className="text-[var(--text-faint)] hover:text-red-500 flex-shrink-0"><FiX className="w-4 h-4" /></button>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        {poll.options.length < 5 && (
          <button type="button" onClick={addOption} className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-300">
            + Add option
          </button>
        )}
        <span className="text-xs text-[var(--text-faint)]">
          {poll.isQuizMode ? '2-5 options · click the green circle next to the correct answer' : '2-5 options · pick the answer to enable quiz mode'}
        </span>
      </div>

      {poll.isQuizMode && (
        <textarea
          value={poll.explanation || ''}
          onChange={(e) => onChange({ ...poll, explanation: e.target.value })}
          rows={2}
          placeholder="(Optional) Explanation shown to voters after they answer — only used in Quiz mode"
          className="w-full mt-3 px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none italic placeholder:text-[var(--text-faint)]"
        />
      )}
    </div>
  );
};

// ── Post Composer (modal) ─────────────────────────────────────────────────────
const EMPTY_POLL = { options: [{ text: '' }, { text: '' }], isQuizMode: false, correctOption: null, explanation: '' };

const PostComposer = ({ user, isStaff, onPost }) => {
  const [open,     setOpen]    = useState(false);
  const [content,  setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [type,     setType]    = useState('discussion');
  const [poll,     setPoll]    = useState(EMPTY_POLL);
  const [posting,  setPosting] = useState(false);
  const [editorKey, setEditorKey] = useState(0); // remounts RTE on reset

  const reset = () => {
    setContent(''); setCategory('general'); setType('discussion');
    setPoll(EMPTY_POLL); setOpen(false);
    setEditorKey(k => k + 1); // force RTE remount so editor clears
  };

  const handleSubmit = async () => {
    if (type === 'poll') {
      const validOpts = poll.options.filter(o => o.text.trim());
      if (validOpts.length < 2) return toast.warn('Poll needs at least 2 options');
      if (poll.isQuizMode && poll.correctOption == null) return toast.warn('Select the correct answer for quiz mode');
    } else {
      const textOnly = content.replace(/<[^>]*>/g, '').trim();
      if (!textOnly) return toast.warn('Write something before posting');
    }

    setPosting(true);
    try {
      const body = { category, type, content };
      if (type === 'poll') {
        body.poll = { ...poll, options: poll.options.filter(o => o.text.trim()) };
      }
      const res = await svc.createPost(body);
      onPost(res.data);
      reset();
      toast.success(res.pointsEarned ? `Posted! +${res.pointsEarned} points` : 'Posted!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to post');
    } finally { setPosting(false); }
  };

  const TYPES = ['doubt', 'discussion', 'poll', ...(isStaff ? ['announcement'] : [])];

  return (
    <>
      {/* ── Trigger card ── */}
      <div
        onClick={() => setOpen(true)}
        className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4 mb-4 flex items-center gap-3 cursor-pointer hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all group"
      >
        <Avatar name={user?.fullName} picture={user?.profilePicture} />
        <div className="flex-1 px-4 py-2.5 bg-[var(--bg-muted)] group-hover:bg-primary-50 dark:group-hover:bg-primary-950/30 rounded-full text-sm text-[var(--text-faint)] group-hover:text-primary-600 dark:group-hover:text-primary-300 transition-colors select-none truncate">
          What's on your mind? Click to write a post…
        </div>
        <button className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 dark:hover:bg-primary-950/60 px-4 py-2 rounded-full transition-colors flex-shrink-0">
          <FiPlusSquare className="w-4 h-4" /> <span className="hidden sm:inline">New Post</span>
        </button>
      </div>

      {/* ── Modal ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-6 sm:pt-10 px-4" onClick={(e) => { if (e.target === e.currentTarget) reset(); }}>
          <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] flex-shrink-0">
              <h2 className="text-lg font-bold text-[var(--text-strong)]">Create Post</h2>
              <button onClick={reset} className="text-[var(--text-faint)] hover:text-[var(--text)] p-1 rounded-lg hover:bg-[var(--bg-muted)]">
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Author row + selectors */}
            <div className="px-5 pt-4 flex-shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <Avatar name={user?.fullName} picture={user?.profilePicture} />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-strong)]">{user?.fullName}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="text-xs border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                      {CATEGORIES.filter(c => c.key !== 'all').map(c => (
                        <option key={c.key} value={c.key}>{c.label}</option>
                      ))}
                    </select>
                    {TYPES.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`capitalize text-xs px-3 py-1 rounded-full font-semibold transition-colors ${
                          type === t
                            ? 'bg-primary-500 text-white'
                            : 'border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 pb-2">
              {type === 'poll' ? (
                <div>
                  <p className="text-sm text-[var(--text-muted)] mb-2">Add a question or context for your poll:</p>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={2}
                    placeholder="Poll question (optional)…"
                    className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none mb-1 placeholder:text-[var(--text-faint)]"
                  />
                  <PollBuilder poll={poll} onChange={setPoll} />
                </div>
              ) : (
                <RichTextEditor
                  key={editorKey}
                  value={content}
                  onChange={setContent}
                  placeholder="Share your doubt, idea or question… (paste images with Ctrl+V, use toolbar for formatting)"
                  minimal={false}
                  showTips={false}
                />
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[var(--border)] flex-shrink-0">
              <button onClick={reset} className="text-sm text-[var(--text-muted)] hover:text-[var(--text)] px-4 py-2 rounded-xl hover:bg-[var(--bg-muted)] transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={posting}
                className="btn-brand text-sm px-6 py-2 disabled:opacity-50"
              >
                {posting ? <FiLoader className="animate-spin w-4 h-4" /> : <FiSend className="w-4 h-4" />}
                {posting ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ── Poll Widget ───────────────────────────────────────────────────────────────
const PollWidget = ({ poll, postId, onVote }) => {
  const [localPoll, setLocalPoll] = useState(poll);
  const [voting, setVoting] = useState(false);

  useEffect(() => { setLocalPoll(poll); }, [poll]);

  const handleVote = async (i) => {
    if (voting) return;
    if (localPoll.isQuizMode && localPoll.myVoteIndex !== -1) return;
    setVoting(true);
    try {
      const res = await svc.votePoll(postId, i);
      setLocalPoll(res.data);
      if (onVote) onVote(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Vote failed');
    } finally { setVoting(false); }
  };

  const total = localPoll.totalVotes || 0;
  const voted = localPoll.myVoteIndex !== -1;

  return (
    <div className="mt-3 space-y-2">
      {localPoll.options.map((opt, i) => {
        const pct       = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
        const isVoted   = localPoll.myVoteIndex === i;
        const isCorrect = localPoll.isQuizMode && voted && localPoll.correctOption === i;
        const isWrong   = localPoll.isQuizMode && voted && isVoted && localPoll.correctOption !== i;

        return (
          <button
            key={opt._id || i}
            onClick={() => handleVote(i)}
            disabled={voting || (localPoll.isQuizMode && voted)}
            className={`w-full text-left px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all relative overflow-hidden ${
              isCorrect ? 'border-green-500 text-green-700 dark:text-green-300' :
              isWrong   ? 'border-red-400 text-red-700 dark:text-red-300' :
              isVoted   ? 'border-primary-500 text-primary-700 dark:text-primary-300' :
              'border-[var(--border)] text-[var(--text)] hover:border-primary-300 dark:hover:border-primary-700 disabled:hover:border-[var(--border)]'
            }`}
          >
            {voted && (
              <div
                className={`absolute inset-0 opacity-15 ${isCorrect ? 'bg-green-400' : isWrong ? 'bg-red-400' : isVoted ? 'bg-primary-400' : 'bg-[var(--bg-muted)]'}`}
                style={{ width: `${pct}%` }}
              />
            )}
            <span className="relative z-10 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center flex-shrink-0">
                  {isVoted && <span className="w-2.5 h-2.5 rounded-full bg-current" />}
                </span>
                {opt.text}
              </span>
              {voted && <span className="text-xs text-[var(--text-muted)] ml-2">{pct}%</span>}
            </span>
          </button>
        );
      })}

      <p className="text-xs text-[var(--text-faint)]">{total} vote{total !== 1 ? 's' : ''}</p>

      {localPoll.isQuizMode && voted && (
        <div className={`text-sm px-3 py-2 rounded-lg border ${
          localPoll.myVoteIndex === localPoll.correctOption
            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900/60'
            : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/60'
        }`}>
          {localPoll.myVoteIndex === localPoll.correctOption
            ? '✓ Correct!'
            : `✗ Incorrect. Correct answer: ${String.fromCharCode(65 + localPoll.correctOption)}`}
          {localPoll.explanation && <p className="mt-1 text-[var(--text-muted)] italic">{localPoll.explanation}</p>}
        </div>
      )}
    </div>
  );
};

// ── Three-dot Menu ────────────────────────────────────────────────────────────
const PostMenu = ({ post, userId, isStaff, onEdit, onDelete, onPin }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isOwner = post.author?._id?.toString() === userId || post.author?.toString() === userId;
  if (!isOwner && !isStaff) return null;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(v => !v)} className="p-1 text-[var(--text-faint)] hover:text-[var(--text)] rounded-lg hover:bg-[var(--bg-muted)]">
        <FiMoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-40 bg-[var(--bg-surface)] rounded-xl shadow-lg border border-[var(--border)] z-20 py-1">
          {isOwner && (
            <button onClick={() => { setOpen(false); onEdit(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-muted)]">
              <FiEdit2 className="w-4 h-4" /> Edit
            </button>
          )}
          {isStaff && (
            <button onClick={() => { setOpen(false); onPin(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--bg-muted)]">
              <FiMapPin className="w-4 h-4" /> {post.isPinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          <button onClick={() => { setOpen(false); onDelete(); }} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40">
            <FiTrash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      )}
    </div>
  );
};

// ── Reply Item ────────────────────────────────────────────────────────────────
const ReplyItem = ({ reply, userId, isStaff, onDelete, onMarkAnswer, onHelpful, onEdit }) => {
  const [editing,  setEditing]  = useState(false);
  const [editText, setEditText] = useState(reply.content);
  const [saving,   setSaving]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const isOwner = reply.author?._id?.toString() === userId;

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      const res = await svc.updateReply(reply._id, { content: editText.trim() });
      onEdit(reply._id, res.data);
      setEditing(false);
    } catch { toast.error('Failed to update reply'); }
    finally { setSaving(false); }
  };

  return (
    <div className={`flex gap-3 py-3 border-b border-[var(--border-faint)] last:border-0 ${
      reply.isAnswer
        ? 'bg-green-50 dark:bg-green-950/30 -mx-3 px-3 rounded-lg'
        : ''
    }`}>
      <Avatar name={reply.author?.fullName} picture={reply.author?.profilePicture} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-[var(--text-strong)]">{reply.author?.fullName}</span>

          {/* Mobile: one identity badge only (Beginner for student, Admin/Teacher for staff).
              Desktop sm+: both badges for students, role only for staff. */}
          {isStaffRole(reply.author?.role) ? (
            <RoleBadge role={reply.author?.role} />
          ) : (
            <>
              {reply.author?.communityPoints !== undefined && (
                <BadgeChip pts={reply.author.communityPoints} />
              )}
              <span className="hidden sm:inline-flex">
                <RoleBadge role={reply.author?.role} />
              </span>
            </>
          )}

          {/* Best-answer chip is shown on every breakpoint — it's the most
              important signal on a reply, so we keep the explicit badge even
              on mobile (the green background reinforces it). */}
          {reply.isAnswer && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950/50 px-2 py-0.5 rounded-full">
              <FiAward className="w-3 h-3" /> Best Answer
            </span>
          )}
          <span className="text-xs text-[var(--text-faint)] ml-auto whitespace-nowrap">{fmtTime(reply.createdAt)}{reply.isEdited && ' (edited)'}</span>
        </div>

        {editing ? (
          <div className="mt-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
            <div className="flex gap-2 mt-1">
              <button onClick={handleSaveEdit} disabled={saving} className="text-sm text-white bg-primary-500 hover:bg-primary-600 px-3 py-1 rounded-lg disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditing(false); setEditText(reply.content); }} className="text-sm text-[var(--text-muted)] px-3 py-1 rounded-lg hover:bg-[var(--bg-muted)]">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-[var(--text)] mt-1 whitespace-pre-wrap break-words">{reply.content}</p>
            {reply.images?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {reply.images.map((url, i) => (
                  <img key={i} src={fixImg(url)} alt="" className="max-h-40 rounded-lg object-cover border border-[var(--border)]" />
                ))}
              </div>
            )}
          </>
        )}

        {/* Reply footer: helpful + answer + menu */}
        <div className="flex items-center gap-2 mt-2">
          {/* Helpful — interactive for everyone except the reply's own author.
              Backend rejects self-helpful with a 400, so we hide the button
              client-side too (zero API cost — purely a JSX gate). Owners still
              see the count as a static badge when at least one person voted,
              so they can track how their reply is landing. */}
          {isOwner ? (
            (reply.helpfulCount || 0) > 0 && (
              <span
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-[var(--border)] text-[var(--text-muted)]"
                title="You can't mark your own reply as helpful"
              >
                <FiThumbsUp className="w-3 h-3" /> {reply.helpfulCount} Helpful
              </span>
            )
          ) : (
            <button
              onClick={() => onHelpful(reply._id)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
                reply.isHelpful
                  ? 'border-primary-400 text-primary-600 bg-primary-50 dark:bg-primary-950/30 dark:text-primary-300 dark:border-primary-700'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-primary-300 dark:hover:border-primary-700'
              }`}
            >
              <FiThumbsUp className="w-3 h-3" /> {reply.helpfulCount || 0} Helpful
            </button>
          )}
          {isStaff && (
            <button
              onClick={() => onMarkAnswer(reply._id)}
              className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
                reply.isAnswer
                  ? 'border-green-500 text-green-700 bg-green-50 dark:bg-green-950/30 dark:text-green-300 dark:border-green-700'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-green-400'
              }`}
            >
              <FiAward className="w-3 h-3" /> {reply.isAnswer ? 'Unmark Answer' : 'Mark Answer'}
            </button>
          )}
          {(isOwner || isStaff) && (
            <div className="relative ml-auto" ref={menuRef}>
              <button onClick={() => setMenuOpen(v => !v)} className="text-[var(--text-faint)] hover:text-[var(--text)] p-1">
                <FiMoreVertical className="w-3.5 h-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-7 w-32 bg-[var(--bg-surface)] rounded-xl shadow-lg border border-[var(--border)] z-20 py-1">
                  {isOwner && (
                    <button onClick={() => { setMenuOpen(false); setEditing(true); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-[var(--text)] hover:bg-[var(--bg-muted)]">
                      <FiEdit2 className="w-3 h-3" /> Edit
                    </button>
                  )}
                  <button onClick={() => { setMenuOpen(false); onDelete(reply._id); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40">
                    <FiTrash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Reply Section (expandable) ────────────────────────────────────────────────
// When opened, the reply panel sits in an inset card with a left "thread"
// accent and a small header so it's visually clear the replies belong to the
// post above. The footer (toggle + Save) stays at the bottom of the post card.
const ReplySection = ({ postId, replyCount, userId, isStaff, onReplyCountChange, renderFooterExtras }) => {
  const [open,        setOpen]       = useState(false);
  const [replies,     setReplies]    = useState([]);
  const [loaded,      setLoaded]     = useState(false);
  const [loading,     setLoading]    = useState(false);
  const [page,        setPage]       = useState(1);
  const [hasMore,     setHasMore]    = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [content,     setContent]    = useState('');
  const [uploading,   setUploading]  = useState(false);
  const [sending,     setSending]    = useState(false);
  const fileRef = useRef(null);

  const loadReplies = async (pg = 1, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await svc.getReplies(postId, pg);
      setReplies(prev => append ? [...prev, ...res.data] : res.data);
      setHasMore(res.hasMore);
      setPage(pg);
      setLoaded(true);
    } catch { toast.error('Failed to load replies'); }
    finally { setLoading(false); setLoadingMore(false); }
  };

  // Skip the API call when there are no replies — but still expand the section so
  // the user can write the first reply.
  const toggle = () => {
    setOpen(v => !v);
    if (!open && !loaded && replyCount > 0) loadReplies(1, false);
    else if (!open && replyCount === 0) setLoaded(true);
  };

  const handleImageAttach = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await svc.uploadImage(file);
      // Insert image URL into reply content as a markdown-style indicator
      setContent(prev => prev + (prev ? '\n' : '') + `[image: ${res.url}]`);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleSend = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await svc.createReply(postId, { content: content.trim() });
      setReplies(prev => [...prev, res.data]);
      setContent('');
      onReplyCountChange(1);
      if (res.pointsEarned) toast.success(`Reply posted! +${res.pointsEarned} points`);
    } catch { toast.error('Failed to send reply'); }
    finally { setSending(false); }
  };

  const handleDelete = async (replyId) => {
    if (!window.confirm('Delete this reply?')) return;
    try {
      await svc.deleteReply(replyId);
      setReplies(prev => prev.filter(r => r._id !== replyId));
      onReplyCountChange(-1);
    } catch { toast.error('Failed to delete reply'); }
  };

  const handleMarkAnswer = async (replyId) => {
    try {
      const res = await svc.markAnswer(replyId);
      setReplies(prev => prev.map(r => r._id === replyId ? { ...r, isAnswer: res.data.isAnswer } : r));
      if (res.pointsEarned > 0)      toast.success(`Marked as best answer · +${res.pointsEarned} points to author`);
      else if (res.pointsEarned < 0) toast.info(`Unmarked · ${res.pointsEarned} points from author`);
    } catch { toast.error('Failed'); }
  };

  const handleHelpful = async (replyId) => {
    try {
      const res = await svc.toggleHelpful(replyId);
      setReplies(prev => prev.map(r => r._id === replyId ? { ...r, helpfulCount: res.data.helpfulCount, isHelpful: res.data.isHelpful } : r));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleEdit = (replyId, updated) => {
    setReplies(prev => prev.map(r => r._id === replyId ? { ...r, ...updated } : r));
  };

  return (
    <div className="mt-3 pt-3 border-t border-[var(--border-faint)]">
      {open && (
        <div className="mb-3 relative pl-2 sm:pl-4">
          {/* Left thread connector — anchors the panel to the post above */}
          <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-primary-400 via-primary-300/60 to-transparent dark:from-primary-500 dark:via-primary-700/60" />

          <div className="bg-[var(--bg-muted)] rounded-xl border border-[var(--border)] p-2.5 sm:p-4">
            {/* Panel header — makes the "↳ Replies to this post" relationship obvious.
                Label shortens to just "Replies" on small screens to save horizontal space. */}
            <div className="flex items-center gap-1.5 mb-3 text-[11px] sm:text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              <FiCornerDownRight className="w-3.5 h-3.5 text-primary-500 flex-shrink-0" />
              <span className="sm:hidden">Replies</span>
              <span className="hidden sm:inline">Replies on this post</span>
              <span className="ml-auto text-[var(--text-faint)] normal-case tracking-normal font-medium">
                {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
              </span>
            </div>

            {loading ? (
              <div className="flex justify-center py-4"><FiLoader className="animate-spin w-5 h-5 text-[var(--text-faint)]" /></div>
            ) : (
              <>
                {replies.length === 0 ? (
                  <p className="text-xs text-[var(--text-faint)] italic py-2">
                    No replies yet — be the first to respond.
                  </p>
                ) : (
                  replies.map(r => (
                    <ReplyItem
                      key={r._id} reply={r} userId={userId} isStaff={isStaff} postId={postId}
                      onDelete={handleDelete} onMarkAnswer={handleMarkAnswer}
                      onHelpful={handleHelpful} onEdit={handleEdit}
                    />
                  ))
                )}
                {hasMore && (
                  <div className="flex justify-center mt-2">
                    <button
                      onClick={() => loadReplies(page + 1, true)}
                      disabled={loadingMore}
                      className="flex items-center gap-1.5 text-xs px-4 py-1.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:border-primary-300 dark:hover:border-primary-700 disabled:opacity-50 transition-colors"
                    >
                      {loadingMore && <FiLoader className="animate-spin w-3 h-3" />}
                      {loadingMore ? 'Loading…' : 'Load more replies'}
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Reply input — sits inside the same inset card so it's clearly part of this thread.
                Mobile uses a shorter placeholder + compact icon buttons so the row fits. */}
            <div className="mt-3 pt-3 border-t border-[var(--border-faint)] flex gap-1.5 sm:gap-2 items-end">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                rows={1}
                placeholder="Write a reply…"
                className="flex-1 min-w-0 resize-none border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
                style={{ minHeight: '38px', maxHeight: '120px' }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-shrink-0 w-9 h-9 inline-flex items-center justify-center text-[var(--text-muted)] hover:text-primary-600 dark:hover:text-primary-300 border border-[var(--border)] rounded-xl hover:border-primary-300 dark:hover:border-primary-700"
                title="Attach image"
              >
                {uploading ? <FiLoader className="animate-spin w-4 h-4" /> : <FiImage className="w-4 h-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { handleImageAttach(e.target.files[0]); e.target.value = ''; }} />
              <button
                onClick={handleSend}
                disabled={!content.trim() || sending}
                className="flex-shrink-0 w-9 h-9 inline-flex items-center justify-center bg-primary-500 hover:bg-primary-600 text-white rounded-xl disabled:opacity-50 transition-colors"
                title="Send reply (Enter)"
              >
                {sending ? <FiLoader className="animate-spin w-4 h-4" /> : <FiSend className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer: reply toggle + extras (save button) — same line */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            open
              ? 'text-primary-600 dark:text-primary-300 font-semibold'
              : 'text-[var(--text-muted)] hover:text-primary-600 dark:hover:text-primary-300'
          }`}
        >
          <FiMessageCircle className="w-4 h-4" />
          {replyCount} {replyCount === 1 ? 'Reply' : 'Replies'}
          {open ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </button>
        {renderFooterExtras}
      </div>
    </div>
  );
};

// ── Post Card ─────────────────────────────────────────────────────────────────
const PostCard = ({ post: initialPost, userId, isStaff, onDelete }) => {
  const [post,        setPost]        = useState(initialPost);
  const [editing,     setEditing]     = useState(false);
  const [editContent, setEditContent] = useState(initialPost.content);
  const [saving,      setSaving]      = useState(false);
  const [editorKey,   setEditorKey]   = useState(0);

  useEffect(() => { setPost(initialPost); }, [initialPost]);

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const res = await svc.updatePost(post._id, { content: editContent });
      setPost(res.data); setEditing(false);
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setEditContent(post.content);
    setEditorKey(k => k + 1);
  };

  const handlePin  = async () => {
    try { const res = await svc.pinPost(post._id); setPost(p => ({ ...p, isPinned: res.data.isPinned })); }
    catch { toast.error('Failed to pin'); }
  };

  const handleSave = async () => {
    try { const res = await svc.savePost(post._id); setPost(p => ({ ...p, isSaved: res.data.isSaved })); }
    catch { toast.error('Failed to save'); }
  };

  const handleReplyCountChange = (delta) => {
    setPost(p => ({ ...p, replyCount: Math.max(0, (p.replyCount || 0) + delta) }));
  };

  return (
    <div className={`bg-[var(--bg-surface)] rounded-xl border p-3 sm:p-5 mb-3 ${
      post.isPinned
        ? 'border-yellow-300 dark:border-yellow-700'
        : 'border-[var(--border)]'
    }`}>
      {post.isPinned && (
        <div className="flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-300 font-semibold mb-2">
          <FiMapPin className="w-3 h-3" /> PINNED
        </div>
      )}

      {/* Author row — one consolidated row.
          Mobile: name + a SINGLE identity badge (Beginner for students,
            Admin/Teacher for staff). Topic chips (type/category/answered) are
            hidden — the filter bar at the top of the feed surfaces those.
          sm+:   name + role + (points for students) + type + category + answered
            all inline. flex-wrap is a safety net for narrow laptops. */}
      <div className="flex items-start gap-3">
        <Avatar name={post.author?.fullName} picture={post.author?.profilePicture} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-[var(--text-strong)] text-sm leading-tight">
                {post.author?.fullName}
              </span>

              {/* Identity badge(s) — mobile shows just one; desktop shows both for students. */}
              {isStaffRole(post.author?.role) ? (
                <RoleBadge role={post.author?.role} />
              ) : (
                <>
                  <BadgeChip pts={post.author?.communityPoints || 0} />
                  <span className="hidden sm:inline-flex">
                    <RoleBadge role={post.author?.role} />
                  </span>
                </>
              )}

              {/* Topic chips — desktop only. The classification data still drives
                  the category/filter buttons at the top of the feed, so no
                  filter logic depends on these chips being rendered. */}
              <span className={`hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${TYPE_COLORS[post.type]}`}>
                {post.type}
              </span>
              <span className={`hidden sm:inline-flex text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${CAT_COLORS[post.category]}`}>
                {post.category.replace('_', ' ')}
              </span>
              {post.isAnswered && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300">
                  <FiCheck className="w-3 h-3" /> Answered
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-xs text-[var(--text-faint)] whitespace-nowrap">
                {fmtTime(post.createdAt)}{post.isEdited && ' (edited)'}
              </span>
              <PostMenu
                post={post} userId={userId} isStaff={isStaff}
                onEdit={() => { setEditing(true); setEditorKey(k => k + 1); }}
                onDelete={() => { if (window.confirm('Delete this post?')) onDelete(post._id); }}
                onPin={handlePin}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-3">
        {editing ? (
          post.type === 'poll' ? (
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="w-full text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
            />
          ) : (
            <RichTextEditor
              key={editorKey}
              value={editContent}
              onChange={setEditContent}
              minimal={false}
              showTips={false}
            />
          )
        ) : (
          <>
            {post.content && (
              post.type === 'poll' ? (
                <p className="text-sm text-[var(--text)] whitespace-pre-wrap break-words">{post.content}</p>
              ) : (
                <div
                  className="prose prose-sm max-w-none text-[var(--text)] dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: fixImageUrls(post.content) }}
                />
              )
            )}
            {post.images?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {post.images.map((url, i) => (
                  <img key={i} src={fixImg(url)} alt="" className="max-h-60 rounded-xl object-cover border border-[var(--border)]" />
                ))}
              </div>
            )}
            {post.type === 'poll' && post.poll && (
              <PollWidget poll={post.poll} postId={post._id} onVote={(updated) => setPost(p => ({ ...p, poll: updated }))} />
            )}
          </>
        )}

        {editing && (
          <div className="flex gap-2 mt-2">
            <button onClick={handleSaveEdit} disabled={saving} className="text-sm text-white bg-primary-500 hover:bg-primary-600 px-4 py-1.5 rounded-lg disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button onClick={handleCancelEdit} className="text-sm text-[var(--text-muted)] px-4 py-1.5 rounded-lg hover:bg-[var(--bg-muted)]">
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Reply section — save button lives here on same row */}
      <ReplySection
        postId={post._id}
        replyCount={post.replyCount || 0}
        userId={userId}
        isStaff={isStaff}
        onReplyCountChange={handleReplyCountChange}
        renderFooterExtras={
          <button
            onClick={handleSave}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-colors ${
              post.isSaved
                ? 'border-primary-400 text-primary-600 bg-primary-50 dark:bg-primary-950/30 dark:text-primary-300 dark:border-primary-700'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:border-primary-300 dark:hover:border-primary-700'
            }`}
          >
            <FiBookmark className="w-3.5 h-3.5" /> {post.isSaved ? 'Saved' : 'Save'}
          </button>
        }
      />
    </div>
  );
};

// ── Leaderboard hooks ─────────────────────────────────────────────────────────
// Data fetching is lifted up so the page can render leaderboard pieces in
// multiple spots (mobile: personal rank at top + leaderboard at bottom;
// desktop: full sidebar) without firing the API or SSE subscription twice.
const useCommunityLeaderboard = () => {
  const [data,       setData]       = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    svc.getLeaderboard().then(r => setData(r.data)).catch(() => {});
  }, []);

  // SSE subscriptions:
  //   leaderboard_update → broadcast on manual refresh; updates the top-10 list
  //   points_update      → personal points change; instant feedback for the user
  useEffect(() => {
    const handler = (e) => {
      if (e.detail.type === 'leaderboard_update') {
        setData(prev => prev ? {
          ...prev,
          leaderboard:  e.detail.leaderboard,
          cacheExpires: e.detail.cacheExpires ?? prev.cacheExpires,
        } : prev);
      } else if (e.detail.type === 'points_update') {
        // Personal points change instantly. Personal rank is NOT updated here —
        // it follows the slower 5-min cache model to avoid a countDocuments
        // hit on every action.
        setData(prev => prev ? {
          ...prev,
          myPoints: e.detail.points,
          myBadge:  e.detail.badge,
        } : prev);
      }
    };
    window.addEventListener('sse:event', handler);
    return () => window.removeEventListener('sse:event', handler);
  }, []);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await svc.refreshLeaderboard();
      setData(prev => prev ? {
        ...prev,
        leaderboard:  res.data.leaderboard,
        cacheExpires: res.data.cacheExpires,
      } : prev);
      toast.success(res.data.refreshed ? 'Leaderboard refreshed' : 'Already up to date');
    } catch {
      toast.error('Failed to refresh');
    } finally {
      setRefreshing(false);
    }
  };

  return { data, refreshing, handleRefresh };
};

// Staff performance — separate endpoint, admin only. Lifted to a hook so it
// only fetches once even if rendered in both the mobile bottom and the
// desktop sidebar slots.
const useStaffPerformance = (enabled) => {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    svc.getStaffPerformance()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);

  return { data, loading };
};

// ── Leaderboard cards ─────────────────────────────────────────────────────────
// Each card is purely presentational — receives data via props, renders
// nothing if there's nothing to show. Cards are composed in the page itself
// so we can lay them out differently on mobile (top + bottom) vs desktop
// (single sidebar column).

// User's own rank (students) OR their points (staff). On mobile this sits
// above the category tabs so the student sees their progression first.
const PersonalRankCard = ({ data }) => {
  if (!data) return null;
  if (data.isStaff) {
    return (
      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4">
        <p className="text-xs text-[var(--text-muted)] font-medium">Community Points</p>
        <p className="text-2xl font-bold text-primary-500">{data.myPoints}</p>
      </div>
    );
  }
  return (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--text-muted)] font-medium">Your Rank</p>
          <p className="text-2xl font-bold text-primary-500">#{data.myRank}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[var(--text-muted)] font-medium">Points</p>
          <p className="text-2xl font-bold text-primary-500">{data.myPoints}</p>
        </div>
      </div>
      <div className="mt-2"><BadgeChip pts={data.myPoints} /></div>
    </div>
  );
};

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

const TopLeaderboardCard = ({ data, userId, refreshing, onRefresh }) => (
  <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4">
    <div className="flex items-start justify-between mb-1">
      <h3 className="font-bold text-[var(--text-strong)]">🏆 Leaderboard</h3>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        title="Refresh leaderboard"
        className="p-1.5 text-[var(--text-faint)] hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/30 rounded-lg disabled:opacity-50 transition-colors"
      >
        <FiRefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
      </button>
    </div>
    <p className="text-xs text-[var(--text-faint)] mb-3">
      Top student contributors · updates every 5 minutes
    </p>
    {!data ? (
      <div className="flex justify-center py-4"><FiLoader className="animate-spin w-5 h-5 text-[var(--text-faint)]" /></div>
    ) : (
      <div className="space-y-2.5">
        {data.leaderboard.map((u, i) => (
          <div key={u._id} className={`flex items-center gap-2 ${
            u._id.toString() === userId
              ? 'bg-primary-50 dark:bg-primary-950/30 -mx-2 px-2 rounded-lg py-0.5'
              : ''
          }`}>
            <span className="text-base w-6 text-center flex-shrink-0">
              {i < 3 ? RANK_MEDALS[i] : <span className="text-xs font-bold text-[var(--text-muted)]">#{i + 1}</span>}
            </span>
            <Avatar name={u.fullName} picture={u.profilePicture} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-strong)] truncate">{u.fullName}</p>
              <BadgeChip pts={u.communityPoints} />
            </div>
            <span className="text-sm font-bold text-primary-500 flex-shrink-0">{u.communityPoints}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const HowToEarnPointsCard = () => (
  <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4">
    <h3 className="font-semibold text-[var(--text-strong)] mb-2 text-sm">How to earn points</h3>
    <div className="space-y-1.5 text-xs text-[var(--text-muted)]">
      <div className="flex justify-between"><span>Create a post</span><span className="font-bold text-green-600 dark:text-green-300">+2</span></div>
      <div className="flex justify-between"><span>Write a reply</span><span className="font-bold text-green-600 dark:text-green-300">+1</span></div>
      <div className="flex justify-between"><span>Reply marked helpful</span><span className="font-bold text-green-600 dark:text-green-300">+1 (max 10)</span></div>
      <div className="flex justify-between"><span>Reply marked as answer</span><span className="font-bold text-green-600 dark:text-green-300">+15</span></div>
    </div>
    <div className="mt-3 border-t border-[var(--border)] pt-3 space-y-1.5 text-xs">
      <p className="font-semibold text-[var(--text)] mb-1">Badge tiers</p>
      {[['Beginner','0–999'],['Scholar','1k–1.9k'],['Expert','2k–2.9k'],['Legend','3k–3.9k'],['Pro','4k+']].map(([b, r]) => (
        <div key={b} className="flex items-center gap-2">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE_STYLES[b]}`}>{b}</span>
          <span className="text-[var(--text-faint)]">{r} pts</span>
        </div>
      ))}
    </div>
  </div>
);

const StaffPerformanceCard = ({ data, loading }) => (
  <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-4">
    <h3 className="font-bold text-[var(--text-strong)] mb-3 text-sm">Staff Activity</h3>
    {loading ? (
      <div className="flex justify-center py-4"><FiLoader className="animate-spin w-5 h-5 text-[var(--text-faint)]" /></div>
    ) : data.length === 0 ? (
      <p className="text-xs text-[var(--text-faint)] text-center py-3">No staff activity yet</p>
    ) : (
      <div className="space-y-3">
        {data.map(s => (
          <div key={s._id} className="flex items-start gap-2">
            <Avatar name={s.fullName} picture={s.profilePicture} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-[var(--text-strong)] truncate">{s.fullName}</p>
                <RoleBadge role={s.role} />
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                <span className="text-xs text-[var(--text-muted)]"><span className="font-semibold text-[var(--text)]">{s.postCount}</span> posts</span>
                <span className="text-xs text-[var(--text-muted)]"><span className="font-semibold text-[var(--text)]">{s.replyCount}</span> replies</span>
                <span className="text-xs text-[var(--text-muted)]"><span className="font-semibold text-green-600 dark:text-green-300">{s.answersGiven}</span> answered</span>
                <span className="text-xs text-[var(--text-muted)]"><span className="font-semibold text-primary-600 dark:text-primary-300">{s.helpfulReceived}</span> helpful</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Filter Tabs ───────────────────────────────────────────────────────────────
// `staffOnly` filters are hidden from students. The "Unanswered" tab is staff-only:
// it surfaces doubts that need a teacher's attention, which is irrelevant to students.
// `primary: true` = always visible inline on mobile (the rest hide behind "More").
const ALL_FILTER_TABS = [
  { key: 'all',           label: 'All',           primary: true },
  { key: 'mine',          label: 'My Posts',      primary: true },
  { key: 'doubts',        label: 'Doubts',        primary: true },
  { key: 'unanswered',    label: 'Unanswered',    staffOnly: true },
  { key: 'answered',      label: 'Answered' },
  { key: 'discussions',   label: 'Discussions' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'pinned',        label: 'Pinned' },
  { key: 'saved',         label: 'Saved' },
  { key: 'noreplies',     label: 'No Replies' },
  { key: 'digest',        label: 'This Week' },
];

// ── CommunityPage ─────────────────────────────────────────────────────────────
const CommunityPage = () => {
  const { user, isAdmin, isTeacher } = useAuth();
  const isStaff = isAdmin || isTeacher;

  // Push the page title + tagline up to the top navbar (DashboardLayout
  // renders it via usePageHeaderState). Subtitle hides below sm in the
  // top bar — that's intentional, the mobile bar is space-constrained.
  usePageHeader({
    title:    'Community',
    subtitle: 'Ask doubts, share insights, and learn together with the SKN community.',
  });

  // Lifted leaderboard + staff-perf data — single fetch + SSE subscription,
  // re-used by the cards in the mobile-top / mobile-bottom / desktop-sidebar
  // slots below.
  const { data: lbData, refreshing, handleRefresh } = useCommunityLeaderboard();
  const { data: staffData, loading: staffLoading }  = useStaffPerformance(isAdmin);
  const myUserId = user?.id || user?._id;

  const [category,     setCategory]     = useState('all');
  const [filter,       setFilter]       = useState('all');
  // `searchDraft` = what the user is typing. `search` = what we've actually
  // committed to the API (only updated when user clicks Search or presses Enter).
  // No live querying — saves dozens of API calls per typed query.
  const [searchDraft,  setSearchDraft]  = useState('');
  const [search,       setSearch]       = useState('');
  const [posts,        setPosts]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [hasMore,      setHasMore]      = useState(false);
  const [page,         setPage]         = useState(1);
  const [loadingMore,  setLoadingMore]  = useState(false);

  // Mobile "More filters" panels. On desktop these panels are always open inline.
  const [moreOpen,    setMoreOpen]    = useState(false); // filter tabs
  const [catMoreOpen, setCatMoreOpen] = useState(false); // category tabs

  // Filter tabs: students don't see staff-only filters (e.g., "Unanswered").
  const visibleFilterTabs = ALL_FILTER_TABS.filter(t => isStaff || !t.staffOnly);
  const primaryTabs       = visibleFilterTabs.filter(t => t.primary);
  const secondaryTabs     = visibleFilterTabs.filter(t => !t.primary);
  // Dot indicator: when a non-primary filter/category is active on mobile, the
  // collapsed "More" pill shows a dot so the user knows a hidden selection exists.
  const activeIsSecondary = secondaryTabs.some(t => t.key === filter);

  // Categories: first 3 stay visible on mobile, the rest hide behind "More".
  // On sm+ all categories render inline so desktop layout is unchanged.
  const PRIMARY_CAT_KEYS    = ['all', 'physics', 'chemistry'];
  const primaryCats         = CATEGORIES.filter(c => PRIMARY_CAT_KEYS.includes(c.key));
  const secondaryCats       = CATEGORIES.filter(c => !PRIMARY_CAT_KEYS.includes(c.key));
  const activeCatIsSecondary = secondaryCats.some(c => c.key === category);

  const fetchPosts = useCallback(async (pg = 1, replace = true) => {
    if (pg === 1) setLoading(true); else setLoadingMore(true);
    try {
      const res = await svc.getPosts({ category, filter, search: search || undefined, page: pg });
      setPosts(prev => replace ? res.data : [...prev, ...res.data]);
      setHasMore(res.hasMore);
      setPage(pg);
    } catch { toast.error('Failed to load posts'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [category, filter, search]);

  useEffect(() => { fetchPosts(1, true); }, [fetchPosts]);

  const submitSearch = () => setSearch(searchDraft.trim());
  const clearSearch  = () => { setSearchDraft(''); setSearch(''); };

  const handleNewPost   = (post)   => setPosts(prev => [post, ...prev]);
  const handleDeletePost = async (postId) => {
    try {
      await svc.deletePost(postId);
      setPosts(prev => prev.filter(p => p._id !== postId));
      toast.success('Post deleted');
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="flex gap-6">
      {/* ── Left: main feed ── */}
      <div className="flex-1 min-w-0">

        {/* MOBILE TOP: personal rank / staff points card. Hidden on desktop
            where the sidebar already shows it on the right. */}
        <div className="lg:hidden mb-4">
          <PersonalRankCard data={lbData} />
        </div>

        {/* Category tabs — mobile: 3 primary + More toggle; sm+: all inline */}
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Mobile: 3 primary categories */}
            <div className="flex flex-wrap sm:hidden items-center gap-1.5">
              {primaryCats.map(c => (
                <CategoryPill
                  key={c.key}
                  active={category === c.key}
                  onClick={() => setCategory(c.key)}
                >
                  {c.label}
                </CategoryPill>
              ))}
              {/* Sized to match CategoryPill exactly (text-sm px-3 py-1.5
                  rounded-xl) so it sits flush with the other pills. */}
              <button
                type="button"
                onClick={() => setCatMoreOpen(v => !v)}
                className={`inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-xl font-medium transition-colors border ${
                  catMoreOpen || activeCatIsSecondary
                    ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                    : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                }`}
                aria-expanded={catMoreOpen}
                aria-label={activeCatIsSecondary ? 'More categories (1 active)' : 'More categories'}
              >
                <FiSliders className="w-3.5 h-3.5" />
                More
                {activeCatIsSecondary && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500" aria-hidden />
                )}
              </button>
            </div>

            {/* sm+: all categories inline (desktop layout preserved) */}
            <div className="hidden sm:flex flex-wrap items-center gap-1.5">
              {CATEGORIES.map(c => (
                <CategoryPill
                  key={c.key}
                  active={category === c.key}
                  onClick={() => setCategory(c.key)}
                >
                  {c.label}
                </CategoryPill>
              ))}
            </div>
          </div>

          {/* Mobile: secondary categories revealed under the More pill.
              Flex-wrap so each pill sizes to its label (matches the primary
              row's behaviour) — Biology and Physics end up the same width
              instead of getting forced into equal grid columns. */}
          {catMoreOpen && (
            <div className="sm:hidden mt-2 flex flex-wrap gap-1.5">
              {secondaryCats.map(c => (
                <CategoryPill
                  key={c.key}
                  active={category === c.key}
                  onClick={() => { setCategory(c.key); setCatMoreOpen(false); }}
                >
                  {c.label}
                </CategoryPill>
              ))}
            </div>
          )}
        </div>

        {/* Post composer trigger + modal */}
        <PostComposer user={user} isStaff={isStaff} onPost={handleNewPost} />

        {/* Filter tabs + search */}
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-3 mb-4">
          {/* Primary row: always-visible filters + the More toggle (mobile only) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {primaryTabs.map(f => (
              <FilterPill
                key={f.key}
                active={filter === f.key}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </FilterPill>
            ))}

            {/* Mobile-only "More" toggle. On md+ secondary tabs render inline.
                Uses a tiny dot (not a "1" badge) so the pill stays compact
                and the row doesn't wrap when a secondary filter is active. */}
            <button
              type="button"
              onClick={() => setMoreOpen(v => !v)}
              className={`md:hidden inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors border ${
                moreOpen || activeIsSecondary
                  ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
              }`}
              aria-expanded={moreOpen}
              aria-label={activeIsSecondary ? 'More filters (1 active)' : 'More filters'}
            >
              <FiSliders className="w-3.5 h-3.5" />
              More
              {activeIsSecondary && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500" aria-hidden />
              )}
            </button>

            {/* Inline secondary tabs (md+) — same line so desktop layout is unchanged */}
            <div className="hidden md:flex flex-wrap items-center gap-1.5">
              {secondaryTabs.map(f => (
                <FilterPill
                  key={f.key}
                  active={filter === f.key}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </FilterPill>
              ))}
            </div>
          </div>

          {/* Mobile More-panel: collapsible secondary tabs as flex-wrapped pills.
              Sizing-to-content keeps every pill the same height as the primary
              row, regardless of label length (no awkward 2-line "Announcements"). */}
          {moreOpen && (
            <div className="md:hidden mt-2 pt-2 border-t border-[var(--border-faint)] flex flex-wrap gap-1.5">
              {secondaryTabs.map(f => (
                <FilterPill
                  key={f.key}
                  active={filter === f.key}
                  onClick={() => { setFilter(f.key); setMoreOpen(false); }}
                >
                  {f.label}
                </FilterPill>
              ))}
            </div>
          )}

          {/* Search — only fires API on submit (Enter or click). No live query. */}
          <div className="mt-2 flex gap-2">
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitSearch(); }}
              placeholder="Search posts or authors…"
              className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
            />
            <button
              onClick={submitSearch}
              className="flex items-center gap-1 px-3 sm:px-4 py-1.5 text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors flex-shrink-0"
            >
              <FiSearch className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Search</span>
            </button>
            {search && (
              <button
                onClick={clearSearch}
                className="px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] bg-[var(--bg-muted)] hover:bg-[var(--border)] rounded-xl transition-colors flex-shrink-0"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Posts */}
        {loading ? (
          <div className="flex justify-center py-12"><FiLoader className="animate-spin w-6 h-6 text-[var(--text-faint)]" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-faint)]">
            <p className="text-lg font-medium mb-1">No posts found</p>
            <p className="text-sm">Be the first to post!</p>
          </div>
        ) : (
          <>
            {posts.map(p => (
              <PostCard
                key={p._id}
                post={p}
                userId={user?.id || user?._id}
                isStaff={isStaff}
                onDelete={handleDeletePost}
              />
            ))}
            {hasMore && (
              <div className="flex justify-center mt-4 mb-2">
                <button
                  onClick={() => fetchPosts(page + 1, false)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-sm font-medium text-[var(--text)] hover:bg-[var(--bg-muted)] disabled:opacity-50 transition-colors"
                >
                  {loadingMore && <FiLoader className="animate-spin w-4 h-4" />}
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}

        {/* MOBILE BOTTOM: leaderboard details under the post list. Hidden on
            desktop — the right sidebar already shows these. */}
        <div className="lg:hidden mt-6 space-y-4">
          {isAdmin && <StaffPerformanceCard data={staffData} loading={staffLoading} />}
          <TopLeaderboardCard
            data={lbData}
            userId={myUserId}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
          <HowToEarnPointsCard />
        </div>
      </div>

      {/* ── Right: sidebar (desktop only) ── */}
      <aside className="hidden lg:block w-72 flex-shrink-0">
        <div className="space-y-4">
          {isAdmin && <StaffPerformanceCard data={staffData} loading={staffLoading} />}
          <PersonalRankCard data={lbData} />
          <TopLeaderboardCard
            data={lbData}
            userId={myUserId}
            refreshing={refreshing}
            onRefresh={handleRefresh}
          />
          <HowToEarnPointsCard />
        </div>
      </aside>
    </div>
  );
};

// Small filter pill used by the primary + secondary tab rows + mobile More grid.
const FilterPill = ({ active, onClick, children, fullWidth = false }) => (
  <button
    onClick={onClick}
    className={`${fullWidth ? 'w-full' : ''} text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
      active
        ? 'bg-primary-500 text-white'
        : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
    }`}
  >
    {children}
  </button>
);

// Category pill — larger than FilterPill and outlined so it matches the
// original category strip styling on desktop.
const CategoryPill = ({ active, onClick, children, fullWidth = false }) => (
  <button
    onClick={onClick}
    className={`${fullWidth ? 'w-full' : ''} text-sm px-3 py-1.5 rounded-xl font-medium transition-colors flex-shrink-0 ${
      active
        ? 'bg-primary-500 text-white shadow-sm'
        : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
    }`}
  >
    {children}
  </button>
);

export default CommunityPage;
