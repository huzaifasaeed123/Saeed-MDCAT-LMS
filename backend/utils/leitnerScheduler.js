// ── Leitner-box scheduler for the Syllabus module ────────────────────────────
// Pure functions — no I/O, no DB. Mirror of SKN's intentionally-simple
// 3-button revision flow (Again / Good / Easy). The flashcards module will use
// a separate SM-2 scheduler when we build it; the two stay decoupled.
//
//   stage 0 -> review in  1 day
//   stage 1 -> review in  3 days
//   stage 2 -> review in  7 days
//   stage 3 -> review in 14 days
//   stage 4 -> review in 30 days
//   stage 5 -> review in 60 days
//   stage 6 -> MASTERED (no scheduling)
//
//   Again -> stage = max(0, stage-1), status = learning
//   Good  -> stage = min(6, stage+1)
//   Easy  -> stage = min(6, stage+2)
// ─────────────────────────────────────────────────────────────────────────────

const INTERVAL_BY_STAGE = [1, 3, 7, 14, 30, 60, 0]; // index 6 = mastered (0 days)
const MAX_STAGE         = 6;
const VALID_OUTCOMES    = new Set(['again', 'good', 'easy']);

// Given the current row's stage and an outcome, return the new state + log
// deltas. Caller persists. `row` may be a Mongoose doc or plain object.
function applyOutcome(row, outcome) {
  const stageBefore = row.leitnerStage || 0;
  const prevInt     = row.intervalDays || 0;
  let stageAfter;
  let failDelta    = 0;
  let successDelta = 0;

  if (outcome === 'again') {
    stageAfter = Math.max(0, stageBefore - 1);
    failDelta  = 1;
  } else if (outcome === 'easy') {
    stageAfter = Math.min(MAX_STAGE, stageBefore + 2);
    successDelta = 1;
  } else { // 'good'
    stageAfter = Math.min(MAX_STAGE, stageBefore + 1);
    successDelta = 1;
  }

  const newInt = INTERVAL_BY_STAGE[stageAfter] || 0;
  const status = stageAfter >= MAX_STAGE
    ? 'mastered'
    : (outcome === 'again' ? 'learning' : 'reviewing');

  return { stageBefore, stageAfter, prevInt, newInt, status, failDelta, successDelta };
}

module.exports = {
  INTERVAL_BY_STAGE,
  MAX_STAGE,
  VALID_OUTCOMES,
  applyOutcome,
};
