// src/modules/reports/pages/TeacherMCQReportsPage.jsx
//
// SKN Academy LMS — MCQ Reports (teacher view, post-redesign).
// Same split-pane shell as the student view, plus teacher affordances:
//   • Reporter identity shown on every card and in the detail header
//   • "Assign to me" button when a report is open or unowned-active
//   • "Edit MCQ" deep link in the detail header
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import useAuth from '../../../core/auth/useAuth';
import {
  FiCheckCircle, FiClock, FiAlertCircle, FiX,
  FiChevronLeft, FiChevronRight, FiMessageSquare,
  FiUserCheck, FiThumbsUp, FiThumbsDown, FiPaperclip, FiArrowLeft,
  FiEdit, FiFlag, FiInbox, FiSliders,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { fixImageUrls } from '../../../shared/utils/fixImageUrls';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const PAGE_SIZE = 20;

// ── Display status (same mapping as student page; closed=active=open semantics)
const getDisplayStatus = (report) => {
  if (report.status === 'open')   return 'open';
  if (report.status === 'active') return 'review';
  if (report.studentSatisfied === false) return 'rejected';
  return 'resolved';
};

const STATUS_META = {
  open:     { label: 'Open',         pillCls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',         dotCls: 'bg-amber-500',   accentCls: 'before:bg-amber-500',   Icon: FiClock },
  review:   { label: 'Under review', pillCls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',              dotCls: 'bg-blue-500',    accentCls: 'before:bg-blue-500',    Icon: FiAlertCircle },
  resolved: { label: 'Resolved',     pillCls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',  dotCls: 'bg-emerald-500', accentCls: 'before:bg-emerald-500', Icon: FiCheckCircle },
  rejected: { label: 'Rejected',     pillCls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',              dotCls: 'bg-rose-500',    accentCls: 'before:bg-rose-500',    Icon: FiX },
};

const REASON_PILL = {
  'Question Statement Wrong': 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
  'Option Wrong':             'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300',
  'Answer Key is Incorrect':  'bg-secondary-50 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300',
  'Wrong Explanation':        'bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300',
  'Need Explanation':         'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
};

const formatRelative = (d) => {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)    return 'just now';
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const day = Math.floor(h / 24);
  if (day < 7)  return `${day} day${day === 1 ? '' : 's'} ago`;
  const w = Math.floor(day / 7);
  if (w < 5)    return `${w} week${w === 1 ? '' : 's'} ago`;
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const repCode = (id) => `REP-${String(id || '').slice(-4).toUpperCase()}`;

const buildEditUrl = (report) => {
  const mcq = report.mcq;
  if (!mcq || !mcq._id) return null;
  if (mcq.questionBankId) return `/admin/question-banks/${mcq.questionBankId}/mcqs/${mcq._id}/edit`;
  if (mcq.testId) return `/tests/${mcq.testId}/mcqs/${mcq._id}/edit`;
  if (report.test) return `/tests/${report.test}/mcqs/${mcq._id}/edit`;
  return null;
};

// ── KPI tile ────────────────────────────────────────────────────────────────
const Kpi = ({ label, value, valueCls, accent }) => (
  <div
    className={`rounded-2xl border p-3 sm:p-4 ${
      accent
        ? 'bg-primary-50/60 dark:bg-primary-950/30 border-primary-200 dark:border-primary-900/50'
        : 'bg-[var(--bg-surface)] border-[var(--border)]'
    }`}
  >
    <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">{label}</p>
    <p className={`font-display text-[28px] sm:text-[32px] font-extrabold leading-none mt-1.5 ${valueCls}`}>{value}</p>
  </div>
);

const StatusPill = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.open;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${meta.pillCls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotCls}`} />
      {meta.label}
    </span>
  );
};

// ── MCQ body (question + 2x2 options) ──────────────────────────────────────
const MCQBlock = ({ mcq }) => {
  if (!mcq || typeof mcq !== 'object' || !mcq.questionText) {
    return <p className="text-sm text-[var(--text-faint)] italic">MCQ data unavailable.</p>;
  }
  return (
    <div>
      <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)] mb-2">Reported question</p>
      <div
        className="prose prose-sm dark:prose-invert max-w-none text-[var(--text-strong)] mb-4"
        dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.questionText) }}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {mcq.options?.map((opt) => (
          <div
            key={opt._id || opt.optionLetter}
            className={`flex items-start gap-2 p-3 rounded-xl border text-sm ${
              opt.isCorrect
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                : 'bg-[var(--bg-surface)] border-[var(--border)]'
            }`}
          >
            <span
              className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold flex-shrink-0 ${
                opt.isCorrect ? 'bg-emerald-500 text-white' : 'bg-[var(--bg-muted)] text-[var(--text-muted)]'
              }`}
            >
              {opt.optionLetter}
            </span>
            <span
              className={`flex-1 ${opt.isCorrect ? 'text-emerald-800 dark:text-emerald-200 font-medium' : 'text-[var(--text)]'}`}
              dangerouslySetInnerHTML={{ __html: fixImageUrls(opt.optionText) }}
            />
            {opt.isCorrect && (
              <span className="text-[10px] font-bold tracking-wider text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded">
                OFFICIAL
              </span>
            )}
          </div>
        ))}
      </div>
      {mcq.explanationText && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <p className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)] mb-1.5">Explanation</p>
          <div
            className="text-sm text-[var(--text)] prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.explanationText) }}
          />
        </div>
      )}
    </div>
  );
};

