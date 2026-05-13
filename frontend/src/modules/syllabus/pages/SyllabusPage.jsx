import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { FiCheckSquare, FiCalendar, FiList, FiBarChart2 } from 'react-icons/fi';
import * as svc from '../services/syllabusService';
import Hero          from '../components/Hero';
import StatTiles     from '../components/StatTiles';
import TopicDetailSheet from '../components/TopicDetailSheet';
import TodayPane     from '../panes/TodayPane';
import WeekPane      from '../panes/WeekPane';
import BrowsePane    from '../panes/BrowsePane';
import StatsPane     from '../panes/StatsPane';
import {
  flattenTree, topicById,
  selectDue, selectUpcoming, selectSuggestedNew, selectCounts, selectReminders,
} from '../components/syllabusSelectors';

// ─────────────────────────────────────────────────────────────────────────────
// SyllabusPage — single-page student experience.
//
// Data model:
//   • Mount: one parallel fetch (tree + progress + today + notes).
//   • Mutations: each makes ONE API call and merges the response into local
//     state surgically. No refetches, no SSE auto-reload.
//   • All "derived" data (due, upcoming, counts, reminders, mastered %) is
//     computed via useMemo selectors over the raw state — recomputes for
//     free on every render.
//   • Tab switches are zero-cost UI flips. Week pane lazy-loads ONCE the
//     first time it's opened (handled inside WeekPane).
//   • Manual "Refresh" button (top-right of the hero) is the only way to
//     re-pull data after mount.
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'today',    label: 'Today',    Icon: FiCheckSquare },
  { key: 'week',     label: 'Week',     Icon: FiCalendar },
  { key: 'syllabus', label: 'Syllabus', Icon: FiList },
  { key: 'stats',    label: 'Stats',    Icon: FiBarChart2 },
];

// Compute "today + 7d" without pulling in dayPkt — selectors only need
// string compares.
const addDaysStr = (day, n) => {
  if (!day) return day;
  const [y, m, d] = day.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + n));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
};

