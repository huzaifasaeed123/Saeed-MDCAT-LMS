// Backfill UserTestAttempt snapshot fields for documents created before
// the denormalisation refactor (see backend/models/UserTestAttempt.js).
//
// What it does:
//   • Finds every UserTestAttempt where testTitle is missing/empty.
//   • Looks up the referenced Test + QuestionBank ONCE per unique test.
//   • Sets testTitle / testSubjects / testChapters / testTopics /
//     questionBankId / questionBankTitle / totalQuestions on the attempt.
//
// Properties:
//   • Idempotent — safe to run multiple times. Already-backfilled rows are
//     skipped via the `testTitle: { $in: [null, ''] }` filter.
//   • Memoised — the Test + QB lookup is cached per testId, so even with
//     millions of attempts referencing the same handful of tests we hit
//     each Test / QB exactly once.
//   • Bulk-write batched — uses unordered bulkWrite in 500-doc batches.
//   • Read-only on Test / QuestionBank — no risk of mutating live data
//     except the snapshot fields on UserTestAttempt itself.
//
// Run with:
//   node backend/scripts/backfill-user-test-attempt-snapshots.js
//
// In production, run BEFORE deploying the new History endpoint so users
// don't see blank titles on rows created before the migration.

require('dotenv').config();
const mongoose         = require('mongoose');
const UserTestAttempt  = require('../models/UserTestAttempt');
const Test             = require('../models/TestModel');
const QuestionBank     = require('../models/QuestionBankModel');

const BATCH_SIZE = 500;

async function main() {
  const uri = "mongodb://localhost:27017/SaeedMdcatLms";
  if (!uri) {
    console.error('MONGO_URI not set — aborting.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('[backfill] connected');

  // Tests + QBs are cached so we hit each one at most once for the whole run.
  const testCache = new Map(); // testId -> { title, subjects, chapters, topics, questionBankId, totalQuestions }
  const qbCache   = new Map(); // qbId   -> title

  const loadTest = async (testId) => {
    const key = String(testId);
    if (testCache.has(key)) return testCache.get(key);
    const t = await Test.findById(testId)
      .select('title subjects chapters topics questionBankId mcqs')
      .lean();
    let snapshot = null;
    if (t) {
      let qbTitle = '';
      if (t.questionBankId) {
        const qbKey = String(t.questionBankId);
        if (qbCache.has(qbKey)) {
          qbTitle = qbCache.get(qbKey);
        } else {
          const qb = await QuestionBank.findById(t.questionBankId).select('title').lean();
          qbTitle = qb?.title || '';
          qbCache.set(qbKey, qbTitle);
        }
      }
      snapshot = {
        testTitle:         t.title || '',
        testSubjects:      Array.isArray(t.subjects) ? t.subjects : [],
        testChapters:      Array.isArray(t.chapters) ? t.chapters : [],
        testTopics:        Array.isArray(t.topics)   ? t.topics   : [],
        questionBankId:    t.questionBankId || null,
        questionBankTitle: qbTitle,
        totalQuestions:    Array.isArray(t.mcqs) ? t.mcqs.length : 0,
      };
    }
    testCache.set(key, snapshot);
    return snapshot;
  };

  // Cursor over attempts that need backfilling. Using a cursor (not .find().lean())
  // so memory stays flat even with millions of rows.
  const filter = { $or: [
    { testTitle: { $exists: false } },
    { testTitle: '' },
    { testTitle: null },
  ]};

  const total = await UserTestAttempt.countDocuments(filter);
  console.log(`[backfill] candidates: ${total}`);
  if (total === 0) {
    console.log('[backfill] nothing to do.');
    await mongoose.disconnect();
    return;
  }

  const cursor = UserTestAttempt.find(filter).select('_id test maxScore').cursor();
  let batch = [];
  let processed = 0;
  let skippedNoTest = 0;

  for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
    const snap = await loadTest(doc.test);
    if (!snap) {
      // Test was deleted — keep the attempt but mark with empty snapshot so
      // future runs don't re-evaluate it forever.
      skippedNoTest++;
      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: {
            testTitle:         '(test deleted)',
            testSubjects:      [],
            testChapters:      [],
            testTopics:        [],
            questionBankId:    null,
            questionBankTitle: '',
            totalQuestions:    doc.maxScore || 0,
          } },
        },
      });
    } else {
      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: {
            testTitle:         snap.testTitle,
            testSubjects:      snap.testSubjects,
            testChapters:      snap.testChapters,
            testTopics:        snap.testTopics,
            questionBankId:    snap.questionBankId,
            questionBankTitle: snap.questionBankTitle,
            totalQuestions:    snap.totalQuestions || doc.maxScore || 0,
          } },
        },
      });
    }

    if (batch.length >= BATCH_SIZE) {
      await UserTestAttempt.bulkWrite(batch, { ordered: false });
      processed += batch.length;
      console.log(`[backfill] wrote ${processed}/${total}`);
      batch = [];
    }
  }
  if (batch.length) {
    await UserTestAttempt.bulkWrite(batch, { ordered: false });
    processed += batch.length;
  }

  console.log(`[backfill] done. processed=${processed}, deleted-test rows=${skippedNoTest}, unique tests cached=${testCache.size}, unique QBs cached=${qbCache.size}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[backfill] fatal:', err);
  process.exit(1);
});
