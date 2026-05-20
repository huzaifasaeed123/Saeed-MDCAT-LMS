// backend/migrations/import-legacy.js
//
// One-shot importer: legacy SQLite portal.db  →  current MongoDB.
//
// Run on the live server (Coolify Terminal) with:
//     node migrations/import-legacy.js /app/uploads/portal.db
//
// Re-runs are blocked by an idempotency marker in the `migration_markers`
// collection. Pass --force to override.
//
// What it migrates (in this order):
//   1.  Users               (legacy `users`,  ~1700)
//   2.  Question Bank       (1 QB with full Subject→Chapter→Topic hierarchy)
//   3.  MCQs                (~21k, skips ones whose images point at broken
//                            relative paths that no longer exist anywhere)
//   4.  SavedQuestions      (from `mcq_marks`, ~17k)
//   5.  MCQ Reports         (from `mcq_reports`, ~1k)
//   6.  UserMcqHistory      (collapses ~770k `mcq_attempts` into ~600k
//                            per-(user,mcq) history docs that drive the
//                            AutoTestGenerator's Used/Unused/Correct/etc.
//                            filter)
//   7.  User-Generated Tests (from `qbank_sessions`, ~20k — each becomes
//                            ONE Test doc + ONE UserTestAttempt doc, mirrors
//                            our portal's "auto-built test" flow)
//   8.  Posts + Replies     (~1.2k posts, ~2.9k replies; image_url passes
//                            through unchanged — copy legacy `uploads/` into
//                            `backend/uploads/` and URLs just work)
//
// What it SKIPS by design (per migration plan):
//   • admin-created `tests_v2` (12 tests)  — not requested
//   • leaderboard / streaks / points       — recomputed by the server
//   • flash cards / squads / loot boxes     — features removed in new portal
//   • user_notifications                    — not requested
//   • direct_messages                       — not requested in this pass
//
// Corruption handling: the legacy DB has page-level damage in `mcq_attempts`
// and `qbank_sessions`. We page-scan with try/except per page (and per row
// inside batches) so corrupted rows are skipped with a log line rather than
// aborting the whole run.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const path     = require('path');
const fs       = require('fs');
const mongoose = require('mongoose');

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  console.error('[ERR] better-sqlite3 is not installed.');
  console.error('       Run from the backend folder: npm install better-sqlite3');
  process.exit(1);
}

// ── Models ───────────────────────────────────────────────────────────────────
const User           = require('../models/User');
const QuestionBank   = require('../models/QuestionBankModel');
const MCQ            = require('../models/McqModel');
const Test           = require('../models/TestModel');
const UserTestAttempt= require('../models/UserTestAttempt');
const UserMcqHistory = require('../models/UserMcqHistory');
const SavedQuestion  = require('../models/SavedQuestion');
const MCQReport      = require('../models/MCQReport');
const Post           = require('../models/Post');
const Reply          = require('../models/Reply');

// ── CLI args ─────────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const dbPath = args.find((a) => !a.startsWith('--'));
const force  = args.includes('--force');
const dryRun = args.includes('--dry-run');

if (!dbPath || !fs.existsSync(dbPath)) {
  console.error('Usage: node migrations/import-legacy.js <portal.db path> [--force] [--dry-run]');
  console.error('Example: node migrations/import-legacy.js /app/uploads/portal.db');
  process.exit(1);
}

// ── Configurable knobs ───────────────────────────────────────────────────────
const QB_TITLE        = 'SKN MDCAT Bank';
const NO_CHAPTER_NAME = '(No chapter)';
const NO_TOPIC_NAME   = '(No topic)';
const BATCH_SIZE      = 500;

// Page-by-page scan size for corrupted tables. Smaller = more page boundaries
// the script can recover across; larger = faster on clean tables.
const SCAN_PAGE = 1000;

// Tutor role doesn't exist in the new portal — map to teacher.
const ROLE_MAP = { admin: 'admin', tutor: 'teacher', teacher: 'teacher', student: 'student' };

// Legacy MCQ report reasons → new portal's enum.
const REPORT_REASON_MAP = {
  typo:          'Question Statement Wrong',
  wrong_answer:  'Answer Key is Incorrect',
  bad_option:    'Option Wrong',
  unclear_stem:  'Question Statement Wrong',
  other:         'Need Explanation',
};

// Legacy report status → new enum (open | active | closed).
const REPORT_STATUS_MAP = {
  open:         'open',
  acknowledged: 'active',
  fixed:        'closed',
  dismissed:    'closed',
};

