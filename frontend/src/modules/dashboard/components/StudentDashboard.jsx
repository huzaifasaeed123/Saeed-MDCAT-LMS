import React from 'react';
import { Link } from 'react-router-dom';
import {
  FiZap, FiCheckSquare, FiTrendingUp, FiAward, FiClock, FiTarget,
  FiBookOpen, FiMessageCircle, FiLock, FiRefreshCw, FiArrowRight, FiBook,
  FiVideo, FiFolder, FiBarChart2, FiActivity,
} from 'react-icons/fi';
import useAuth from '../../../core/auth/useAuth';
import LatestAnnouncementsWidget from '../../announcements/components/LatestAnnouncementsWidget';

// ── Helpers ─────────────────────────────────────────────────────────────────
const fmtTime = (sec) => {
  if (!sec) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  const diff = Math.floor((Date.now() - dt.getTime()) / 60000);
  if (diff < 1)   return 'just now';
  if (diff < 60)  return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const scoreColor = (pct) => {
  if (pct >= 80) return 'bg-emerald-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-rose-500';
};

// ── KPI tile ─────────────────────────────────────────────────────────────────
const Kpi = ({ Icon, label, value, sub, tone = 'primary' }) => {
  const TONES = {
    primary:   'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300',
    secondary: 'bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300',
    emerald:   'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    amber:     'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
    blue:      'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    rose:      'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
    violet:    'bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300',
  };
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${TONES[tone] || TONES.primary}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-[var(--text-strong)] mt-3 leading-none">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-faint)] mt-2">{label}</p>
      {sub && <p className="text-[10px] text-[var(--text-faint)] mt-0.5">{sub}</p>}
    </div>
  );
};

