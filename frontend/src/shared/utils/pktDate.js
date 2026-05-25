// Shared helpers for working with Pakistan-Standard-Time (Asia/Karachi)
// dates across the app. All scheduling fields (course resources, dates,
// test availability windows, review-unlock times) are entered by admins
// IN PKT regardless of where the user is running the app, and displayed
// to students IN PKT regardless of where the server lives. These helpers
// convert between three representations:
//
//   • UTC ISO string (what we send/receive over the wire and what Mongo
//     stores natively as Date).
//   • <input type="datetime-local"> string in PKT wall-clock time
//     ("2026-05-25T14:30") — used to populate / read controlled inputs.
//   • User-facing label string for display ("Wed May 25 · 2:30 PM PKT").
//
// Why offset by +05:00 and not call Intl with a TZ? PKT has no DST and is
// a fixed +05:00 offset, so the math is trivial and doesn't depend on
// the browser's ICU data. The display helpers do use Intl with
// timeZone:'Asia/Karachi' for the locale-formatted strings.

// Convert any date-ish value (Date, ISO string, etc.) to a `datetime-local`
// input value that represents the SAME instant expressed in PKT wall-clock
// time. Returns '' for null/invalid input so the input renders blank.
export const toPktInputValue = (v) => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    // Shift the UTC clock forward 5h so the resulting UTC fields are the
    // PKT wall-clock values; then format as YYYY-MM-DDTHH:mm.
    const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pkt.getUTCFullYear()}-${pad(pkt.getUTCMonth() + 1)}-${pad(pkt.getUTCDate())}T${pad(pkt.getUTCHours())}:${pad(pkt.getUTCMinutes())}`;
  } catch { return ''; }
};

// Convert a `datetime-local` input value (read as PKT wall-clock) to a
// proper UTC ISO string for storage. Returns '' for blank input so
// callers can ship the field as empty/null without sending "Invalid Date".
export const pktInputToUtcIso = (localStr) => {
  if (!localStr) return '';
  return new Date(`${localStr}:00+05:00`).toISOString();
};

// Locale-formatted PKT label for display. Pass any subset of Intl options
// (e.g. { weekday: 'short', month: 'short', day: 'numeric' }) — the
// timeZone is locked to Asia/Karachi.
export const fmtPkt = (v, opts) => {
  if (!v) return '';
  try {
    return new Date(v).toLocaleString('en-PK', {
      timeZone: 'Asia/Karachi',
      ...opts,
    });
  } catch { return ''; }
};

// "Wed, May 25 · 2:30 PM PKT" — used in lock/closed messages.
export const fmtPktDateTime = (v) => {
  const datePart = fmtPkt(v, { weekday: 'short', month: 'short', day: 'numeric' });
  const timePart = fmtPkt(v, { hour: 'numeric', minute: '2-digit', hour12: true });
  if (!datePart || !timePart) return '';
  return `${datePart} · ${timePart} PKT`;
};

// "in 3d 4h" / "in 5h 12m" / "in 8m" / 'opening soon' — friendly
// countdown until a future UTC date. Returns '' if the date is past
// (caller should branch on that and render the "open now" state).
export const fmtCountdown = (target) => {
  if (!target) return '';
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return '';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `in ${d}d ${h % 24}h`;
  if (h > 0) return `in ${h}h ${m % 60}m`;
  if (m > 0) return `in ${m}m`;
  return 'opening soon';
};

// Resolve a scheduling triple (availability, unlockAt, lockAt) to a single
// status string the UI can branch on. Used both for course resources and
// for Tests — same enum + same field names. Pure function: doesn't read
// "now" except through `Date.now()` so callers can wrap in useMemo and
// re-derive on a timer if they want live updates.
//   'available' — open right now
//   'locked'    — unlock_date / window mode, hasn't opened yet
//   'closed'    — window mode, past lockAt
export const resolveScheduleStatus = ({ availability, unlockAt, lockAt }) => {
  if (!availability || availability === 'public') return 'available';
  const now = Date.now();
  if (availability === 'unlock_date') {
    return unlockAt && now < new Date(unlockAt).getTime() ? 'locked' : 'available';
  }
  if (availability === 'window') {
    if (unlockAt && now < new Date(unlockAt).getTime()) return 'locked';
    if (lockAt   && now > new Date(lockAt).getTime())   return 'closed';
    return 'available';
  }
  return 'available';
};
