import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  FiEdit2, FiSend, FiSearch, FiX, FiRadio, FiMessageSquare,
  FiChevronLeft, FiLoader, FiLock, FiStar, FiArrowRight,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import useAuth from '../../../core/auth/useAuth';
import * as svc from '../services/messageService';
import { getBackendUrl } from '../../../shared/utils/fixImageUrls';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const fixPicture = (url) => (url && url.startsWith('/') ? `${getBackendUrl()}${url}` : url);

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

// Role pill colors — picked to read clearly against light + dark surfaces.
const ROLE_BADGE = {
  admin:   'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  teacher: 'bg-primary-100 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300',
  student: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
};

const AVATAR_COLORS = ['bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-rose-500', 'bg-teal-500'];
const avatarColor = (name = '') => AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const fmtTime = (date) =>
  new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

const fmtConvTime = (date) => {
  const d       = new Date(date);
  const diffMs  = Date.now() - d;
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffDay === 0) return fmtTime(date);
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7)  return d.toLocaleDateString('en-US', { weekday: 'short' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Date-divider label used between messages: "Today · May 16", "Yesterday", or the date.
const fmtDayDivider = (date) => {
  const d = new Date(date);
  const today     = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const dayKey    = new Date(d); dayKey.setHours(0,0,0,0);
  if (dayKey.getTime() === today.getTime()) {
    return `Today · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }
  if (dayKey.getTime() === yesterday.getTime()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ name = '', picture, size = 'md' }) => {
  const sz  = size === 'sm' ? 'w-9 h-9 text-xs' : size === 'lg' ? 'w-11 h-11 text-sm' : 'w-10 h-10 text-sm';
  const src = fixPicture(picture);
  if (src) {
    return <img src={src} alt={name} className={`${sz} rounded-full object-cover flex-shrink-0`} />;
  }
  return (
    <div className={`${sz} ${avatarColor(name)} rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0`}>
      {initials(name)}
    </div>
  );
};

// ── Section label ("MENTORS" / "ADMIN & SUPPORT") ─────────────────────────────
const SectionLabel = ({ children }) => (
  <div className="px-3 pt-3 pb-1.5 text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--text-faint)]">
    {children}
  </div>
);

// ── ConversationItem ──────────────────────────────────────────────────────────
const ConversationItem = ({ conv, selected, onClick, currentUserId }) => {
  const other   = conv.otherParticipant;
  const isMyMsg = conv.lastMessageBy && conv.lastMessageBy.toString() === currentUserId;
  const preview = conv.lastMessage
    ? isMyMsg ? `You: ${conv.lastMessage}` : conv.lastMessage
    : 'No messages yet';

  return (
    <button
      onClick={onClick}
      className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
        selected
          ? 'bg-primary-50 dark:bg-primary-950/30'
          : 'hover:bg-[var(--bg-muted)]'
      }`}
    >
      {/* Left accent stripe when selected — anchors the active conversation visually */}
      {selected && (
        <span aria-hidden className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-primary-500" />
      )}
      <Avatar name={other?.fullName} picture={other?.profilePicture} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-semibold text-[var(--text-strong)] truncate">
            {other?.fullName || 'Unknown'}
          </span>
          {conv.lastMessageAt && (
            <span className="text-[11px] text-[var(--text-faint)] flex-shrink-0">
              {fmtConvTime(conv.lastMessageAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-xs text-[var(--text-muted)] truncate">{preview}</span>
          {conv.unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 bg-secondary-600 text-white text-[11px] rounded-full flex items-center justify-center px-1.5 font-bold">
              {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// ── DateDivider ───────────────────────────────────────────────────────────────
const DateDivider = ({ label }) => (
  <div className="flex justify-center my-4">
    <span className="text-[11px] font-medium text-[var(--text-faint)] bg-[var(--bg-muted)] px-3 py-1 rounded-full border border-[var(--border)]">
      {label}
    </span>
  </div>
);

// ── MessageBubble ─────────────────────────────────────────────────────────────
const MessageBubble = ({ msg, isMe, showSender }) => {
  if (isMe) {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[85%] sm:max-w-[70%]">
          <div className="px-4 py-2.5 bg-secondary-600 text-white rounded-2xl rounded-br-md text-sm leading-relaxed break-words shadow-sm">
            {msg.content}
          </div>
          <p className="text-[10px] text-[var(--text-faint)] mt-1 text-right">
            {fmtTime(msg.createdAt)}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-start mb-3">
      {showSender && (
        <span className="text-xs text-[var(--text-muted)] mb-1 ml-1 font-medium">
          {msg.sender?.fullName}
        </span>
      )}
      <div className="max-w-[85%] sm:max-w-[70%]">
        <div className="px-4 py-2.5 bg-[var(--bg-surface)] text-[var(--text)] border border-[var(--border)] rounded-2xl rounded-bl-md text-sm leading-relaxed break-words shadow-sm">
          {msg.content}
        </div>
        <p className="text-[10px] text-[var(--text-faint)] mt-1 text-left ml-1">
          {fmtTime(msg.createdAt)}
        </p>
      </div>
    </div>
  );
};

// ── NewConversationModal ──────────────────────────────────────────────────────
const NewConversationModal = ({ isStaff, onClose, onSelect }) => {
  const [query,   setQuery]   = useState('');
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef           = useRef(null);

  useEffect(() => {
    if (!isStaff) {
      setLoading(true);
      svc.searchUsers('').then((r) => { setUsers(r.data); setLoading(false); }).catch(() => setLoading(false));
    }
  }, [isStaff]);

  const handleSearch = (val) => {
    setQuery(val);
    if (!isStaff) return;
    clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setUsers([]); return; }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      svc.searchUsers(val.trim()).then((r) => { setUsers(r.data); setLoading(false); }).catch(() => setLoading(false));
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h3 className="font-semibold text-[var(--text-strong)]">Start new chat</h3>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text)] p-1 rounded-lg hover:bg-[var(--bg-muted)]">
            <FiX />
          </button>
        </div>
        {isStaff ? (
          <div className="px-4 pt-3 pb-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] w-4 h-4" />
              <input
                autoFocus value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-9 pr-4 py-2 border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
              />
            </div>
            {query.trim().length < 2 && (
              <p className="text-xs text-[var(--text-faint)] mt-1.5 pl-1">Type at least 2 characters to search</p>
            )}
          </div>
        ) : (
          <p className="px-5 pt-3 text-xs text-[var(--text-faint)]">Message any admin or teacher:</p>
        )}
        <div className="overflow-y-auto max-h-72 px-2 pb-3">
          {loading && <p className="text-center text-sm text-[var(--text-faint)] py-6">Searching…</p>}
          {!loading && users.length === 0 && (isStaff ? query.length >= 2 : true) && (
            <p className="text-center text-sm text-[var(--text-faint)] py-6">No users found</p>
          )}
          {users.map((u) => (
            <button key={u._id} onClick={() => onSelect(u)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[var(--bg-muted)] rounded-xl transition-colors">
              <Avatar name={u.fullName} picture={u.profilePicture} size="sm" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-[var(--text-strong)] truncate">{u.fullName}</p>
                <p className="text-xs text-[var(--text-muted)] truncate">{u.email}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${ROLE_BADGE[u.role]}`}>
                {u.role}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── BroadcastModal (admin only) ───────────────────────────────────────────────
const BroadcastModal = ({ onClose }) => {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!content.trim()) return;
    setSending(true);
    try {
      const res = await svc.createBroadcast(content.trim());
      toast.success(res.message || 'Broadcast sent!');
      onClose();
    } catch {
      toast.error('Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div className="bg-[var(--bg-surface)] rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <FiRadio className="text-primary-500 w-5 h-5" />
            <h3 className="font-semibold text-[var(--text-strong)]">Send Broadcast</h3>
          </div>
          <button onClick={onClose} className="text-[var(--text-faint)] hover:text-[var(--text)]">
            <FiX />
          </button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-[var(--text-muted)] mb-3">
            This message will appear in <strong>every student's</strong> conversation with you.
          </p>
          <textarea
            autoFocus rows={5} value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your broadcast message…"
            maxLength={2000}
            className="w-full border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
          />
          <p className="text-xs text-[var(--text-faint)] text-right mt-1">{content.length}/2000</p>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text)]">
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending || !content.trim()} className="btn-brand text-sm px-5 py-2 disabled:opacity-50">
            {sending ? <FiLoader className="animate-spin w-4 h-4" /> : <FiRadio className="w-4 h-4" />}
            {sending ? 'Sending…' : 'Send to All Students'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── EmptyState ────────────────────────────────────────────────────────────────
const EmptyState = () => (
  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
    <div className="w-16 h-16 bg-primary-50 dark:bg-primary-950/40 rounded-full flex items-center justify-center mb-4">
      <FiMessageSquare className="w-8 h-8 text-primary-500" />
    </div>
    <h3 className="text-lg font-semibold text-[var(--text-strong)] mb-1">Your Messages</h3>
    <p className="text-sm text-[var(--text-muted)]">Select a conversation or start a new one.</p>
  </div>
);

// ── MessagesPage ──────────────────────────────────────────────────────────────
const MessagesPage = () => {
  const { user, isAdmin, isTeacher } = useAuth();
  const isStaff = isAdmin || isTeacher;

  // Push title + tagline up to the top navbar so the page chrome stays
  // consistent across the app. The inline header below was removed in favour
  // of this hook — the navbar slot scales itself for mobile vs laptop.
  usePageHeader({
    title:    'Messages',
    subtitle: 'Direct chat with your mentors and the SKN team',
  });

  // Conversation list state (paginated)
  const [conversations,  setConversations]  = useState([]);
  const [convPage, setConvPage] = useState(1);
  const [hasMore,  setHasMore]  = useState(true);
  const [loadingMore,    setLoadingMore]    = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Active conversation state
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [loadingMsgs,  setLoadingMsgs]  = useState(false);

  // Input / UI
  const [input,              setInput]              = useState('');
  const [sending,            setSending]            = useState(false);
  const [showNewModal,       setShowNewModal]        = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [mobileShowChat,     setMobileShowChat]     = useState(false);
  // Frontend-only search filter over the loaded conversation list. Adds no
  // API call — purely an in-memory filter on otherParticipant.fullName.
  const [convSearch,         setConvSearch]         = useState('');

  const messagesEndRef  = useRef(null);
  const convListRef     = useRef(null);
  const inputRef        = useRef(null);
  // Ref mirror of selectedConv — lets the SSE handler (stable closure) always
  // read the current conversation without re-subscribing.
  const selectedConvRef = useRef(null);
  useEffect(() => { selectedConvRef.current = selectedConv; }, [selectedConv]);

  // Debounced markConversationRead. Without this, every incoming SSE frame
  // triggers another PUT /read on the recipient (= one extra Mongo write
  // per message), causing message-burst chatter.
  //
  // Debounce collapses bursts into a single /read call:
  //   • While messages keep arriving, the timer keeps resetting.
  //   • After 800ms of quiet (or on conv change / unmount), one /read fires.
  //   • That sync also fires AuthContext's 'messages_read' which decrements
  //     the global Messages badge by the entire burst at once — so badge
  //     state stays correct.
  const markReadTimerRef = useRef({});                // convId → timeout id
  const flushMarkRead = useCallback((convId) => {
    if (!convId) return;
    if (markReadTimerRef.current[convId]) {
      clearTimeout(markReadTimerRef.current[convId]);
      delete markReadTimerRef.current[convId];
    }
    svc.markConversationRead(convId).catch(() => {});
  }, []);
  const scheduleMarkRead = useCallback((convId) => {
    if (!convId) return;
    clearTimeout(markReadTimerRef.current[convId]);
    markReadTimerRef.current[convId] = setTimeout(() => {
      delete markReadTimerRef.current[convId];
      svc.markConversationRead(convId).catch(() => {});
    }, 800);
  }, []);
  // On unmount, flush any pending /read so we don't leave stale counts on
  // the server when the user navigates away mid-conversation.
  useEffect(() => () => {
    Object.entries(markReadTimerRef.current).forEach(([id, t]) => {
      clearTimeout(t);
      svc.markConversationRead(id).catch(() => {});
    });
    markReadTimerRef.current = {};
  }, []);

  // ── Fetch page 1 of conversations (poll + initial load) ──────────────────
  const fetchPage1 = useCallback(async (silent = false) => {
    try {
      const res = await svc.getConversations(1, 20);
      setConversations((prev) => {
        if (!silent) return res.data; // initial load — replace entirely
        // Poll: merge fresh page-1 data into existing list, re-sort by lastMessageAt
        const map = Object.fromEntries(prev.map((c) => [c._id, c]));
        res.data.forEach((c) => { map[c._id] = c; }); // update or add
        return Object.values(map).sort(
          (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
        );
      });
      setHasMore(res.hasMore);
      if (!silent) { setConvPage(1); setInitialLoading(false); }
    } catch {
      if (!silent) setInitialLoading(false);
    }
  }, []);

  // ── Load next page (infinite scroll) ─────────────────────────────────────
  const loadNextPage = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = convPage + 1;
    try {
      const res = await svc.getConversations(nextPage, 20);
      setConversations((prev) => {
        const existingIds = new Set(prev.map((c) => c._id));
        const fresh = res.data.filter((c) => !existingIds.has(c._id));
        return [...prev, ...fresh];
      });
      setConvPage(nextPage);
      setHasMore(res.hasMore);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }, [convPage, hasMore, loadingMore]);

  // ── Mount: initial conversation load only (SSE handles all further updates) ─
  useEffect(() => {
    fetchPage1(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch messages for selected conversation ───────────────────────────────
  const fetchMessages = useCallback(async (convId, silent = false) => {
    if (!convId) return;
    if (!silent) setLoadingMsgs(true);
    try {
      const res = await svc.getMessages(convId);
      setMessages(res.data);
      // Reset unread locally so badge clears immediately
      setConversations((prev) =>
        prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
      );
    } catch {
      if (!silent) toast.error('Failed to load messages');
    } finally {
      if (!silent) setLoadingMsgs(false);
    }
  }, []);

  // ── SSE event handler ─────────────────────────────────────────────────────
  // Listens to window 'sse:event' dispatched by AuthContext.
  useEffect(() => {
    const handler = (e) => {
      const data = e.detail;

      if (data.type === 'new_message') {
        const { message, conversationId, conversationUpdate } = data;
        const isOpen = selectedConvRef.current?._id === conversationId;

        if (message && isOpen) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === message._id)) return prev;
            return [...prev, message];
          });
          scheduleMarkRead(conversationId);
        }

        setConversations((prev) => {
          const exists = prev.some((c) => c._id === conversationId);
          if (!exists) {
            fetchPage1(true);
            return prev;
          }
          return prev
            .map((c) =>
              c._id === conversationId
                ? {
                    ...c,
                    ...conversationUpdate,
                    unreadCount: isOpen ? 0 : conversationUpdate.unreadCount,
                  }
                : c
            )
            .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        });
      }

      if (data.type === 'messages_read') {
        setConversations((prev) =>
          prev.map((c) => c._id === data.conversationId ? { ...c, unreadCount: 0 } : c)
        );
      }

      if (data.type === 'connected') {
        fetchPage1(true);
        if (selectedConvRef.current) {
          fetchMessages(selectedConvRef.current._id, true);
        }
      }
    };

    window.addEventListener('sse:event', handler);
    return () => window.removeEventListener('sse:event', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Infinite scroll on conversation list ──────────────────────────────────
  const handleConvScroll = useCallback(() => {
    const el = convListRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 60) {
      loadNextPage();
    }
  }, [loadNextPage]);

  // ── Load messages when active conversation changes ─────────────────────────
  useEffect(() => {
    if (!selectedConv) return;
    fetchMessages(selectedConv._id);
  }, [selectedConv?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll to bottom on new messages ─────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Select a conversation ─────────────────────────────────────────────────
  const handleSelectConv = (conv) => {
    if (selectedConvRef.current && selectedConvRef.current._id !== conv._id) {
      flushMarkRead(selectedConvRef.current._id);
    }
    setSelectedConv(conv);
    setMobileShowChat(true);
    setInput('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Start new conversation via user-search modal ──────────────────────────
  const handleNewConvSelect = async (targetUser) => {
    setShowNewModal(false);
    try {
      const res = await svc.startConversation(targetUser._id);
      const newConv = res.data;
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === newConv._id);
        return exists ? prev.map((c) => (c._id === newConv._id ? newConv : c)) : [newConv, ...prev];
      });
      handleSelectConv(newConv);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start conversation');
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || !selectedConv || sending) return;
    setSending(true);

    const optimistic = {
      _id: `opt-${Date.now()}`,
      sender: { _id: user.id, fullName: user.fullName },
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');

    try {
      const res = await svc.sendMessage(selectedConv._id, text);
      setMessages((prev) => prev.map((m) => (m._id === optimistic._id ? res.data : m)));
      setConversations((prev) =>
        prev.map((c) =>
          c._id === selectedConv._id
            ? { ...c, lastMessage: text.substring(0, 100), lastMessageAt: new Date().toISOString(), lastMessageBy: user.id }
            : c
        )
      );
    } catch {
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
      setInput(text);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────
  // Group conversations by the other participant's role. Sections only render
  // when they have at least one conversation, so a student-only list won't
  // show empty "ADMIN & SUPPORT" headers and vice versa.
  const grouped = useMemo(() => {
    const q = convSearch.trim().toLowerCase();
    const filtered = q
      ? conversations.filter((c) => (c.otherParticipant?.fullName || '').toLowerCase().includes(q))
      : conversations;

    const groups = { mentors: [], admins: [], students: [], others: [] };
    for (const c of filtered) {
      const r = c.otherParticipant?.role;
      if (r === 'teacher')      groups.mentors.push(c);
      else if (r === 'admin')   groups.admins.push(c);
      else if (r === 'student') groups.students.push(c);
      else                      groups.others.push(c);
    }
    return groups;
  }, [conversations, convSearch]);

  const otherRole = selectedConv?.otherParticipant?.role;
  const otherIsMentor = otherRole === 'teacher';

  // Decide where to render the sender-name label for each non-me message.
  // Only show it for the first message in a consecutive run from the same
  // sender, like most modern chat UIs.
  const messageRows = useMemo(() => {
    const rows = [];
    let lastDayKey = null;
    let lastSenderKey = null;
    for (const m of messages) {
      const dayKey = new Date(m.createdAt).toDateString();
      if (dayKey !== lastDayKey) {
        rows.push({ kind: 'divider', key: `div-${dayKey}`, label: fmtDayDivider(m.createdAt) });
        lastDayKey    = dayKey;
        lastSenderKey = null; // Force sender label on first msg of new day
      }
      const senderId = (m.sender?._id || m.sender)?.toString();
      const isMe = senderId === user.id || senderId === user._id?.toString();
      const showSender = !isMe && senderId !== lastSenderKey;
      rows.push({ kind: 'msg', key: m._id, msg: m, isMe, showSender });
      lastSenderKey = senderId;
    }
    return rows;
  }, [messages, user.id, user._id]);

  // ── Render ────────────────────────────────────────────────────────────────
  // height = viewport minus top navbar (~68px) so the split cards fill the
  // remaining space exactly, with no scroll on the page itself.
  //
  // Negative margins must match the dashboard layout's <main> padding
  // (p-4 sm:p-6) — otherwise the page sticks out past the viewport edge and
  // the body picks up an unwanted horizontal scrollbar.
  return (
    <div className="-m-4 sm:-m-6 flex flex-col bg-[var(--bg)] overflow-hidden" style={{ height: 'calc(100vh - 68px)' }}>
      {/* ── Main split layout ── */}
      <div className="flex-1 flex gap-3 sm:gap-4 p-3 sm:p-4 overflow-hidden min-h-0">

        {/* ── Left panel: conversation list card ── */}
        <aside className={`${mobileShowChat ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col flex-shrink-0 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden`}>

          {/* Start new chat */}
          <div className="p-3 flex-shrink-0 flex items-center gap-2">
            <button
              onClick={() => setShowNewModal(true)}
              className="btn-brand flex-1 justify-center text-sm"
            >
              <FiEdit2 className="w-4 h-4" /> Start new chat
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowBroadcastModal(true)}
                title="Send broadcast to all students"
                className="p-2.5 rounded-xl border border-[var(--border)] text-primary-600 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-950/30 transition-colors flex-shrink-0"
              >
                <FiRadio className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Search conversations (frontend-only filter) */}
          <div className="px-3 pb-2 flex-shrink-0">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] w-4 h-4" />
              <input
                value={convSearch}
                onChange={(e) => setConvSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-[var(--bg-muted)] border border-[var(--border)] text-[var(--text)] rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-400 placeholder:text-[var(--text-faint)]"
              />
              {convSearch && (
                <button
                  onClick={() => setConvSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--text-faint)] hover:text-[var(--text)]"
                  aria-label="Clear search"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Grouped conversation list */}
          <div
            ref={convListRef}
            onScroll={handleConvScroll}
            className="flex-1 overflow-y-auto px-2 pb-2"
          >
            {initialLoading ? (
              <div className="flex items-center justify-center py-12">
                <FiLoader className="animate-spin w-6 h-6 text-[var(--text-faint)]" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="text-center text-sm text-[var(--text-faint)] py-10 px-4">
                No conversations yet.<br />
                Tap <strong>Start new chat</strong> above.
              </p>
            ) : (
              <>
                {grouped.mentors.length > 0 && (
                  <>
                    <SectionLabel>Mentors</SectionLabel>
                    {grouped.mentors.map((conv) => (
                      <ConversationItem
                        key={conv._id}
                        conv={conv}
                        selected={selectedConv?._id === conv._id}
                        onClick={() => handleSelectConv(conv)}
                        currentUserId={user.id}
                      />
                    ))}
                  </>
                )}
                {grouped.admins.length > 0 && (
                  <>
                    <SectionLabel>Admin &amp; Support</SectionLabel>
                    {grouped.admins.map((conv) => (
                      <ConversationItem
                        key={conv._id}
                        conv={conv}
                        selected={selectedConv?._id === conv._id}
                        onClick={() => handleSelectConv(conv)}
                        currentUserId={user.id}
                      />
                    ))}
                  </>
                )}
                {grouped.students.length > 0 && (
                  <>
                    <SectionLabel>Students</SectionLabel>
                    {grouped.students.map((conv) => (
                      <ConversationItem
                        key={conv._id}
                        conv={conv}
                        selected={selectedConv?._id === conv._id}
                        onClick={() => handleSelectConv(conv)}
                        currentUserId={user.id}
                      />
                    ))}
                  </>
                )}
                {grouped.others.length > 0 && (
                  <>
                    <SectionLabel>Other</SectionLabel>
                    {grouped.others.map((conv) => (
                      <ConversationItem
                        key={conv._id}
                        conv={conv}
                        selected={selectedConv?._id === conv._id}
                        onClick={() => handleSelectConv(conv)}
                        currentUserId={user.id}
                      />
                    ))}
                  </>
                )}
                {convSearch && Object.values(grouped).every((g) => g.length === 0) && (
                  <p className="text-center text-sm text-[var(--text-faint)] py-8">
                    No matches for "{convSearch}"
                  </p>
                )}
                {loadingMore && (
                  <div className="flex justify-center py-3">
                    <FiLoader className="animate-spin w-4 h-4 text-[var(--text-faint)]" />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer disclaimer */}
          {!isStaff && (
            <div className="px-3 py-2.5 border-t border-[var(--border)] flex-shrink-0">
              <p className="text-[11px] text-[var(--text-muted)] flex items-center gap-1.5">
                <FiLock className="w-3 h-3 flex-shrink-0" />
                You can only message mentors and admin.
              </p>
            </div>
          )}
        </aside>

        {/* ── Right panel: chat card ── */}
        <main className={`${mobileShowChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden min-w-0`}>
          {selectedConv ? (
            <>
              {/* Chat header — name + role only. No top-right icons. */}
              <div className="px-3 sm:px-5 py-3 border-b border-[var(--border)] flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => setMobileShowChat(false)}
                  className="md:hidden p-1 -ml-1 text-[var(--text-muted)] hover:text-[var(--text)]"
                  aria-label="Back to conversations"
                >
                  <FiChevronLeft className="w-5 h-5" />
                </button>
                <Avatar
                  name={selectedConv.otherParticipant?.fullName}
                  picture={selectedConv.otherParticipant?.profilePicture}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-[var(--text-strong)] text-sm sm:text-base truncate">
                      {selectedConv.otherParticipant?.fullName}
                    </p>
                    {otherIsMentor && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded-full">
                        <FiStar className="w-3 h-3" /> Mentor
                      </span>
                    )}
                  </div>
                  <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full capitalize mt-0.5 ${ROLE_BADGE[otherRole] || ROLE_BADGE.student}`}>
                    {otherRole}
                  </span>
                </div>
              </div>

              {/* Messages with day dividers + sender labels */}
              <div className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 bg-[var(--bg)]">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full">
                    <FiLoader className="animate-spin w-6 h-6 text-[var(--text-faint)]" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-sm text-[var(--text-faint)] mt-10">
                    No messages yet. Say hello!
                  </p>
                ) : (
                  messageRows.map((row) =>
                    row.kind === 'divider'
                      ? <DateDivider key={row.key} label={row.label} />
                      : <MessageBubble key={row.key} msg={row.msg} isMe={row.isMe} showSender={row.showSender} />
                  )
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input row */}
              <form
                onSubmit={handleSend}
                className="px-3 sm:px-5 py-3 border-t border-[var(--border)] flex items-end gap-2 sm:gap-3 flex-shrink-0"
              >
                <div className="flex-1 min-w-0 bg-[var(--bg-muted)] border border-[var(--border)] rounded-2xl px-3 sm:px-4 py-2 focus-within:ring-2 focus-within:ring-primary-400">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    placeholder="Type your message…"
                    maxLength={2000}
                    className="w-full resize-none bg-transparent text-sm text-[var(--text)] focus:outline-none placeholder:text-[var(--text-faint)]"
                    style={{ minHeight: '24px', maxHeight: '120px' }}
                  />
                  <p className="hidden sm:block text-[10px] text-[var(--text-faint)] mt-0.5">
                    Enter to send · Shift+Enter for newline
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="btn-brand text-sm px-4 sm:px-5 py-2.5 flex-shrink-0"
                >
                  {sending
                    ? <FiLoader className="animate-spin w-4 h-4" />
                    : <FiArrowRight className="w-4 h-4" />}
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </>
          ) : (
            <EmptyState />
          )}
        </main>
      </div>

      {/* ── Modals ── */}
      {showNewModal && (
        <NewConversationModal
          isStaff={isStaff}
          onClose={() => setShowNewModal(false)}
          onSelect={handleNewConvSelect}
        />
      )}
      {showBroadcastModal && (
        <BroadcastModal onClose={() => setShowBroadcastModal(false)} />
      )}
    </div>
  );
};

export default MessagesPage;