const SyllabusPage = () => {
  // ── Raw state owned by this page ───────────────────────────────────────
  const [tab,         setTab]         = useState('today');
  const [tree,        setTree]        = useState(null);
  const [progressMap, setProgressMap] = useState({});
  const [todos,       setTodos]       = useState([]);
  const [notes,       setNotes]       = useState([]);
  const [today,       setToday]       = useState('');
  const [streak,      setStreak]      = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [sheetTopicId, setSheetTopicId] = useState(null);

  // ── ONE batch load on mount ────────────────────────────────────────────
  // Subsequent state changes are surgical — never re-runs unless the user
  // explicitly hits the Refresh button.
  const loadAll = useCallback(async () => {
    const [treeRes, progRes, todayRes, notesRes] = await Promise.all([
      svc.getTree(),
      svc.getProgress(),
      svc.getToday(),
      svc.listNotes(),
    ]);
    setTree(treeRes);
    const map = {};
    for (const p of progRes.progress || []) map[String(p.topic)] = p;
    setProgressMap(map);
    setToday(todayRes.today || '');
    setStreak(todayRes.streak || 0);
    setTodos(todayRes.todos || []);
    setNotes(notesRes.data || []);
  }, []);

  useEffect(() => {
    let alive = true;
    loadAll()
      .catch(() => alive && toast.error('Failed to load syllabus'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [loadAll]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadAll(); toast.success('Refreshed'); }
    catch { toast.error('Refresh failed'); }
    finally { setRefreshing(false); }
  }, [loadAll]);

  // ── Derived state via memoized selectors. ZERO API calls. ──────────────
  const flat        = useMemo(() => flattenTree(tree), [tree]);
  const counts      = useMemo(() => selectCounts(progressMap, flat.length), [progressMap, flat.length]);
  const due         = useMemo(() => selectDue(progressMap, flat, today), [progressMap, flat, today]);
  const upcoming    = useMemo(() => selectUpcoming(progressMap, flat, today, addDaysStr(today, 7)), [progressMap, flat, today]);
  const newTopics   = useMemo(() => selectSuggestedNew(progressMap, flat), [progressMap, flat]);
  const pendingTodo = useMemo(() => todos.filter((t) => !t.done).length, [todos]);
  const reminders   = useMemo(() => selectReminders(progressMap, flat, due.length, pendingTodo), [progressMap, flat, due.length, pendingTodo]);
  const masteredPct = counts.totalTopics ? Math.round((counts.mastered / counts.totalTopics) * 100) : 0;

  // ── Surgical update helpers — handed to children as callbacks ──────────

  // Merge a partial progress row update for one topic.
  const onProgressChange = useCallback((topicId, patch) => {
    setProgressMap((m) => ({
      ...m,
      [String(topicId)]: { ...(m[String(topicId)] || { topic: topicId }), ...patch },
    }));
  }, []);

  // Reload ONLY the todo list after the auto-plan endpoint creates many.
  // Cheaper than letting the server echo every doc.
  const reloadTodos = useCallback(async () => {
    try {
      const r = await svc.listTodos();
      setTodos(r.data || []);
    } catch { /* silent */ }
  }, []);

  // ── Topic-detail sheet plumbing ────────────────────────────────────────
  const sheetTopic = useMemo(() => sheetTopicId ? topicById(flat, sheetTopicId) : null, [sheetTopicId, flat]);
  const sheetProgress = useMemo(() => sheetTopicId ? progressMap[String(sheetTopicId)] : null, [sheetTopicId, progressMap]);

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto bg-slate-950 min-h-full -m-6">
      <Hero
        due={due.length}
        mastered={counts.mastered}
        totalTopics={counts.totalTopics}
        streak={streak}
        onStart={() => setTab('today')}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <StatTiles
        totalTopics={counts.totalTopics}
        started={counts.started}
        mastered={counts.mastered}
        masteredPct={masteredPct}
        due={due.length}
        streak={streak}
      />

      {/* Tab strip — pure UI flips, no API calls */}
      <div className="flex gap-1.5 mb-5 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
        {TABS.map((t) => {
          const TabIcon = t.Icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all ${
                tab === t.key
                  ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TabIcon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'today' && (
        <TodayPane
          today={today}
          reminders={reminders}
          due={due}
          upcoming={upcoming}
          suggestedNew={newTopics}
          todos={todos}
          notes={notes}
          onOpenTopic={setSheetTopicId}
          onTodoCreated={(t) => setTodos((arr) => [...arr, t])}
          onTodoUpdated={(t) => setTodos((arr) => arr.map((x) => x._id === t._id ? { ...x, ...t } : x))}
          onTodoDeleted={(id) => setTodos((arr) => arr.filter((x) => x._id !== id))}
          onTodosSeeded={reloadTodos}
          onNoteCreated={(n) => setNotes((arr) => [n, ...arr])}
          onNoteUpdated={(n) => setNotes((arr) => arr.map((x) => x._id === n._id ? { ...x, ...n } : x))}
          onNoteDeleted={(id) => setNotes((arr) => arr.filter((x) => x._id !== id))}
        />
      )}

      {/* Week pane mounts only when its tab is active, so it doesn't fetch
          unless the student actually opens it. */}
      {tab === 'week' && <WeekPane />}

      {tab === 'syllabus' && (
        <BrowsePane tree={tree} progressMap={progressMap} onOpenTopic={setSheetTopicId} />
      )}

      {tab === 'stats' && (
        <StatsPane counts={counts} tree={tree} progressMap={progressMap} />
      )}

      {sheetTopic && (
        <TopicDetailSheet
          topic={sheetTopic}
          progress={sheetProgress}
          today={today}
          onClose={() => setSheetTopicId(null)}
          onProgressChange={(patch) => onProgressChange(sheetTopic._id, patch)}
        />
      )}
    </div>
  );
};

export default SyllabusPage;
