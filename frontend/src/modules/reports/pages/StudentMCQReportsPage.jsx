import { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import useAuth from '../../../core/auth/useAuth';
import {
  FiAlertCircle, FiCheckCircle, FiClock, FiFilter,
  FiChevronLeft, FiChevronRight, FiMessageSquare, FiSend,
  FiThumbsUp, FiThumbsDown, FiChevronDown, FiChevronUp,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { fixImageUrls } from '../../../shared/utils/fixImageUrls';

const PAGE_SIZE = 20;

const STATUS_COLORS = {
  open:   'bg-yellow-100 text-yellow-700',
  active: 'bg-blue-100 text-blue-700',
  closed: 'bg-gray-100 text-gray-500',
};

const REASON_COLORS = {
  'Question Statement Wrong': 'bg-red-100 text-red-700',
  'Option Wrong':             'bg-orange-100 text-orange-700',
  'Answer Key is Incorrect':  'bg-purple-100 text-purple-700',
  'Wrong Explanation':        'bg-pink-100 text-pink-700',
  'Need Explanation':         'bg-blue-100 text-blue-700',
};

const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ── Full MCQ Detail View (no edit button for students) ────────────────────────
const MCQFullView = ({ mcq }) => {
  if (!mcq || typeof mcq !== 'object' || !mcq.questionText) {
    return <p className="text-sm text-gray-400 italic py-2">MCQ data unavailable</p>;
  }

  return (
    <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Full Question</p>

      <div
        className="prose prose-sm max-w-none mb-3 text-gray-800"
        dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.questionText) }}
      />

      <div className="space-y-1.5 mb-3">
        {mcq.options?.map(opt => (
          <div
            key={opt._id || opt.optionLetter}
            className={`flex items-start gap-2 p-2 rounded-lg text-sm ${opt.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-100'}`}
          >
            <span className={`font-bold flex-shrink-0 w-5 ${opt.isCorrect ? 'text-green-700' : 'text-gray-500'}`}>{opt.optionLetter}.</span>
            <span
              className={`flex-1 ${opt.isCorrect ? 'text-green-800 font-medium' : 'text-gray-700'}`}
              dangerouslySetInnerHTML={{ __html: fixImageUrls(opt.optionText) }}
            />
            {opt.isCorrect && <span className="text-xs text-green-600 font-bold flex-shrink-0 bg-green-100 px-1.5 py-0.5 rounded">✓ Correct</span>}
          </div>
        ))}
      </div>

      {mcq.explanationText && (
        <div className="mt-2 pt-3 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Explanation</p>
          <div
            className="text-sm text-gray-700 prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: fixImageUrls(mcq.explanationText) }}
          />
        </div>
      )}
    </div>
  );
};

