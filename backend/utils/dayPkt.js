// ── Day helper — Asia/Karachi (PKT, UTC+5) ───────────────────────────────────
// All "day rollover" math for the syllabus + (future) flashcards modules lives
// here. We store day-strings as 'YYYY-MM-DD' so string comparison on indexes
// works exactly like date comparison. Pakistan has no DST, so a fixed
// +5h offset is correct year-round.
// ─────────────────────────────────────────────────────────────────────────────

const OFFSET_MIN = 5 * 60; // PKT = UTC+5

const pad2 = (n) => String(n).padStart(2, '0');

// Convert any Date (or now) to a PKT calendar day string 'YYYY-MM-DD'.
const todayPkt = (d = new Date()) => {
  const t = new Date(d.getTime() + OFFSET_MIN * 60_000);
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`;
};

// Add (or subtract with negative n) calendar days to a PKT day string.
// Inputs that aren't valid 'YYYY-MM-DD' return the input unchanged.
const addDaysPkt = (dayStr, n) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayStr)) return dayStr;
  const [y, m, d] = dayStr.split('-').map(Number);
  const base = Date.UTC(y, m - 1, d); // anchor at noon-UTC for that PKT date
  const next = new Date(base + n * 86_400_000);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
};

// Inclusive count of PKT days between two 'YYYY-MM-DD' strings (a <= b).
const daysBetweenPkt = (a, b) => {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
};

module.exports = { todayPkt, addDaysPkt, daysBetweenPkt };
