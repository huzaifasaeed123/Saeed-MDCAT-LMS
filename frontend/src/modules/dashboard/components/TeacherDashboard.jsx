import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiFileText, FiCheckSquare, FiFlag, FiUsers, FiMessageCircle,
  FiRefreshCw, FiArrowRight, FiAlertCircle, FiPlusCircle, FiActivity, FiBookOpen,
} from 'react-icons/fi';
import { HiOutlineSpeakerphone } from 'react-icons/hi';
import useAuth from '../../../core/auth/useAuth';
import LatestAnnouncementsWidget from '../../announcements/components/LatestAnnouncementsWidget';

// ─── Small components ───────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const diff = Math.floor((Date.now() - dt.getTime()) / 60000);
  if (diff < 1)   return 'just now';
  if (diff < 60)  return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const Kpi = ({ Icon, label, value, sub, tone = 'violet' }) => {
  const TONES = {
    violet:  'bg-purple-50 text-purple-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    blue:    'bg-blue-50 text-blue-700',
    rose:    'bg-rose-50 text-rose-700',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${TONES[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-extrabold text-gray-900 mt-3 leading-none">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-2">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
};

const TestRow = ({ t }) => (
  <Link to={`/tests/${t.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
    <div className="w-9 h-9 rounded-lg bg-brand-gradient-soft text-primary-700 flex items-center justify-center flex-shrink-0">
      <FiFileText className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-900 truncate">{t.title}</p>
      <p className="text-xs text-gray-500 mt-0.5">
        {t.totalQuestions} MCQ{t.totalQuestions !== 1 ? 's' : ''} · {fmtDate(t.createdAt)}
      </p>
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
      t.status === 'published' ? 'bg-emerald-100 text-emerald-700'
      : t.status === 'archived' ? 'bg-gray-200 text-gray-500'
      : 'bg-amber-100 text-amber-700'
    }`}>
      {t.status || 'draft'}
    </span>
  </Link>
);

const ReportRow = ({ r }) => (
  <Link to="/teacher/mcq-reports" className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
    <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
      <FiFlag className="w-4 h-4" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-900 truncate">{r.reason || 'MCQ reported'}</p>
      <p className="text-xs text-gray-500 mt-0.5 truncate">
        {r.questionPreview ? `"${r.questionPreview}…"` : 'No preview'}
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5">By {r.reporter} · {fmtDate(r.createdAt)}</p>
    </div>
  </Link>
);

// ─── Main ───────────────────────────────────────────────────────────────────
const TeacherDashboard = ({ data, refreshing, onRefresh }) => {
  const { user } = useAuth();
  const d = data || {};
  const t = d.teaching          || { testsCreated: 0, mcqsCreated: 0, reportsOpen: 0, reportsHandledByMe: 0, answersMarked: 0 };
  const e = d.studentEngagement || { weekAttempts: 0, weekStudents: 0 };
  const c = d.community         || { points: 0, badge: '', postsCreated: 0, repliesCreated: 0 };
  const recentTests   = d.recentTests   || [];
  const recentReports = d.recentReports || [];

  return (
    <div className="space-y-5 pb-6">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-brand-gradient text-white rounded-2xl">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(252,211,77,.35), transparent 70%)' }} />

        <div className="relative z-10 px-6 py-6 sm:px-7 sm:py-7 flex flex-wrap items-center gap-5">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-85">Teacher</div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] mt-1">
              Welcome back, {user?.fullName?.split(' ')[0] || 'Teacher'} 👋
            </h1>
            <p className="text-sm opacity-90 mt-1 max-w-xl">
              {t.reportsOpen > 0
                ? `${t.reportsOpen} MCQ report${t.reportsOpen === 1 ? '' : 's'} need${t.reportsOpen === 1 ? 's' : ''} your review.`
                : `${e.weekAttempts} student attempt${e.weekAttempts === 1 ? '' : 's'} on your tests this week.`}
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              <Link to="/tests/create" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-primary-700 text-sm font-bold shadow hover:shadow-md transition-all">
                <FiPlusCircle className="w-4 h-4" /> New Test
              </Link>
              <Link to="/teacher/mcq-reports" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/15 border border-white/30 text-white text-sm font-bold backdrop-blur hover:bg-white/25 transition-all">
                <FiFlag className="w-4 h-4" /> Review Reports {t.reportsOpen > 0 && <span className="ml-1 px-1.5 py-0.5 bg-rose-500 rounded-full text-[10px] font-extrabold">{t.reportsOpen}</span>}
              </Link>
              <Link to="/admin/announcements" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/15 border border-white/30 text-white text-sm font-bold backdrop-blur hover:bg-white/25 transition-all">
                <HiOutlineSpeakerphone className="w-4 h-4" /> Announce
              </Link>
            </div>
          </div>

          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh dashboard"
            className="absolute top-4 right-4 z-20 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/15 border border-white/30 hover:bg-white/25 backdrop-blur disabled:opacity-50"
          >
            <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPI strip ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi Icon={FiFileText}     label="Tests Created"     value={t.testsCreated} tone="violet" />
        <Kpi Icon={FiCheckSquare}  label="MCQs Authored"     value={t.mcqsCreated}  tone="amber" />
        <Kpi Icon={FiFlag}         label="Reports Open"      value={t.reportsOpen}  sub={`${t.reportsHandledByMe} handled by me`} tone="rose" />
        <Kpi Icon={FiUsers}        label="Active Students (7d)" value={e.weekStudents} sub={`${e.weekAttempts} attempts`} tone="emerald" />
      </div>

      {/* ── Recent tests + reports ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* My recent tests */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Authored</div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight mt-0.5">My Recent Tests</h3>
            </div>
            <Link to="/tests" className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-0.5">
              All tests <FiArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentTests.length === 0 ? (
            <div className="text-center py-8">
              <FiFileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">You haven't created any tests yet.</p>
              <Link to="/tests/create" className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg bg-brand-gradient-soft text-primary-700 text-xs font-bold">
                <FiPlusCircle className="w-3.5 h-3.5" /> Create your first test
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentTests.map((t) => <TestRow key={t.id} t={t} />)}
            </div>
          )}
        </div>

        {/* Open MCQ reports */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Queue</div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight mt-0.5 flex items-center gap-1.5">
                <FiAlertCircle className="text-rose-500 w-4 h-4" /> Open Reports
              </h3>
            </div>
            <Link to="/teacher/mcq-reports" className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-0.5">
              All <FiArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recentReports.length === 0 ? (
            <div className="text-center py-8">
              <FiActivity className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No open reports — nothing to review.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentReports.map((r) => <ReportRow key={r.id} r={r} />)}
            </div>
          )}
        </div>
      </div>

      {/* ── Community engagement + announcements ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Engage</div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight mt-0.5 flex items-center gap-1.5">
                <FiMessageCircle className="text-primary-600 w-4 h-4" /> Community
              </h3>
            </div>
            <Link to="/community" className="text-xs font-bold text-primary-700 hover:text-primary-800">Open →</Link>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-2xl font-extrabold text-gray-900">{c.postsCreated}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-0.5">Posts</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-gray-900">{c.repliesCreated}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-0.5">Replies</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-gray-900">{t.answersMarked}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-0.5">Best Answers</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">Community points</span>
            <span className="text-sm font-extrabold text-primary-700">{c.points} <span className="text-xs text-gray-400 font-medium">· {c.badge || 'Newcomer'}</span></span>
          </div>
        </div>

        <LatestAnnouncementsWidget />
      </div>
    </div>
  );
};

export default TeacherDashboard;
