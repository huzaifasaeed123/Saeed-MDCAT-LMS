import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArrowLeft, FiDownload, FiRefreshCw, FiAward, FiClock, FiUsers, FiTarget, FiCheckCircle, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';

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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <p className="text-gray-500">No data.</p>
      </div>
    );
  }

  const { test, summary, histogram, topScorers, perQuestion } = data;
  const maxBucket = Math.max(1, ...histogram.map((h) => h.count));

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <Link to={`/tests/${id}`} className="text-gray-500 hover:text-gray-700" title="Back to test">
            <FiArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{test.title}</h1>
            <p className="text-sm text-gray-500">Test analytics & download</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStats}
            className="px-3 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1"
          >
            <FiRefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={() => downloadExcel(false)}
            disabled={downloading}
            className="px-3 py-2 text-sm rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white flex items-center gap-1"
          >
            <FiDownload className="w-4 h-4" /> Excel
          </button>
          <button
            onClick={() => downloadExcel(true)}
            disabled={downloading}
            className="px-3 py-2 text-sm rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white flex items-center gap-1"
            title="Includes a per-attempt × per-question audit sheet (heavier file)"
          >
            <FiDownload className="w-4 h-4" /> Excel + Detail
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <Kpi icon={<FiUsers />}        label="Attempts"        value={summary.totalAttempts} />
        <Kpi icon={<FiCheckCircle />}  label="Completed"       value={summary.completedCount} />
        <Kpi icon={<FiUsers />}        label="Unique Students" value={summary.uniqueStudents} />
        <Kpi icon={<FiAward />}        label="Avg Score"       value={`${summary.avgScorePct}%`} />
        <Kpi icon={<FiTarget />}       label="Pass Rate"       value={`${summary.passRate}%`} />
        <Kpi icon={<FiClock />}        label="Avg Time"        value={fmtSecs(summary.avgTimeSec)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Score histogram */}
        <div className="bg-white rounded-lg shadow p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Score Distribution</h2>
          <div className="space-y-1.5">
            {histogram.map((h) => (
              <div key={h.range} className="flex items-center gap-2 text-xs">
                <span className="w-14 text-gray-500">{h.range}%</span>
                <div className="flex-1 bg-gray-100 rounded h-4 overflow-hidden">
                  <div
                    className="h-full bg-primary-500"
                    style={{ width: `${(h.count / maxBucket) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-gray-700">{h.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status / Mode breakdown */}
        <div className="bg-white rounded-lg shadow p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-3">Status</h2>
          <Row k="Completed"   v={summary.completedCount}  />
          <Row k="In Progress" v={summary.inProgressCount} />
          <Row k="Abandoned"   v={summary.abandonedCount}  />
          <hr className="my-2" />
          <Row k="Tutor Mode"  v={summary.tutorModeCount} />
          <Row k="Timer Mode"  v={summary.timerModeCount} />
          <hr className="my-2" />
          <Row k="Min Score"   v={`${summary.minScorePct}%`}   />
          <Row k="Median"      v={`${summary.medianScorePct}%`} />
          <Row k="Max Score"   v={`${summary.maxScorePct}%`}   />
          <hr className="my-2" />
          <Row k="First Attempt" v={fmtDate(summary.firstAttemptAt)} />
          <Row k="Last Attempt"  v={fmtDate(summary.lastAttemptAt)}  />
        </div>
      </div>

      {/* Top scorers */}
      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Top Scorers</h2>
        {topScorers.length === 0 ? (
          <p className="text-sm text-gray-500">No completed attempts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2 w-8" />
                  <th className="py-2 pr-4">#</th>
                  <th className="py-2 pr-4">Student</th>
                  <th className="py-2 pr-4">Score</th>
                  <th className="py-2 pr-4">%</th>
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Mode</th>
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
                      <tr className="border-b last:border-0">
                        <td className="py-2 pr-2 align-top">
                          <button
                            type="button"
                            onClick={() => setExpandedRow(open ? null : s.attemptId)}
                            disabled={!hasExtra}
                            className="p-1 rounded text-gray-400 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-default"
                            title={hasExtra ? (open ? 'Hide details' : 'Show details') : 'No extra details'}
                          >
                            {open ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                        <td className="py-2 pr-4 text-gray-500 align-top">{i + 1}</td>
                        <td className="py-2 pr-4 align-top">
                          <div className="font-medium text-gray-800 leading-tight">{s.userName || '—'}</div>
                          {s.userFatherName && <div className="text-xs text-gray-500 leading-tight mt-0.5">s/o {s.userFatherName}</div>}
                          <div className="text-xs text-gray-500 leading-tight mt-0.5 truncate max-w-[260px]">{s.userEmail || '—'}</div>
                        </td>
                        <td className="py-2 pr-4 align-top">{s.score}/{s.maxScore}</td>
                        <td className="py-2 pr-4 font-semibold align-top">{(s.scorePercentage || 0).toFixed(1)}%</td>
                        <td className="py-2 pr-4 align-top">{fmtSecs(s.totalTimeSpent)}</td>
                        <td className="py-2 pr-4 capitalize align-top">{s.mode}</td>
                      </tr>
                      {open && hasExtra && (
                        <tr className="bg-gray-50/70 border-b">
                          <td />
                          <td colSpan={6} className="py-3 pr-4">
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
      <div className="bg-white rounded-lg shadow p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-3">Per-Question Stats</h2>
        {perQuestion.length === 0 ? (
          <p className="text-sm text-gray-500">No attempt data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">Question</th>
                  <th className="py-2 pr-2">Correct</th>
                  <th className="py-2 pr-2">A%</th>
                  <th className="py-2 pr-2">B%</th>
                  <th className="py-2 pr-2">C%</th>
                  <th className="py-2 pr-2">D%</th>
                  <th className="py-2 pr-2">E%</th>
                  <th className="py-2 pr-2">Omit%</th>
                  <th className="py-2 pr-2">Correct%</th>
                  <th className="py-2 pr-2">Reports</th>
                </tr>
              </thead>
              <tbody>
                {perQuestion.map((q, i) => (
                  <tr key={q.mcqId} className="border-b last:border-0">
                    <td className="py-2 pr-2 text-gray-500">{i + 1}</td>
                    <td className="py-2 pr-2 max-w-md truncate text-gray-800" title={q.questionText}>{q.questionText || '—'}</td>
                    <td className="py-2 pr-2 font-semibold text-emerald-600">{q.correctOption || '—'}</td>
                    <PickCell value={q.picks.Apct} highlight={q.correctOption === 'A'} />
                    <PickCell value={q.picks.Bpct} highlight={q.correctOption === 'B'} />
                    <PickCell value={q.picks.Cpct} highlight={q.correctOption === 'C'} />
                    <PickCell value={q.picks.Dpct} highlight={q.correctOption === 'D'} />
                    <PickCell value={q.picks.Epct} highlight={q.correctOption === 'E'} />
                    <td className="py-2 pr-2 text-gray-500">{q.omittedPct}%</td>
                    <td className="py-2 pr-2 font-semibold">{q.correctPct}%</td>
                    <td className="py-2 pr-2">{q.reportedCount}</td>
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
  <div className="bg-white rounded-lg shadow px-4 py-3">
    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
      <span className="text-primary-600">{icon}</span>
      <span>{label}</span>
    </div>
    <div className="text-xl font-bold text-gray-800">{value}</div>
  </div>
);

const Row = ({ k, v }) => (
  <div className="flex items-center justify-between text-sm py-1">
    <span className="text-gray-500">{k}</span>
    <span className="font-medium text-gray-800">{v}</span>
  </div>
);

// Bold + colored when this column is the correct option — makes the heat
// map of "where did students go wrong" obvious at a glance.
const PickCell = ({ value, highlight }) => (
  <td className={`py-2 pr-2 ${highlight ? 'text-emerald-600 font-semibold' : 'text-gray-700'}`}>{value}%</td>
);

// Single key/value cell in the "Student details" expand panel.
const DetailCell = ({ k, v }) => (
  <div>
    <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400">{k}</div>
    <div className="text-gray-800">{v}</div>
  </div>
);

export default TestStatsPage;
