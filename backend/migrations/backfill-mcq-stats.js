// backend/migrations/backfill-mcq-stats.js
//
// Two complementary backfills, both derived from the canonical source — every
// completed UserTestAttempt's questionAttempts[].
//
//   rebuildMcqOptionStats()
//     Recomputes `MCQ.statistics.optionsSelections` (per-letter pick counts +
//     `total`). Live controllers maintain this incrementally via $inc on every
//     completeTest call, but Phase 7 of import-legacy.js bulk-inserted attempts
//     past that hook, so legacy attempts never bumped the counter. Without
//     this, the test player's popularity bars are empty / wrong on imported
//     MCQs.
//
//   rebuildAttemptScores()
//     Recomputes each completed attempt's `score`, `answeredCount`, and
//     `scorePercentage` from `questionAttempts[].isCorrect / selectedOption`.
//     The legacy `correct_count` column from the old portal was sometimes
//     inflated relative to the real number of answered questions — produced
//     accuracy >100% on the weekly leaderboard. The questionAttempts array is
//     the source of truth (same flow the live completeTest controller uses).
//
// Both walk UserTestAttempt with `status: 'completed'`. Idempotent — every
// run re-derives values from primary data and writes only when something
// actually changed.
//
// Usage (run from the backend folder):
//   node migrations/backfill-mcq-stats.js            # runs BOTH fixes
//   node migrations/backfill-mcq-stats.js --mcq      # only MCQ option stats
//   node migrations/backfill-mcq-stats.js --scores   # only attempt scores

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const MCQ             = require('../models/McqModel');
const UserTestAttempt = require('../models/UserTestAttempt');

const BATCH = 500;
const log   = (...a) => console.log('[mcq-stats]', ...a);

// Shared by both this script and post-import-fixes.js (--mcq-stats flag).
// Exported so we don't duplicate the implementation in two places.
async function rebuildMcqOptionStats() {
  // counts: Map<mcqIdStr, { A, B, C, D, E, total }>
  // We allocate the full shape per MCQ even when only one letter is picked,
  // so the final $set produces a clean, dense object (no missing keys that
  // would silently default to 0 in the frontend's sum).
  const counts = new Map();

  const cursor = UserTestAttempt.find(
    { status: 'completed' },
    'questionAttempts.mcqId questionAttempts.selectedOption',
  ).lean().cursor();

  let attemptsScanned = 0;
  let questionsScanned = 0;
  for await (const attempt of cursor) {
    attemptsScanned++;
    for (const qa of (attempt.questionAttempts || [])) {
      if (!qa.mcqId) continue;
      questionsScanned++;
      const id = qa.mcqId.toString();
      let entry = counts.get(id);
      if (!entry) {
        entry = { A: 0, B: 0, C: 0, D: 0, E: 0, total: 0 };
        counts.set(id, entry);
      }
      entry.total += 1;
      if (qa.selectedOption && /^[A-E]$/.test(qa.selectedOption)) {
        entry[qa.selectedOption] += 1;
      }
    }
    if (attemptsScanned % 1000 === 0) {
      process.stdout.write(`\r  Attempts scanned: ${attemptsScanned.toLocaleString()}`);
    }
  }
  process.stdout.write('\n');
  log(`  Scanned ${attemptsScanned.toLocaleString()} completed attempts (${questionsScanned.toLocaleString()} question rows) · ${counts.size.toLocaleString()} distinct MCQs`);

  // Write back in batches. We $set the whole sub-object so it OVERWRITES the
  // existing counter — that's intentional: the live counter could be stale
  // (legacy + mixed data) and the in-memory tally is the source of truth.
  const ops = [];
  let modified = 0;
  let processed = 0;

  for (const [mcqId, entry] of counts) {
    ops.push({
      updateOne: {
        filter: { _id: mcqId },
        update: { $set: { 'statistics.optionsSelections': entry } },
      },
    });
    if (ops.length >= BATCH) {
      const r = await MCQ.bulkWrite(ops.splice(0), { ordered: false });
      modified  += (r.modifiedCount || 0);
      processed += BATCH;
      process.stdout.write(`\r  MCQs processed: ${processed.toLocaleString()} / ${counts.size.toLocaleString()}`);
    }
  }
  if (ops.length > 0) {
    const r = await MCQ.bulkWrite(ops.splice(0), { ordered: false });
    modified += (r.modifiedCount || 0);
  }
  process.stdout.write('\n');
  log(`  MCQs with stats updated: ${modified.toLocaleString()}`);
}

