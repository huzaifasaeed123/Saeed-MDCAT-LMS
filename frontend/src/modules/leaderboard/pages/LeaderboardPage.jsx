import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiAward, FiTrendingUp, FiCalendar, FiBook, FiChevronDown,
  FiRefreshCw, FiTarget, FiZap, FiCheckCircle, FiXCircle,
  FiHash, FiPercent, FiLayers
} from 'react-icons/fi';
import apiClient from '../../../core/api/axiosConfig';
import useAuth from '../../../core/auth/useAuth';
import { getBackendUrl } from '../../../shared/utils/fixImageUrls';

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'alltime',      label: 'All-Time',      icon: <FiAward className="w-4 h-4" /> },
  { key: 'weekly',       label: 'This Week',      icon: <FiZap className="w-4 h-4" /> },
  { key: 'monthly',      label: 'This Month',     icon: <FiCalendar className="w-4 h-4" /> },
  { key: 'mostimproved', label: 'Most Improved',  icon: <FiTrendingUp className="w-4 h-4" /> },
  { key: 'subject',      label: 'Subject-Wise',   icon: <FiBook className="w-4 h-4" /> },
];

const VOL_CAPS = { alltime: 1000, weekly: 70, monthly: 300, mostimproved: 70, subject: 1000 };

const PODIUM_ORDER    = [1, 0, 2]; // display order: 2nd | 1st | 3rd
const PODIUM_HEIGHTS  = ['h-28', 'h-40', 'h-20'];
const PODIUM_COLORS   = [
  { border: '#C0C0C0', bg: '#C0C0C015', text: '#9ca3af', ring: 'ring-gray-400',   label: 'text-gray-500' },   // silver (2nd)
  { border: '#FFD700', bg: '#FFD70020', text: '#d97706', ring: 'ring-yellow-400', label: 'text-yellow-600' }, // gold (1st)
  { border: '#CD7F32', bg: '#CD7F3215', text: '#b45309', ring: 'ring-orange-400', label: 'text-orange-600' }, // bronze (3rd)
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmtTime = (iso) => {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)  return 'just now';
  if (diff < 60) return `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24)   return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const accColor = (acc) => {
  if (acc >= 80) return 'text-green-600 bg-green-50';
  if (acc >= 60) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-500 bg-red-50';
};

// ── Avatar ─────────────────────────────────────────────────────────────────────

const resolveUrl = (url) => {
  if (!url) return null;
  return url.startsWith('http') ? url : `${getBackendUrl()}${url}`;
};

const Avatar = ({ name, picture, size = 'md', ringClass = '' }) => {
  const szMap  = { xs: 'w-7 h-7 text-xs', sm: 'w-9 h-9 text-sm', md: 'w-11 h-11 text-base', lg: 'w-16 h-16 text-xl', xl: 'w-20 h-20 text-2xl' };
  const sz     = szMap[size] || szMap.md;
  const letter = name?.charAt(0)?.toUpperCase() || '?';
  const src    = resolveUrl(picture);

  return (
    <div className="relative flex-shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sz} rounded-full object-cover ${ringClass ? `ring-3 ${ringClass}` : ''}`}
          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
        />
      ) : null}
      <div
        className={`${sz} rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center ${ringClass ? `ring-3 ${ringClass}` : ''} ${src ? 'hidden' : ''}`}
      >
        {letter}
      </div>
    </div>
  );
};

// ── Skeleton ───────────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <tr className="animate-pulse">
    <td className="px-4 py-3"><div className="h-4 w-6 bg-gray-200 rounded mx-auto" /></td>
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-gray-200 rounded-full" />
        <div className="h-3 w-28 bg-gray-200 rounded" />
      </div>
    </td>
    <td className="px-4 py-3"><div className="h-5 w-16 bg-gray-200 rounded-full mx-auto" /></td>
    <td className="px-4 py-3"><div className="h-4 w-12 bg-gray-100 rounded mx-auto" /></td>
    <td className="px-4 py-3"><div className="h-4 w-10 bg-gray-100 rounded mx-auto" /></td>
    <td className="px-4 py-3"><div className="h-4 w-10 bg-gray-100 rounded mx-auto" /></td>
    <td className="px-4 py-3"><div className="h-4 w-10 bg-gray-100 rounded mx-auto" /></td>
  </tr>
);

