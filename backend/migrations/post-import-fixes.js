// backend/migrations/post-import-fixes.js
//
// Three one-off fixes that need to run AFTER the legacy import (or anytime
// you want to recompute these values).
//
//   Function 1 — resyncTestClassification()
//     Recomputes every Test's `subjects` / `chapters` / `topics` arrays from
//     the MCQs that are actually attached to it, then propagates the result
//     into every `UserTestAttempt.testSubjects/Chapters/Topics` snapshot so
//     Test History + MCQ Reports filter dropdowns reflect the real data.
//     (Migration imported these arrays from the legacy `filter_*` fields,
//     which were often empty or partial — the live portal auto-derives them
//     from MCQs.)
//
//   Function 2 — backfillPausedAnsweredCount()
//     Recomputes `answeredCount` for every in-progress (paused) attempt.
//     Existing controllers updated this only on `completeTest`, so paused
//     attempts had a stale 0 while their `questionAttempts[]` actually held
//     answers. After the matching pauseTest controller fix, future pauses
//     write the value correctly — this backfills the ones already on disk.
//
//   Function 3 — backfillCreatedByAdmin()
//     Stamps every user that pre-dates the `createdByAdmin` flag with
//     `createdByAdmin: true`. Rationale: we have no proof these legacy users
//     registered themselves vs were imported by an admin script, so we mark
//     them all as admin-created — that matches the historical reality (they
//     were imported by the migration tool) and lets admin treat them as a
//     known cohort in the filter UI. Idempotent: only touches docs whose
//     field is missing, so re-runs after new signups are no-ops.
//
// Usage (run from the backend folder):
//   node migrations/post-import-fixes.js                  # all three fixes
//   node migrations/post-import-fixes.js --classification # only fix 1
//   node migrations/post-import-fixes.js --pause          # only fix 2
//   node migrations/post-import-fixes.js --created-by     # only fix 3
//
// Idempotent — safe to re-run as many times as you like. Each fix re-derives
// the canonical value from primary data and writes it only if it changed.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const Test            = require('../models/TestModel');
const MCQ             = require('../models/McqModel');
const QuestionBank    = require('../models/QuestionBankModel');
const UserTestAttempt = require('../models/UserTestAttempt');
const User            = require('../models/User');

const BATCH = 500;
const log   = (...a) => console.log('[fix]', ...a);

// ── Pure helper: derive {subjects, chapters, topics} from MCQs ──────────────
// Mirrors testController.syncTestClassification's logic but uses an in-memory
// QuestionBank cache so the bulk run doesn't re-query the same QB 20k times.
function deriveClassification(mcqs, qbCache) {
  const subjects = new Set();
  const chapters = new Set();
  const topics   = new Set();

  for (const mcq of mcqs) {
    // Legacy free-form fields first — used by older / non-QB MCQs.
    if (mcq.subject) subjects.add(mcq.subject);
    if (mcq.unit)    chapters.add(mcq.unit);
    if (mcq.topic)   topics.add(mcq.topic);

    // Then resolve the QB hierarchy IDs to their human-readable titles.
    if (!mcq.questionBankId) continue;
    const qb = qbCache.get(mcq.questionBankId.toString());
    if (!qb || !mcq.qbSubjectId) continue;

    const subj = qb.subjects.id(mcq.qbSubjectId);
    if (!subj) continue;
    subjects.add(subj.title);

    if (!mcq.qbChapterId) continue;
    const chap = subj.chapters.id(mcq.qbChapterId);
    if (!chap) continue;
    chapters.add(chap.title);

    if (!mcq.qbTopicId) continue;
    const top = chap.topics.id(mcq.qbTopicId);
    if (top) topics.add(top.title);
  }

  return {
    subjects: [...subjects].filter(Boolean),
    chapters: [...chapters].filter(Boolean),
    topics:   [...topics].filter(Boolean),
  };
}

// Two arrays equal by their sorted contents (cheap dedup-aware check). Used
// to skip writes when the value isn't actually changing.
function sameArr(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const x = [...a].sort(), y = [...b].sort();
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
}

