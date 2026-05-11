import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiEdit2, FiSend, FiSearch, FiX, FiRadio, FiMessageSquare,
  FiChevronLeft, FiLoader,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import useAuth from '../../../core/auth/useAuth';
import * as svc from '../services/messageService';
import { getBackendUrl } from '../../../shared/utils/fixImageUrls';

const fixPicture = (url) => (url && url.startsWith('/') ? `${getBackendUrl()}${url}` : url);

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

const ROLE_BADGE = {
  admin:   'bg-red-100 text-red-700',
  teacher: 'bg-blue-100 text-blue-700',
  student: 'bg-green-100 text-green-700',
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

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ name = '', picture, size = 'md' }) => {
  const sz  = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
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

// ── ConversationItem ──────────────────────────────────────────────────────────
const ConversationItem = ({ conv, selected, onClick, currentUserId }) => {
  const other   = conv.otherParticipant;
  // "You: …" if the last message was sent by the current user
  const isMyMsg = conv.lastMessageBy && conv.lastMessageBy.toString() === currentUserId;
  const preview = conv.lastMessage
    ? isMyMsg ? `You: ${conv.lastMessage}` : conv.lastMessage
    : 'No messages yet';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-50 ${
        selected ? 'bg-blue-50' : 'hover:bg-gray-50'
      }`}
    >
      <Avatar name={other?.fullName} picture={other?.profilePicture} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-semibold text-gray-900 truncate">{other?.fullName || 'Unknown'}</span>
          {conv.lastMessageAt && (
            <span className="text-xs text-gray-400 flex-shrink-0">{fmtConvTime(conv.lastMessageAt)}</span>
          )}
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <span className="text-xs text-gray-500 truncate">{preview}</span>
          {conv.unreadCount > 0 && (
            <span className="flex-shrink-0 min-w-[20px] h-5 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center px-1 font-medium">
              {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

// ── MessageBubble ─────────────────────────────────────────────────────────────
const MessageBubble = ({ msg, isMe }) => (
  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-3`}>
    {!isMe && (
      <Avatar name={msg.sender?.fullName} picture={msg.sender?.profilePicture} size="sm" />
    )}
    <div className={`max-w-[70%] ${isMe ? '' : 'ml-2'}`}>
      <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
        isMe
          ? 'bg-blue-600 text-white rounded-br-sm'
          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
      }`}>
        {msg.content}
      </div>
      <p className={`text-xs text-gray-400 mt-1 ${isMe ? 'text-right' : 'text-left'}`}>
        {fmtTime(msg.createdAt)}
      </p>
    </div>
  </div>
);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">New Message</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX /></button>
        </div>
        {isStaff ? (
          <div className="px-4 pt-3 pb-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                autoFocus value={query}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            {query.trim().length < 2 && (
              <p className="text-xs text-gray-400 mt-1.5 pl-1">Type at least 2 characters to search</p>
            )}
          </div>
        ) : (
          <p className="px-5 pt-3 text-xs text-gray-400">Message any admin or teacher:</p>
        )}
        <div className="overflow-y-auto max-h-72 divide-y divide-gray-50 px-2 pb-3">
          {loading && <p className="text-center text-sm text-gray-400 py-6">Searching…</p>}
          {!loading && users.length === 0 && (isStaff ? query.length >= 2 : true) && (
            <p className="text-center text-sm text-gray-400 py-6">No users found</p>
          )}
          {users.map((u) => (
            <button key={u._id} onClick={() => onSelect(u)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl transition-colors">
              <Avatar name={u.fullName} picture={u.profilePicture} size="sm" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 truncate">{u.fullName}</p>
                <p className="text-xs text-gray-500 truncate">{u.email}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role]}`}>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <FiRadio className="text-blue-600 w-5 h-5" />
            <h3 className="font-semibold text-gray-900">Send Broadcast</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><FiX /></button>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm text-gray-500 mb-3">
            This message will appear in <strong>every student's</strong> conversation with you.
          </p>
          <textarea
            autoFocus rows={5} value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Type your broadcast message…"
            maxLength={2000}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <p className="text-xs text-gray-400 text-right mt-1">{content.length}/2000</p>
        </div>
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={handleSend} disabled={sending || !content.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
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
  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gray-50">
    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
      <FiMessageSquare className="w-8 h-8 text-blue-500" />
    </div>
    <h3 className="text-lg font-semibold text-gray-800 mb-1">Your Messages</h3>
    <p className="text-sm text-gray-500">Select a conversation or start a new one.</p>
  </div>
);