// Legacy post type/subject → new portal's enums.
const POST_TYPE_MAP = {
  doubt:        'doubt',
  discussion:   'discussion',
  poll:         'poll',
  announcement: 'announcement',
};
const POST_CATEGORY_MAP = {
  general:    'general',
  biology:    'biology',
  chemistry:  'chemistry',
  physics:    'physics',
  english:    'english',
  logic:      'logical_reasoning',
  logical:    'logical_reasoning',
  'logical reasoning': 'logical_reasoning',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const log     = (...a) => console.log('[migrate]', ...a);
const warn    = (...a) => console.warn('[warn]   ', ...a);
const oid     = () => new mongoose.Types.ObjectId();
const safeStr = (v) => (v == null ? '' : String(v));

// Convert legacy `correct_idx` (0..3) → optionLetter (A/B/C/D/E).
const idxToLetter = (i) => ['A', 'B', 'C', 'D', 'E'][i] ?? null;

// Build the 4 standardised options from a legacy `options_json` array + correct_idx.
const buildOptions = (optionsJson, correctIdx) => {
  let arr;
  try { arr = JSON.parse(optionsJson); } catch { return null; }
  if (!Array.isArray(arr) || arr.length < 2) return null;
  return arr.map((text, i) => ({
    optionLetter: ['A', 'B', 'C', 'D', 'E'][i],
    optionText:   safeStr(text),
    isCorrect:    i === correctIdx,
  })).filter((o) => o.optionLetter); // drop >5 options
};

// Detect MCQs whose images reference broken relative paths.
// 892 use S3 (work everywhere), 23 use /uploads/<file> with no host. We don't
// have those local files in the new portal, so the question would render
// with a broken image. Per migration plan: SKIP those MCQs.
const hasBrokenImage = (...htmlChunks) => {
  for (const html of htmlChunks) {
    if (!html) continue;
    // Match img src that is NOT absolute http(s) and is NOT data:
    //   src="/uploads/abc.png"  or  src="uploads/abc.png"  → broken
    //   src="https://..."        or  src="data:..."         → OK
    const re = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const src = m[1].trim();
      if (!/^https?:\/\//i.test(src) && !/^data:/i.test(src)) return true;
    }
  }
  return false;
};

// Page-scan: iterate a (potentially corrupted) table with try/except per page
// so one bad page doesn't abort the whole scan.
function* pageScan(sqlite, table, columns) {
  let offset = 0;
  let bad = 0;
  while (true) {
    let rows;
    try {
      rows = sqlite.prepare(`SELECT ${columns} FROM ${table} LIMIT ${SCAN_PAGE} OFFSET ${offset}`).all();
    } catch (err) {
      bad++;
      if (bad <= 3) warn(`page-scan ${table} @offset ${offset} failed:`, err.message);
      // Skip ahead a page and continue trying.
      offset += SCAN_PAGE;
      if (bad > 200) {
        warn(`page-scan ${table}: too many failures, stopping`);
        return;
      }
      continue;
    }
    if (!rows || rows.length === 0) return;
    for (const row of rows) yield row;
    offset += rows.length;
  }
}

// Insert in batches; uses .collection.insertMany to bypass Mongoose pre-save
// hooks (critical for users — passwords are already bcrypt-hashed).
async function bulkInsert(collection, docs, label, opts = {}) {
  if (!docs.length) return 0;
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const slice = docs.slice(i, i + BATCH_SIZE);
    try {
      const r = await collection.insertMany(slice, { ordered: false, ...opts });
      inserted += (r.insertedCount ?? Object.keys(r.insertedIds || {}).length);
    } catch (err) {
      // Some docs may collide (e.g. duplicate email). insertMany with ordered:false
      // still inserts the rest; we just log the error count.
      const dupes = err.writeErrors ? err.writeErrors.length : 1;
      inserted += slice.length - dupes;
      warn(`${label}: ${dupes} of ${slice.length} in batch failed (likely dupes): ${err.message.slice(0, 100)}`);
    }
    process.stdout.write(`\r  ${label}: ${inserted.toLocaleString()} / ${docs.length.toLocaleString()}`);
  }
  process.stdout.write('\n');
  return inserted;
}

// ── Phase implementations ────────────────────────────────────────────────────