// ── Chat Thread Component ─────────────────────────────────────────────────────
const ChatThread = ({ report, currentUserId, onAddMessage, onClose, onFeedback }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [report.messages?.length]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      await onAddMessage(report._id, text);
      setText('');
    } finally {
      setSending(false);
    }
  };

  const hasTeacherReply = report.messages?.some(m => m.senderRole !== 'student');
  const feedbackGiven   = report.studentSatisfied !== null && report.studentSatisfied !== undefined;

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {/* Messages */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1 mb-3">
        {(!report.messages || report.messages.length === 0) && (
          <p className="text-xs text-gray-400 italic text-center py-2">No responses yet.</p>
        )}
        {report.messages?.map((msg, i) => {
          const isMe = msg.sender?._id === currentUserId || msg.sender === currentUserId;
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${isMe ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {!isMe && (
                  <p className="text-xs font-semibold mb-0.5 text-blue-600">
                    {msg.senderName || msg.sender?.fullName} ({msg.senderRole})
                  </p>
                )}
                <p>{msg.text}</p>
                <p className={`text-xs mt-0.5 ${isMe ? 'text-orange-200' : 'text-gray-400'}`}>
                  {formatDate(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Satisfaction feedback */}
      {hasTeacherReply && !feedbackGiven && report.status !== 'closed' && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-xl">
          <span className="text-xs text-blue-700 font-medium flex-1">Are you satisfied with the response?</span>
          <button
            onClick={() => onFeedback(report._id, true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600"
          >
            <FiThumbsUp className="w-3 h-3" /> Yes
          </button>
          <button
            onClick={() => onFeedback(report._id, false)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-400 text-white text-xs font-bold hover:bg-red-500"
          >
            <FiThumbsDown className="w-3 h-3" /> No
          </button>
        </div>
      )}

      {feedbackGiven && (
        <div className={`flex items-center gap-2 mb-3 px-3 py-1.5 rounded-xl text-xs font-semibold ${report.studentSatisfied ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
          {report.studentSatisfied ? <FiThumbsUp className="w-3 h-3" /> : <FiThumbsDown className="w-3 h-3" />}
          {report.studentSatisfied ? 'You marked this as resolved — satisfied' : 'You marked this as not satisfying'}
        </div>
      )}

      {/* Reply input */}
      {report.status !== 'closed' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={handleSend}
            disabled={sending || !text.trim()}
            className="px-4 py-2 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center gap-1"
          >
            {sending ? <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" /> : <FiSend className="w-4 h-4" />}
          </button>
        </div>
      )}

      {report.status !== 'closed' && (
        <button
          onClick={() => onClose(report._id)}
          className="mt-2 w-full py-1.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50"
        >
          Close Issue
        </button>
      )}
    </div>
  );
};

// ── Report Card ───────────────────────────────────────────────────────────────
const ReportCard = ({ report, currentUserId, onAddMessage, onClose, onFeedback }) => {
  const [expanded, setExpanded] = useState(false);
  const mcq = report.mcq;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${report.status === 'closed' ? 'border-gray-100 opacity-80' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[report.status]}`}>
              {report.status === 'open'   && <FiClock className="w-3 h-3" />}
              {report.status === 'active' && <FiAlertCircle className="w-3 h-3" />}
              {report.status === 'closed' && <FiCheckCircle className="w-3 h-3" />}
              {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REASON_COLORS[report.reason] || 'bg-gray-100 text-gray-600'}`}>
              {report.reason}
            </span>
            {report.mcqSubject     && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full text-xs">{report.mcqSubject}</span>}
            {report.mcqChapter     && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-xs">{report.mcqChapter}</span>}
            {report.mcqTopic       && <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded-full text-xs">{report.mcqTopic}</span>}
            {report.mcqQuestionBank && <span className="px-2 py-0.5 bg-teal-50 text-teal-600 rounded-full text-xs">{report.mcqQuestionBank}</span>}
          </div>

          {!expanded && (
            <div
              className="text-sm text-gray-800 line-clamp-2 mb-1 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: mcq?.questionText ? fixImageUrls(mcq.questionText) : '<em>Click to expand</em>' }}
            />
          )}

          <div className="flex flex-wrap gap-3 text-xs text-gray-400 mt-1">
            <span>{formatDate(report.createdAt)}</span>
            {report.handledBy && (
              <span className="text-blue-500 font-medium">Handled by: {report.handledBy.fullName}</span>
            )}
            {report.messages?.length > 0 && (
              <span className="flex items-center gap-1">
                <FiMessageSquare className="w-3 h-3" /> {report.messages.length} message{report.messages.length !== 1 ? 's' : ''}
              </span>
            )}
            {report.studentSatisfied === true  && <span className="text-green-600 font-semibold flex items-center gap-1"><FiThumbsUp className="w-3 h-3" /> Satisfied</span>}
            {report.studentSatisfied === false && <span className="text-red-500 font-semibold flex items-center gap-1"><FiThumbsDown className="w-3 h-3" /> Not Satisfied</span>}
          </div>

          {report.details && (
            <p className="text-xs text-gray-500 mt-1 italic">"{report.details}"</p>
          )}
        </div>

        <button
          onClick={() => setExpanded(v => !v)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0"
        >
          {expanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <>
          <MCQFullView mcq={mcq} />
          <ChatThread
            report={report}
            currentUserId={currentUserId}
            onAddMessage={onAddMessage}
            onClose={onClose}
            onFeedback={onFeedback}
          />
        </>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const StudentMCQReportsPage = () => {
  const [reports, setReports]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [total, setTotal]             = useState(0);
  const [totalPages, setTotalPages]   = useState(1);
  const [filterOptions, setFilterOptions] = useState({ subjects: [], chapters: [], topics: [], questionBanks: [] });
  const [stats, setStats]             = useState({ open: 0, active: 0, closed: 0, total: 0 });

  const [statusFilter,    setStatusFilter]    = useState('open-active');
  const [subjectFilter,   setSubjectFilter]   = useState('');
  const [chapterFilter,   setChapterFilter]   = useState('');
  const [topicFilter,     setTopicFilter]     = useState('');
  const [qbFilter,        setQbFilter]        = useState('');
  const [satisfiedFilter, setSatisfiedFilter] = useState('');
  const [page, setPage] = useState(1);

  const { user: currentUser } = useAuth();

  const loadReports = async (p = page) => {
    setLoading(true);
    try {
      // Map combined filter to backend param
      const statusParam = statusFilter === 'open-active' ? '' : statusFilter;
      const params = new URLSearchParams({ page: p });
      if (statusParam && statusParam !== 'all') params.append('status',      statusParam);
      if (subjectFilter)   params.append('subject',      subjectFilter);
      if (chapterFilter)   params.append('chapter',      chapterFilter);
      if (topicFilter)     params.append('topic',        topicFilter);
      if (qbFilter)        params.append('questionBank', qbFilter);
      if (satisfiedFilter) params.append('satisfied',    satisfiedFilter);

      const res = await apiClient.get(`/mcq-reports/my?${params}`);
      let data = res.data.data;

      // Client-side filter for "open-active" combined view
      if (statusFilter === 'open-active') {
        data = data.filter(r => r.status !== 'closed');
      }

      setReports(data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setFilterOptions(res.data.filterOptions || { subjects: [], chapters: [], topics: [], questionBanks: [] });

      // Stats come from the same response (backend always computes them)
      if (res.data.stats) setStats(res.data.stats);
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [statusFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, satisfiedFilter]);
  useEffect(() => { loadReports(page); }, [page, statusFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, satisfiedFilter]);

  const handleAddMessage = async (reportId, text) => {
    const res = await apiClient.post(`/mcq-reports/${reportId}/messages`, { text });
    setReports(prev => prev.map(r => r._id === reportId ? res.data.data : r));
  };

  const handleClose = async (reportId) => {
    await apiClient.put(`/mcq-reports/${reportId}/close`);
    toast.success('Issue closed');
    loadReports(page);
  };

  const handleFeedback = async (reportId, satisfied) => {
    const res = await apiClient.put(`/mcq-reports/${reportId}/feedback`, { satisfied });
    setReports(prev => prev.map(r => r._id === reportId ? { ...r, studentSatisfied: res.data.data.studentSatisfied } : r));
    toast.success(satisfied ? 'Marked as satisfied!' : 'Feedback submitted');
  };

  const hasActiveFilters = subjectFilter || chapterFilter || topicFilter || qbFilter || satisfiedFilter || statusFilter !== 'open-active';

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My MCQ Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track issues you have reported. Chat with teachers below each MCQ.</p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',  value: stats.total,  color: 'text-gray-700',   bg: 'bg-gray-50' },
          { label: 'Open',   value: stats.open,   color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Active', value: stats.active, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Closed', value: stats.closed, color: 'text-green-600',  bg: 'bg-green-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex flex-wrap gap-2 items-center">
          <FiFilter className="text-gray-400 w-4 h-4" />

          {[
            { value: 'open-active', label: 'Open & Active' },
            { value: 'open',   label: 'Open' },
            { value: 'active', label: 'Active' },
            { value: 'closed', label: 'Closed' },
            { value: 'all',    label: 'All' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === opt.value ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}

          {filterOptions.subjects.length > 0 && (
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">All Subjects</option>
              {filterOptions.subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {filterOptions.chapters.length > 0 && (
            <select value={chapterFilter} onChange={e => setChapterFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">All Chapters</option>
              {filterOptions.chapters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {filterOptions.topics.length > 0 && (
            <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">All Topics</option>
              {filterOptions.topics.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {filterOptions.questionBanks?.length > 0 && (
            <select value={qbFilter} onChange={e => setQbFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">All Question Banks</option>
              {filterOptions.questionBanks.map(q => <option key={q} value={q}>{q}</option>)}
            </select>
          )}
          <select value={satisfiedFilter} onChange={e => setSatisfiedFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-400">
            <option value="">All Feedback</option>
            <option value="true">Satisfied</option>
            <option value="false">Not Satisfied</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => { setSubjectFilter(''); setChapterFilter(''); setTopicFilter(''); setQbFilter(''); setSatisfiedFilter(''); setStatusFilter('open-active'); }}
              className="px-3 py-1.5 rounded-lg text-xs text-red-500 border border-red-200 hover:bg-red-50"
            >Clear</button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
        </div>
      )}

      {!loading && reports.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🙌</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
          <p className="text-sm text-gray-400">
            {statusFilter === 'open-active'
              ? 'You have no open or active reports. All issues resolved!'
              : 'No reports match the selected filters.'}
          </p>
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {reports.map(report => (
            <ReportCard
              key={report._id}
              report={report}
              currentUserId={currentUser._id || currentUser.id}
              onAddMessage={handleAddMessage}
              onClose={handleClose}
              onFeedback={handleFeedback}
            />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm text-gray-400">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              <FiChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              return p <= totalPages ? (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-9 h-9 rounded-lg text-sm font-medium ${p === page ? 'bg-orange-500 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {p}
                </button>
              ) : null;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentMCQReportsPage;