// ── rebuildAttemptScores ──────────────────────────────────────────────────────
// Walks every completed attempt, recomputes score / answeredCount /
// scorePercentage from questionAttempts[]. Writes only when the stored value
// differs from the recomputed value (saves write traffic on already-good docs).
async function rebuildAttemptScores() {
  // Slim projection — only what we need for the recompute + write decision.
  const cursor = UserTestAttempt.find(
    { status: 'completed' },
    'questionAttempts.selectedOption questionAttempts.isCorrect score answeredCount scorePercentage maxScore',
  ).lean().cursor();

  const ops = [];
  let scanned   = 0;
  let queued    = 0;
  let modified  = 0;
  let alreadyOk = 0;

  for await (const a of cursor) {
    scanned++;
    const qa       = a.questionAttempts || [];
    const correct  = qa.reduce((s, q) => s + (q.isCorrect ? 1 : 0), 0);
    const answered = qa.reduce((s, q) => s + (q.selectedOption != null ? 1 : 0), 0);
    const max      = (a.maxScore && a.maxScore > 0) ? a.maxScore : qa.length;
    const pct      = max > 0 ? Math.round((correct / max) * 1000) / 10 : 0;

    // Skip the write if values already match the recompute.
    if (a.score === correct && a.answeredCount === answered && a.scorePercentage === pct) {
      alreadyOk++;
      if (scanned % 1000 === 0) {
        process.stdout.write(`\r  Attempts scanned: ${scanned.toLocaleString()}`);
      }
      continue;
    }

    ops.push({
      updateOne: {
        filter: { _id: a._id },
        update: { $set: {
          score: correct,
          answeredCount: answered,
          scorePercentage: pct,
        }},
      },
    });
    queued++;

    if (ops.length >= BATCH) {
      const r = await UserTestAttempt.bulkWrite(ops.splice(0), { ordered: false });
      modified += (r.modifiedCount || 0);
      process.stdout.write(`\r  Attempts scanned: ${scanned.toLocaleString()} · modified: ${modified.toLocaleString()}`);
    } else if (scanned % 1000 === 0) {
      process.stdout.write(`\r  Attempts scanned: ${scanned.toLocaleString()} · queued: ${queued.toLocaleString()}`);
    }
  }

  if (ops.length > 0) {
    const r = await UserTestAttempt.bulkWrite(ops.splice(0), { ordered: false });
    modified += (r.modifiedCount || 0);
  }
  process.stdout.write('\n');
  log(`  Scanned ${scanned.toLocaleString()} completed attempt(s)`);
  log(`  Already correct: ${alreadyOk.toLocaleString()}`);
  log(`  Modified:        ${modified.toLocaleString()}`);
}

module.exports = { rebuildMcqOptionStats, rebuildAttemptScores };

// Only run when invoked directly (not when require()'d from post-import-fixes.js).
if (require.main === module) {
  (async () => {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI is not set. Make sure backend/.env exists.');
      process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    log(`Connected to MongoDB: ${mongoose.connection.db.databaseName}`);
    const t0 = Date.now();

    const args = process.argv.slice(2);
    const only = args.find((a) => a.startsWith('--'));

    if (only === '--mcq') {
      log('Rebuilding MCQ option-selection stats only');
      await rebuildMcqOptionStats();
    } else if (only === '--scores') {
      log('Rebuilding attempt scores only');
      await rebuildAttemptScores();
    } else {
      // Default: run both. Attempt scores first so the leaderboard
      // aggregations re-derive from clean per-attempt numbers on the next run.
      log('Step 1/2 — rebuilding attempt scores from questionAttempts');
      await rebuildAttemptScores();
      log('Step 2/2 — rebuilding MCQ option-selection stats');
      await rebuildMcqOptionStats();
    }

    log(`Done in ${Math.round((Date.now() - t0) / 1000)}s`);
    await mongoose.disconnect();
    process.exit(0);
  })().catch((err) => {
    console.error('[FATAL]', err);
    process.exit(1);
  });
}