async function importUsers(sqlite, maps) {
  log('PHASE 1 — Users');
  const rows = sqlite.prepare(`SELECT id, name, email, password, role, status, batch, join_date, last_login, points FROM users`).all();
  log(`  legacy users: ${rows.length.toLocaleString()}`);

  const docs = [];
  for (const r of rows) {
    const mappedRole = ROLE_MAP[r.role] || 'student';
    const mongoId    = oid();
    maps.users.set(r.id, mongoId);
    docs.push({
      _id:             mongoId,
      fullName:        safeStr(r.name) || 'Unknown',
      email:           safeStr(r.email).toLowerCase(),
      // bcrypt $2a$10$... — already hashed, insert raw. We use
      // .collection.insertMany() below to bypass the pre-save hook that
      // would otherwise re-hash and break login.
      password:        safeStr(r.password),
      role:            mappedRole,
      // legacy `batch`/`status`/`points` don't have matching fields on the
      // current User schema; we drop those. communityPoints starts at the
      // legacy points value as a one-time carry-over.
      communityPoints: Number(r.points) || 0,
      // Migrated users had access to everything on the old portal — preserve
      // that on day one so they don't see "feature locked" screens. Admin can
      // tighten per-user later from the User Management page.
      featureAccess: {
        autoTest:  true,
        community: true,
        videos:    true,
        notes:     true,
      },
      coursesGrantAll: false,
      sessionVersion:  0,
      loginAttempts:   0,
      createdAt:       r.join_date  ? new Date(r.join_date)  : new Date(),
      updatedAt:       r.last_login ? new Date(r.last_login) : new Date(),
    });
  }

  if (dryRun) { log(`  [dry-run] would insert ${docs.length} users`); return docs.length; }
  return await bulkInsert(User.collection, docs, 'users');
}

async function importQuestionBank(sqlite, maps, adminMongoId) {
  log('PHASE 2 — Question Bank structure');

  // Pull only active MCQs (matches what we'll insert in phase 3).
  const rows = sqlite.prepare(`
    SELECT subject, chapter, topic
    FROM mcq_questions
    WHERE active = 1 AND subject IS NOT NULL AND subject != ''
  `).all();

  // Build nested map: subject -> chapter -> Set<topic>
  const tree = new Map();
  for (const r of rows) {
    const subj  = r.subject.trim();
    const chap  = (r.chapter || '').trim() || NO_CHAPTER_NAME;
    const topic = (r.topic   || '').trim() || NO_TOPIC_NAME;
    if (!tree.has(subj)) tree.set(subj, new Map());
    if (!tree.get(subj).has(chap)) tree.get(subj).set(chap, new Set());
    tree.get(subj).get(chap).add(topic);
  }

  // Build the QB doc + the lookup map for Phase 3.
  const subjects = [];
  for (const [subjTitle, chapMap] of tree.entries()) {
    const subjectId = oid();
    const chapters = [];
    for (const [chapTitle, topicSet] of chapMap.entries()) {
      const chapterId = oid();
      const topics    = [];
      for (const topicTitle of topicSet) {
        const topicId = oid();
        topics.push({ _id: topicId, title: topicTitle, order: topics.length });
        maps.qb.set(`${subjTitle}|||${chapTitle}|||${topicTitle}`, {
          subjectId, chapterId, topicId,
        });
      }
      chapters.push({ _id: chapterId, title: chapTitle, order: chapters.length, topics });
    }
    subjects.push({ _id: subjectId, title: subjTitle, order: subjects.length, chapters });
  }

  const qbDoc = {
    _id:         oid(),
    title:       QB_TITLE,
    description: 'Imported from legacy SKN portal',
    visibility:  'public',
    createdBy:   adminMongoId,
    subjects,
    createdAt:   new Date(),
    updatedAt:   new Date(),
  };
  maps.questionBankId = qbDoc._id;

  log(`  ${subjects.length} subjects · ${[...tree.values()].reduce((s, c) => s + c.size, 0)} chapters · ${rows.length.toLocaleString()} active MCQs`);
  if (dryRun) { log('  [dry-run] would insert question bank'); return; }
  await QuestionBank.collection.insertOne(qbDoc);
}

