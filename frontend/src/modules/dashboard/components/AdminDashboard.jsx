import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiUsers, FiBookOpen, FiFileText, FiCheckSquare, FiDatabase,
  FiActivity, FiMessageCircle, FiFlag, FiTrendingUp, FiRefreshCw,
  FiArrowRight, FiUserPlus, FiAward, FiCalendar, FiMonitor, FiWifi,
} from 'react-icons/fi';
import { HiOutlineSpeakerphone } from 'react-icons/hi';
import useAuth from '../../../core/auth/useAuth';
import LatestAnnouncementsWidget from '../../announcements/components/LatestAnnouncementsWidget';

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const diff = Math.floor((Date.now() - dt.getTime()) / 60000);
  if (diff < 1)   return 'just now';
  if (diff < 60)  return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ROLE_CHIP = {
  admin:   'bg-purple-100 text-purple-700',
  teacher: 'bg-emerald-100 text-emerald-700',
  student: 'bg-blue-100 text-blue-700',
};

const Kpi = ({ Icon, label, value, sub, tone = 'violet', to }) => {
  const TONES = {
    violet:  'bg-purple-50 text-purple-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber:   'bg-amber-50 text-amber-700',
    blue:    'bg-blue-50 text-blue-700',
    rose:    'bg-rose-50 text-rose-700',
  };
  const inner = (
    <>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${TONES[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-extrabold text-gray-900 mt-3 leading-none">{value}</p>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mt-2">{label}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </>
  );
  return to ? (
    <Link to={to} className="bg-white rounded-2xl border border-gray-200 hover:border-primary-200 hover:shadow-sm p-4 transition-all block">
      {inner}
    </Link>
  ) : (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      {inner}
    </div>
  );
};

const SignupRow = ({ u }) => (
  <Link to={`/admin/users/${u.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
    {u.picture ? (
      <img src={u.picture.startsWith('http') ? u.picture : `http://localhost:5000${u.picture}`} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
    ) : (
      <div className="w-9 h-9 rounded-full bg-brand-gradient text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0">
        {u.name?.charAt(0)?.toUpperCase() || '?'}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-900 truncate">{u.name}</p>
      <p className="text-xs text-gray-500 truncate">{u.email}</p>
    </div>
    <div className="flex flex-col items-end gap-1">
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${ROLE_CHIP[u.role]}`}>{u.role}</span>
      <span className="text-[10px] text-gray-400">{fmtDate(u.joinedAt)}</span>
    </div>
  </Link>
);

const TopStudentRow = ({ s }) => (
  <Link to={`/admin/users/${s.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-colors">
    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-extrabold text-xs flex-shrink-0 ${
      s.rank === 1 ? 'bg-yellow-500'
      : s.rank === 2 ? 'bg-gray-400'
      : s.rank === 3 ? 'bg-orange-600'
      : 'bg-gray-300'
    }`}>#{s.rank}</div>
    {s.picture ? (
      <img src={s.picture.startsWith('http') ? s.picture : `http://localhost:5000${s.picture}`} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
    ) : (
      <div className="w-9 h-9 rounded-full bg-brand-gradient text-white text-xs font-extrabold flex items-center justify-center flex-shrink-0">
        {s.name?.charAt(0)?.toUpperCase() || '?'}
      </div>
    )}
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-gray-900 truncate">{s.name}</p>
      <p className="text-xs text-gray-500 truncate">{s.attempted} solved · {s.accuracy}% acc</p>
    </div>
    <span className="text-sm font-extrabold text-primary-700">{s.score}</span>
  </Link>
);

// ─── Main ───────────────────────────────────────────────────────────────────
const AdminDashboard = ({ data, refreshing, onRefresh }) => {
  const { user, activeUsers } = useAuth();
  const d = data || {};
  const p = d.platform || { totalUsers: 0, students: 0, teachers: 0, admins: 0, signupsWeek: 0, signupsMonth: 0 };
  const c = d.content  || { totalCourses: 0, totalTests: 0, totalMcqs: 0, totalQuestionBanks: 0, totalAnnouncements: 0 };
  const a = d.activity || { attemptsToday: 0, attemptsThisWeek: 0, postsThisWeek: 0, conversationsThisWeek: 0, mcqReportsOpen: 0 };
  const top    = d.topStudents   || [];
  const signups = d.recentSignups || [];

  return (
    <div className="space-y-5 pb-6">
      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-brand-gradient text-white rounded-2xl">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(252,211,77,.35), transparent 70%)' }} />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.2), transparent 70%)' }} />

        <div className="relative z-10 px-6 py-6 sm:px-7 sm:py-7 flex flex-wrap items-center gap-5">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-85">Admin Console</div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] mt-1">
              Welcome, {user?.fullName?.split(' ')[0] || 'Admin'} 👋
            </h1>
            <p className="text-sm opacity-90 mt-1 max-w-xl">
              {p.totalUsers} users · {c.totalTests} tests · {a.attemptsToday} attempt{a.attemptsToday === 1 ? '' : 's'} today
              {a.mcqReportsOpen > 0 ? ` · ${a.mcqReportsOpen} open report${a.mcqReportsOpen === 1 ? '' : 's'}` : ''}.
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              <Link to="/admin/users" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-primary-700 text-sm font-bold shadow hover:shadow-md transition-all">
                <FiUsers className="w-4 h-4" /> Users
              </Link>
              <Link to="/admin/courses" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/15 border border-white/30 text-white text-sm font-bold backdrop-blur hover:bg-white/25 transition-all">
                <FiBookOpen className="w-4 h-4" /> Courses
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

      {/* ── Live presence ─────────────────────────────────────────────────
          Two KPI cards driven by SSE 'active_users' broadcasts from
          sseManager.broadcastActiveCount(). Updates within ~1.5s of any
          connect/disconnect. `activeUsers` is null until the first frame
          arrives — we render the same skeleton placeholder as the other
          KPIs for visual consistency. */}
      <div>
        <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400 mb-2 flex items-center gap-2">
          <span className="relative inline-flex w-2 h-2">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${activeUsers ? 'bg-emerald-400 animate-ping' : 'bg-gray-300'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${activeUsers ? 'bg-emerald-500' : 'bg-gray-400'}`} />
          </span>
          Live now
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi
            Icon={FiWifi}
            label="Active Users"
            value={activeUsers ? activeUsers.users : '—'}
            sub={activeUsers ? 'connected right now' : 'syncing…'}
            tone="emerald"
          />
          <Kpi
            Icon={FiMonitor}
            label="Open Tabs"
            value={activeUsers ? activeUsers.connections : '—'}
            sub={activeUsers ? `${activeUsers.connections === activeUsers.users ? 'one per user' : 'across all users'}` : 'syncing…'}
            tone="blue"
          />
        </div>
      </div>

      {/* ── Platform KPIs ──────────────────────────────────────────────── */}
      <div>
        <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400 mb-2">People</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi Icon={FiUsers}     label="Total Users"    value={p.totalUsers}
               sub={`+${p.signupsWeek} this week`} tone="violet" to="/admin/users" />
          <Kpi Icon={FiUsers}     label="Students"       value={p.students}
               sub={`${pctOf(p.students, p.totalUsers)}% of total`} tone="blue" />
          <Kpi Icon={FiUsers}     label="Teachers"       value={p.teachers}  tone="emerald" />
          <Kpi Icon={FiUserPlus}  label="New This Month" value={p.signupsMonth} sub={`+${p.signupsWeek} this week`} tone="amber" />
        </div>
      </div>

      <div>
        <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400 mb-2">Content</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi Icon={FiBookOpen}    label="Courses"        value={c.totalCourses}       tone="violet"  to="/admin/courses" />
          <Kpi Icon={FiFileText}    label="Tests"          value={c.totalTests}         tone="blue"    to="/tests" />
          <Kpi Icon={FiCheckSquare} label="MCQs"           value={c.totalMcqs.toLocaleString()}      tone="amber" />
          <Kpi Icon={FiDatabase}    label="Question Banks" value={c.totalQuestionBanks} tone="emerald" to="/admin/question-banks" />
        </div>
      </div>

      <div>
        <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400 mb-2">Activity (7 days)</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi Icon={FiActivity}      label="Attempts Today"  value={a.attemptsToday}
               sub={`${a.attemptsThisWeek} this week`} tone="emerald" />
          <Kpi Icon={FiTrendingUp}    label="Test Attempts"   value={a.attemptsThisWeek}   tone="violet" />
          <Kpi Icon={FiMessageCircle} label="Posts This Week" value={a.postsThisWeek}      tone="blue"   to="/community" />
          <Kpi Icon={FiFlag}          label="Open Reports"    value={a.mcqReportsOpen}     tone="rose"   to="/admin/mcq-reports" />
        </div>
      </div>

      {/* ── Top students + recent signups ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top performers */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Top performers</div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight mt-0.5 flex items-center gap-1.5">
                <FiAward className="text-primary-600 w-4 h-4" /> Leaderboard · All-time
              </h3>
            </div>
            <Link to="/leaderboard" className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-0.5">
              Full <FiArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {top.length === 0 ? (
            <div className="text-center py-8">
              <FiAward className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Leaderboard hasn't been computed yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {top.map((s) => <TopStudentRow key={s.id} s={s} />)}
            </div>
          )}
        </div>

        {/* Recent signups */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-gray-400">Joins</div>
              <h3 className="text-base font-bold text-gray-900 tracking-tight mt-0.5 flex items-center gap-1.5">
                <FiUserPlus className="text-emerald-600 w-4 h-4" /> Recent Signups
              </h3>
            </div>
            <Link to="/admin/users" className="text-xs font-bold text-primary-700 hover:text-primary-800 flex items-center gap-0.5">
              All <FiArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {signups.length === 0 ? (
            <div className="text-center py-8">
              <FiUserPlus className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No signups yet.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {signups.map((u) => <SignupRow key={u.id} u={u} />)}
            </div>
          )}
        </div>
      </div>

      {/* ── Announcements (existing widget) ────────────────────────────── */}
      <LatestAnnouncementsWidget />
    </div>
  );
};

const pctOf = (n, d) => d > 0 ? Math.round((n / d) * 100) : 0;

export default AdminDashboard;