// ── Fix 1 ───────────────────────────────────────────────────────────────────
async function resyncTestClassification() {
  log('Fix 1 — re-syncing Test classification + propagating to UserTestAttempt');

  // Pre-fetch every QuestionBank once. There are typically 1-2 of these
  // (the SKN MDCAT Bank from import + maybe a teacher test bank), so this is
  // ~tens of KB in RAM. Without it we'd re-fetch the same QB ~20,000 times.
  // We keep these as full Mongoose docs (not .lean()) so the subdoc helper
  // `qb.subjects.id(subjectId)` still works inside deriveClassification.
  const qbDocs  = await QuestionBank.find({});
  const qbCache = new Map(qbDocs.map((q) => [q._id.toString(), q]));
  log(`  Cached ${qbCache.size} QuestionBank doc(s).`);

  // Pull every Test as a tiny lean projection. We only need _id + mcqs +
  // the current arrays so we can detect "no change" and skip the write.
  const tests = await Test.find({}, '_id mcqs subjects chapters topics').lean();
  log(`  Total tests to process: ${tests.length.toLocaleString()}`);

  let processed = 0;
  let testUpdates = 0;
  let attemptUpdates = 0;
  let unchanged = 0;
  const testOps    = [];
  const attemptOps = [];

  const flushTests = async () => {
    if (testOps.length === 0) return;
    const r = await Test.bulkWrite(testOps.splice(0), { ordered: false });
    testUpdates += (r.modifiedCount || 0);
  };
  const flushAttempts = async () => {
    if (attemptOps.length === 0) return;
    const r = await UserTestAttempt.bulkWrite(attemptOps.splice(0), { ordered: false });
    attemptUpdates += (r.modifiedCount || 0);
  };

  for (const t of tests) {
    processed++;
    if (processed % 500 === 0) {
      process.stdout.write(`\r  Processed: ${processed.toLocaleString()} / ${tests.length.toLocaleString()}`);
    }

    if (!Array.isArray(t.mcqs) || t.mcqs.length === 0) { unchanged++; continue; }

    // Fetch only the 7 classification fields per MCQ (no stem / options /
    // explanation HTML). Massively cheaper than populate('mcqs').
    const mcqs = await MCQ.find(
      { _id: { $in: t.mcqs } },
      'subject unit topic questionBankId qbSubjectId qbChapterId qbTopicId',
    ).lean();
    if (mcqs.length === 0) { unchanged++; continue; }

    const derived = deriveClassification(mcqs, qbCache);

    // If the existing arrays already match, don't write — keeps the run
    // idempotent and avoids touching the Test's updatedAt.
    if (sameArr(derived.subjects, t.subjects) &&
        sameArr(derived.chapters, t.chapters) &&
        sameArr(derived.topics,   t.topics)) {
      unchanged++;
      continue;
    }

    testOps.push({
      updateOne: {
        filter: { _id: t._id },
        update: { $set: derived },
      },
    });
    attemptOps.push({
      updateMany: {
        filter: { test: t._id },
        update: { $set: {
          testSubjects: derived.subjects,
          testChapters: derived.chapters,
          testTopics:   derived.topics,
        }},
      },
    });

    if (testOps.length    >= BATCH) await flushTests();
    if (attemptOps.length >= BATCH) await flushAttempts();
  }

  // Flush any leftovers.
  await flushTests();
  await flushAttempts();

  process.stdout.write('\n');
  log(`  Tests updated         : ${testUpdates.toLocaleString()}`);
  log(`  Tests unchanged       : ${unchanged.toLocaleString()}`);
  log(`  UserTestAttempts patched: ${attemptUpdates.toLocaleString()}`);
}

// ── Fix 2 ───────────────────────────────────────────────────────────────────
async function backfillPausedAnsweredCount() {
  log('Fix 2 — backfilling answeredCount on in-progress attempts');

  // Only fetch the field we need to recompute. Stream-friendly even for
  // very large boards.
  const attempts = await UserTestAttempt.find(
    { status: 'in-progress' },
    '_id questionAttempts.selectedOption answeredCount',
  ).lean();
  log(`  In-progress attempts: ${attempts.length.toLocaleString()}`);

  const ops = [];
  let updated = 0;

  const flush = async () => {
    if (ops.length === 0) return;
    const r = await UserTestAttempt.bulkWrite(ops.splice(0), { ordered: false });
    updated += (r.modifiedCount || 0);
  };

  for (const a of attempts) {
    const actual = (a.questionAttempts || []).filter((qa) => qa.selectedOption != null).length;
    if (actual === a.answeredCount) continue; // already correct

    ops.push({
      updateOne: {
        filter: { _id: a._id },
        update: { $set: { answeredCount: actual } },
      },
    });
    if (ops.length >= BATCH) await flush();
  }
  await flush();

  log(`  Attempts patched     : ${updated.toLocaleString()}`);
  log(`  Attempts already ok  : ${(attempts.length - updated).toLocaleString()}`);
}

// ── Fix 3 ───────────────────────────────────────────────────────────────────
async function backfillCreatedByAdmin() {
  log('Fix 3 — backfilling createdByAdmin on pre-existing users');

  // Stamp every user that doesn't have the flag yet. Mongo's $exists:false
  // matches both "field missing" and "doc never had it" — exactly the legacy
  // cohort we want to backfill. Users created since the flag was introduced
  // (post-deploy) already have it set explicitly, so they're untouched.
  const filter = { createdByAdmin: { $exists: false } };
  const before = await User.countDocuments(filter);
  log(`  Users without createdByAdmin: ${before.toLocaleString()}`);

  if (before === 0) {
    log('  Nothing to do.');
    return;
  }

  const result = await User.updateMany(filter, { $set: { createdByAdmin: true } });
  log(`  Stamped ${(result.modifiedCount || 0).toLocaleString()} user(s) as admin-created`);
}

// ── Main ────────────────────────────────────────────────────────────────────
(async () => {
  const args = process.argv.slice(2);
  const only = args.find((a) => a.startsWith('--'));

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is not set. Make sure backend/.env exists.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  log(`Connected to MongoDB: ${mongoose.connection.db.databaseName}`);
  const t0 = Date.now();

  if (only === '--pause') {
    await backfillPausedAnsweredCount();
  } else if (only === '--classification') {
    await resyncTestClassification();
  } else if (only === '--created-by') {
    await backfillCreatedByAdmin();
  } else {
    // Default: run all three, classification first (so attempt snapshots match
    // the re-derived Test arrays before the answeredCount pass).
    await resyncTestClassification();
    await backfillPausedAnsweredCount();
    await backfillCreatedByAdmin();
  }

  log(`Done in ${Math.round((Date.now() - t0) / 1000)}s`);
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