async function importMCQs(sqlite, maps) {
  log('PHASE 3 — MCQs');
  const rows = sqlite.prepare(`
    SELECT id, subject, chapter, topic, stem, options_json, correct_idx, explanation, difficulty, source, created_at, created_by
    FROM mcq_questions
    WHERE active = 1
  `).all();
  log(`  legacy active MCQs: ${rows.length.toLocaleString()}`);

  const docs = [];
  let skippedNoOptions = 0;
  let skippedBrokenImg = 0;
  let skippedNoLookup  = 0;

  for (const r of rows) {
    // Skip MCQs whose HTML references images via relative paths we can't serve.
    if (hasBrokenImage(r.stem, r.explanation, r.options_json)) { skippedBrokenImg++; continue; }

    const options = buildOptions(r.options_json, r.correct_idx);
    if (!options || options.length < 2) { skippedNoOptions++; continue; }

    const subj  = (r.subject || '').trim();
    const chap  = (r.chapter || '').trim() || NO_CHAPTER_NAME;
    const topic = (r.topic   || '').trim() || NO_TOPIC_NAME;
    const lookup = maps.qb.get(`${subj}|||${chap}|||${topic}`);
    if (!lookup) { skippedNoLookup++; continue; }

    const mongoId = oid();
    // Store MCQ info (id + classification) so later phases can derive Test
    // subjects/chapters/topics arrays from actual MCQs without re-querying
    // the DB. This fixes the bug where imported Tests had partial/empty
    // classification arrays (legacy `filter_*` JSON only captured what the
    // user actively filtered on, not what the MCQs actually were).
    maps.mcqs.set(r.id, {
      _id:         mongoId,
      subject:     subj,
      chapter:     chap,
      topic:       topic,
      qbSubjectId: lookup.subjectId,
      qbChapterId: lookup.chapterId,
      qbTopicId:   lookup.topicId,
    });
    docs.push({
      _id:             mongoId,
      // `author` is required on the MCQ schema. Legacy `created_by` is a
      // free-form string ('system-seed', 'admin', etc.), so we pass it through.
      author:          safeStr(r.created_by) || 'legacy-import',
      questionText:    safeStr(r.stem),
      options,
      explanationText: safeStr(r.explanation),
      subject:         subj,
      unit:            chap,
      topic:           topic,
      questionBankId:  maps.questionBankId,
      qbSubjectId:     lookup.subjectId,
      qbChapterId:     lookup.chapterId,
      qbTopicId:       lookup.topicId,
      difficulty:      ({ 1: 'Easy', 2: 'Medium', 3: 'Hard' }[r.difficulty] || 'Medium'),
      isPublic:        true,
      createdAt:       r.created_at ? new Date(r.created_at) : new Date(),
      updatedAt:       new Date(),
    });
  }

  log(`  skipped: ${skippedBrokenImg} broken-image · ${skippedNoOptions} no-options · ${skippedNoLookup} no-lookup`);
  if (dryRun) { log(`  [dry-run] would insert ${docs.length} MCQs`); return docs.length; }
  return await bulkInsert(MCQ.collection, docs, 'mcqs');
}

async function importSavedQuestions(sqlite, maps) {
  log('PHASE 4 — Saved Questions');
  const rows = sqlite.prepare(`SELECT user_id, question_id, marked_at, note FROM mcq_marks`).all();
  log(`  legacy mcq_marks: ${rows.length.toLocaleString()}`);

  const docs = [];
  let orphan = 0;
  for (const r of rows) {
    const userId  = maps.users.get(r.user_id);
    const mcqInfo = maps.mcqs.get(r.question_id);
    if (!userId || !mcqInfo) { orphan++; continue; }
    docs.push({
      _id:       oid(),
      user:      userId,
      mcq:       mcqInfo._id,
      notes:     safeStr(r.note),
      createdAt: r.marked_at ? new Date(r.marked_at) : new Date(),
      updatedAt: new Date(),
    });
  }
  log(`  orphaned (user/mcq missing): ${orphan}`);
  if (dryRun) { log(`  [dry-run] would insert ${docs.length} saved questions`); return docs.length; }
  return await bulkInsert(SavedQuestion.collection, docs, 'savedquestions');
}

async function importMcqReports(sqlite, maps) {
  log('PHASE 5 — MCQ Reports');
  const rows = sqlite.prepare(`
    SELECT id, user_id, question_id, reason, details, status, created_at, resolved_at, resolved_by
    FROM mcq_reports
  `).all();
  log(`  legacy mcq_reports: ${rows.length.toLocaleString()}`);

  const docs = [];
  let orphan = 0;
  for (const r of rows) {
    const userId  = maps.users.get(r.user_id);
    const mcqInfo = maps.mcqs.get(r.question_id);
    if (!userId || !mcqInfo) { orphan++; continue; }

    const handledBy = r.resolved_by ? maps.users.get(r.resolved_by) : null;
    docs.push({
      _id:         oid(),
      mcq:         mcqInfo._id,
      reportedBy:  userId,
      reason:      REPORT_REASON_MAP[r.reason] || 'Need Explanation',
      details:     safeStr(r.details),
      status:      REPORT_STATUS_MAP[r.status] || 'open',
      handledBy:   handledBy || undefined,
      closedBy:    (REPORT_STATUS_MAP[r.status] === 'closed' && handledBy) ? handledBy : undefined,
      closedAt:    r.resolved_at ? new Date(r.resolved_at) : undefined,
      createdAt:   r.created_at ? new Date(r.created_at) : new Date(),
      updatedAt:   new Date(),
    });
  }
  log(`  orphaned: ${orphan}`);
  if (dryRun) { log(`  [dry-run] would insert ${docs.length} reports`); return docs.length; }
  return await bulkInsert(MCQReport.collection, docs, 'mcqreports');
}

