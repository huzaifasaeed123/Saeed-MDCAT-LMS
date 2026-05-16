// src/modules/tests/pages/TestStatsPage.jsx
//
// Admin Test Analytics — themed to match the design system.
//   • Title/subtitle pushed up into the global top bar via usePageHeader().
//   • KPI cards, score histogram, status panel, top scorers and per-question
//     table all use theme tokens (bg-[var(--bg-surface)] / text-[var(--…)] /
//     dark variants on colored chips).
//   • Top scorers and per-question tables use zebra striping with no row
//     dividers, matching other admin tables.
//
// State, effects, API calls and chart data computation are preserved
// untouched — only the JSX and Tailwind classes changed.
import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiDownload, FiRefreshCw, FiAward, FiClock, FiUsers, FiTarget, FiCheckCircle, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import { usePageHeader } from '../../../core/layouts/PageHeaderContext';

const fmtSecs = (s) => {
  if (!s) return '00:00';
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';

const TestStatsPage = () => {
  const { id } = useParams();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  // Which top-scorer row's "Student details" panel is currently expanded.
  // Only one open at a time keeps the table from ballooning.
  const [expandedRow, setExpandedRow] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/tests/${id}/stats`);
      if (res.data.success) setData(res.data.data);
      else toast.error(res.data.message || 'Failed to load stats');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  // Triggers a blob download. Adding `detail=1` opts into the heavier
  // per-attempt × per-question audit sheet (admin-only deep audit).
  const downloadExcel = async (detail = false) => {
    setDownloading(true);
    try {
      const res = await apiClient.get(`/tests/${id}/stats/export${detail ? '?detail=1' : ''}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      const safe = (data?.test?.title || 'test').replace(/[^a-z0-9_-]+/gi, '_').slice(0, 50);
      a.download = `test-stats-${safe}${detail ? '-detailed' : ''}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Download failed');
    } finally {
      setDownloading(false);
    }
  };

  // ── Push title/subtitle to top navbar ───────────────────────────────────
  const headerSubtitle = data?.test
    ? `Analytics for "${data.test.title}"`
    : 'Test analytics & download';

  const headerAction = useMemo(() => (
    <div className="flex items-center gap-2">
      <Link
        to={`/tests/${id}`}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--text-muted)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-muted)] transition-colors"
        title="Back to test"
      >
        <FiArrowLeft className="w-4 h-4" /> Back
      </Link>
      <button
        type="button"
        onClick={fetchStats}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--text-muted)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-muted)] transition-colors"
      >
        <FiRefreshCw className="w-4 h-4" /> Refresh
      </button>
      <button
        type="button"
        onClick={() => downloadExcel(false)}
        disabled={downloading}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl disabled:opacity-50 transition-colors"
      >
        <FiDownload className="w-4 h-4" /> Excel
      </button>
      <button
        type="button"
        onClick={() => downloadExcel(true)}
        disabled={downloading}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-secondary-700 hover:bg-secondary-800 text-white rounded-xl disabled:opacity-50 transition-colors"
        title="Includes a per-attempt × per-question audit sheet (heavier file)"
      >
        <FiDownload className="w-4 h-4" /> Excel + Detail
      </button>
    </div>
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [downloading, id, data?.test?.title]);

  usePageHeader({
    title:    data?.test?.title || 'Test Stats',
    subtitle: headerSubtitle,
    action:   headerAction,
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <p className="text-sm text-[var(--text-muted)]">No data.</p>
      </div>
    );
  }

  const { test, summary, histogram, topScorers, perQuestion } = data;
  const maxBucket = Math.max(1, ...histogram.map((h) => h.count));

  return (
    <div>
      {/* Mobile-only action row (navbar action slot is desktop-only) */}
      <div className="md:hidden mb-4 flex flex-wrap gap-2">
        <Link
          to={`/tests/${id}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--text-muted)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-muted)] transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" /> Back
        </Link>
        <button
          type="button"
          onClick={fetchStats}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[var(--text-muted)] border border-[var(--border)] rounded-xl hover:bg-[var(--bg-muted)] transition-colors"
        >
          <FiRefreshCw className="w-4 h-4" /> Refresh
        </button>
        <button
          type="button"
          onClick={() => downloadExcel(false)}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl disabled:opacity-50 transition-colors"
        >
          <FiDownload className="w-4 h-4" /> Excel
        </button>
        <button
          type="button"
          onClick={() => downloadExcel(true)}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold bg-secondary-700 hover:bg-secondary-800 text-white rounded-xl disabled:opacity-50 transition-colors"
        >
          <FiDownload className="w-4 h-4" /> + Detail
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-5">
        <Kpi icon={<FiUsers />}        label="Attempts"        value={summary.totalAttempts} />
        <Kpi icon={<FiCheckCircle />}  label="Completed"       value={summary.completedCount} />
        <Kpi icon={<FiUsers />}        label="Unique Students" value={summary.uniqueStudents} />
        <Kpi icon={<FiAward />}        label="Avg Score"       value={`${summary.avgScorePct}%`} />
        <Kpi icon={<FiTarget />}       label="Pass Rate"       value={`${summary.passRate}%`} />
        <Kpi icon={<FiClock />}        label="Avg Time"        value={fmtSecs(summary.avgTimeSec)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        {/* Score histogram */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 lg:col-span-2">
          <h2 className="font-display text-base font-bold text-[var(--text-strong)] mb-3">Score Distribution</h2>
          <div className="space-y-1.5">
            {histogram.map((h) => (
              <div key={h.range} className="flex items-center gap-2 text-xs">
                <span className="w-14 text-[var(--text-muted)]">{h.range}%</span>
                <div className="flex-1 bg-[var(--bg-muted)] rounded h-4 overflow-hidden">
                  <div
                    className="h-full bg-primary-500"
                    style={{ width: `${(h.count / maxBucket) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-[var(--text)]">{h.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status / Mode breakdown */}
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
          <h2 className="font-display text-base font-bold text-[var(--text-strong)] mb-3">Status</h2>
          <Row k="Completed"   v={summary.completedCount}  />
          <Row k="In Progress" v={summary.inProgressCount} />
          <Row k="Abandoned"   v={summary.abandonedCount}  />
          <hr className="my-2 border-[var(--border-faint)]" />
          <Row k="Tutor Mode"  v={summary.tutorModeCount} />
          <Row k="Timer Mode"  v={summary.timerModeCount} />
          <hr className="my-2 border-[var(--border-faint)]" />
          <Row k="Min Score"   v={`${summary.minScorePct}%`}   />
          <Row k="Median"      v={`${summary.medianScorePct}%`} />
          <Row k="Max Score"   v={`${summary.maxScorePct}%`}   />
          <hr className="my-2 border-[var(--border-faint)]" />
          <Row k="First Attempt" v={fmtDate(summary.firstAttemptAt)} />
          <Row k="Last Attempt"  v={fmtDate(summary.lastAttemptAt)}  />
        </div>
      </div>

      {/* Top scorers */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 mb-5">
        <h2 className="font-display text-base font-bold text-[var(--text-strong)] mb-3">Top Scorers</h2>
        {topScorers.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No completed attempts yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:mx-0">
            <table className="w-full text-sm">
              <thead className="bg-[var(--bg-muted)]">
                <tr className="text-left text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">
                  <th className="py-2.5 px-3 w-8" />
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Student</th>
                  <th className="py-2.5 px-3">Score</th>
                  <th className="py-2.5 px-3">%</th>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Mode</th>
                </tr>
              </thead>
              <tbody>
                {topScorers.map((s, i) => {
                  const open = expandedRow === s.attemptId;
                  // Show expand button only if the student has any extra
                  // profile info worth revealing.
                  const hasExtra = s.userFatherName || s.userProvince || s.userDistrict || s.userClass || s.userStudentStatus || s.userFscCollege || s.userFscBoard || s.userContact;
                  return (
                    <React.Fragment key={s.attemptId}>
                      <tr className="odd:bg-[var(--bg-surface)] even:bg-[var(--bg-muted)] hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-colors">
                        <td className="py-2.5 px-3 align-top">
                          <button
                            type="button"
                            onClick={() => setExpandedRow(open ? null : s.attemptId)}
                            disabled={!hasExtra}
                            className="p-1 rounded text-[var(--text-faint)] hover:bg-[var(--bg-muted)] disabled:opacity-30 disabled:cursor-default transition-colors"
                            title={hasExtra ? (open ? 'Hide details' : 'Show details') : 'No extra details'}
                          >
                            {open ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text-muted)] align-top">{i + 1}</td>
                        <td className="py-2.5 px-3 align-top">
                          <div className="font-medium text-[var(--text-strong)] leading-tight">{s.userName || '—'}</div>
                          {s.userFatherName && <div className="text-xs text-[var(--text-muted)] leading-tight mt-0.5">s/o {s.userFatherName}</div>}
                          <div className="text-xs text-[var(--text-faint)] leading-tight mt-0.5 truncate max-w-[260px]">{s.userEmail || '—'}</div>
                        </td>
                        <td className="py-2.5 px-3 text-[var(--text)] align-top">{s.score}/{s.maxScore}</td>
                        <td className="py-2.5 px-3 font-semibold text-[var(--text-strong)] align-top">{(s.scorePercentage || 0).toFixed(1)}%</td>
                        <td className="py-2.5 px-3 text-[var(--text-muted)] align-top">{fmtSecs(s.totalTimeSpent)}</td>
                        <td className="py-2.5 px-3 capitalize text-[var(--text-muted)] align-top">{s.mode}</td>
                      </tr>
                      {open && hasExtra && (
                        <tr className="bg-primary-50/40 dark:bg-primary-950/20">
                          <td />
                          <td colSpan={6} className="py-3 px-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                              {s.userContact && (<DetailCell k="Contact" v={s.userContact} />)}
                              {s.userProvince && (<DetailCell k="Province" v={s.userProvince} />)}
                              {s.userDistrict && (<DetailCell k="District" v={s.userDistrict} />)}
                              {s.userClass && (<DetailCell k="Class" v={s.userClass} />)}
                              {s.userStudentStatus && (<DetailCell k="Status" v={s.userStudentStatus} />)}
                              {s.userFscCollege && (<DetailCell k="FSC College" v={s.userFscCollege} />)}
                              {s.userFscBoard && (<DetailCell k="FSC Board" v={s.userFscBoard} />)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Per-question */}
      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5">
        <h2 className="font-display text-base font-bold text-[var(--text-strong)] mb-3">Per-Question Stats</h2>
        {perQuestion.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No attempt data yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-5 sm:mx-0">
            <table className="w-full text-xs">
              <thead className="bg-[var(--bg-muted)]">
                <tr className="text-left text-[10px] font-mono uppercase tracking-[0.16em] text-[var(--text-faint)]">
                  <th className="py-2.5 px-2">#</th>
                  <th className="py-2.5 px-2">Question</th>
                  <th className="py-2.5 px-2">Correct</th>
                  <th className="py-2.5 px-2">A%</th>
                  <th className="py-2.5 px-2">B%</th>
                  <th className="py-2.5 px-2">C%</th>
                  <th className="py-2.5 px-2">D%</th>
                  <th className="py-2.5 px-2">E%</th>
                  <th className="py-2.5 px-2">Omit%</th>
                  <th className="py-2.5 px-2">Correct%</th>
                  <th className="py-2.5 px-2">Reports</th>
                </tr>
              </thead>
              <tbody>
                {perQuestion.map((q, i) => (
                  <tr key={q.mcqId} className="odd:bg-[var(--bg-surface)] even:bg-[var(--bg-muted)] hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-colors">
                    <td className="py-2 px-2 text-[var(--text-muted)]">{i + 1}</td>
                    <td className="py-2 px-2 max-w-md truncate text-[var(--text)]" title={q.questionText}>{q.questionText || '—'}</td>
                    <td className="py-2 px-2 font-semibold text-emerald-600 dark:text-emerald-300">{q.correctOption || '—'}</td>
                    <PickCell value={q.picks.Apct} highlight={q.correctOption === 'A'} />
                    <PickCell value={q.picks.Bpct} highlight={q.correctOption === 'B'} />
                    <PickCell value={q.picks.Cpct} highlight={q.correctOption === 'C'} />
                    <PickCell value={q.picks.Dpct} highlight={q.correctOption === 'D'} />
                    <PickCell value={q.picks.Epct} highlight={q.correctOption === 'E'} />
                    <td className="py-2 px-2 text-[var(--text-muted)]">{q.omittedPct}%</td>
                    <td className="py-2 px-2 font-semibold text-[var(--text-strong)]">{q.correctPct}%</td>
                    <td className="py-2 px-2 text-[var(--text)]">{q.reportedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const Kpi = ({ icon, label, value }) => (
  <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-4">
    <div className="flex items-center gap-2 text-[var(--text-faint)] text-[11px] font-mono uppercase tracking-[0.16em] mb-1.5">
      <span className="text-primary-600 dark:text-primary-300">{icon}</span>
      <span>{label}</span>
    </div>
    <div className="font-display text-xl font-extrabold text-[var(--text-strong)] leading-none">{value}</div>
  </div>
);

const Row = ({ k, v }) => (
  <div className="flex items-center justify-between text-sm py-1">
    <span className="text-[var(--text-muted)]">{k}</span>
    <span className="font-medium text-[var(--text-strong)]">{v}</span>
  </div>
);

// Bold + colored when this column is the correct option — makes the heat
// map of "where did students go wrong" obvious at a glance.
const PickCell = ({ value, highlight }) => (
  <td className={`py-2 px-2 ${highlight ? 'text-emerald-600 dark:text-emerald-300 font-semibold' : 'text-[var(--text)]'}`}>{value}%</td>
);

// Single key/value cell in the "Student details" expand panel.
const DetailCell = ({ k, v }) => (
  <div>
    <div className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-faint)]">{k}</div>
    <div className="text-[var(--text-strong)]">{v}</div>
  </div>
);

export default TestStatsPage;
