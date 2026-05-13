// ── Pure selectors over the raw syllabus state ───────────────────────────────
// SyllabusPage holds the raw state (tree, progressMap, todos, notes); every
// derived value the UI needs (due list, counts, reminders, etc.) is computed
// from that state via these pure functions. They are wrapped in useMemo at
// the call site so re-renders cost nothing extra.
//
// Adding new derived data? Add another selector here — don't refetch.

// Walk the tree once and build a flat array of topics enriched with their
// parent subject + unit metadata. Cheap (~300 items).
export const flattenTree = (tree) => {
  if (!tree?.subjects) return [];
  const out = [];
  for (const s of tree.subjects) {
    for (const u of s.units) {
      for (const o of u.outcomes) {
        out.push({
          _id:         o._id,
          outcomeCode: o.outcomeCode,
          outcomeText: o.outcomeText,
          subject:     s.subject,
          unitNumber:  u.unitNumber,
          unitTitle:   u.unitTitle,
        });
      }
    }
  }
  return out;
};

// Look up a topic by id without re-walking the tree (callers should pass the
// memoized flat list). Returns null if unknown.
export const topicById = (flat, id) => flat.find((t) => String(t._id) === String(id)) || null;

// Merge a progress row with the topic metadata for display.
const enrich = (p, topic) => topic ? {
  ...p,
  topic:       topic._id,
  subject:     topic.subject,
  unitNumber:  topic.unitNumber,
  unitTitle:   topic.unitTitle,
  outcomeCode: topic.outcomeCode,
  outcomeText: topic.outcomeText,
} : p;

// Due today: nextReviewDay ≤ today AND not mastered.
// Sorted oldest-due first so students tackle the most overdue topic first.
export const selectDue = (progressMap, flat, today) => {
  const out = [];
  for (const id in progressMap) {
    const p = progressMap[id];
    if (p.status === 'mastered') continue;
    if (!p.nextReviewDay || p.nextReviewDay > today) continue;
    const t = topicById(flat, p.topic);
    if (t) out.push(enrich(p, t));
  }
  out.sort((a, b) => (a.nextReviewDay || '').localeCompare(b.nextReviewDay || ''));
  return out;
};

// Upcoming: next 7 days, excluding today's due.
export const selectUpcoming = (progressMap, flat, today, weekEnd) => {
  const out = [];
  for (const id in progressMap) {
    const p = progressMap[id];
    if (p.status === 'mastered') continue;
    if (!p.nextReviewDay) continue;
    if (p.nextReviewDay <= today || p.nextReviewDay > weekEnd) continue;
    const t = topicById(flat, p.topic);
    if (t) out.push(enrich(p, t));
  }
  out.sort((a, b) => (a.nextReviewDay || '').localeCompare(b.nextReviewDay || ''));
  return out.slice(0, 50);
};

// New topics the student hasn't started yet — first 12 in catalog order.
export const selectSuggestedNew = (progressMap, flat) => {
  const started = new Set(Object.keys(progressMap));
  const out = [];
  for (const t of flat) {
    if (started.has(String(t._id))) continue;
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
};

// Aggregated counters used by the hero + stat tiles + stats pane KPI row.
// One pass over progressMap is enough.
export const selectCounts = (progressMap, flatTotal) => {
  const c = {
    totalTopics:  flatTotal,
    started:      0,
    mastered:     0,
    reviewing:    0,
    learning:     0,
    nw:           0,
    lecturesDone: 0,
    booksDone:    0,
    mcqsDone:     0,
  };
  for (const id in progressMap) {
    const p = progressMap[id];
    c.started++;
    if      (p.status === 'mastered')  c.mastered++;
    else if (p.status === 'reviewing') c.reviewing++;
    else if (p.status === 'learning')  c.learning++;
    else                                c.nw++;
    if (p.lectureDone) c.lecturesDone++;
    if (p.bookDone)    c.booksDone++;
    c.mcqsDone += p.mcqCount || 0;
  }
  // "New" from the catalog perspective = total - started.
  c.newFromCatalog = Math.max(0, flatTotal - c.started);
  return c;
};

// Tracker-gap reminders — same logic the server used in /me/today. We do it
// client-side so it stays in sync after every optimistic update.
export const selectReminders = (progressMap, flat, dueCount, pendingTodos) => {
  const reminders = [];

  if (dueCount > 0) {
    reminders.push({
      type: 'revision-due', severity: 'high', count: dueCount,
      message: `${dueCount} topic${dueCount === 1 ? ' is' : 's are'} due for revision today.`,
    });
  }

  // Up to 30 tracker-gap topics → at most ~10 reminders surface.
  let i = 0;
  for (const id in progressMap) {
    if (i >= 30) break;
    const p = progressMap[id];
    const t = topicById(flat, p.topic);
    if (!t) continue;
    const target = p.mcqTarget || 50;

    if (p.lectureDone && !p.bookDone) {
      reminders.push({
        type: 'book-pending', severity: 'warn',
        topic: p.topic, ...t,
        message: `Book reading pending — you watched the lecture for ${t.outcomeCode}.`,
      });
      i++;
    } else if (p.lectureDone && p.bookDone) {
      if (p.mcqCount === 0) {
        reminders.push({
          type: 'mcqs-missing', severity: 'warn',
          topic: p.topic, ...t,
          message: `No MCQs practiced yet — target ${target} for ${t.outcomeCode}.`,
        });
        i++;
      } else if (p.mcqCount < 20) {
        reminders.push({
          type: 'mcqs-low', severity: 'high',
          topic: p.topic, ...t,
          message: `Only ${p.mcqCount} MCQs done for ${t.outcomeCode} — push to ${target}.`,
        });
        i++;
      } else if (p.mcqCount < target) {
        reminders.push({
          type: 'mcqs-mid', severity: 'info',
          topic: p.topic, ...t,
          message: `${p.mcqCount}/${target} MCQs — almost there on ${t.outcomeCode}.`,
        });
        i++;
      }
    }
  }

  if (pendingTodos > 0) {
    reminders.push({
      type: 'todo-pending', severity: 'info', count: pendingTodos,
      message: `${pendingTodos} to-do item${pendingTodos === 1 ? '' : 's'} still pending for today.`,
    });
  }
  return reminders;
};