async function importMcqHistory(sqlite, maps) {
  log('PHASE 6 — UserMcqHistory (collapses legacy mcq_attempts)');

  // (legacyUser, legacyMcq) → { total, correct, incorrect, omitted, lastResult, lastAttemptedAt }
  const collapse = new Map();
  let scanned = 0;

  for (const r of pageScan(sqlite, 'mcq_attempts',
      'user_id, question_id, selected_idx, is_correct, attempted_at')) {
    scanned++;
    if (scanned % 50000 === 0) process.stdout.write(`\r  scanned ${scanned.toLocaleString()} attempts`);
    const key = `${r.user_id}|||${r.question_id}`;
    let agg = collapse.get(key);
    if (!agg) {
      agg = { total: 0, correct: 0, incorrect: 0, omitted: 0, lastResult: 'omitted', lastAt: 0 };
      collapse.set(key, agg);
    }
    agg.total++;
    const omitted = r.selected_idx == null;
    if (omitted)        { agg.omitted++;   var result = 'omitted'; }
    else if (r.is_correct) { agg.correct++;   var result = 'correct'; }
    else                { agg.incorrect++; var result = 'incorrect'; }
    const t = r.attempted_at ? Date.parse(r.attempted_at) : 0;
    if (t >= agg.lastAt) { agg.lastAt = t; agg.lastResult = result; }
  }
  process.stdout.write('\n');
  log(`  scanned ${scanned.toLocaleString()} attempts · collapsed into ${collapse.size.toLocaleString()} (user,mcq) pairs`);

  // QB classification is already in maps.mcqs (populated by Phase 3) — no
  // need to re-query MCQ collection. Saves ~21k docs of network traffic on
  // a typical import.

  // Load mcq_marks to set `saved: true` on the matching history doc.
  const savedSet = new Set();
  for (const r of sqlite.prepare(`SELECT user_id, question_id FROM mcq_marks`).all()) {
    savedSet.add(`${r.user_id}|||${r.question_id}`);
  }

  const docs = [];
  let orphan = 0;
  for (const [key, agg] of collapse.entries()) {
    const [legacyUser, legacyMcq] = key.split('|||');
    const userId  = maps.users.get(legacyUser);
    const mcqInfo = maps.mcqs.get(legacyMcq);
    if (!userId || !mcqInfo) { orphan++; continue; }
    docs.push({
      _id:             oid(),
      user:            userId,
      mcq:             mcqInfo._id,
      questionBankId:  maps.questionBankId,
      qbSubjectId:     mcqInfo.qbSubjectId,
      qbChapterId:     mcqInfo.qbChapterId,
      qbTopicId:       mcqInfo.qbTopicId,
      lastResult:      agg.lastResult,
      totalAttempts:   agg.total,
      correctCount:    agg.correct,
      incorrectCount:  agg.incorrect,
      omittedCount:    agg.omitted,
      saved:           savedSet.has(key),
      markedForReview: false,
      lastAttemptedAt: agg.lastAt ? new Date(agg.lastAt) : new Date(),
    });
  }
  log(`  orphaned (user/mcq missing): ${orphan}`);
  if (dryRun) { log(`  [dry-run] would insert ${docs.length} history docs`); return docs.length; }
  return await bulkInsert(UserMcqHistory.collection, docs, 'usermcqhistories');
}

