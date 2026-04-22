import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import useAuth from '../../../core/auth/useAuth';
import {
  FiAlertCircle, FiCheckCircle, FiClock, FiFilter,
  FiChevronLeft, FiChevronRight, FiMessageSquare, FiSend,
  FiThumbsUp, FiThumbsDown, FiChevronDown, FiChevronUp,
  FiUsers, FiBarChart2, FiActivity, FiInbox, FiUserCheck, FiAward, FiEdit,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { fixImageUrls } from '../../../shared/utils/fixImageUrls';

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

const buildEditUrl = (report) => {
  const mcq = report.mcq;
  if (!mcq || !mcq._id) return null;
  if (mcq.questionBankId) return `/admin/question-banks/${mcq.questionBankId}/mcqs/${mcq._id}/edit`;
  if (mcq.testId) return `/tests/${mcq.testId}/mcqs/${mcq._id}/edit`;
  if (report.test) return `/tests/${report.test}/mcqs/${mcq._id}/edit`;
  return null;
};

// ── Full MCQ Detail View ──────────────────────────────────────────────────────
const MCQFullView = ({ report }) => {
  const mcq = report.mcq;
  const editUrl = buildEditUrl(report);

  if (!mcq || typeof mcq !== 'object' || !mcq.questionText) {
    return <p className="text-sm text-gray-400 italic py-2">MCQ data unavailable</p>;
  }

  return (
    <div className="mt-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Full Question</p>
        {editUrl && (
          <Link
            to={editUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-500 rounded-lg hover:bg-indigo-600 flex-shrink-0"
          >
            <FiEdit className="w-3 h-3" /> Edit MCQ
          </Link>
        )}
      </div>

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

// ── Chat Thread ───────────────────────────────────────────────────────────────
const ChatThread = ({ report, currentUserId, onAddMessage, onAssign, onClose }) => {
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
    <div className="mt-3 border-t border-gray-100 pt-3">
      {report.status === 'open' && (
        <button onClick={() => onAssign(report._id)}
          className="mb-3 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700">
          <FiUserCheck className="w-4 h-4" /> Assign to Me
        </button>
      )}

      {report.studentSatisfied === true && (
        <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-green-50 text-green-700 rounded-xl text-xs font-semibold">
          <FiThumbsUp className="w-3 h-3" /> Student is satisfied
        </div>
      )}
      {report.studentSatisfied === false && (
        <div className="flex items-center gap-2 mb-3 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-semibold">
          <FiThumbsDown className="w-3 h-3" /> Student is not satisfied
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1 mb-3">
        {(!report.messages || report.messages.length === 0) && (
          <p className="text-xs text-gray-400 italic text-center py-2">No messages yet.</p>
        )}
        {report.messages?.map((msg, i) => {
          const isMe = msg.sender?._id === currentUserId || msg.sender === currentUserId;
          const isStudent = msg.senderRole === 'student';
          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                isMe ? 'bg-purple-600 text-white' : isStudent ? 'bg-orange-50 border border-orange-200 text-gray-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {!isMe && (
                  <p className={`text-xs font-semibold mb-0.5 ${isStudent ? 'text-orange-600' : 'text-blue-600'}`}>
                    {msg.senderName || msg.sender?.fullName} ({msg.senderRole})
                  </p>
                )}
                <p>{msg.text}</p>
                <p className={`text-xs mt-0.5 ${isMe ? 'text-purple-200' : 'text-gray-400'}`}>{formatDate(msg.createdAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {report.status !== 'closed' && (
        <div className="flex gap-2">
          <input type="text" value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="Type your response..."
            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400" />
          <button onClick={handleSend} disabled={sending || !text.trim()}
            className="px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1">
            {sending ? <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-white" /> : <FiSend className="w-4 h-4" />}
          </button>
        </div>
      )}
      {report.status !== 'closed' && (
        <button onClick={() => onClose(report._id)}
          className="mt-2 w-full py-1.5 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium hover:bg-gray-50">
          Close Issue
        </button>
      )}
    </div>
  );
};

// ── Report Card ───────────────────────────────────────────────────────────────
const ReportCard = ({ report, currentUserId, onAddMessage, onAssign, onClose }) => {
  const [expanded, setExpanded] = useState(false);
  const mcq = report.mcq;

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${
      report.status === 'closed' ? 'border-gray-100 opacity-75' :
      report.status === 'open'   ? 'border-yellow-200' : 'border-blue-200'
    }`}>
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
            {mcq?.difficulty && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                mcq.difficulty === 'Easy' ? 'bg-green-50 text-green-600' :
                mcq.difficulty === 'Hard' ? 'bg-red-50 text-red-600' : 'bg-yellow-50 text-yellow-600'
              }`}>{mcq.difficulty}</span>
            )}
          </div>

          {!expanded && (
            <div
              className="text-sm text-gray-800 line-clamp-2 mb-2 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: mcq?.questionText ? fixImageUrls(mcq.questionText) : '<em>Click to expand</em>' }}
            />
          )}

          <div className="flex flex-wrap gap-3 text-xs text-gray-400">
            <span>By: <strong className="text-gray-700">{report.reportedBy?.fullName}</strong> ({report.reportedBy?.role})</span>
            <span>{formatDate(report.createdAt)}</span>
            {report.handledBy ? (
              <span className="text-blue-500 font-medium">Handled by: {report.handledBy.fullName}</span>
            ) : (
              <span className="text-yellow-600 font-medium">Unassigned</span>
            )}
            {report.messages?.length > 0 && (
              <span className="flex items-center gap-1"><FiMessageSquare className="w-3 h-3" /> {report.messages.length}</span>
            )}
            {report.studentSatisfied === true  && <span className="text-green-600 flex items-center gap-1"><FiThumbsUp className="w-3 h-3" /> Satisfied</span>}
            {report.studentSatisfied === false  && <span className="text-red-500 flex items-center gap-1"><FiThumbsDown className="w-3 h-3" /> Not Satisfied</span>}
          </div>
          {report.details && <p className="text-xs text-gray-500 mt-1 italic">"{report.details}"</p>}
        </div>
        <button onClick={() => setExpanded(v => !v)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 flex-shrink-0">
          {expanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <>
          <MCQFullView report={report} />
          <ChatThread report={report} currentUserId={currentUserId}
            onAddMessage={onAddMessage} onAssign={onAssign} onClose={onClose} />
        </>
      )}
    </div>
  );
};

// ── Teacher Stats Table ────────────────────────────────────────────────────────
const TeacherStatsTable = ({ stats }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
    <div className="p-4 border-b border-gray-100">
      <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
        <FiUsers className="w-5 h-5 text-purple-600" /> Staff Performance Summary
      </h2>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Name', 'Role', 'Total Handled', 'Active', 'Closed', 'Satisfied', 'Not Satisfied', 'Last Activity'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {stats.length === 0 && (
            <tr><td colSpan={8} className="text-center py-6 text-gray-400 text-sm">No staff activity yet.</td></tr>
          )}
          {stats.map(s => (
            <tr key={s._id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {s.role}
                </span>
              </td>
              <td className="px-4 py-3 font-bold text-gray-800">{s.totalHandled}</td>
              <td className="px-4 py-3 text-blue-600 font-semibold">{s.active}</td>
              <td className="px-4 py-3 text-green-600 font-semibold">{s.closed}</td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1 text-green-600 font-semibold">
                  <FiThumbsUp className="w-3 h-3" /> {s.satisfied}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1 text-red-500 font-semibold">
                  <FiThumbsDown className="w-3 h-3" /> {s.notSatisfied}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-400 text-xs">
                {s.lastActivity ? formatDate(s.lastActivity) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────
const AdminMCQReportsPage = () => {
  const [reports, setReports]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [total, setTotal]                 = useState(0);
  const [totalPages, setTotalPages]       = useState(1);
  const [filterOptions, setFilterOptions] = useState({ subjects: [], chapters: [], topics: [], questionBanks: [] });
  const [summary, setSummary]             = useState({ total: 0, open: 0, active: 0, closed: 0, todayNew: 0, satisfied: 0, notSatisfied: 0 });
  const [teacherStats, setTeacherStats]   = useState([]);

  const [statusFilter,    setStatusFilter]    = useState('all');
  const [subjectFilter,   setSubjectFilter]   = useState('');
  const [chapterFilter,   setChapterFilter]   = useState('');
  const [topicFilter,     setTopicFilter]     = useState('');
  const [qbFilter,        setQbFilter]        = useState('');
  const [satisfiedFilter, setSatisfiedFilter] = useState('');
  const [activeTab, setActiveTab]             = useState('reports');
  const [page, setPage] = useState(1);

  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?._id || currentUser?.id;

  const loadMeta = async () => {
    try {
      const [summaryRes, statsRes] = await Promise.all([
        apiClient.get('/mcq-reports/admin/summary'),
        apiClient.get('/mcq-reports/admin/teacher-stats'),
      ]);
      setSummary(summaryRes.data.data);
      setTeacherStats(statsRes.data.data);
    } catch { /* non-critical */ }
  };

  const loadReports = async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: p });
      if (statusFilter && statusFilter !== 'all') params.append('status',      statusFilter);
      if (subjectFilter)   params.append('subject',      subjectFilter);
      if (chapterFilter)   params.append('chapter',      chapterFilter);
      if (topicFilter)     params.append('topic',        topicFilter);
      if (qbFilter)        params.append('questionBank', qbFilter);
      if (satisfiedFilter) params.append('satisfied',    satisfiedFilter);

      const res = await apiClient.get(`/mcq-reports?${params}`);
      setReports(res.data.data);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
      setFilterOptions(res.data.filterOptions || { subjects: [], chapters: [], topics: [], questionBanks: [] });
    } catch {
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { setPage(1); }, [statusFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, satisfiedFilter]);
  useEffect(() => { if (activeTab === 'reports') loadReports(page); }, [page, statusFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, satisfiedFilter, activeTab]);

  const handleAddMessage = async (reportId, text) => {
    const res = await apiClient.post(`/mcq-reports/${reportId}/messages`, { text });
    setReports(prev => prev.map(r => r._id === reportId ? res.data.data : r));
    loadMeta();
  };

  const handleAssign = async (reportId) => {
    try {
      const res = await apiClient.put(`/mcq-reports/${reportId}/assign`);
      toast.success('Report assigned to you');
      setReports(prev => prev.map(r => r._id === reportId ? res.data.data : r));
      loadMeta();
    } catch {
      toast.error('Failed to assign report');
    }
  };

  const handleClose = async (reportId) => {
    await apiClient.put(`/mcq-reports/${reportId}/close`);
    toast.success('Issue closed');
    loadReports(page);
    loadMeta();
  };

  const hasActiveFilters = subjectFilter || chapterFilter || topicFilter || qbFilter || satisfiedFilter || statusFilter !== 'all';

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">MCQ Reports — Admin</h1>
        <p className="text-sm text-gray-500 mt-0.5">Full oversight of all student-reported MCQ issues across the platform.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { label: 'Total',         value: summary.total,        color: 'text-gray-700',    bg: 'bg-gray-50',    icon: <FiBarChart2 /> },
          { label: 'New Today',     value: summary.todayNew,     color: 'text-red-600',     bg: 'bg-red-50',     icon: <FiInbox /> },
          { label: 'Open',          value: summary.open,         color: 'text-yellow-600',  bg: 'bg-yellow-50',  icon: <FiClock /> },
          { label: 'Active',        value: summary.active,       color: 'text-blue-600',    bg: 'bg-blue-50',    icon: <FiActivity /> },
          { label: 'Closed',        value: summary.closed,       color: 'text-green-600',   bg: 'bg-green-50',   icon: <FiCheckCircle /> },
          { label: 'Satisfied',     value: summary.satisfied,    color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <FiThumbsUp /> },
          { label: 'Not Satisfied', value: summary.notSatisfied, color: 'text-red-500',     bg: 'bg-red-50',     icon: <FiThumbsDown /> },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-3 text-center`}>
            <div className={`text-lg mb-0.5 flex justify-center ${s.color}`}>{s.icon}</div>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'reports' ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >All Reports</button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${activeTab === 'staff' ? 'bg-purple-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
        >Staff Performance</button>
      </div>

      {activeTab === 'staff' && <TeacherStatsTable stats={teacherStats} />}

      {activeTab === 'reports' && (
        <>
          {/* Filters */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
            <div className="flex flex-wrap gap-2 items-center">
              <FiFilter className="text-gray-400 w-4 h-4" />
              {['all', 'open', 'active', 'closed'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    statusFilter === s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}

              {filterOptions.subjects.length > 0 && (
                <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <option value="">All Subjects</option>
                  {filterOptions.subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {filterOptions.chapters.length > 0 && (
                <select value={chapterFilter} onChange={e => setChapterFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <option value="">All Chapters</option>
                  {filterOptions.chapters.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {filterOptions.topics.length > 0 && (
                <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <option value="">All Topics</option>
                  {filterOptions.topics.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
              {filterOptions.questionBanks?.length > 0 && (
                <select value={qbFilter} onChange={e => setQbFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <option value="">All Question Banks</option>
                  {filterOptions.questionBanks.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
              )}
              <select value={satisfiedFilter} onChange={e => setSatisfiedFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-400">
                <option value="">All Feedback</option>
                <option value="true">Satisfied</option>
                <option value="false">Not Satisfied</option>
              </select>

              {hasActiveFilters && (
                <button onClick={() => { setSubjectFilter(''); setChapterFilter(''); setTopicFilter(''); setQbFilter(''); setSatisfiedFilter(''); setStatusFilter('all'); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-red-500 border border-red-200 hover:bg-red-50">Clear</button>
              )}
              <span className="ml-auto text-xs text-gray-400">{total} result{total !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {loading && <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" /></div>}

          {!loading && reports.length === 0 && (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📭</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No reports found</h3>
            </div>
          )}

          {!loading && (
            <div className="space-y-3">
              {reports.map(report => (
                <ReportCard key={report._id} report={report} currentUserId={currentUserId}
                  onAddMessage={handleAddMessage} onAssign={handleAssign} onClose={handleClose} />
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
                      className={`w-9 h-9 rounded-lg text-sm font-medium ${p === page ? 'bg-purple-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
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
        </>
      )}
    </div>
  );
};

export default AdminMCQReportsPage;
