// src/modules/tests/pages/TestHistoryPage.jsx
//
// SKN Academy LMS — Test History (post-redesign).
//   • 4 KPI cards: total / completed / avg score / best streak.
//   • Single filter row (search + 4 selects + clear button).
//   • Attempt list: table-style row on md+, stacked card on mobile.
//   • Score shown as a colored SVG donut with the percentage in the middle.
//   • Full light + dark mode via Tailwind dark: variants.
//   • Action buttons (Resume / Results / Review / Retake) keep all existing
//     navigation; only the visual treatment changed.
//
// Functionality preserved exactly: filters, pagination, debounced search,
// loading states, empty state, all status/mode/subject filter wiring.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  FiCheckCircle, FiPlayCircle, FiEye, FiBarChart2, FiZap,
  FiSearch, FiX, FiChevronLeft, FiChevronRight,
  FiFileText, FiTarget, FiTrendingUp, FiSliders,
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const PAGE_SIZE = 20;

const formatDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

// ── SVG score donut ─────────────────────────────────────────────────────────
// Smaller version of what you'd find on dashboards. Stroke colour follows
// the score range — green ≥ 80, orange 50–79, red < 50. Track is theme-aware.
const ScoreDonut = ({ pct = 0, size = 48 }) => {
  const safe = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const r    = (size - 6) / 2;          // radius (3px stroke padding)
  const c    = 2 * Math.PI * r;         // circumference
  const dash = (safe / 100) * c;

  // Stroke colour buckets — tuned to match the mockup's traffic-light cues.
  const stroke = safe >= 80
    ? '#10b981'   // emerald-500
    : safe >= 50
      ? '#f97316' // primary-500 (orange)
      : '#ef4444'; // red-500

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      {/* Track */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        className="stroke-[var(--border)]"
        strokeWidth="3"
      />
      {/* Progress arc */}
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%" y="50%"
        textAnchor="middle"
        dy="0.34em"
        className="fill-[var(--text-strong)] font-bold"
        style={{ fontSize: size <= 48 ? 12 : 14 }}
      >
        {safe}%
      </text>
    </svg>
  );
};

// ── Status pill — matches mockup labels: Passed / Below 50% / In Progress / Abandoned
const StatusBadge = ({ status, scorePercent }) => {
  if (status === 'completed') {
    const passed = scorePercent >= 50;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold
        ${passed
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'}`}
      >
        {passed ? <FiCheckCircle className="w-3 h-3" /> : null}
        {passed ? 'Passed' : 'Below 50%'}
      </span>
    );
  }
  if (status === 'in-progress') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        <FiPlayCircle className="w-3 h-3" /> In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500 dark:bg-[var(--bg-surface)] dark:text-[var(--text-faint)]">
      Abandoned
    </span>
  );
};

// ── KPI card: icon tile + label + value + sub
const Kpi = ({ Icon, label, value, sub, tone = 'orange' }) => {
  const TONES = {
    orange:  'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    violet:  'bg-secondary-50 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300',
    blue:    'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
  };
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${TONES[tone]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">{label}</div>
        <div className="font-display text-2xl font-extrabold text-[var(--text-strong)] mt-0.5 leading-none">{value}</div>
        {sub && <div className="text-[11px] text-[var(--text-faint)] mt-1">{sub}</div>}
      </div>
    </div>
  );
};