async function importUserGeneratedTests(sqlite, maps) {
  log('PHASE 7 — User-generated tests (from qbank_sessions)');

  // First: collect all per-session per-question attempts (so we can build the
  // questionAttempts[] array on each UserTestAttempt). Same page-scan to dodge
  // corruption.
  const sessionAnswers = new Map(); // session_id → [{questionId, selected_idx, is_correct}]
  let scanned = 0;
  for (const r of pageScan(sqlite, 'mcq_attempts',
      'session_id, question_id, selected_idx, is_correct, attempted_at')) {
    scanned++;
    let arr = sessionAnswers.get(r.session_id);
    if (!arr) { arr = []; sessionAnswers.set(r.session_id, arr); }
    arr.push({ qid: r.question_id, idx: r.selected_idx, correct: r.is_correct });
  }
  log(`  re-scanned ${scanned.toLocaleString()} attempts to build session-answer index (${sessionAnswers.size.toLocaleString()} sessions)`);

  // Now iterate qbank_sessions and build Test + UserTestAttempt for each.
  const tests    = [];
  const attempts = [];
  let scannedSess = 0, skippedOrphan = 0, skippedEmpty = 0;

  for (const s of pageScan(sqlite, 'qbank_sessions',
      'id, user_id, mode, timed, filter_subjects, filter_chapters, filter_topics, question_ids, question_count, status, started_at, ended_at, total_time_sec, correct_count, incorrect_count, omitted_count, score_pct')) {
    scannedSess++;
    if (scannedSess % 2000 === 0) process.stdout.write(`\r  processed ${scannedSess.toLocaleString()} sessions`);

    const userId = maps.users.get(s.user_id);
    if (!userId) { skippedOrphan++; continue; }

    let qids;
    try { qids = JSON.parse(s.question_ids || '[]'); } catch { qids = []; }
    if (!Array.isArray(qids) || qids.length === 0) { skippedEmpty++; continue; }

    // Translate legacy MCQ IDs → MCQ info objects, skipping any we don't have.
    const mcqInfos    = qids.map((q) => maps.mcqs.get(q)).filter(Boolean);
    const mongoMcqIds = mcqInfos.map((m) => m._id);
    if (mongoMcqIds.length === 0) { skippedEmpty++; continue; }

    // ── DERIVE classification from the actual MCQs in this session ──────
    // Live portal auto-derives Test.subjects/chapters/topics from the MCQs
    // attached (see testController.syncTestClassification). We mirror that
    // here at import time so:
    //   • Test History filter dropdowns work correctly,
    //   • Test detail page shows the right syllabus chips,
    //   • the `testSubjects/testChapters/testTopics` indexed snapshots on
    //     UserTestAttempt are populated.
    // Legacy `s.filter_subjects/filter_chapters/filter_topics` arrays were
    // often empty or partial (only what the user actively filtered on),
    // so we deliberately ignore them.
    const subjects = [...new Set(mcqInfos.map((m) => m.subject).filter(Boolean))];
    const chapters = [...new Set(mcqInfos.map((m) => m.chapter).filter(Boolean))];
    const topics   = [...new Set(mcqInfos.map((m) => m.topic).filter(Boolean))];

    // Build a friendly title for the imported test. We prefer the user's
    // original filter labels for the title (better captures intent), but
    // fall back to the derived list when the legacy filter was empty.
    let titleSubjects = [];
    let titleTopics   = [];
    try { titleSubjects = JSON.parse(s.filter_subjects || '[]'); } catch { /* ignore */ }
    try { titleTopics   = JSON.parse(s.filter_topics   || '[]'); } catch { /* ignore */ }
    if (titleSubjects.length === 0) titleSubjects = subjects.length === 1 ? subjects : (subjects.length ? ['Mixed'] : []);
    const titleBits = [];
    if (titleSubjects.length) titleBits.push(titleSubjects.join(', '));
    if (titleTopics.length)   titleBits.push(titleTopics.slice(0, 2).join(', '));
    const dayPart = s.started_at ? s.started_at.split(' ')[0] : '';
    const title   = `Practice · ${titleBits.join(' · ') || 'Mixed'}${dayPart ? ` · ${dayPart}` : ''}`;

    // Test doc — archived + private so it doesn't pollute admin "All Tests" lists.
    const testId = oid();
    tests.push({
      _id:             testId,
      title,
      description:     `Imported from legacy QB practice session`,
      totalQuestions:  mongoMcqIds.length,
      passingScore:    50,
      maxAttempts:     1,
      isPublished:     false,
      createdBy:       userId,
      status:          'archived',
      difficultyLevel: 'Medium',
      mcqs:            mongoMcqIds,
      allowedModes:    [ s.mode === 'test' ? 'timer' : 'tutor' ],
      questionBankId:  maps.questionBankId,
      subjects, chapters, topics,
      createdAt:       s.started_at ? new Date(s.started_at) : new Date(),
      updatedAt:       new Date(),
    });

    // Resolve per-question answers (when we have them).
    const ans = sessionAnswers.get(s.id) || [];
    const ansByQid = new Map();
    for (const a of ans) ansByQid.set(a.qid, a);

    // Build questionAttempts[] in the same order as question_ids so resume / review
    // shows the questions in the order the student saw them.
    const questionAttempts = [];
    for (const legacyQid of qids) {
      const mcqInfo = maps.mcqs.get(legacyQid);
      if (!mcqInfo) continue; // skipped MCQ → just leave it out
      const a    = ansByQid.get(legacyQid);
      const sel  = a && a.idx != null ? idxToLetter(a.idx) : null;
      const isC  = !!(a && a.correct);
      questionAttempts.push({
        mcqId: mcqInfo._id,
        selectedOption: sel,
        correctOption:  null,  // not needed for historical attempts
        isCorrect:      isC,
        reported:       false,
        saved:          false,
        markedForReview: false,
      });
    }

    // Map legacy status → our status. "ongoing" goes to "abandoned" per plan.
    const status = ({ completed: 'completed', abandoned: 'abandoned', ongoing: 'abandoned' }[s.status] || 'abandoned');
    const score   = Number(s.correct_count) || 0;
    const maxS    = mongoMcqIds.length;

    attempts.push({
      _id:               oid(),
      user:              userId,
      test:              testId,
      testTitle:         title,
      testSubjects:      subjects,
      testChapters:      chapters,
      testTopics:        topics,
      questionBankId:    maps.questionBankId,
      questionBankTitle: QB_TITLE,
      totalQuestions:    maxS,
      mode:              s.mode === 'test' ? 'timer' : 'tutor',
      status,
      score,
      maxScore:          maxS,
      scorePercentage:   maxS > 0 ? Math.round((score / maxS) * 1000) / 10 : 0,
      answeredCount:     questionAttempts.filter((q) => q.selectedOption !== null).length,
      totalTimeSpent:    Number(s.total_time_sec) || 0,
      startTime:         s.started_at ? new Date(s.started_at) : new Date(),
      endTime:           s.ended_at   ? new Date(s.ended_at)   : undefined,
      questionAttempts,
      currentQuestionIndex: 0,
      createdAt:         s.started_at ? new Date(s.started_at) : new Date(),
      updatedAt:         s.ended_at   ? new Date(s.ended_at)   : new Date(),
    });
  }
  process.stdout.write('\n');
  log(`  ${tests.length.toLocaleString()} tests + attempts will be inserted (skipped: ${skippedOrphan} orphan-user, ${skippedEmpty} empty/no-mcqs)`);

  if (dryRun) return { tests: tests.length, attempts: attempts.length };
  const t = await bulkInsert(Test.collection, tests, 'tests');
  const a = await bulkInsert(UserTestAttempt.collection, attempts, 'usertestattempts');
  return { tests: t, attempts: a };
}