// ── Chat thread (teacher angle: own messages right-aligned in violet,
//   student messages left in muted, other staff replies left in soft tone)
const ChatThread = ({ report, currentUserId, onAddMessage, onClose }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [report.messages?.length]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try { await onAddMessage(report._id, text); setText(''); }
    finally { setSending(false); }
  };

  return (
    <div className="flex flex-col">
      <div className="space-y-3 max-h-[42vh] lg:max-h-[420px] overflow-y-auto py-1 pr-1">
        {(!report.messages || report.messages.length === 0) && (
          <p className="text-xs text-[var(--text-faint)] italic text-center py-2">No messages yet. Be the first to respond.</p>
        )}
        {report.messages?.map((msg, i) => {
          const isMe      = msg.sender?._id === currentUserId || msg.sender === currentUserId;
          const isStudent = msg.senderRole === 'student';
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                <div className="flex items-center gap-1 mb-1 text-[11px] text-[var(--text-faint)] px-1">
                  <strong className="text-[var(--text-strong)] font-semibold">
                    {isMe ? 'You' : (msg.senderName || msg.sender?.fullName || 'User')}
                  </strong>
                  {!isMe && (
                    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full font-semibold text-[10px] ${
                      isStudent
                        ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                        : 'bg-secondary-50 dark:bg-secondary-950/40 text-secondary-700 dark:text-secondary-300'
                    }`}>
                      {isStudent ? 'Student' : (msg.senderRole === 'admin' ? 'Admin' : 'Teacher')}
                    </span>
                  )}
                  <span>·</span>
                  <span>{formatRelative(msg.createdAt)}</span>
                </div>
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words ${
                    isMe
                      ? 'bg-secondary-600 text-white'
                      : isStudent
                        ? 'bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-900/50 text-[var(--text)]'
                        : 'bg-[var(--bg-muted)] text-[var(--text)] border border-[var(--border)]'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {report.studentSatisfied === true && (
        <div className="mt-3 inline-flex items-center self-start gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <FiThumbsUp className="w-3 h-3" /> Student is satisfied with your response
        </div>
      )}
      {report.studentSatisfied === false && (
        <div className="mt-3 inline-flex items-center self-start gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold">
          <FiThumbsDown className="w-3 h-3" /> Student is not satisfied — consider following up
        </div>
      )}

      {report.status !== 'closed' ? (
        <div className="mt-3 flex items-center gap-2 p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] focus-within:ring-2 focus-within:ring-primary-400/30 transition">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your response..."
            className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:outline-none px-2"
          />
          <button type="button" className="p-2 rounded-lg text-[var(--text-faint)] hover:bg-[var(--bg-muted)] transition-colors" aria-label="Attach" title="Attach (coming soon)">
            <FiPaperclip className="w-4 h-4" />
          </button>
          <button onClick={handleSend} disabled={sending || !text.trim()} className="btn-brand text-sm px-3 py-2">
            {sending ? <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" /> : <><span>Send</span><FiChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      ) : (
        <div className="mt-3 px-3 py-2 rounded-xl bg-[var(--bg-muted)] text-xs text-[var(--text-muted)] text-center">
          This issue is closed.
        </div>
      )}

      {report.status !== 'closed' && (
        <button
          onClick={() => onClose(report._id)}
          className="mt-2 self-end text-xs text-[var(--text-faint)] hover:text-rose-600 dark:hover:text-rose-300 transition-colors"
        >
          Close this issue
        </button>
      )}
    </div>
  );
};

// ── List item ──────────────────────────────────────────────────────────────
const ReportListItem = ({ report, selected, onSelect }) => {
  const display = getDisplayStatus(report);
  const meta = STATUS_META[display];
  const mcq  = report.mcq;

  return (
    <button
      type="button"
      onClick={() => onSelect(report._id)}
      className={`relative w-full text-left rounded-2xl border p-4 pl-5 transition-all hover:border-[var(--border-strong)]
        before:content-[''] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-1 before:rounded-r-full ${meta.accentCls}
        ${selected
          ? 'bg-[var(--bg-surface)] border-secondary-300 dark:border-secondary-700 shadow-sm ring-2 ring-secondary-500/15'
          : 'bg-[var(--bg-surface)] border-[var(--border)] hover:bg-[var(--bg-subtle)] dark:hover:bg-[var(--bg-muted)]'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <StatusPill status={display} />
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium truncate max-w-[150px] ${REASON_PILL[report.reason] || 'bg-[var(--bg-muted)] text-[var(--text-muted)]'}`}>
            {report.reason}
          </span>
          {report.mcqSubject && (
            <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-full text-[11px] font-medium">
              {report.mcqSubject}
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono tracking-wider text-[var(--text-faint)] flex-shrink-0">{repCode(report._id)}</span>
      </div>

      <div
        className="text-[13px] sm:text-sm text-[var(--text-strong)] line-clamp-2 leading-snug mb-2 prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: mcq?.questionText ? fixImageUrls(mcq.questionText) : '<em>(question unavailable)</em>' }}
      />

      <div className="flex items-center justify-between text-[11px] text-[var(--text-faint)] gap-2">
        <span className="truncate">
          By <strong className="text-[var(--text)]">{report.reportedBy?.fullName || 'Unknown'}</strong>
        </span>
        <span className="inline-flex items-center gap-1 flex-shrink-0">
          <FiClock className="w-3 h-3" />
          {formatRelative(report.createdAt)}
          <span className="mx-1">·</span>
          <FiMessageSquare className="w-3 h-3" />
          {report.messages?.length || 0}
        </span>
      </div>
    </button>
  );
};

// ── Detail panel ───────────────────────────────────────────────────────────
const ReportDetailPanel = ({ report, currentUserId, onAddMessage, onAssign, onClose, onBack }) => {
  if (!report) {
    return (
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
        <div className="w-14 h-14 rounded-2xl bg-secondary-50 dark:bg-secondary-950/40 text-secondary-600 dark:text-secondary-300 flex items-center justify-center mb-3">
          <FiFlag className="w-6 h-6" />
        </div>
        <h3 className="font-display text-lg font-bold text-[var(--text-strong)] mb-1">Select a report</h3>
        <p className="text-sm text-[var(--text-faint)] max-w-sm">Pick a report from the list to view the full MCQ and chat with the student.</p>
      </div>
    );
  }

  const display  = getDisplayStatus(report);
  const editUrl  = buildEditUrl(report);
  const isMine   = report.handledBy?._id === currentUserId || report.handledBy === currentUserId;
  const showAssign = report.status === 'open' || (!isMine && report.status === 'active');

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] flex flex-col">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-[var(--border)]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            type="button"
            onClick={onBack}
            className="lg:hidden inline-flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text-strong)]"
          >
            <FiArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2 ml-auto">
            {editUrl && (
              <Link
                to={editUrl}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
              >
                <FiEdit className="w-3.5 h-3.5" /> Edit MCQ
              </Link>
            )}
            <span className="text-[11px] font-mono tracking-wider text-[var(--text-faint)]">
              {repCode(report._id)} · {formatRelative(report.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusPill status={display} />
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${REASON_PILL[report.reason] || 'bg-[var(--bg-muted)] text-[var(--text-muted)]'}`}>
            {report.reason}
          </span>
          {report.mcqSubject && <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-full text-[11px] font-medium">{report.mcqSubject}</span>}
          {report.mcqChapter && <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-full text-[11px] font-medium">{report.mcqChapter}</span>}
          {report.mcqTopic   && <span className="px-2 py-0.5 bg-secondary-50 dark:bg-secondary-950/40 text-secondary-700 dark:text-secondary-300 rounded-full text-[11px] font-medium">{report.mcqTopic}</span>}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-[var(--text-muted)]">
            Reported by <strong className="text-[var(--text)]">{report.reportedBy?.fullName || 'Unknown'}</strong>
            {report.handledBy
              ? <> · Handled by <strong className="text-[var(--text)]">{report.handledBy.fullName}</strong></>
              : <span className="ml-1 text-amber-600 dark:text-amber-300 font-medium">Unassigned</span>}
          </p>
          {showAssign && (
            <button
              onClick={() => onAssign(report._id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary-600 hover:bg-secondary-700 text-white text-xs font-bold transition-colors"
            >
              <FiUserCheck className="w-3.5 h-3.5" /> Assign to me
            </button>
          )}
        </div>

        {report.details && (
          <p className="mt-3 text-xs text-[var(--text-muted)] italic border-l-2 border-[var(--border)] pl-3">&ldquo;{report.details}&rdquo;</p>
        )}
      </div>

      {/* MCQ body */}
      <div className="p-4 sm:p-5 border-b border-[var(--border)]">
        <MCQBlock mcq={report.mcq} />
      </div>

      {/* Chat */}
      <div className="p-4 sm:p-5">
        <ChatThread report={report} currentUserId={currentUserId} onAddMessage={onAddMessage} onClose={onClose} />
      </div>
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────
const TeacherMCQReportsPage = () => {
  const [reports, setReports]             = useState([]);
  const [loading, setLoading]             = useState(true);
  // hasMore replaces totalPages — backend stopped sending countDocuments.
  const [hasMore, setHasMore]             = useState(false);
  const [filterOptions, setFilterOptions] = useState({ subjects: [], chapters: [], topics: [], questionBanks: [] });
  const [summary, setSummary]             = useState({ openAll: 0, myActive: 0, myClosed: 0, myTotal: 0, newToday: 0 });

  // Primary chip: 'all' | 'open' | 'closed'. "Open" sends status=open,active.
  const [statusFilter,    setStatusFilter]    = useState('open');
  // Secondary "More filters" — sent only when explicitly set.
  const [subjectFilter,   setSubjectFilter]   = useState('');
  const [chapterFilter,   setChapterFilter]   = useState('');
  const [topicFilter,     setTopicFilter]     = useState('');
  const [qbFilter,        setQbFilter]        = useState('');
  const [satisfiedFilter, setSatisfiedFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showMore, setShowMore]                 = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [selectedId, setSelectedId]             = useState(null);

  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?._id || currentUser?.id;

  const loadSummary = async () => {
    try {
      const res = await apiClient.get('/mcq-reports/teacher/summary');
      setSummary(res.data.data);
    } catch { /* non-critical */ }
  };

  // Map chip → backend status param. 'open' becomes the comma-list 'open,active'.
  const chipToStatusParam = (chip) => {
    if (chip === 'open')   return 'open,active';
    if (chip === 'closed') return 'closed';
    return ''; // 'all' / unknown → no status filter
  };

  const loadReports = async (p = page) => {
    setLoading(true);
    try {
      const statusParam = chipToStatusParam(statusFilter);
      const params = new URLSearchParams({ page: p });
      if (statusParam)     params.set('status',       statusParam);
      if (subjectFilter)   params.set('subject',      subjectFilter);
      if (chapterFilter)   params.set('chapter',      chapterFilter);
      if (topicFilter)     params.set('topic',        topicFilter);
      if (qbFilter)        params.set('questionBank', qbFilter);
      if (satisfiedFilter) params.set('satisfied',    satisfiedFilter);

      const res = await apiClient.get(`/mcq-reports?${params}`);
      const data = res.data.data || [];
      setReports(data);
      setHasMore(!!res.data.hasMore);
      // filterOptions only arrive on page 1; cache them across page navigation.
      if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);

      if (data.length > 0) {
        const stillThere = data.some((r) => r._id === selectedId);
        if (!stillThere && typeof window !== 'undefined' && window.innerWidth >= 1024) {
          setSelectedId(data[0]._id);
        } else if (!stillThere) {
          setSelectedId(null);
        }
      } else {
        setSelectedId(null);
      }
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSummary(); }, []);
  useEffect(() => { setPage(1); }, [statusFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, satisfiedFilter]);
  useEffect(() => { loadReports(page); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, statusFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, satisfiedFilter]);

  const handleAddMessage = async (reportId, text) => {
    const res = await apiClient.post(`/mcq-reports/${reportId}/messages`, { text });
    setReports((prev) => prev.map((r) => (r._id === reportId ? res.data.data : r)));
    loadSummary();
  };

  const handleAssign = async (reportId) => {
    try {
      const res = await apiClient.put(`/mcq-reports/${reportId}/assign`);
      toast.success('Report assigned to you');
      setReports((prev) => prev.map((r) => (r._id === reportId ? res.data.data : r)));
      loadSummary();
    } catch {
      toast.error('Failed to assign report');
    }
  };

  const handleClose = async (reportId) => {
    await apiClient.put(`/mcq-reports/${reportId}/close`);
    toast.success('Issue closed');
    loadReports(page);
    loadSummary();
  };

  const subtitle = `${summary.openAll || 0} open · ${summary.myActive || 0} in your queue · ${summary.newToday || 0} new today`;
  usePageHeader({
    title:    'MCQ Reports',
    subtitle,
    action:   null,
  });

  const selectedReport = reports.find((r) => r._id === selectedId) || null;

  const inputCls =
    'px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-primary-400/40 transition';

  const statusChips = [
    { value: 'all',    label: 'All' },
    { value: 'open',   label: 'Open' },
    { value: 'closed', label: 'Closed' },
  ];

  const moreFilterCount =
    (subjectFilter ? 1 : 0) +
    (chapterFilter ? 1 : 0) +
    (topicFilter   ? 1 : 0) +
    (qbFilter      ? 1 : 0);
  const hasAnyFilter = moreFilterCount > 0 || satisfiedFilter || statusFilter !== 'open';

  const clearAllFilters = () => {
    setSubjectFilter(''); setChapterFilter(''); setTopicFilter('');
    setQbFilter(''); setSatisfiedFilter(''); setStatusFilter('open');
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* ── KPI strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 mb-5">
        <Kpi label="New today"  value={summary.newToday || 0} valueCls="text-rose-600 dark:text-rose-300" />
        <Kpi label="Open (all)" value={summary.openAll || 0}  valueCls="text-amber-600 dark:text-amber-300" accent />
        <Kpi label="My active"  value={summary.myActive || 0} valueCls="text-blue-600 dark:text-blue-300" />
        <Kpi label="My closed"  value={summary.myClosed || 0} valueCls="text-emerald-600 dark:text-emerald-300" />
        <Kpi label="My total"   value={summary.myTotal || 0}  valueCls="text-secondary-600 dark:text-secondary-300" />
      </div>

      {/* ── Filter bar ────────────────────────────────────────────────────
          Desktop ≥md: chips + Feedback + More toggle + Clear (single row).
          Mobile <md:  chips scroll + "Filters" button opens 2-col sheet. */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-2 sm:p-3 mb-5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto">
            {statusChips.map((opt) => {
              const active = statusFilter === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
                    active
                      ? (opt.value === 'all'
                          ? 'bg-[var(--text-strong)] text-[var(--bg-surface)]'
                          : 'bg-secondary-600 text-white')
                      : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-muted)] border border-[var(--border)]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <select
            value={satisfiedFilter}
            onChange={(e) => setSatisfiedFilter(e.target.value)}
            className={`${inputCls} hidden md:block flex-shrink-0`}
            aria-label="Feedback"
          >
            <option value="">All feedback</option>
            <option value="true">Satisfied</option>
            <option value="false">Not satisfied</option>
          </select>

          {/* Mobile Filters pill — dot indicator (not number badge) keeps the
              row on a single line when filters are active. */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className={`md:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-colors flex-shrink-0 ${
              mobileFiltersOpen || moreFilterCount > 0 || satisfiedFilter
                ? 'border-secondary-300 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-950/40 text-secondary-700 dark:text-secondary-300'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
            }`}
            aria-expanded={mobileFiltersOpen}
            aria-label={(moreFilterCount > 0 || satisfiedFilter)
              ? `Filters (${moreFilterCount + (satisfiedFilter ? 1 : 0)} active)`
              : 'Filters'}
          >
            <FiSliders className="w-3.5 h-3.5" />
            <span>Filters</span>
            {(moreFilterCount > 0 || satisfiedFilter) && (
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-600" aria-hidden />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border transition-colors flex-shrink-0 ${
              showMore || moreFilterCount > 0
                ? 'border-secondary-300 dark:border-secondary-700 bg-secondary-50 dark:bg-secondary-950/40 text-secondary-700 dark:text-secondary-300'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
            }`}
            aria-expanded={showMore}
          >
            <FiSliders className="w-3.5 h-3.5" />
            <span>More filters</span>
            {moreFilterCount > 0 && (
              <span className="ml-0.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-secondary-600 text-white text-[10px] font-bold">
                {moreFilterCount}
              </span>
            )}
          </button>

          {hasAnyFilter && (
            <button
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] flex-shrink-0"
              title="Clear all filters"
              aria-label="Clear all filters"
            >
              <FiX className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        {showMore && (
          <div className="hidden md:flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-[var(--border)]">
            {filterOptions.subjects.length > 0 && (
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className={inputCls} aria-label="Subject">
                <option value="">All subjects</option>
                {filterOptions.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {filterOptions.chapters.length > 0 && (
              <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)} className={inputCls} aria-label="Chapter">
                <option value="">All chapters</option>
                {filterOptions.chapters.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {filterOptions.topics.length > 0 && (
              <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className={inputCls} aria-label="Topic">
                <option value="">All topics</option>
                {filterOptions.topics.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {filterOptions.questionBanks?.length > 0 && (
              <select value={qbFilter} onChange={(e) => setQbFilter(e.target.value)} className={inputCls} aria-label="Question bank">
                <option value="">All question banks</option>
                {filterOptions.questionBanks.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            )}
          </div>
        )}

        {mobileFiltersOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-2 gap-2">
            {filterOptions.subjects.length > 0 && (
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className={`${inputCls} w-full`} aria-label="Subject">
                <option value="">All subjects</option>
                {filterOptions.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            {filterOptions.chapters.length > 0 && (
              <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)} className={`${inputCls} w-full`} aria-label="Chapter">
                <option value="">All chapters</option>
                {filterOptions.chapters.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {filterOptions.topics.length > 0 && (
              <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className={`${inputCls} w-full`} aria-label="Topic">
                <option value="">All topics</option>
                {filterOptions.topics.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {filterOptions.questionBanks?.length > 0 && (
              <select value={qbFilter} onChange={(e) => setQbFilter(e.target.value)} className={`${inputCls} w-full`} aria-label="Question bank">
                <option value="">All question banks</option>
                {filterOptions.questionBanks.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            )}
            <select value={satisfiedFilter} onChange={(e) => setSatisfiedFilter(e.target.value)} className={`${inputCls} w-full col-span-2`} aria-label="Feedback">
              <option value="">All feedback</option>
              <option value="true">Satisfied</option>
              <option value="false">Not satisfied</option>
            </select>
          </div>
        )}
      </div>

      {/* ── Split pane ──────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-12 gap-4">
        <div className={`lg:col-span-5 ${selectedId ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-3 mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-strong)]">{reports.length} report{reports.length === 1 ? '' : 's'}</span>
            <span className="text-[11px] text-[var(--text-faint)]">Newest first</span>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary-500" />
            </div>
          )}

          {!loading && reports.length === 0 && (
            <div className="text-center py-16 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
              <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300">
                <FiInbox className="w-6 h-6" />
              </div>
              <h3 className="font-display text-base font-bold text-[var(--text-strong)] mb-1">All clear</h3>
              <p className="text-sm text-[var(--text-faint)]">No reports match the current filter.</p>
            </div>
          )}

          {!loading && reports.length > 0 && (
            <div className="space-y-2.5">
              {reports.map((r) => (
                <ReportListItem key={r._id} report={r} selected={r._id === selectedId} onSelect={setSelectedId} />
              ))}
            </div>
          )}

          {(page > 1 || hasMore) && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-xs text-[var(--text-faint)]">Page {page}</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <FiChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!hasMore}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next <FiChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`lg:col-span-7 ${selectedId ? 'block' : 'hidden lg:block'}`}>
          <ReportDetailPanel
            report={selectedReport}
            currentUserId={currentUserId}
            onAddMessage={handleAddMessage}
            onAssign={handleAssign}
            onClose={handleClose}
            onBack={() => setSelectedId(null)}
          />
        </div>
      </div>
    </div>
  );
};

export default TeacherMCQReportsPage;