const TestHistoryPage = () => {
  const navigate = useNavigate();

  const [attempts, setAttempts]         = useState([]);
  // Pagination is now hasMore-based (no totalPages). Page 1 also returns
  // stats + filterOptions; the frontend caches those and reuses on pages 2+.
  const [hasMore, setHasMore]           = useState(false);
  const [stats, setStats]               = useState({ total: 0, completed: 0, avgScore: 0, abandoned: 0, bestStreak: 0 });
  const [filterOptions, setFilterOptions] = useState({ subjects: [], chapters: [], topics: [], qbs: [] });
  const [loading, setLoading]           = useState(true);

  // Filter state
  const [searchText, setSearchText]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('all');
  const [modeFilter, setModeFilter]       = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [topicFilter, setTopicFilter]     = useState('all');
  const [qbFilter, setQbFilter]           = useState('all');
  const [dateFilter, setDateFilter]       = useState('all');
  const [page, setPage]                   = useState(1);

  // Debounce search to avoid calling the API on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimer = useRef(null);

  // Desktop: secondary filters (chapter / topic / QB) hide behind a "More"
  // toggle so the primary row stays compact at common widths.
  const [showMore, setShowMore] = useState(false);
  // Mobile: a single "Filters" button collapses ALL selects into a sheet.
  // Avoids the 3-row stack of selects that looked busy on phones.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Active-filter count powers the badge on the mobile "Filters" button.
  const activeFilterCount = (
    (statusFilter   !== 'all' ? 1 : 0) +
    (modeFilter     !== 'all' ? 1 : 0) +
    (subjectFilter  !== 'all' ? 1 : 0) +
    (chapterFilter  !== 'all' ? 1 : 0) +
    (topicFilter    !== 'all' ? 1 : 0) +
    (qbFilter       !== 'all' ? 1 : 0) +
    (dateFilter     !== 'all' ? 1 : 0)
  );
  useEffect(() => {
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(searchTimer.current);
  }, [searchText]);

  // Reset to page 1 whenever any filter changes
  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, modeFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, dateFilter]);

  // Fetch from server when page or any filter changes
  useEffect(() => {
    const params = new URLSearchParams({ page, limit: PAGE_SIZE });
    if (debouncedSearch)           params.set('search',  debouncedSearch);
    if (statusFilter !== 'all')    params.set('status',  statusFilter);
    if (modeFilter   !== 'all')    params.set('mode',    modeFilter);
    if (subjectFilter !== 'all')   params.set('subject', subjectFilter);
    if (chapterFilter !== 'all')   params.set('chapter', chapterFilter);
    if (topicFilter   !== 'all')   params.set('topic',   topicFilter);
    if (qbFilter      !== 'all')   params.set('qbId',    qbFilter);
    if (dateFilter    !== 'all')   params.set('date',    dateFilter);

    setLoading(true);
    apiClient.get(`/user-tests/history?${params}`)
      .then((res) => {
        setAttempts(res.data.data || []);
        setHasMore(!!res.data.hasMore);
        // Backend only sends stats + filterOptions on page 1 (saves queries
        // on subsequent pages). Frontend keeps the cached versions otherwise.
        if (res.data.stats)         setStats((s) => ({ ...s, ...res.data.stats }));
        if (res.data.filterOptions) setFilterOptions(res.data.filterOptions);
      })
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, statusFilter, modeFilter, subjectFilter, chapterFilter, topicFilter, qbFilter, dateFilter]);

  const hasActiveFilter = searchText || statusFilter !== 'all' || modeFilter !== 'all' ||
    subjectFilter !== 'all' || chapterFilter !== 'all' || topicFilter !== 'all' ||
    qbFilter !== 'all' || dateFilter !== 'all';

  const clearFilters = () => {
    setSearchText(''); setStatusFilter('all'); setModeFilter('all');
    setSubjectFilter('all'); setChapterFilter('all'); setTopicFilter('all');
    setQbFilter('all'); setDateFilter('all');
  };

  // Tailwind shared classes for the filter dropdowns + inputs.
  const inputCls =
    'px-3 py-2 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-sm ' +
    'text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-primary-400 transition';

  // Subtitle: matches the mockup's tri-stat summary.
  const abandoned = Math.max(0, stats.abandoned ?? (stats.total - stats.completed));
  const subtitle = `${stats.total} total attempt${stats.total === 1 ? '' : 's'} · ${stats.completed} completed · ${abandoned} abandoned`;

  // ── Push page header into the top bar ─────────────────────────────────
  // These hooks MUST sit above any early `return` so the hook order stays
  // stable across renders (Rules of Hooks). The layout's PageHeaderContext
  // renders title + subtitle on the left and the action button on the right
  // of the global top bar.
  const headerAction = useMemo(() => (
    <button
      onClick={() => navigate('/auto-test')}
      className="btn-brand text-sm whitespace-nowrap"
    >
      <FiZap className="w-4 h-4" /> New practice test
    </button>
  ), [navigate]);
  usePageHeader({
    title:    'Test History',
    subtitle,
    action:   headerAction,
  });

  if (loading && attempts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Mobile-only action button — top bar hides the action below md so we
          render it inline here on small screens. */}
      <div className="md:hidden mb-4">{headerAction}</div>

      {/* ── KPI cards — 2-col on mobile, 4-col on lg+ ─────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Kpi
          Icon={FiFileText}
          label="Total tests"
          value={stats.total}
          sub={stats.total > 0 ? 'all-time attempts' : 'no tests yet'}
          tone="orange"
        />
        <Kpi
          Icon={FiCheckCircle}
          label="Completed"
          value={stats.completed}
          sub={stats.total > 0 ? `${Math.round((stats.completed / Math.max(1, stats.total)) * 100)}% completion` : '—'}
          tone="emerald"
        />
        <Kpi
          Icon={FiTarget}
          label="Avg score"
          value={`${stats.avgScore ?? 0}%`}
          sub={stats.completed > 0 ? 'across completed' : '—'}
          tone="violet"
        />
        <Kpi
          Icon={FiTrendingUp}
          label="Best streak"
          value={stats.bestStreak ? `${stats.bestStreak} in a row` : '—'}
          sub={stats.bestStreak ? 'passed ≥ 70%' : 'build a streak'}
          tone="blue"
        />
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────
          Two distinct layouts for the two breakpoints:
            • Mobile (<md): only Search + a "Filters" button (with active count
              badge) + Clear. Tapping Filters reveals all selects in a 2-column
              grid below — replaces the cramped wrapping multi-row layout.
            • Desktop (≥md): inline Search + Status + Mode + Subject + Time
              + "More" (reveals secondary filters) + Clear. */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-2 sm:p-3 mb-5">
        {/* Primary row — visible at every breakpoint */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-0">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] w-4 h-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search test, topic, chapter…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className={`${inputCls} pl-10 w-full`}
            />
          </div>

          {/* ── Mobile-only single "Filters" button ─────────────────────── */}
          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className={`md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors flex-shrink-0 ${
              mobileFiltersOpen || activeFilterCount > 0
                ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
            }`}
            aria-expanded={mobileFiltersOpen}
            aria-label="Filters"
          >
            <FiSliders className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-primary-500 text-white text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* ── Desktop inline selects (hidden on mobile) ───────────────── */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${inputCls} flex-shrink-0 hidden md:block`}
            aria-label="Status"
          >
            <option value="all">Status</option>
            <option value="completed">Completed</option>
            <option value="in-progress">In progress</option>
            <option value="abandoned">Abandoned</option>
          </select>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className={`${inputCls} flex-shrink-0 hidden md:block`}
            aria-label="Mode"
          >
            <option value="all">Mode</option>
            <option value="tutor">Tutor</option>
            <option value="timer">Timed</option>
          </select>
          {filterOptions.subjects.length > 0 && (
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className={`${inputCls} flex-shrink-0 hidden md:block`}
              aria-label="Subject"
            >
              <option value="all">Subject</option>
              {filterOptions.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className={`${inputCls} flex-shrink-0 hidden md:block`}
            aria-label="Date range"
          >
            <option value="all">Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
            <option value="month">Last 30 days</option>
          </select>

          {/* Desktop "More" toggle */}
          {(filterOptions.chapters.length || filterOptions.topics.length || filterOptions.qbs.length) > 0 && (
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors flex-shrink-0 ${
                showMore
                  ? 'border-primary-300 dark:border-primary-700 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
              }`}
              aria-expanded={showMore}
            >
              <FiSliders className="w-3.5 h-3.5" />
              <span>More</span>
            </button>
          )}

          {/* Clear — both layouts (only visible when something is active) */}
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] transition-colors flex-shrink-0"
              title="Clear all filters"
            >
              <FiX className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        {/* ── Mobile filter sheet (expanded panel, full-width selects) ─── */}
        {mobileFiltersOpen && (
          <div className="md:hidden mt-3 pt-3 border-t border-[var(--border)] grid grid-cols-2 gap-2">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} w-full`} aria-label="Status">
              <option value="all">Status</option>
              <option value="completed">Completed</option>
              <option value="in-progress">In progress</option>
              <option value="abandoned">Abandoned</option>
            </select>
            <select value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} className={`${inputCls} w-full`} aria-label="Mode">
              <option value="all">Mode</option>
              <option value="tutor">Tutor</option>
              <option value="timer">Timed</option>
            </select>
            {filterOptions.subjects.length > 0 && (
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className={`${inputCls} w-full`} aria-label="Subject">
                <option value="all">Subject</option>
                {filterOptions.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className={`${inputCls} w-full`} aria-label="Date range">
              <option value="all">Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </select>
            {filterOptions.chapters.length > 0 && (
              <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)} className={`${inputCls} w-full`} aria-label="Chapter">
                <option value="all">Chapter</option>
                {filterOptions.chapters.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {filterOptions.topics.length > 0 && (
              <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className={`${inputCls} w-full`} aria-label="Topic">
                <option value="all">Topic</option>
                {filterOptions.topics.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {filterOptions.qbs.length > 0 && (
              <select value={qbFilter} onChange={(e) => setQbFilter(e.target.value)} className={`${inputCls} w-full col-span-2`} aria-label="Question bank">
                <option value="all">Question bank</option>
                {filterOptions.qbs.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
              </select>
            )}
          </div>
        )}

        {/* ── Desktop secondary filters (under the "More" toggle) ──────── */}
        {showMore && (filterOptions.chapters.length || filterOptions.topics.length || filterOptions.qbs.length) > 0 && (
          <div className="hidden md:flex items-center gap-2 flex-wrap mt-2 pt-2 border-t border-[var(--border)]">
            {filterOptions.chapters.length > 0 && (
              <select value={chapterFilter} onChange={(e) => setChapterFilter(e.target.value)} className={`${inputCls} flex-shrink-0`} aria-label="Chapter">
                <option value="all">Chapter</option>
                {filterOptions.chapters.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {filterOptions.topics.length > 0 && (
              <select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)} className={`${inputCls} flex-shrink-0`} aria-label="Topic">
                <option value="all">Topic</option>
                {filterOptions.topics.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
            {filterOptions.qbs.length > 0 && (
              <select value={qbFilter} onChange={(e) => setQbFilter(e.target.value)} className={`${inputCls} flex-shrink-0`} aria-label="Question bank">
                <option value="all">Question bank</option>
                {filterOptions.qbs.map(({ id, title }) => <option key={id} value={id}>{title}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {/* ── Loading overlay (for filter changes when list already has items) */}
      {loading && attempts.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {!loading && attempts.length === 0 && (
        <div className="text-center py-16 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)]">
          <div className="text-5xl mb-4">📝</div>
          <h3 className="text-lg font-semibold text-[var(--text)] mb-2">No tests found</h3>
          <p className="text-sm text-[var(--text-faint)] mb-6">
            {hasActiveFilter ? 'Try adjusting your filters.' : 'Create your first practice test to see it here.'}
          </p>
          <button onClick={() => navigate('/auto-test')} className="btn-brand text-sm">
            <FiZap className="w-4 h-4" /> Create practice test
          </button>
        </div>
      )}

      {/* ── Attempt list ─────────────────────────────────────────────────── */}
      {/* Strict CSS Grid on md+: every row uses the same grid-template-columns
          so columns line up under their headers regardless of attempt status
          (in-progress rows had alignment drift before this refactor).
          Below md: each row collapses to a flex-column card (score donut on
          top, content below, actions wrap last).                            */}
      {!loading && attempts.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
          {/* Column header — md+ only */}
          <div
            className="hidden md:grid items-center gap-4 px-5 py-3 border-b border-[var(--border)] text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]"
            style={{ gridTemplateColumns: '56px minmax(0, 1.4fr) 100px 90px 100px 290px' }}
          >
            <span>Score</span>
            <span>Test</span>
            <span>Subject</span>
            <span>Mode</span>
            <span>Date</span>
            <span className="text-right">Actions</span>
          </div>

          <ul className="divide-y divide-[var(--border)]">
            {attempts.map((attempt) => {
              // Backend now returns Test info as denormalised snapshot fields
              // directly on the attempt — no nested .test.* lookups needed.
              const testId       = attempt.test;
              const totalQs      = attempt.maxScore || attempt.totalQuestions || 0;
              const answered     = attempt.answeredCount || 0;
              const scorePct     = attempt.scorePercentage ? Math.round(attempt.scorePercentage) : 0;
              const subject      = (attempt.testSubjects && attempt.testSubjects[0]) || '—';
              const qbTitle      = attempt.questionBankTitle || '';
              const mode         = attempt.mode === 'tutor' ? 'Tutor' : (attempt.mode === 'timer' ? 'Timed' : 'Untimed');

              // ── Cell content (rendered once, placed by both layouts) ───
              const scoreCell = attempt.status === 'completed' ? (
                <ScoreDonut pct={scorePct} size={48} />
              ) : (
                <div className="w-12 h-12 rounded-full border-[3px] border-amber-300 dark:border-amber-500/40 flex items-center justify-center">
                  <FiPlayCircle className="w-5 h-5 text-amber-500" />
                </div>
              );

              const testCell = (
                <div className="min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5">
                    <h3 className="font-semibold text-[var(--text-strong)] truncate text-sm sm:text-[15px]">
                      {attempt.testTitle || 'Untitled Test'}
                    </h3>
                    <StatusBadge status={attempt.status} scorePercent={scorePct} />
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5 truncate">
                    {attempt.status === 'completed'
                      ? `${attempt.score}/${totalQs} correct`
                      : (attempt.status === 'in-progress' ? `${answered}/${totalQs} answered` : '—')}
                    {qbTitle ? ` · ${qbTitle}` : ''}
                  </div>
                  {attempt.status === 'in-progress' && totalQs > 0 && (
                    <div className="mt-1.5 h-1 bg-[var(--border)] rounded-full overflow-hidden max-w-[200px]">
                      <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(answered / totalQs) * 100}%` }} />
                    </div>
                  )}
                </div>
              );

              const subjectChip = (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  {subject}
                </span>
              );

              const modeChip = (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary-50 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300">
                  {mode}
                </span>
              );

              const dateCell = (
                <span className="text-xs text-[var(--text-muted)]">
                  {formatDate(attempt.createdAt)}
                </span>
              );

              // Action buttons — tight padding + no flex-wrap so all three
              // sit on a single line inside the 290px actions column.
              // On mobile the parent uses flex-wrap anyway (see card layout).
              const btnBase =
                'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap min-h-[34px]';
              const btnGhost =
                `${btnBase} border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)]`;
              const btnPrimary =
                `${btnBase} bg-primary-500 text-white hover:bg-primary-600`;

              const actionsCell = (
                <div className="flex items-center gap-1.5 justify-start md:justify-end md:flex-nowrap flex-wrap">
                  {attempt.status === 'completed' && (
                    <>
                      <button
                        onClick={() => navigate(`/student/tests/${testId}/result/${attempt._id}`)}
                        className={btnGhost}
                      >
                        <FiBarChart2 className="w-3.5 h-3.5" /> Results
                      </button>
                      <button
                        onClick={() => navigate(`/student/tests/${testId}/review/${attempt._id}`)}
                        className={btnGhost}
                      >
                        <FiEye className="w-3.5 h-3.5" /> Review
                      </button>
                    </>
                  )}
                  {attempt.status === 'in-progress' && (
                    <button
                      onClick={() => navigate(`/student/tests/${testId}/play?attemptId=${attempt._id}`)}
                      className={btnPrimary}
                    >
                      <FiPlayCircle className="w-3.5 h-3.5" /> Resume
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/student/tests/${testId}`)}
                    className={btnPrimary}
                  >
                    Retake
                  </button>
                </div>
              );

              return (
                <li
                  key={attempt._id}
                  className="px-4 sm:px-5 py-3 sm:py-4 hover:bg-[var(--bg-muted)] transition-colors"
                >
                  {/* ── Desktop layout: strict CSS grid ─────────────── */}
                  <div
                    className="hidden md:grid md:items-center md:gap-4"
                    style={{ gridTemplateColumns: '56px minmax(0, 1.4fr) 100px 90px 100px 290px' }}
                  >
                    <div className="flex justify-start">{scoreCell}</div>
                    {testCell}
                    <div>{subjectChip}</div>
                    <div>{modeChip}</div>
                    <div>{dateCell}</div>
                    <div>{actionsCell}</div>
                  </div>

                  {/* ── Mobile layout: stacked card ─────────────────── */}
                  <div className="md:hidden flex items-start gap-3">
                    <div className="flex-shrink-0">{scoreCell}</div>
                    <div className="flex-1 min-w-0">
                      {testCell}
                      <div className="flex items-center flex-wrap gap-1.5 mt-2">
                        {subjectChip}
                        {modeChip}
                        {dateCell}
                      </div>
                      <div className="mt-2">{actionsCell}</div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ── Pagination (hasMore-based) ─────────────────────────────────────
          We no longer fetch a total page count — the backend skipped the
          countDocuments() to save a query. Prev/Next controls are driven by
          `page` (for prev) and `hasMore` (for next). */}
      {(page > 1 || hasMore) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-5">
          <p className="text-sm text-[var(--text-muted)] text-center sm:text-left">
            Page {page}
          </p>
          <div className="flex items-center justify-center sm:justify-end gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
              aria-label="Previous page"
            >
              <FiChevronLeft className="w-4 h-4" />
              <span className="text-sm font-semibold hidden sm:inline">Prev</span>
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed min-h-[36px]"
              aria-label="Next page"
            >
              <span className="text-sm font-semibold hidden sm:inline">Next</span>
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestHistoryPage;