async function importPostsAndReplies(sqlite, maps) {
  log('PHASE 8 — Posts + Replies');

  // ── Posts ───────────────────────────────────────────────────────────────
  const postRows = sqlite.prepare(`
    SELECT id, author_id, author_name, content, image_url, type, is_pinned, created_at, subject, upvotes
    FROM posts
  `).all();
  log(`  legacy posts: ${postRows.length.toLocaleString()}`);

  const userInfoById = new Map();
  for (const u of await User.find({ _id: { $in: [...maps.users.values()] } })
                            .select('_id fullName role profilePicture communityPoints').lean()) {
    userInfoById.set(u._id.toString(), u);
  }

  const posts = [];
  let postOrphan = 0;
  const legacyPostToMongo = new Map();
  for (const p of postRows) {
    const userId = maps.users.get(p.author_id);
    if (!userId) { postOrphan++; continue; }
    const u = userInfoById.get(userId.toString()) || {};
    const mongoId = oid();
    legacyPostToMongo.set(p.id, mongoId);

    posts.push({
      _id:    mongoId,
      author: userId,
      authorSnapshot: {
        fullName:        u.fullName || safeStr(p.author_name),
        role:            u.role || 'student',
        profilePicture:  u.profilePicture || '',
        communityPoints: u.communityPoints || 0,
      },
      category:   POST_CATEGORY_MAP[(p.subject || '').toLowerCase()] || 'general',
      type:       POST_TYPE_MAP[p.type] || 'discussion',
      content:    safeStr(p.content).slice(0, 5000),
      // image_url is a single string in legacy → wrap as array.
      // Path stays /uploads/<uuid>.<ext> — copy legacy uploads/ into backend/uploads/ on the server.
      images:     p.image_url ? [safeStr(p.image_url)] : [],
      isPinned:   !!p.is_pinned,
      isAnswered: false, // recomputed below from comments
      replyCount: 0,
      createdAt:  p.created_at ? new Date(p.created_at) : new Date(),
      updatedAt:  p.created_at ? new Date(p.created_at) : new Date(),
    });
  }
  log(`  posts orphaned (author missing): ${postOrphan}`);

  // ── Replies ──────────────────────────────────────────────────────────────
  const replyRows = sqlite.prepare(`
    SELECT id, post_id, author_id, author_name, content, created_at, is_best, image_url
    FROM comments
  `).all();
  log(`  legacy comments: ${replyRows.length.toLocaleString()}`);

  // Comment-helpful tallies — pre-aggregate so each reply gets helpfulCount + helpfulVotes set.
  const helpfulByComment = new Map();
  for (const h of sqlite.prepare(`SELECT comment_id, user_id FROM comment_helpful`).all()) {
    const userId = maps.users.get(h.user_id);
    if (!userId) continue;
    if (!helpfulByComment.has(h.comment_id)) helpfulByComment.set(h.comment_id, []);
    helpfulByComment.get(h.comment_id).push(userId);
  }

  const replies      = [];
  let   replyOrphan  = 0;
  const replyCountByPost = new Map();
  const postHasAnswer    = new Set();

  for (const c of replyRows) {
    const userId = maps.users.get(c.author_id);
    const postId = legacyPostToMongo.get(c.post_id);
    if (!userId || !postId) { replyOrphan++; continue; }
    const u = userInfoById.get(userId.toString()) || {};
    const helpful = helpfulByComment.get(c.id) || [];

    replies.push({
      _id:    oid(),
      post:   postId,
      author: userId,
      authorSnapshot: {
        fullName:        u.fullName || safeStr(c.author_name),
        role:            u.role || 'student',
        profilePicture:  u.profilePicture || '',
        communityPoints: u.communityPoints || 0,
      },
      content:      safeStr(c.content).slice(0, 3000),
      images:       c.image_url ? [safeStr(c.image_url)] : [],
      isAnswer:     !!c.is_best,
      helpfulVotes: helpful,
      helpfulCount: helpful.length,
      createdAt:    c.created_at ? new Date(c.created_at) : new Date(),
      updatedAt:    c.created_at ? new Date(c.created_at) : new Date(),
    });

    replyCountByPost.set(postId.toString(), (replyCountByPost.get(postId.toString()) || 0) + 1);
    if (c.is_best) postHasAnswer.add(postId.toString());
  }
  log(`  replies orphaned: ${replyOrphan}`);

  // Patch post replyCount + isAnswered before insert (cheap — just in-memory).
  for (const p of posts) {
    const k = p._id.toString();
    p.replyCount = replyCountByPost.get(k) || 0;
    p.isAnswered = postHasAnswer.has(k);
  }

  if (dryRun) return { posts: posts.length, replies: replies.length };
  const pCount = await bulkInsert(Post.collection,  posts,   'posts');
  const rCount = await bulkInsert(Reply.collection, replies, 'replies');
  return { posts: pCount, replies: rCount };
}

// ── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  log(`Mongo: ${process.env.MONGO_URI ? '(set)' : '(NOT SET — check .env)'}`);
  log(`SQLite: ${dbPath}`);
  log(`Mode  : ${dryRun ? 'DRY-RUN (no writes)' : 'WRITE'}${force ? ' --force' : ''}`);

  if (!process.env.MONGO_URI) { console.error('MONGO_URI missing'); process.exit(1); }

  await mongoose.connect(process.env.MONGO_URI);
  const sqlite = new Database(dbPath, { readonly: true, fileMustExist: true });

  // Idempotency
  const Marker = mongoose.connection.collection('migration_markers');
  const prev   = await Marker.findOne({ key: 'legacy-portal' });
  if (prev && !force) {
    console.error(`\n[ABORT] Already imported on ${prev.completedAt}.`);
    console.error(`        To re-run, pass --force (WARNING: will create duplicate docs).\n`);
    process.exit(1);
  }

  // Find an admin to attribute the QB to — first migrated admin OR the default
  // admin (admin@sknmdcat.com) already created at server boot.
  const startedAt = new Date();
  const maps = {
    users: new Map(),
    mcqs:  new Map(),
    qb:    new Map(),
    questionBankId: null,
  };

  const stats = {};
  stats.users = await importUsers(sqlite, maps);

  // Try to find a usable admin id for the QB's createdBy. Prefer the legacy
  // admin user; fall back to the first migrated admin we have.
  let adminMongoId = null;
  for (const r of sqlite.prepare(`SELECT id FROM users WHERE role='admin' LIMIT 1`).all()) {
    adminMongoId = maps.users.get(r.id);
  }
  if (!adminMongoId) {
    const fallback = await User.findOne({ role: 'admin' }).select('_id').lean();
    adminMongoId = fallback?._id;
  }
  if (!adminMongoId) {
    console.error('No admin user found. Boot the server once so it auto-creates admin@sknmdcat.com.');
    process.exit(1);
  }

  await importQuestionBank(sqlite, maps, adminMongoId);
  stats.mcqs         = await importMCQs(sqlite, maps);
  stats.savedQs      = await importSavedQuestions(sqlite, maps);
  stats.mcqReports   = await importMcqReports(sqlite, maps);
  stats.userMcqHist  = await importMcqHistory(sqlite, maps);
  const ut           = await importUserGeneratedTests(sqlite, maps);
  stats.tests        = ut.tests;
  stats.attempts     = ut.attempts;
  const pr           = await importPostsAndReplies(sqlite, maps);
  stats.posts        = pr.posts;
  stats.replies      = pr.replies;

  const finishedAt = new Date();
  if (!dryRun) {
    await Marker.insertOne({
      key: 'legacy-portal',
      startedAt, completedAt: finishedAt,
      durationSec: Math.round((finishedAt - startedAt) / 1000),
      stats,
      sourceDb: path.basename(dbPath),
    });
  }

  log('');
  log('============================================================');
  log(`DONE${dryRun ? ' (dry-run)' : ''} in ${Math.round((finishedAt - startedAt) / 1000)}s`);
  log('Inserted:');
  for (const [k, v] of Object.entries(stats)) {
    log(`  ${k.padEnd(14)} : ${typeof v === 'number' ? v.toLocaleString() : JSON.stringify(v)}`);
  }
  log('============================================================');

  sqlite.close();
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