// ── Podium ─────────────────────────────────────────────────────────────────────

const Podium = ({ entries, currentUserId }) => {
  if (!entries?.length) return null;

  // arrange as [2nd, 1st, 3rd] for display
  const slots = PODIUM_ORDER.map((idx) => entries[idx] ?? null).filter(Boolean);

  return (
    <div className="flex items-end justify-center gap-3 pt-6 pb-0 px-4">
      {slots.map((entry, displayIdx) => {
        const colorIdx = displayIdx; // 0=silver,1=gold,2=bronze
        const palette  = PODIUM_COLORS[colorIdx];
        const isMe     = entry.userId?.toString() === currentUserId;
        const incorrect = entry.totalAttempted - entry.correctCount;

        return (
          <div key={entry.userId} className="flex flex-col items-center gap-1.5 flex-1 max-w-[120px]">
            {/* Crown / medal above */}
            {colorIdx === 1 && <span className="text-3xl mb-1">👑</span>}
            {colorIdx === 0 && <span className="text-xl mb-1">🥈</span>}
            {colorIdx === 2 && <span className="text-xl mb-1">🥉</span>}

            {/* Avatar */}
            <Avatar
              name={entry.fullName}
              picture={entry.profilePicture}
              size={colorIdx === 1 ? 'xl' : 'lg'}
              ringClass={palette.ring}
            />

            {/* Name */}
            <p className={`text-xs font-bold text-center leading-tight max-w-full px-1 truncate ${isMe ? 'text-primary-700' : 'text-gray-700'}`}>
              {isMe ? 'You' : entry.fullName?.split(' ')[0]}
            </p>

            {/* Podium block */}
            <div
              className={`w-full ${PODIUM_HEIGHTS[displayIdx]} flex flex-col items-center justify-start pt-3 rounded-t-2xl border-t-4 gap-0.5`}
              style={{ borderColor: palette.border, backgroundColor: palette.bg }}
            >
              <span className="text-3xl font-black" style={{ color: palette.text }}>
                {entry.rank}
              </span>
              <span className="text-sm font-bold text-gray-700">{entry.score}</span>
              <span className="text-[10px] text-gray-400 font-medium">pts</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Personal Rank Card ─────────────────────────────────────────────────────────

const PersonalRankCard = ({ userRank, type, currentUser }) => {
  if (!userRank) return null;

  const incorrect = userRank.incorrectCount ?? (userRank.totalAttempted - userRank.correctCount);
  const rankLabel = userRank.rank != null
    ? userRank.estimated ? `~#${userRank.rank}` : `#${userRank.rank}`
    : '—';
  const isEstimated = !!userRank.estimated;

  return (
    <div className="mx-4 mb-4 rounded-2xl overflow-hidden shadow-lg">
      {/* Top banner */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-5 py-4 flex items-center gap-4">
        <Avatar name={currentUser?.fullName} picture={currentUser?.profilePicture} size="md" />
        <div className="flex-1 min-w-0">
          <p className="text-primary-100 text-xs font-medium">Your Rank</p>
          <div className="flex items-baseline gap-2">
            <p className="text-white text-2xl font-black">{rankLabel}</p>
            {isEstimated && (
              <span className="text-[10px] text-primary-200 bg-primary-700/40 px-1.5 py-0.5 rounded-full">
                estimated · updates in &lt;10 min
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-white text-3xl font-black tabular-nums">{userRank.score ?? '—'}</p>
          <p className="text-primary-200 text-xs">points</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="bg-white grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
        <StatCell label="Accuracy" value={`${userRank.accuracy ?? '—'}%`}
          icon={<FiPercent className="w-3.5 h-3.5 text-primary-400" />}
          highlight={userRank.accuracy >= 80 ? 'text-green-600' : userRank.accuracy >= 60 ? 'text-yellow-600' : 'text-red-500'} />
        <StatCell label="Total MCQs" value={userRank.totalAttempted ?? '—'}
          icon={<FiLayers className="w-3.5 h-3.5 text-blue-400" />} />
        <StatCell label="Correct" value={userRank.correctCount ?? '—'}
          icon={<FiCheckCircle className="w-3.5 h-3.5 text-green-400" />}
          highlight="text-green-600" />
        <StatCell label="Incorrect" value={incorrect ?? '—'}
          icon={<FiXCircle className="w-3.5 h-3.5 text-red-400" />}
          highlight="text-red-500" />
      </div>

      {type === 'mostimproved' && userRank.delta != null && (
        <div className="bg-white border-t border-gray-100 px-4 py-2 text-center">
          <span className={`text-sm font-bold ${userRank.delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
            {userRank.delta >= 0 ? '▲' : '▼'} {Math.abs(userRank.delta)} pts vs last week
          </span>
        </div>
      )}
    </div>
  );
};

const StatCell = ({ label, value, icon, highlight = 'text-gray-800' }) => (
  <div className="flex flex-col items-center justify-center py-3 px-2 gap-0.5">
    <div className="flex items-center gap-0.5 text-[10px] text-gray-400 uppercase tracking-wide font-medium">
      {icon} {label}
    </div>
    <p className={`text-lg font-black tabular-nums ${highlight}`}>{value}</p>
  </div>
);

// ── Table Row (rank 4+) ────────────────────────────────────────────────────────

const TableRow = ({ entry, currentUserId }) => {
  const isMe      = entry.userId?.toString() === currentUserId;
  const incorrect = entry.totalAttempted - entry.correctCount;

  return (
    <tr className={`border-b border-gray-50 transition-colors ${isMe ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
      {/* Rank */}
      <td className="px-4 py-3.5 text-center">
        <span className={`text-sm font-black tabular-nums ${isMe ? 'text-primary-600' : 'text-gray-500'}`}>
          {entry.rank}
        </span>
      </td>

      {/* Name + avatar */}
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={entry.fullName} picture={entry.profilePicture} size="sm" />
          <span className={`text-sm font-semibold truncate max-w-[140px] ${isMe ? 'text-primary-700' : 'text-gray-800'}`}>
            {isMe ? `${entry.fullName} (You)` : entry.fullName}
          </span>
        </div>
      </td>

      {/* Score */}
      <td className="px-4 py-3.5 text-center">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${isMe ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-700'}`}>
          {entry.score} pts
        </span>
      </td>

      {/* Accuracy */}
      <td className="px-4 py-3.5 text-center">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${accColor(entry.accuracy)}`}>
          {entry.accuracy}%
        </span>
      </td>

      {/* Total */}
      <td className="px-4 py-3.5 text-center text-sm text-gray-600 font-medium tabular-nums">
        {entry.totalAttempted}
      </td>

      {/* Correct */}
      <td className="px-4 py-3.5 text-center text-sm font-semibold text-green-600 tabular-nums">
        {entry.correctCount}
      </td>

      {/* Incorrect */}
      <td className="px-4 py-3.5 text-center text-sm font-semibold text-red-500 tabular-nums">
        {incorrect}
      </td>

      {/* Delta (most improved only) */}
      {entry.delta != null && (
        <td className="px-4 py-3.5 text-center text-xs font-bold tabular-nums">
          <span className={entry.delta >= 0 ? 'text-green-600' : 'text-red-500'}>
            {entry.delta >= 0 ? '▲' : '▼'} {Math.abs(entry.delta)}
          </span>
        </td>
      )}
    </tr>
  );
};

// ── Top-3 Card (used in table when 3 or fewer entries) ────────────────────────

const Top3TableRow = ({ entry, currentUserId }) => {
  const isMe      = entry.userId?.toString() === currentUserId;
  const incorrect = entry.totalAttempted - entry.correctCount;
  const medalMap  = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <tr className={`border-b border-gray-50 ${isMe ? 'bg-primary-50' : 'bg-white'}`}>
      <td className="px-4 py-3.5 text-center text-lg">{medalMap[entry.rank] || entry.rank}</td>
      <td className="px-4 py-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={entry.fullName} picture={entry.profilePicture} size="sm" />
          <span className={`text-sm font-semibold ${isMe ? 'text-primary-700' : 'text-gray-800'}`}>
            {isMe ? `${entry.fullName} (You)` : entry.fullName}
          </span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-center">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${isMe ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-700'}`}>
          {entry.score} pts
        </span>
      </td>
      <td className="px-4 py-3.5 text-center">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${accColor(entry.accuracy)}`}>
          {entry.accuracy}%
        </span>
      </td>
      <td className="px-4 py-3.5 text-center text-sm text-gray-600 font-medium tabular-nums">{entry.totalAttempted}</td>
      <td className="px-4 py-3.5 text-center text-sm font-semibold text-green-600 tabular-nums">{entry.correctCount}</td>
      <td className="px-4 py-3.5 text-center text-sm font-semibold text-red-500 tabular-nums">{incorrect}</td>
      {entry.delta != null && (
        <td className="px-4 py-3.5 text-center text-xs font-bold">
          <span className={entry.delta >= 0 ? 'text-green-600' : 'text-red-500'}>
            {entry.delta >= 0 ? '▲' : '▼'} {Math.abs(entry.delta)}
          </span>
        </td>
      )}
    </tr>
  );
};

// ── Empty State ────────────────────────────────────────────────────────────────

const EmptyState = ({ type }) => (
  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
    <FiAward className="w-14 h-14 mb-4 opacity-20" />
    <p className="text-base font-semibold text-gray-500">No rankings yet</p>
    <p className="text-sm mt-1 text-center max-w-xs">
      {type === 'subject'
        ? 'No subject boards available. Complete tests from a question bank to appear here.'
        : 'Be the first to complete a test and claim the top spot!'}
    </p>
  </div>
);

// ── Main Page ──────────────────────────────────────────────────────────────────

const LeaderboardPage = () => {
  const { user } = useAuth();
  const [activeTab,    setActiveTab]    = useState('alltime');
  const [subjects,     setSubjects]     = useState([]);
  const [selectedSubj, setSelectedSubj] = useState('');
  const [subjMenuOpen, setSubjMenuOpen] = useState(false);
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);

  const currentUserId = user?._id?.toString();
  const showDelta     = activeTab === 'mostimproved';

  // Per-tab data cache: { 'alltime': data, 'weekly': data, 'subject:biology': data }
  // Lets us show stale data immediately when switching tabs while the fresh fetch runs.
  const tabCacheRef = useRef({});

  const fetchBoardForTab = useCallback(async (tabType, subjectTitle) => {
    const key = tabType === 'subject' ? `subject:${subjectTitle}` : tabType;

    // Show cached data immediately (stale-while-revalidate)
    if (tabCacheRef.current[key]) {
      setData(tabCacheRef.current[key]);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const params = { type: tabType };
      if (tabType === 'subject') params.subjectTitle = subjectTitle;
      const res     = await apiClient.get('/leaderboard', { params });
      const newData = res.data.data || null;
      tabCacheRef.current[key] = newData;
      setData(newData);
    } catch {
      if (!tabCacheRef.current[key]) setData(null);
    } finally {
      setLoading(false);
    }
  }, []); // stable — reads tabType/subjectTitle from args, not closure

  // Load subject list once on mount
  useEffect(() => {
    apiClient.get('/leaderboard/subjects')
      .then((res) => {
        const list = res.data.data || [];
        setSubjects(list);
        if (list.length > 0) setSelectedSubj(list[0].title);
      })
      .catch(() => {});
  }, []);

  // Fetch non-subject boards when activeTab changes
  // Does NOT depend on selectedSubj → no spurious refetch when subjects load
  useEffect(() => {
    if (activeTab !== 'subject') {
      fetchBoardForTab(activeTab, null);
    }
  }, [activeTab, fetchBoardForTab]);

  // Fetch subject board when activeTab is 'subject' AND a subject is selected
  useEffect(() => {
    if (activeTab === 'subject' && selectedSubj) {
      fetchBoardForTab('subject', selectedSubj);
    }
  }, [activeTab, selectedSubj, fetchBoardForTab]);

  const entries    = data?.entries || [];
  const top3       = entries.slice(0, 3);
  const rest       = entries.slice(3);
  const hasEntries = entries.length > 0;
  const updatedAgo = data?.computedAt ? fmtTime(data.computedAt) : null;

  const tableHeaders = [
    { label: '#',         icon: <FiHash className="w-3 h-3" /> },
    { label: 'Student',   icon: null },
    { label: 'Score',     icon: null },
    { label: 'Accuracy',  icon: <FiPercent className="w-3 h-3" /> },
    { label: 'Total',     icon: <FiLayers className="w-3 h-3" /> },
    { label: 'Correct',   icon: <FiCheckCircle className="w-3 h-3" /> },
    { label: 'Incorrect', icon: <FiXCircle className="w-3 h-3" /> },
    ...(showDelta ? [{ label: 'Δ Week', icon: <FiTrendingUp className="w-3 h-3" /> }] : []),
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <FiAward className="text-primary-500 w-6 h-6" />
            Leaderboard
          </h1>
          {updatedAgo && (
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <FiRefreshCw className="w-3 h-3" /> Updated {updatedAgo}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            // Force-clear tab cache for current board so we get a real fresh fetch
            const key = activeTab === 'subject' ? `subject:${selectedSubj}` : activeTab;
            delete tabCacheRef.current[key];
            if (activeTab === 'subject' && selectedSubj) fetchBoardForTab('subject', selectedSubj);
            else if (activeTab !== 'subject') fetchBoardForTab(activeTab, null);
          }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 disabled:opacity-50 transition-colors"
        >
          <FiRefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-primary-500 text-white shadow-md shadow-primary-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-primary-300 hover:text-primary-600'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Subject selector */}
      {activeTab === 'subject' && (
        <div className="relative">
          <button
            onClick={() => setSubjMenuOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-primary-300 transition-colors shadow-sm"
          >
            <span className="flex items-center gap-2">
              <FiBook className="w-4 h-4 text-primary-500" />
              {selectedSubj
                ? <span className="capitalize">{selectedSubj}</span>
                : 'Select a subject'}
            </span>
            <FiChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${subjMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {subjMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-10 max-h-52 overflow-y-auto">
              {subjects.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-4">No subject boards yet</p>
              ) : (
                subjects.map((s) => (
                  <button
                    key={s.title}
                    onClick={() => { setSelectedSubj(s.title); setSubjMenuOpen(false); }}
                    className={`w-full text-left px-4 py-3 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors flex items-center justify-between capitalize ${
                      selectedSubj === s.title ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-700'
                    }`}
                  >
                    {s.title}
                    {s.computedAt && <span className="text-[10px] text-gray-400 normal-case">{fmtTime(s.computedAt)}</span>}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Main board card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Board description bar */}
        <div className="px-5 py-2.5 border-b border-gray-50 bg-gradient-to-r from-primary-50 to-transparent">
          <p className="text-xs text-gray-500">
            {activeTab === 'alltime'      && 'All-time rankings based on cumulative MCQ performance.'}
            {activeTab === 'weekly'       && 'Rankings based on MCQ performance in the last 7 days.'}
            {activeTab === 'monthly'      && 'Rankings based on MCQ performance in the last 30 days.'}
            {activeTab === 'mostimproved' && 'Students who improved the most compared to the previous week.'}
            {activeTab === 'subject'      && selectedSubj && <span>Rankings for subject: <strong className="capitalize">{selectedSubj}</strong>.</span>}
          </p>
        </div>

        {/* Personal rank card */}
        {!loading && data?.userRank && (
          <PersonalRankCard userRank={data.userRank} type={activeTab} currentUser={user} />
        )}

        {loading ? (
          <div className="py-2">
            {/* Skeleton podium */}
            <div className="flex items-end justify-center gap-4 px-8 py-8 animate-pulse">
              {[28, 40, 20].map((h, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-14 h-14 rounded-full bg-gray-200" />
                  <div className="h-3 w-16 bg-gray-200 rounded" />
                  <div className={`w-full h-${h} bg-gray-100 rounded-t-xl`} style={{ height: `${h * 4}px` }} />
                </div>
              ))}
            </div>
            {/* Skeleton table */}
            <table className="w-full">
              <tbody>
                {[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        ) : !hasEntries ? (
          <EmptyState type={activeTab} />
        ) : (
          <>
            {/* Podium — only when 3+ entries */}
            {top3.length >= 2 && <Podium entries={top3} currentUserId={currentUserId} />}

            {/* Full stats table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-gray-100 bg-gray-50">
                    {tableHeaders.map((h) => (
                      <th key={h.label} className="px-4 py-2.5 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        <span className="flex items-center justify-center gap-1">
                          {h.icon}{h.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Top-3 rows (always shown in table too for completeness) */}
                  {top3.map((entry) => (
                    top3.length >= 2
                      ? <TableRow key={entry.userId} entry={entry} currentUserId={currentUserId} />
                      : <Top3TableRow key={entry.userId} entry={entry} currentUserId={currentUserId} />
                  ))}
                  {/* Divider between podium entries and the rest */}
                  {rest.length > 0 && top3.length >= 2 && (
                    <tr>
                      <td colSpan={tableHeaders.length} className="px-4 py-1 bg-gray-50">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-px bg-gray-200" />
                          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Ranks 4 – {entries.length}</span>
                          <div className="flex-1 h-px bg-gray-200" />
                        </div>
                      </td>
                    </tr>
                  )}
                  {rest.map((entry) => (
                    <TableRow key={entry.userId} entry={entry} currentUserId={currentUserId} />
                  ))}
                </tbody>
              </table>
            </div>

            {entries.length >= 50 && (
              <p className="text-center text-xs text-gray-400 py-3 border-t border-gray-50">
                Showing top 50 players
              </p>
            )}
          </>
        )}
      </div>

      {/* Legends */}
      {activeTab === 'mostimproved' && (
        <div className="bg-blue-50 rounded-xl p-4 text-sm border border-blue-100">
          <p className="font-semibold text-blue-800 mb-1 flex items-center gap-1.5">
            <FiTrendingUp className="w-4 h-4" /> How Most Improved Works
          </p>
          <p className="text-xs text-blue-600 leading-relaxed">
            Compares this week's score vs last week's. Score = improvement × activity bonus.
            Minimum 10 MCQs this week required. The Δ column shows the raw score change.
          </p>
        </div>
      )}

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1.5">
          <FiTarget className="w-3.5 h-3.5" /> Scoring Formula
        </p>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Score (0–1000) = Accuracy 70% + Volume 30%.
          Accuracy uses Bayesian smoothing to be fair for students with fewer attempts.
          Volume cap for this board: <strong>{VOL_CAPS[activeTab]}</strong> MCQs.
          Boards refresh every 10 minutes.
        </p>
      </div>
    </div>
  );
};

export default LeaderboardPage;
