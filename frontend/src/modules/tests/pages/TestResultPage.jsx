// src/modules/tests/pages/TestResultPage.jsx
//
// SKN Academy LMS — Test Result page.
//
// Two tabs:
//   • Overview — hero, subject/topic/chapter breakdowns, difficulty &
//     class-score distribution.
//   • Leaderboard — top scorers + podium + your-rank tile (hidden when the
//     test was created by the current user).
//
// Data sources (2 parallel calls — no waterfall):
//   • GET /user-tests/:attemptId             — attempt + populated MCQs
//   • GET /user-tests/:attemptId/analytics   — cohort: top N, my rank,
//     percentile, median, histogram (single $facet aggregation)
//
// Export PDF uses window.print() + an inline @media print stylesheet that
// hides the sidebar, top bar, tabs, and action buttons so the printable
// view is just the result content. Zero external libraries.
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiCheckCircle, FiBarChart2, FiDownload, FiEye, FiZap,
  FiAward, FiTrendingUp,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';
import useAuth from '../../../core/auth/useAuth';
import { fixImageUrl } from '../../../shared/utils/fixImageUrls';

// ── Helpers ─────────────────────────────────────────────────────────────────
const formatTime = (seconds) => {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m}m`;
  return `${m}m ${s}s`;
};
const formatHM = (seconds) => {
  if (!seconds && seconds !== 0) return '—';
  const m = Math.round(seconds / 60);
  return `${m}m`;
};
const formatTimeOfDay = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};

// ── Score donut — slightly smaller default than before so the hero row
// doesn't dominate vertical space when stacked with KPI tiles. ─────────────
const ScoreDonut = ({ pct, size = 112, strokeWidth = 12, color = '#22c55e', label }) => {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const safe = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const dash = (safe / 100) * c;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                className="stroke-[var(--bg-muted)]" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
                strokeDasharray={`${dash} ${c}`}
                style={{ transition: 'stroke-dasharray 0.8s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[22px] font-extrabold leading-none" style={{ color }}>
          {safe}%
        </span>
        {label && (
          <span className="text-[10px] text-[var(--text-faint)] mt-0.5">{label}</span>
        )}
      </div>
    </div>
  );
};

// ── Hero KPI tile (smaller padding, smaller value type) ────────────────────
const HeroKpi = ({ label, value, sub, valueCls }) => (
  <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] p-2.5 min-w-[90px]">
    <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-faint)]">{label}</p>
    <p className={`font-display text-[22px] font-extrabold leading-none mt-1 ${valueCls || 'text-[var(--text-strong)]'}`}>{value}</p>
    {sub && <p className="text-[10px] text-[var(--text-faint)] mt-0.5">{sub}</p>}
  </div>
);

// ── Horizontal bar row used by difficulty / chapter cards ──────────────────
const BarRow = ({ label, count, total, accent = 'emerald' }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const ACCENT = {
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300' },
    amber:   { bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-300' },
    rose:    { bar: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-300' },
    primary: { bar: 'bg-primary-500', text: 'text-primary-600 dark:text-primary-300' },
    violet:  { bar: 'bg-secondary-600', text: 'text-secondary-600 dark:text-secondary-300' },
  }[accent] || { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300' };
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--text-strong)] flex-shrink-0 w-24 sm:w-28">
        <span className={`w-1.5 h-1.5 rounded-full ${ACCENT.bar}`} />
        {label}
      </span>
      <div className="flex-1 h-2.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-[width] duration-700 ${ACCENT.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-[var(--text-muted)] tabular-nums">{count}/{total}</span>
        <span className={`text-sm font-bold tabular-nums w-11 text-right ${ACCENT.text}`}>{pct}%</span>
      </div>
    </div>
  );
};

// ── Subject row — colored letter avatar + accuracy bar ─────────────────────
const SubjectRow = ({ name, count, total, palette }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const accent = pct >= 80 ? 'emerald' : pct >= 60 ? 'primary' : 'rose';
  const ACCENT = {
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300' },
    primary: { bar: 'bg-primary-500', text: 'text-primary-600 dark:text-primary-300' },
    rose:    { bar: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-300' },
  }[accent];
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${palette.bg} ${palette.text}`}>
          {name[0]?.toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[var(--text-strong)] text-sm truncate">{name}</p>
          <p className="text-[11px] text-[var(--text-muted)]">{count} / {total} correct</p>
        </div>
        <p className={`font-display text-xl font-extrabold ${ACCENT.text} tabular-nums`}>{pct}%</p>
      </div>
      <div className="h-2 bg-[var(--bg-muted)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-[width] duration-700 ${ACCENT.bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ── Topic row — segmented (one segment per question) ───────────────────────
const TopicRow = ({ name, count, total }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const accent = pct >= 80 ? 'emerald' : pct >= 60 ? 'primary' : 'rose';
  const ACCENT = {
    emerald: { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300' },
    primary: { bar: 'bg-primary-500', text: 'text-primary-600 dark:text-primary-300' },
    rose:    { bar: 'bg-rose-500',    text: 'text-rose-600 dark:text-rose-300' },
  }[accent];
  const segments = Array.from({ length: total }, (_, i) => i < count);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm text-[var(--text-strong)] truncate flex-1 min-w-0">{name}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-[var(--text-muted)] tabular-nums">{count}/{total}</span>
          <span className={`text-sm font-bold tabular-nums ${ACCENT.text}`}>{pct}%</span>
        </div>
      </div>
      <div className="flex gap-0.5">
        {segments.map((on, i) => (
          <div key={i} className={`h-2 flex-1 rounded-sm ${on ? ACCENT.bar : 'bg-[var(--bg-muted)]'}`} />
        ))}
      </div>
    </div>
  );
};

// ── Section card shell — tighter padding than before ───────────────────────
const Section = ({ title, subtitle, right, children, className = '' }) => (
  <section className={`bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 ${className}`}>
    {(title || right) && (
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="min-w-0">
          {title && <h3 className="font-display text-[15px] font-bold text-[var(--text-strong)] leading-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    )}
    {children}
  </section>
);

const TAG = (text, tone = 'muted') => {
  const TONES = {
    muted:    'bg-[var(--bg-muted)] text-[var(--text-muted)]',
    emerald:  'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
    primary:  'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300',
    violet:   'bg-secondary-50 dark:bg-secondary-950/40 text-secondary-700 dark:text-secondary-300',
    rose:     'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${TONES[tone]}`}>
      {text}
    </span>
  );
};

const SUBJECT_PALETTES = [
  { bg: 'bg-secondary-100 dark:bg-secondary-950/40', text: 'text-secondary-700 dark:text-secondary-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-950/40',      text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-primary-100 dark:bg-primary-950/40',      text: 'text-primary-700 dark:text-primary-300' },
  { bg: 'bg-blue-100 dark:bg-blue-950/40',            text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-rose-100 dark:bg-rose-950/40',            text: 'text-rose-700 dark:text-rose-300' },
];

// ── Helpers used by the Leaderboard view ────────────────────────────────────
// Two-letter initials from "Mahnoor Siddiqui" → "MS".
const initialsOf = (name) => {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

// Deterministic palette per name — so each avatar in the leaderboard gets a
// consistent color across renders (using a simple hash on the name).
const AVATAR_PALETTES = [
  { bg: 'bg-secondary-100 dark:bg-secondary-950/40', text: 'text-secondary-700 dark:text-secondary-300' },
  { bg: 'bg-emerald-100 dark:bg-emerald-950/40',      text: 'text-emerald-700 dark:text-emerald-300' },
  { bg: 'bg-primary-100 dark:bg-primary-950/40',      text: 'text-primary-700 dark:text-primary-300' },
  { bg: 'bg-blue-100 dark:bg-blue-950/40',            text: 'text-blue-700 dark:text-blue-300' },
  { bg: 'bg-rose-100 dark:bg-rose-950/40',            text: 'text-rose-700 dark:text-rose-300' },
  { bg: 'bg-amber-100 dark:bg-amber-950/40',          text: 'text-amber-700 dark:text-amber-300' },
];
const paletteFor = (key) => {
  let h = 0;
  const s = String(key || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return AVATAR_PALETTES[Math.abs(h) % AVATAR_PALETTES.length];
};

const Avatar = ({ row, size = 36 }) => {
  const palette = paletteFor(row.userId || row.fullName);
  // Profile pictures stored as server-relative paths need the backend host
  // prepended — fixImageUrl handles that (and leaves absolute URLs alone).
  const src = fixImageUrl(row.profilePicture);
  // Fall back to initials when the <img> fails to load (broken/expired URL).
  const handleError = (e) => {
    e.currentTarget.style.display = 'none';
    if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = 'flex';
  };
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {src && (
        <img
          src={src}
          alt=""
          onError={handleError}
          className="absolute inset-0 rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      )}
      <div
        className={`${src ? 'absolute inset-0 hidden' : ''} rounded-full flex items-center justify-center font-bold ${palette.bg} ${palette.text}`}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.34) }}
      >
        {initialsOf(row.fullName)}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const TestResultPage = () => {
  const { testId, attemptId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [attempt, setAttempt]   = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // ── Fetch both calls in parallel ─────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      apiClient.get(`/user-tests/${attemptId}`),
      apiClient.get(`/user-tests/${attemptId}/analytics`).catch(() => ({ data: { data: null } })),
    ])
      .then(([attemptRes, analyticsRes]) => {
        setAttempt(attemptRes.data.data);
        setAnalytics(analyticsRes.data.data || null);
      })
      .catch(() => {
        toast.error('Failed to load results');
        navigate('/student/tests');
      })
      .finally(() => setLoading(false));
  }, [attemptId, navigate]);

  // ── Derived performance buckets (all client-side, zero extra DB hits) ───
  const derived = useMemo(() => {
    if (!attempt) return null;
    const qas = attempt.questionAttempts || [];
    const total    = qas.length;
    const correct  = qas.filter((q) => q.isCorrect).length;
    const wrong    = qas.filter((q) => q.selectedOption && !q.isCorrect).length;
    const skipped  = qas.filter((q) => !q.selectedOption).length;
    const scorePct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const groupBy = (keyFn) => {
      const map = {};
      qas.forEach((qa) => {
        const k = keyFn(qa);
        if (!k) return;
        if (!map[k]) map[k] = { c: 0, t: 0 };
        map[k].t += 1;
        if (qa.isCorrect) map[k].c += 1;
      });
      return map;
    };
    const byDifficulty = groupBy((qa) => qa.mcqId?.difficulty || 'Medium');
    const bySubject    = groupBy((qa) => qa.mcqId?.subject);
    const byChapter    = groupBy((qa) => qa.mcqId?.unit);
    const byTopic      = groupBy((qa) => qa.mcqId?.topic);
    let weakest = null;
    Object.entries(byTopic).forEach(([name, { c, t }]) => {
      if (t < 2) return;
      const acc = (c / t) * 100;
      if (!weakest || acc < weakest.acc) weakest = { name, acc };
    });
    return { total, correct, wrong, skipped, scorePct, byDifficulty, bySubject, byChapter, byTopic, weakest };
  }, [attempt]);

  // ── Header (push title + actions to the global top bar) ─────────────────
  const headerSubtitle = useMemo(() => {
    if (!attempt) return '';
    const t = attempt.test;
    const submittedAt = attempt.endTime || attempt.updatedAt;
    const subjectPart = (t?.subjects?.[0]) || '';
    const modePart    = attempt.mode === 'tutor' ? 'Tutor' : 'Drill';
    const qb = attempt.questionBankTitle || t?.questionBankId?.title || '';
    const parts = [subjectPart, `${modePart} · ${attempt.questionAttempts?.length ?? 0} MCQs`,
      submittedAt ? `Submitted ${formatTimeOfDay(submittedAt)}` : '', qb].filter(Boolean);
    return parts.join(' · ');
  }, [attempt]);

  const handlePrint = () => {
    // Tiny UX touch: toast first so the user knows the print dialog is opening.
    // window.print() is synchronous on most browsers and blocks the toast
    // animation, so we defer it with rAF.
    toast.info('Opening print dialog…');
    requestAnimationFrame(() => window.print());
  };

  const headerAction = useMemo(() => (
    <div className="hidden md:flex items-center gap-2 no-print">
      <button onClick={handlePrint} className="btn-ghost text-sm px-3 py-2">
        <FiDownload className="w-4 h-4" /> Export PDF
      </button>
      <button
        onClick={() => navigate(`/student/tests/${testId}/review/${attemptId}`)}
        className="btn-ghost text-sm px-3 py-2"
      >
        <FiEye className="w-4 h-4" /> Review answers
      </button>
      <button
        onClick={() => navigate(`/student/tests/${testId}`)}
        className="btn-brand text-sm px-3 py-2"
      >
        <FiZap className="w-4 h-4" /> Retake test
      </button>
    </div>
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  ), [navigate, testId, attemptId]);

  usePageHeader({
    title:    'Test Result',
    subtitle: headerSubtitle,
    action:   headerAction,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }
  if (!attempt || !derived) return null;

  // ── Local UI derivations ────────────────────────────────────────────────
  const passingScore = attempt.test?.passingScore ?? 50;
  const passed       = derived.scorePct >= passingScore;
  const scoreColor   = derived.scorePct >= 80 ? '#10b981' : derived.scorePct >= 50 ? '#f97316' : '#ef4444';

  const createdByMe = (attempt.test?.createdBy?.toString?.() === (currentUser?._id || currentUser?.id))
    || (typeof attempt.test?.createdBy === 'string'
        && attempt.test.createdBy === (currentUser?._id || currentUser?.id));
  const showLeaderboard = !createdByMe;

  // Hero-only derivations from analytics. The Leaderboard tab pulls its own
  // copy of these fields inside <LeaderboardView /> so the main component
  // stays lean and we don't accidentally couple Overview and Leaderboard.
  const totalTakers  = analytics?.leaderboard?.totalTakers ?? 0;
  const myPercentile = analytics?.myPercentile;
  const classMedian  = analytics?.classMedian;

  const topPctLabel = myPercentile != null
    ? `Top ${Math.max(1, 100 - myPercentile)}% · ${totalTakers.toLocaleString()} students`
    : (totalTakers > 1 ? `${totalTakers.toLocaleString()} students` : 'First attempt');

  const heroCaption = (() => {
    const parts = [];
    parts.push(`That's ${derived.scorePct}%`);
    if (classMedian != null && totalTakers > 1) {
      const diff = derived.scorePct - classMedian;
      if (diff >= 5)       parts.push(`, well above the class median of ${classMedian}%`);
      else if (diff <= -5) parts.push(`, below the class median of ${classMedian}%`);
      else                 parts.push(`, right around the class median of ${classMedian}%`);
    }
    if (derived.weakest)  parts.push(`. Your weakest area was ${derived.weakest.name}`);
    return parts.join('') + '.';
  })();

  const subjectsSorted = Object.entries(derived.bySubject)
    .sort((a, b) => (b[1].c / b[1].t) - (a[1].c / a[1].t));
  const topicsSorted   = Object.entries(derived.byTopic)
    .sort((a, b) => (b[1].c / b[1].t) - (a[1].c / a[1].t));
  const chaptersSorted = Object.entries(derived.byChapter)
    .sort((a, b) => (b[1].c / b[1].t) - (a[1].c / a[1].t));

  const DIFFICULTY_ORDER = [
    { key: 'Easy',   accent: 'emerald' },
    { key: 'Medium', accent: 'primary' },
    { key: 'Hard',   accent: 'rose' },
  ];

  return (
    // -mt-2 pulls the content slightly up under the global topbar so the gap
    // doesn't feel too airy. Section spacing also tightened from 5 → 4.
    <div className="max-w-7xl mx-auto -mt-2">
      {/* ── Inline print stylesheet ──────────────────────────────────────
          window.print() exports whatever's on the page; we strip the global
          chrome (sidebar, top bar, action buttons, tabs) so the printed
          page is just the Test Result content. Stretches the main column
          to full width and pulls back internal padding. */}
      <style>{`
        @media print {
          aside, header.bg-\\[var\\(--bg-surface\\)\\] { display: none !important; }
          main { padding: 0 !important; overflow: visible !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          .max-w-7xl { max-width: none !important; }
          body { background: #ffffff !important; }
          section { box-shadow: none !important; break-inside: avoid; }
          /* Restore page colors for printers — :root vars survive print */
        }
        .print-only { display: none; }
      `}</style>

      {/* Title strip shown ONLY in print, so the PDF has context */}
      <div className="print-only mb-4">
        <h1 className="font-display text-2xl font-extrabold text-[var(--text-strong)]">Test Result · {attempt.test?.title}</h1>
        <p className="text-sm text-[var(--text-muted)]">{headerSubtitle}</p>
      </div>

      {/* Mobile action buttons */}
      <div className="md:hidden flex items-center gap-2 mb-3 flex-wrap no-print">
        <button onClick={handlePrint} className="btn-ghost text-sm px-3 py-2 flex-1">
          <FiDownload className="w-4 h-4" /> PDF
        </button>
        <button onClick={() => navigate(`/student/tests/${testId}/review/${attemptId}`)} className="btn-ghost text-sm px-3 py-2 flex-1">
          <FiEye className="w-4 h-4" /> Review
        </button>
        <button onClick={() => navigate(`/student/tests/${testId}`)} className="btn-brand text-sm px-3 py-2 flex-1">
          <FiZap className="w-4 h-4" /> Retake
        </button>
      </div>

      {/* ── Tabs (orange-tinted active state instead of the previous harsh black) */}
      <div className="inline-flex items-center gap-1 p-1 mb-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] no-print">
        {[
          { key: 'overview',    icon: FiBarChart2, label: 'Overview' },
          ...(showLeaderboard ? [{ key: 'leaderboard', icon: FiAward, label: 'Leaderboard' }] : []),
        ].map((tab) => {
          const active = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                active
                  ? 'bg-primary-500 text-white shadow-[0_4px_14px_-4px_rgba(249,115,22,0.55)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* ── Hero ────────────────────────────────────────────────────── */}
          <Section title={null} className="!p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <ScoreDonut pct={derived.scorePct} color={scoreColor} label={`${derived.correct} / ${derived.total}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    {TAG(<><FiCheckCircle className="w-3 h-3" /> {passed ? 'Passed' : 'Not passed'}</>, passed ? 'emerald' : 'rose')}
                    {totalTakers > 1 && myPercentile != null && TAG(topPctLabel, 'violet')}
                  </div>
                  <h2 className="font-display text-xl sm:text-2xl font-extrabold tracking-[-0.01em] text-[var(--text-strong)] leading-tight">
                    You scored {derived.correct} out of {derived.total}
                  </h2>
                  <p className="text-[13px] text-[var(--text-muted)] mt-1.5 leading-snug">
                    {heroCaption}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:w-[300px] flex-shrink-0">
                <HeroKpi label="Correct"   value={derived.correct} sub={`${derived.scorePct}%`} valueCls="text-emerald-600 dark:text-emerald-300" />
                <HeroKpi label="Incorrect" value={derived.wrong}   sub={derived.total > 0 ? `${Math.round((derived.wrong / derived.total) * 100)}%` : '—'} valueCls="text-rose-600 dark:text-rose-300" />
                <HeroKpi label="Skipped"   value={derived.skipped} sub={derived.total > 0 ? `${Math.round((derived.skipped / derived.total) * 100)}%` : '—'} valueCls="text-primary-600 dark:text-primary-300" />
                <HeroKpi label="Time"      value={formatHM(attempt.totalTimeSpent)} sub={attempt.totalDurationSec ? `of ${formatHM(attempt.totalDurationSec)}` : ''} valueCls="text-secondary-600 dark:text-secondary-300" />
              </div>
            </div>
          </Section>

          {/* ── Row 1: Subject (left) + Difficulty (right) ───────────────── */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Section title="Subject-wise Performance" subtitle="Accuracy per subject covered">
              {subjectsSorted.length === 0 ? (
                <p className="text-sm text-[var(--text-faint)] italic">No subject data on the MCQs in this test.</p>
              ) : (
                <div className="space-y-3.5">
                  {subjectsSorted.map(([name, d], i) => (
                    <SubjectRow key={name} name={name} count={d.c} total={d.t} palette={SUBJECT_PALETTES[i % SUBJECT_PALETTES.length]} />
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Difficulty-wise Performance"
              subtitle="How you did at each difficulty band"
              right={TAG(`${DIFFICULTY_ORDER.filter((d) => derived.byDifficulty[d.key]?.t).length} bands`, 'primary')}
            >
              <div className="space-y-3.5">
                {DIFFICULTY_ORDER.map(({ key, accent }) => {
                  const d = derived.byDifficulty[key];
                  if (!d || d.t === 0) return null;
                  return <BarRow key={key} label={key} count={d.c} total={d.t} accent={accent} />;
                })}
                {!DIFFICULTY_ORDER.some(({ key }) => derived.byDifficulty[key]?.t > 0) && (
                  <p className="text-sm text-[var(--text-faint)] italic">No difficulty data available for this test.</p>
                )}
              </div>
            </Section>
          </div>

          {/* ── Row 2: Topic (left) + Chapter (right) ────────────────────────
              When chapter data is missing, Topic takes full width so the row
              doesn't end with an empty right cell. */}
          <div className={chaptersSorted.length > 0 ? 'grid lg:grid-cols-2 gap-4' : ''}>
            <Section
              title="Topic-wise Performance"
              subtitle="Drill into individual topics"
              right={topicsSorted.length > 0 ? TAG(`${topicsSorted.length} topic${topicsSorted.length === 1 ? '' : 's'}`, 'muted') : null}
            >
              {topicsSorted.length === 0 ? (
                <p className="text-sm text-[var(--text-faint)] italic">No topic data on the MCQs in this test.</p>
              ) : (
                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                  {topicsSorted.map(([name, d]) => (
                    <TopicRow key={name} name={name} count={d.c} total={d.t} />
                  ))}
                </div>
              )}
            </Section>

            {chaptersSorted.length > 0 && (
              <Section
                title="Chapter-wise Performance"
                subtitle="Roll-up of topics by chapter"
                right={TAG(`${chaptersSorted.length} chapter${chaptersSorted.length === 1 ? '' : 's'}`, 'muted')}
              >
                <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
                  {chaptersSorted.map(([name, d]) => {
                    const pct = Math.round((d.c / d.t) * 100);
                    const accent = pct >= 80 ? 'emerald' : pct >= 60 ? 'primary' : 'rose';
                    return <BarRow key={name} label={name} count={d.c} total={d.t} accent={accent} />;
                  })}
                </div>
              </Section>
            )}
          </div>
        </div>
      )}

      {activeTab === 'leaderboard' && showLeaderboard && (
        <LeaderboardView
          analytics={analytics}
          derived={derived}
          attempt={attempt}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LeaderboardView — full tab matching the design screenshot:
//   • Top banner: rank badge + headline + cohort stats + top-3 mini avatars
//   • Main grid: leaderboard table (left) + YOUR RANK sidebar (right)
//
// All computations are derived from the existing `analytics` + `derived`
// payloads — no extra DB hits.
// ─────────────────────────────────────────────────────────────────────────────
const LeaderboardView = ({ analytics, derived, attempt, currentUser }) => {
  const totalTakers   = analytics?.leaderboard?.totalTakers ?? 0;
  // Defensive Array.isArray check — the `|| []` pattern only catches falsy
  // values, so a stray truthy non-array (e.g. an aborted/malformed response)
  // would slip through and crash `.slice` / `.map` below.
  const topRaw        = analytics?.leaderboard?.top;
  const top           = Array.isArray(topRaw) ? topRaw : [];
  const avgScore      = analytics?.leaderboard?.avgScore;
  const avgTime       = analytics?.leaderboard?.avgTime;
  const passRate      = analytics?.leaderboard?.passRate;
  const myRank        = analytics?.myRank;
  const myPercentile  = analytics?.myPercentile;
  const classMedian   = analytics?.classMedian;
  const medianTime    = analytics?.medianTime;
  // The leaderboard-counted attempt — may differ from the currently-viewed
  // attempt when the user has multiple attempts on this test.
  const myFA          = analytics?.myFirstAttempt;
  const isFirstAttempt = !!analytics?.isFirstAttempt;

  // Empty cohort fallback — early return, no banner/sidebar to render.
  if (totalTakers === 0 || top.length === 0) {
    return (
      <Section title={null}>
        <p className="text-sm text-[var(--text-faint)] italic text-center py-10">
          No leaderboard data yet — be the first to attempt this test.
        </p>
      </Section>
    );
  }

  const topScorer   = top[0];
  const topScorePct = topScorer.scorePercentage;
  const top3        = top.slice(0, 3);

  // ── Sidebar values use myFirstAttempt (the leaderboard-counted attempt) ─
  // so the sidebar is internally consistent with the rank. Falls back to
  // the currently-viewed attempt's derived data if the analytics didn't
  // include myFirstAttempt for some reason (defensive).
  const myScore    = myFA?.score    ?? derived.correct;
  const myMax      = myFA?.maxScore ?? derived.total;
  const myScorePct = myFA?.scorePercentage ?? derived.scorePct;
  const myTimeSec  = myFA?.totalTimeSpent ?? attempt.totalTimeSpent;

  // ── Comparisons for the right sidebar ─────────────────────────────────
  const topMarkGap    = topScorer.score != null ? myScore - topScorer.score : null;
  const classAvgMarks = avgScore != null ? Math.round((avgScore / 100) * myMax) : null;
  const avgMarkGap    = classAvgMarks != null ? myScore - classAvgMarks : null;
  // negative = faster than median, positive = slower
  const timeGapSec    = medianTime != null ? (myTimeSec - medianTime) : null;

  // ── "How to climb" actionable suggestions ─────────────────────────────
  const climbTips = [];
  if (derived.weakest) {
    const lost = Math.round((1 - derived.weakest.acc / 100) * derived.weakest.t) || 0;
    climbTips.push(`Master ${derived.weakest.name} — ${lost} pt${lost === 1 ? '' : 's'} lost there`);
  }
  // Time tip — only useful if top scorers are faster than the leaderboard-counted attempt.
  if (myMax > 0 && top.length > 0 && myTimeSec > 0) {
    const top5 = top.slice(0, 5);
    const top5AvgTime = top5.reduce((s, r) => s + (r.totalTimeSpent || 0), 0) / top5.length;
    const myPerQ  = myTimeSec / myMax;
    const top5PerQ = top5AvgTime / myMax;
    const diffSecPerQ = Math.round(myPerQ - top5PerQ);
    if (diffSecPerQ > 0) {
      climbTips.push(`Trim avg time/Q by ${diffSecPerQ}s to crack top 5`);
    }
  }
  climbTips.push('Retake the test — your first-attempt rank stays');

  // ── CSV export of leaderboard table ───────────────────────────────────
  const exportCsv = () => {
    const lines = [
      ['Rank', 'Name', 'School', 'Score', 'Accuracy (%)', 'Time (s)'].join(','),
      ...top.map((r, i) => [
        i + 1,
        `"${(r.fullName || '').replace(/"/g, '""')}"`,
        `"${(r.school || '').replace(/"/g, '""')}"`,
        `${r.score ?? ''}/${r.maxScore ?? ''}`,
        r.scorePercentage,
        r.totalTimeSpent ?? 0,
      ].join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `leaderboard-${attempt.test?.title || 'test'}.csv`.replace(/[^a-z0-9.-]+/gi, '_');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    // min-w-0 on the wrapper prevents the grid children below from forcing
    // the whole page to scroll horizontally on narrow viewports.
    <div className="space-y-4 min-w-0">
      {/* ── BANNER ───────────────────────────────────────────────────────
          Two-row layout to give the podium room to breathe:
            Row 1: rank tile + headline (left) + top-3 cards (right)
            Row 2: cohort stats strip (Attempts / Avg / Pass rate / Top / Avg time)
      */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-3 sm:p-4 space-y-3 sm:space-y-4 overflow-hidden">
        {/* ── Row 1: Rank tile + headline + top-3 podium cards ──────────── */}
        <div className="flex flex-col lg:flex-row lg:items-stretch gap-3 min-w-0">
          {/* (a) Rank tile + headline. `flex-shrink-0` lifted on mobile so
              long headlines wrap instead of pushing the row wider than the
              viewport. */}
          <div className="flex items-stretch gap-3 min-w-0 lg:flex-shrink-0">
            <div className="flex flex-col items-center justify-center px-3 rounded-xl bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-900/50 min-w-[70px] flex-shrink-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-primary-700 dark:text-primary-300">Rank</span>
              <span className="font-display text-2xl font-extrabold text-primary-600 dark:text-primary-300 leading-none mt-0.5">
                {myRank != null ? `#${myRank}` : '—'}
              </span>
            </div>
            <div className="min-w-0 lg:max-w-[220px] flex flex-col justify-center flex-1">
              <p className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)]">
                <FiAward className="w-3 h-3 text-primary-500" /> Test leaderboard
              </p>
              <p className="font-display text-sm sm:text-base font-extrabold text-[var(--text-strong)] leading-tight mt-1">
                {myRank != null
                  ? <>You're <span className="text-primary-600 dark:text-primary-300">#{myRank}</span> of {totalTakers.toLocaleString()}</>
                  : <>{totalTakers.toLocaleString()} attempted</>}
              </p>
              {myPercentile != null && (
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 truncate">
                  Top {Math.max(1, 100 - myPercentile)}%
                  {topMarkGap != null && topMarkGap < 0 && (
                    <> · {Math.abs(topMarkGap)} behind {initialsOf(topScorer.fullName)}</>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* (b) Top-3 podium cards — full info per the screenshot.
              On mobile stack vertically; on lg+ split the remaining width. */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {top3.map((row, i) => {
              const TINTS = [
                {
                  // Gold — #1
                  card:  'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50',
                  rank:  'text-amber-700 dark:text-amber-300',
                  badge: 'bg-amber-500 text-white',
                  medal: '🥇',
                },
                {
                  // Silver — #2
                  card:  'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800',
                  rank:  'text-zinc-700 dark:text-zinc-300',
                  badge: 'bg-zinc-400 text-white',
                  medal: '🥈',
                },
                {
                  // Bronze — #3
                  card:  'bg-orange-50/70 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50',
                  rank:  'text-orange-700 dark:text-orange-300',
                  badge: 'bg-orange-500 text-white',
                  medal: '🥉',
                },
              ][i];
              return (
                <div
                  key={row.userId}
                  className={`relative rounded-xl border ${TINTS.card} p-2.5 flex items-center gap-2.5 min-w-0`}
                >
                  {/* Rank pill — pinned top-left */}
                  <span className={`absolute -top-1.5 -left-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${TINTS.badge} shadow-sm`}>
                    #{i + 1}
                  </span>
                  <Avatar row={row} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-strong)] truncate flex items-center gap-1">
                      <span className="text-[11px]">{TINTS.medal}</span>
                      <span className="truncate">{row.fullName}</span>
                    </p>
                    {row.school && (
                      <p className="text-[10px] text-[var(--text-faint)] truncate">{row.school}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-display text-sm font-extrabold text-[var(--text-strong)] tabular-nums leading-none">
                      {row.score ?? '—'}<span className="text-[10px] font-normal text-[var(--text-faint)]">/{row.maxScore ?? '—'}</span>
                    </p>
                    <p className={`text-[10px] font-bold tabular-nums mt-0.5 ${TINTS.rank}`}>
                      {Math.round(row.scorePercentage)}% · {formatTime(row.totalTimeSpent)}
                    </p>
                  </div>
                </div>
              );
            })}
            {/* Placeholder cards when fewer than 3 takers exist — keeps the grid balanced */}
            {top3.length < 3 && Array.from({ length: 3 - top3.length }).map((_, i) => (
              <div
                key={`placeholder-${i}`}
                className="rounded-xl border border-dashed border-[var(--border)] p-2.5 flex items-center justify-center text-[11px] text-[var(--text-faint)]"
              >
                Open slot
              </div>
            ))}
          </div>
        </div>

        {/* ── Row 2: cohort stats strip ─────────────────────────────────── */}
        {/* On mobile the "TEST STATS" label sits ABOVE the grid (its own
            line) so the grid gets the full row width. On lg+ they share a
            row with the grid taking the remaining space. */}
        <div className="pt-3 border-t border-[var(--border)] min-w-0">
          <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-faint)] flex-shrink-0">
              Test stats
            </span>
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3 min-w-0">
              <BannerStat label="Attempts"  value={totalTakers.toLocaleString()} />
              <BannerStat label="Avg score" value={avgScore != null ? `${avgScore}%` : '—'} />
              <BannerStat label="Pass rate" value={passRate != null ? `${passRate}%` : '—'} />
              <BannerStat label="Top score" value={`${Math.round(topScorePct)}%`} valueCls="text-emerald-600 dark:text-emerald-300" />
              <BannerStat label="Avg time"  value={formatTime(avgTime)} />
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN GRID: TABLE + SIDEBAR ───────────────────────────────────── */}
      <div className="grid lg:grid-cols-12 gap-4 min-w-0">
        {/* ── Leaderboard table ────────────────────────────────────────── */}
        <div className="lg:col-span-8 min-w-0">
          <Section
            title="Top 10 on this test"
            subtitle="Tie-break by time used · faster = higher"
            right={
              <div className="flex items-center gap-1.5">
                <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--border)] text-xs text-[var(--text-muted)] hover:bg-[var(--bg-muted)] no-print">
                  <FiDownload className="w-3.5 h-3.5" /> Export
                </button>
              </div>
            }
          >
            {/* ── Desktop table (md+) ──────────────────────────────────── */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-mono uppercase tracking-[0.14em] text-[var(--text-faint)]">
                    <th className="text-left px-2 py-2 font-semibold">Rank</th>
                    <th className="text-left px-2 py-2 font-semibold">Student</th>
                    <th className="text-left px-2 py-2 font-semibold">Score</th>
                    <th className="text-left px-2 py-2 font-semibold">Accuracy</th>
                    <th className="text-left px-2 py-2 font-semibold">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {top.map((row, i) => {
                    const rank = i + 1;
                    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                    const pct = Math.round(row.scorePercentage * 10) / 10;
                    const accentBar = pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-primary-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                    return (
                      <tr key={row.userId} className={row.isMe ? 'bg-primary-50/60 dark:bg-primary-950/30' : ''}>
                        <td className="px-2 py-3">
                          <span className="inline-flex items-center justify-center w-8 text-sm font-bold text-[var(--text-muted)] tabular-nums">
                            {medal ? <span className="text-base">{medal}</span> : `#${rank}`}
                          </span>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Avatar row={row} size={32} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--text-strong)] truncate flex items-center gap-1.5">
                                {row.fullName}
                                {row.isMe && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary-500 text-white text-[9px] font-bold">
                                    You
                                  </span>
                                )}
                              </p>
                              {row.school && (
                                <p className="text-[11px] text-[var(--text-faint)] truncate">{row.school}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3 whitespace-nowrap">
                          <span className="font-display text-sm font-bold text-[var(--text-strong)] tabular-nums">
                            {row.score ?? '—'}
                          </span>
                          {row.maxScore != null && (
                            <span className="text-xs text-[var(--text-faint)] tabular-nums">/{row.maxScore}</span>
                          )}
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <span className={`font-display text-sm font-bold tabular-nums ${
                              pct >= 90 ? 'text-emerald-600 dark:text-emerald-300'
                                : pct >= 75 ? 'text-primary-600 dark:text-primary-300'
                                : pct >= 50 ? 'text-amber-600 dark:text-amber-300'
                                : 'text-rose-600 dark:text-rose-300'
                            }`}>
                              {pct}%
                            </span>
                            <div className="hidden sm:block w-12 h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${accentBar}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-xs text-[var(--text-muted)] whitespace-nowrap tabular-nums">
                          {formatTime(row.totalTimeSpent)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile card list (<md) ────────────────────────────────
                Stacks each row into a 3-column layout: rank · avatar+name+school+time
                · score+percentage. No horizontal scroll, no table-layout drama. */}
            <ul className="md:hidden divide-y divide-[var(--border)]">
              {top.map((row, i) => {
                const rank = i + 1;
                const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
                const pct = Math.round(row.scorePercentage * 10) / 10;
                const pctText =
                  pct >= 90 ? 'text-emerald-600 dark:text-emerald-300' :
                  pct >= 75 ? 'text-primary-600 dark:text-primary-300' :
                  pct >= 50 ? 'text-amber-600 dark:text-amber-300' :
                              'text-rose-600 dark:text-rose-300';
                return (
                  <li
                    key={row.userId}
                    className={`flex items-center gap-2.5 py-2.5 px-1 ${
                      row.isMe ? '-mx-1 px-2 rounded-lg bg-primary-50/60 dark:bg-primary-950/30' : ''
                    }`}
                  >
                    <span className="w-6 flex-shrink-0 text-center text-sm font-bold text-[var(--text-muted)] tabular-nums">
                      {medal ? <span className="text-base">{medal}</span> : `#${rank}`}
                    </span>
                    <Avatar row={row} size={32} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--text-strong)] truncate flex items-center gap-1.5">
                        {row.fullName}
                        {row.isMe && (
                          <span className="inline-flex items-center px-1 py-0.5 rounded-md bg-primary-500 text-white text-[9px] font-bold flex-shrink-0">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-[var(--text-faint)] truncate">
                        {row.school ? `${row.school} · ` : ''}{formatTime(row.totalTimeSpent)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-display text-sm font-extrabold tabular-nums text-[var(--text-strong)] leading-none">
                        {row.score ?? '—'}<span className="text-[10px] font-normal text-[var(--text-faint)]">/{row.maxScore ?? '—'}</span>
                      </p>
                      <p className={`text-[11px] font-bold tabular-nums mt-0.5 ${pctText}`}>
                        {pct}%
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-4 space-y-4">
          {/* "Based on your first attempt" notice — only when the viewed
              attempt isn't the one that counts on the leaderboard. */}
          {!isFirstAttempt && myFA && (
            <div className="rounded-xl px-3 py-2 text-[11px] bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 text-blue-800 dark:text-blue-200 flex items-start gap-2">
              <FiAward className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>
                Leaderboard counts only your <strong>first attempt</strong>.
                {' '}Stats below reflect that attempt ({myScore}/{myMax} · {Math.round(myScorePct)}%),
                not the one you're viewing.
              </span>
            </div>
          )}

          {/* (a) YOUR RANK gradient card */}
          <div className="rounded-2xl p-4 bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-[0_8px_24px_-8px_rgba(249,115,22,0.45)]">
            <div className="flex items-center gap-3">
              {fixImageUrl(currentUser?.profilePicture) ? (
                <img
                  src={fixImageUrl(currentUser.profilePicture)}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover ring-2 ring-white/30"
                  onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                />
              ) : null}
              <div
                className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center font-bold text-base ring-2 ring-white/30"
                style={fixImageUrl(currentUser?.profilePicture) ? { display: 'none' } : undefined}
              >
                {initialsOf(currentUser?.fullName || 'You')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/70">Your rank</p>
                <p className="font-display text-3xl font-extrabold leading-none mt-1">
                  #{myRank ?? '—'}
                </p>
                <p className="text-[11px] text-white/80 mt-1">of {totalTakers.toLocaleString()} attempts</p>
              </div>
            </div>
          </div>

          {/* (b) 4 stat tiles in 2x2 — all from myFirstAttempt so they line
              up with the rank above. */}
          <div className="grid grid-cols-2 gap-3">
            <SidebarStat label="Score"      value={`${myScore}/${myMax}`}                       valueCls="text-[var(--text-strong)]" />
            <SidebarStat label="Accuracy"   value={`${Math.round(myScorePct)}%`}                valueCls="text-emerald-600 dark:text-emerald-300" />
            <SidebarStat label="Time"       value={formatTime(myTimeSec)}                       valueCls="text-secondary-600 dark:text-secondary-300" />
            <SidebarStat label="Percentile" value={myPercentile != null ? `${ordinalSuffix(myPercentile)}` : '—'} valueCls="text-primary-600 dark:text-primary-300" />
          </div>

          {/* (c) vs comparisons */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 space-y-2.5">
            <CompareRow
              label={<>vs Top scorer{topScorer.fullName ? <span className="text-[var(--text-faint)] font-normal"> ({initialsOf(topScorer.fullName)})</span> : null}</>}
              value={topMarkGap != null ? `${topMarkGap >= 0 ? '+' : ''}${topMarkGap} marks` : '—'}
              tone={topMarkGap == null ? 'muted' : topMarkGap >= 0 ? 'emerald' : 'rose'}
            />
            <CompareRow
              label="vs Class average"
              value={avgMarkGap != null ? `${avgMarkGap >= 0 ? '+' : ''}${avgMarkGap} marks` : '—'}
              tone={avgMarkGap == null ? 'muted' : avgMarkGap >= 0 ? 'emerald' : 'rose'}
            />
            <CompareRow
              label="vs Median time"
              value={timeGapSec != null
                ? `${timeGapSec <= 0 ? '−' : '+'}${formatTime(Math.abs(timeGapSec))} ${timeGapSec <= 0 ? 'faster' : 'slower'}`
                : '—'}
              tone={timeGapSec == null ? 'muted' : timeGapSec <= 0 ? 'emerald' : 'rose'}
            />
          </div>

          {/* (d) How to climb */}
          <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4">
            <p className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-[var(--text-strong)] mb-2.5">
              <FiTrendingUp className="w-4 h-4 text-primary-500" />
              How to climb
            </p>
            <ul className="space-y-2">
              {climbTips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-[var(--text)]">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-300 text-[10px] font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Small atoms used only by LeaderboardView ──────────────────────────────────
const BannerStat = ({ label, value, valueCls }) => (
  <div className="min-w-0">
    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">{label}</p>
    <p className={`font-display text-base sm:text-lg font-extrabold leading-tight mt-0.5 truncate ${valueCls || 'text-[var(--text-strong)]'}`}>
      {value}
    </p>
  </div>
);

const SidebarStat = ({ label, value, valueCls }) => (
  <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-3">
    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-faint)]">{label}</p>
    <p className={`font-display text-xl font-extrabold leading-none mt-1 ${valueCls || 'text-[var(--text-strong)]'}`}>{value}</p>
  </div>
);

const CompareRow = ({ label, value, tone = 'muted' }) => {
  const TONES = {
    emerald: 'text-emerald-600 dark:text-emerald-300',
    rose:    'text-rose-600 dark:text-rose-300',
    muted:   'text-[var(--text-muted)]',
  };
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--text-muted)] truncate">{label}</span>
      <span className={`font-bold tabular-nums whitespace-nowrap ${TONES[tone]}`}>{value}</span>
    </div>
  );
};

// 92 → "92nd", 1 → "1st", 22 → "22nd"
const ordinalSuffix = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export default TestResultPage;