// ── MessagesPage ──────────────────────────────────────────────────────────────
const MessagesPage = () => {
  const { user, isAdmin, isTeacher } = useAuth();
  const isStaff = isAdmin || isTeacher;

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

  const messagesEndRef  = useRef(null);
  const convListRef     = useRef(null);
  const inputRef        = useRef(null);
  // Ref mirror of selectedConv — lets the SSE handler (stable closure) always
  // read the current conversation without re-subscribing.
  const selectedConvRef = useRef(null);
  useEffect(() => { selectedConvRef.current = selectedConv; }, [selectedConv]);

  // Debounced markConversationRead. Without this, every incoming SSE frame
  // triggers another PUT /read on the recipient (= one extra Mongo write
  // per message), causing the message-burst chatter you saw in the logs.
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

  // ── SSE event handler ─────────────────────────────────────────────────────
  // Listens to window 'sse:event' dispatched by AuthContext.
  // Handles messaging events; other modules add their own listeners for
  // 'notification', 'leaderboard_update', etc. without touching this file.
  useEffect(() => {
    const handler = (e) => {
      const data = e.detail;

      if (data.type === 'new_message') {
        const { message, conversationId, conversationUpdate } = data;
        const isOpen = selectedConvRef.current?._id === conversationId;

        // If the incoming message is for the currently open chat, add it live
        // and immediately mark it as read (so badge stays zero for the viewer).
        if (message && isOpen) {
          setMessages((prev) => {
            // Deduplicate — optimistic message from sender has same _id
            if (prev.some((m) => m._id === message._id)) return prev;
            return [...prev, message];
          });
          // Debounced — see scheduleMarkRead above. Collapses message
          // bursts into a single PUT /read after 800ms of quiet.
          scheduleMarkRead(conversationId);
        }

        // Update conversation list: preview text + unread badge
        setConversations((prev) => {
          const exists = prev.some((c) => c._id === conversationId);
          if (!exists) {
            // Brand-new conversation (e.g. student gets first broadcast) —
            // fetch page 1 so it appears in the list.
            fetchPage1(true);
            return prev;
          }
          return prev
            .map((c) =>
              c._id === conversationId
                ? {
                    ...c,
                    ...conversationUpdate,
                    // Don't show unread badge if user is currently viewing it
                    unreadCount: isOpen ? 0 : conversationUpdate.unreadCount,
                  }
                : c
            )
            .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
        });
      }

      if (data.type === 'messages_read') {
        // Server confirmed this user's conversation was marked as read
        setConversations((prev) =>
          prev.map((c) => c._id === data.conversationId ? { ...c, unreadCount: 0 } : c)
        );
      }

      if (data.type === 'connected') {
        // SSE reconnected after a drop — refresh to catch any missed updates
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

  // ── Load messages when active conversation changes ─────────────────────────
  // Initial load only — SSE pushes new messages in real time after that.
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
    // Flush any pending /read for the conv we're leaving so the server's
    // unread tally doesn't go stale. (No-op if nothing pending.)
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

  const totalUnread = conversations.reduce((s, c) => s + (c.unreadCount || 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="-m-6 flex bg-white overflow-hidden" style={{ height: 'calc(100vh - 144px)' }}>

      {/* ── Left panel — conversation list ── */}
      <div className={`${mobileShowChat ? 'hidden md:flex' : 'flex'} w-full md:w-80 flex-col flex-shrink-0 border-r border-gray-200`}>

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-900">Messages</h1>
            {totalUnread > 0 && (
              <span className="bg-blue-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <button
                onClick={() => setShowBroadcastModal(true)}
                title="Send Broadcast to All Students"
                className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <FiRadio className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setShowNewModal(true)}
              title="New Message"
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <FiEdit2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conversation list with infinite scroll */}
        <div
          ref={convListRef}
          onScroll={handleConvScroll}
          className="flex-1 overflow-y-auto"
        >
          {initialLoading ? (
            <div className="flex items-center justify-center py-12">
              <FiLoader className="animate-spin w-6 h-6 text-gray-400" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-10 px-4">
              No conversations yet.<br />
              Click <strong>✏</strong> to start one.
            </p>
          ) : (
            <>
              {conversations.map((conv) => (
                <ConversationItem
                  key={conv._id}
                  conv={conv}
                  selected={selectedConv?._id === conv._id}
                  onClick={() => handleSelectConv(conv)}
                  currentUserId={user.id}
                />
              ))}
              {loadingMore && (
                <div className="flex justify-center py-3">
                  <FiLoader className="animate-spin w-4 h-4 text-gray-400" />
                </div>
              )}
              {!loadingMore && hasMore && (
                <p className="text-center text-xs text-gray-400 py-2">Scroll down to load more</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right panel — chat ── */}
      <div className={`${mobileShowChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col`}>
        {selectedConv ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-3 flex-shrink-0">
              <button
                onClick={() => setMobileShowChat(false)}
                className="md:hidden p-1 text-gray-500 hover:text-gray-700"
              >
                <FiChevronLeft className="w-5 h-5" />
              </button>
              <Avatar
                name={selectedConv.otherParticipant?.fullName}
                picture={selectedConv.otherParticipant?.profilePicture}
              />
              <div>
                <p className="font-semibold text-gray-900 text-sm">
                  {selectedConv.otherParticipant?.fullName}
                </p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[selectedConv.otherParticipant?.role]}`}>
                  {selectedConv.otherParticipant?.role}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-full">
                  <FiLoader className="animate-spin w-6 h-6 text-gray-400" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-gray-400 mt-10">No messages yet. Say hello!</p>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg._id}
                    msg={msg}
                    isMe={
                      (msg.sender?._id || msg.sender) === user.id ||
                      msg.sender?._id?.toString() === user.id
                    }
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSend}
              className="px-4 py-3 border-t border-gray-200 bg-white flex items-end gap-3 flex-shrink-0"
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                maxLength={2000}
                className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 overflow-y-auto"
                style={{ minHeight: '42px', maxHeight: '128px' }}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {sending ? <FiLoader className="animate-spin w-4 h-4" /> : <FiSend className="w-4 h-4" />}
              </button>
            </form>
          </>
        ) : (
          <EmptyState />
        )}
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