// ── Recent attempt row ──────────────────────────────────────────────────────
const AttemptRow = ({ a }) => (
  <Link to={`/student/tests/${a.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-muted)] border border-transparent hover:border-[var(--border-faint)] transition-colors">
    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${scoreColor(a.scorePct)}`}>
      {a.scorePct}%
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-bold text-[var(--text-strong)] truncate">{a.title}</p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">
        {a.answeredCount}/{a.totalQuestions} answered · {fmtTime(a.timeSpentSec)} · {fmtDate(a.finishedAt)}
      </p>
    </div>
    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
      a.mode === 'timer'
        ? 'bg-primary-100 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300'
        : 'bg-secondary-100 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300'
    }`}>
      {a.mode}
    </span>
  </Link>
);

// ── Locked-feature pill (small CTA for students missing a feature) ─────────
const LockedPill = ({ label, to }) => (
  <Link to={to} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:hover:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900/60 text-xs font-bold transition-colors">
    <FiLock className="w-3 h-3" /> {label}
  </Link>
);

const StudentDashboard = ({ data, refreshing, onRefresh }) => {
  const { user, hasFeature } = useAuth();
  const d = data || {};
  const tests  = d.testStats  || { total: 0, completed: 0, inProgress: 0, avgScore: 0, timeSpentSec: 0, weekCount: 0, weekAvg: 0 };
  const mcq    = d.mcqStats   || { uniqueMcqs: 0, totalAttempts: 0, correctCount: 0, incorrectCount: 0, accuracy: 0, markedForReview: 0, savedCount: 0, weekTouched: 0 };
  const lb     = d.leaderboard;
  const comm   = d.community  || { points: 0, badge: '', postsCreated: 0, repliesCreated: 0, helpfulReceived: 0 };
  const recent = d.recentAttempts || [];

  return (
    <div className="space-y-5 pb-6">
      {/* ── Hero greeting ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-brand-gradient text-white rounded-2xl">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full" style={{ background: 'radial-gradient(circle, rgba(252,211,77,.35), transparent 70%)' }} />
        <div className="absolute -bottom-24 left-1/3 w-72 h-72 rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,.2), transparent 70%)' }} />

        <div className="relative z-10 px-6 py-6 sm:px-7 sm:py-7 flex flex-wrap items-center gap-5">
          <div className="flex-1 min-w-0">
            <div className="font-mono text-[11px] tracking-[0.18em] uppercase opacity-85">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.025em] mt-1">
              Salam, {user?.fullName?.split(' ')[0] || 'Student'}
            </h1>
            <p className="text-sm opacity-90 mt-1 max-w-xl">
              {tests.completed === 0
                ? 'Ready to start? Take your first practice test to build up your stats.'
                : `${tests.completed} test${tests.completed === 1 ? '' : 's'} completed · ${mcq.correctCount + mcq.incorrectCount} MCQs answered · ${mcq.accuracy}% accuracy.`}
            </p>

            <div className="flex flex-wrap gap-2 mt-4">
              <Link to="/auto-test" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white text-primary-700 text-sm font-bold shadow hover:shadow-md transition-all">
                <FiZap className="w-4 h-4" /> {hasFeature('autoTest') ? 'Create Practice Test' : 'View practice'}
              </Link>
              <Link to="/student/tests" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/15 border border-white/30 text-white text-sm font-bold backdrop-blur hover:bg-white/25 transition-all">
                <FiBarChart2 className="w-4 h-4" /> Test History
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-2 min-w-[140px]">
            {/* Leaderboard rank pill */}
            <div className="bg-white/15 border border-white/30 backdrop-blur rounded-xl px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-85 flex items-center gap-1">
                <FiAward className="w-3 h-3" /> Leaderboard
              </div>
              <div className="text-xl font-extrabold mt-1 leading-tight">
                {lb ? `#${lb.rank}` : '—'}
              </div>
              <div className="text-[10px] opacity-85">
                {lb ? `Top ${lb.percentile}%` : 'Take a test to rank'}
              </div>
            </div>

            {/* Community points / badge */}
            <div className="bg-white/15 border border-white/30 backdrop-blur rounded-xl px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-wider opacity-85 flex items-center gap-1">
                <FiMessageCircle className="w-3 h-3" /> Points
              </div>
              <div className="text-xl font-extrabold mt-1 leading-tight">{comm.points}</div>
              <div className="text-[10px] opacity-85">{comm.badge || 'Newcomer'}</div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi Icon={FiCheckSquare} label="Tests Completed" value={tests.completed}
             sub={tests.inProgress > 0 ? `${tests.inProgress} in progress` : (tests.weekCount > 0 ? `+${tests.weekCount} this week` : null)}
             tone="secondary" />
        <Kpi Icon={FiZap} label="MCQs Solved" value={mcq.correctCount + mcq.incorrectCount}
             sub={mcq.weekTouched > 0 ? `+${mcq.weekTouched} this week` : null}
             tone="primary" />
        <Kpi Icon={FiTarget} label="Accuracy" value={`${mcq.accuracy}%`}
             sub={`${mcq.correctCount} correct · ${mcq.incorrectCount} wrong`}
             tone="emerald" />
        <Kpi Icon={FiClock} label="Time Studied" value={fmtTime(tests.timeSpentSec)}
             sub={`Avg score ${tests.avgScore || 0}%`}
             tone="blue" />
      </div>

      {/* ── Recent tests + side rail ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Recent attempts card */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--text-faint)]">Recent</div>
              <h3 className="text-base font-bold text-[var(--text-strong)] tracking-tight mt-0.5">Latest Test Attempts</h3>
            </div>
            <Link to="/student/tests" className="text-xs font-bold text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200 flex items-center gap-0.5">
              See all <FiArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-[var(--bg-muted)] flex items-center justify-center">
                <FiActivity className="w-6 h-6 text-[var(--text-faint)]" />
              </div>
              <p className="text-sm text-[var(--text-muted)]">No tests taken yet.</p>
              <Link to="/auto-test" className="btn-brand text-xs mt-3">
                <FiZap className="w-3.5 h-3.5" /> Start your first practice test
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recent.map((a) => <AttemptRow key={a.id} a={a} />)}
            </div>
          )}
        </div>

        {/* Side rail */}
        <div className="space-y-4">
          {/* Leaderboard widget */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--text-faint)]">Standing</div>
                <h3 className="text-base font-bold text-[var(--text-strong)] tracking-tight mt-0.5 flex items-center gap-1.5">
                  <FiAward className="text-primary-600 dark:text-primary-300 w-4 h-4" /> Leaderboard
                </h3>
              </div>
              <Link to="/leaderboard" className="text-xs font-bold text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200">Full →</Link>
            </div>

            {lb ? (
              <>
                <div className="text-center py-2">
                  <div className="text-4xl font-extrabold text-brand-gradient">#{lb.rank}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">of {lb.totalRanked} students</div>
                  <div className="mt-2 inline-block px-2.5 py-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-bold rounded-full">
                    Top {lb.percentile}%
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div className="bg-[var(--bg-muted)] rounded-lg p-2 text-center">
                    <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider font-bold">Score</div>
                    <div className="text-sm font-extrabold text-[var(--text-strong)] mt-0.5">{lb.score}</div>
                  </div>
                  <div className="bg-[var(--bg-muted)] rounded-lg p-2 text-center">
                    <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider font-bold">Solved</div>
                    <div className="text-sm font-extrabold text-[var(--text-strong)] mt-0.5">{lb.totalAttempted}</div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-[var(--bg-muted)] flex items-center justify-center">
                  <FiTrendingUp className="w-5 h-5 text-[var(--text-faint)]" />
                </div>
                <p className="text-xs text-[var(--text-muted)]">Complete a test to enter the leaderboard.</p>
              </div>
            )}
          </div>

          {/* Community engagement */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--text-faint)]">Engage</div>
                <h3 className="text-base font-bold text-[var(--text-strong)] tracking-tight mt-0.5">Community</h3>
              </div>
              {hasFeature('community')
                ? <Link to="/community" className="text-xs font-bold text-primary-600 dark:text-primary-300 hover:text-primary-700 dark:hover:text-primary-200">Open →</Link>
                : <LockedPill label="Locked" to="/community" />}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-extrabold text-[var(--text-strong)]">{comm.postsCreated}</div>
                <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider font-bold mt-0.5">Posts</div>
              </div>
              <div>
                <div className="text-lg font-extrabold text-[var(--text-strong)]">{comm.repliesCreated}</div>
                <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider font-bold mt-0.5">Replies</div>
              </div>
              <div>
                <div className="text-lg font-extrabold text-[var(--text-strong)]">{comm.helpfulReceived}</div>
                <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider font-bold mt-0.5">Helpful</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--border-faint)] flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)]">Community points</span>
              <span className="text-sm font-extrabold text-primary-600 dark:text-primary-300">{comm.points} <span className="text-xs text-[var(--text-faint)] font-medium">· {comm.badge || 'Newcomer'}</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MCQ practice insights (full width) ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6">
          <div className="mb-3">
            <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--text-faint)]">Practice</div>
            <h3 className="text-base font-bold text-[var(--text-strong)] tracking-tight mt-0.5">MCQ Practice Insights</h3>
          </div>

          {/* Accuracy bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-bold text-[var(--text)]">Overall accuracy</span>
              <span className="font-extrabold text-[var(--text-strong)]">{mcq.accuracy}%</span>
            </div>
            <div className="h-3 bg-[var(--bg-muted)] rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500" style={{ width: `${pctOf(mcq.correctCount, mcq.correctCount + mcq.incorrectCount)}%` }} />
              <div className="h-full bg-rose-400" style={{ width: `${pctOf(mcq.incorrectCount, mcq.correctCount + mcq.incorrectCount)}%` }} />
            </div>
            <div className="flex gap-4 mt-2 text-[11px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Correct {mcq.correctCount}</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" /> Wrong {mcq.incorrectCount}</span>
              <span className="text-[var(--text-faint)] ml-auto">Unique MCQs touched: {mcq.uniqueMcqs}</span>
            </div>
          </div>

          {/* Quick stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            <MiniStat label="Marked" value={mcq.markedForReview} />
            <MiniStat label="Saved"  value={mcq.savedCount} />
            <MiniStat label="Omitted" value={mcq.omittedCount} />
            <MiniStat label="Attempts" value={mcq.totalAttempts} />
          </div>
        </div>

        {/* Quick access tiles */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6">
          <div className="font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--text-faint)] mb-3">Shortcuts</div>
          <div className="space-y-2">
            <QuickTile to="/student/courses" Icon={FiBook}    label="My Courses"  locked={!hasFeature('courses')} />
            <QuickTile to="/videos"          Icon={FiVideo}   label="Videos"      locked={!hasFeature('videos')} />
            <QuickTile to="/notes"           Icon={FiFolder}  label="Notes"       locked={!hasFeature('notes')} />
            <QuickTile to="/student/mcq-reports" Icon={FiBarChart2} label="My MCQ Reports" />
          </div>
        </div>
      </div>

      {/* ── Announcements (existing widget — keeps working) ─────────────── */}
      <LatestAnnouncementsWidget />
    </div>
  );
};

// Small helpers used in the bottom row
const pctOf = (n, d) => d > 0 ? (n / d) * 100 : 0;

const MiniStat = ({ label, value }) => (
  <div className="bg-[var(--bg-muted)] rounded-lg p-2 text-center">
    <div className="text-lg font-extrabold text-[var(--text-strong)]">{value}</div>
    <div className="text-[10px] text-[var(--text-faint)] uppercase tracking-wider font-bold mt-0.5">{label}</div>
  </div>
);

const QuickTile = ({ to, Icon, label, locked }) => (
  <Link to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
    locked
      ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40 hover:bg-amber-50 dark:hover:bg-amber-950/40'
      : 'border-[var(--border-faint)] hover:bg-[var(--bg-muted)]'
  }`}>
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
      locked
        ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
        : 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300'
    }`}>
      <Icon className="w-4 h-4" />
    </div>
    <span className={`flex-1 text-sm font-bold ${locked ? 'text-[var(--text-muted)]' : 'text-[var(--text-strong)]'}`}>{label}</span>
    {locked
      ? <FiLock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-300" />
      : <FiArrowRight className="w-3.5 h-3.5 text-[var(--text-faint)]" />}
  </Link>
);

export default StudentDashboard;
