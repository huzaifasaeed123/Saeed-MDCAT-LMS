// ── Visual config + helpers shared by every syllabus subcomponent ─────────
// Matches SKN's color system: each subject has a gradient + status pills
// shared between dark cards on the syllabus page.

export const STAGE_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 0];
export const STAGE_LABEL = ['Stage 0', 'Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5', 'Mastered'];

// Subject → SKN gradient classes for the 48px square badge (used inside
// dark cards on the student syllabus page).
export const SUBJECT_GRADIENT = {
  Biology:             'bg-gradient-to-br from-emerald-500 to-teal-600',
  Chemistry:           'bg-gradient-to-br from-blue-500 to-blue-700',
  Physics:             'bg-gradient-to-br from-purple-500 to-purple-700',
  English:             'bg-gradient-to-br from-amber-500 to-orange-600',
  'Logical Reasoning': 'bg-gradient-to-br from-red-500 to-red-700',
};
export const subjectGradient = (s) => SUBJECT_GRADIENT[s] || 'bg-gradient-to-br from-slate-500 to-slate-700';

// Light-theme subject chip — used by the admin page (light background) where
// the dark gradient badge would look out of place. Keep these in sync with
// SUBJECT_GRADIENT so the two stay color-coordinated.
export const SUBJECT_CHIP = {
  Biology:             'bg-emerald-50 text-emerald-700 border-emerald-200',
  Chemistry:           'bg-blue-50 text-blue-700 border-blue-200',
  Physics:             'bg-purple-50 text-purple-700 border-purple-200',
  English:             'bg-amber-50 text-amber-700 border-amber-200',
  'Logical Reasoning': 'bg-red-50 text-red-700 border-red-200',
};
export const subjectClass = (s) => SUBJECT_CHIP[s] || 'bg-gray-50 text-gray-700 border-gray-200';

// Short abbreviation shown in the top of the 48px badge.
export const SUBJECT_ABBR = {
  Biology: 'BIO', Chemistry: 'CHEM', Physics: 'PHYS',
  English: 'ENG', 'Logical Reasoning': 'LR',
};
export const subjectAbbr = (s) => SUBJECT_ABBR[s] || (s || '').slice(0, 4).toUpperCase();

// Status pills (translucent backgrounds against the dark card).
export const STATUS_STYLE = {
  new:       { label: 'NEW',       cls: 'bg-blue-500/15 text-blue-300 border-blue-500/35' },
  learning:  { label: 'LEARNING',  cls: 'bg-amber-500/15 text-amber-300 border-amber-500/35' },
  reviewing: { label: 'REVIEWING', cls: 'bg-purple-500/15 text-purple-300 border-purple-500/35' },
  mastered:  { label: 'MASTERED',  cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35' },
};
export const statusStyle = (s) => STATUS_STYLE[s] || STATUS_STYLE.new;

// "in 2d" / "today" / "5d ago" formatter. Inputs: PKT day string + today's PKT string.
export const dayLabel = (input, todayStr) => {
  if (!input) return '—';
  const a = typeof input === 'string' ? input : input.toISOString().slice(0, 10);
  if (!todayStr || a === todayStr) return 'today';
  const [ay, am, ad] = a.split('-').map(Number);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const diff = Math.round((Date.UTC(ay, am - 1, ad) - Date.UTC(ty, tm - 1, td)) / 86_400_000);
  if (diff === 1)  return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 0)    return `in ${diff}d`;
  return `${-diff}d ago`;
};

// Sticky-note color → Tailwind class map.
export const NOTE_BG = {
  yellow: 'bg-yellow-200/90 text-yellow-950 border-yellow-400/60',
  pink:   'bg-pink-200/90 text-pink-950 border-pink-400/60',
  blue:   'bg-blue-200/90 text-blue-950 border-blue-400/60',
  green:  'bg-emerald-200/90 text-emerald-950 border-emerald-400/60',
  purple: 'bg-purple-200/90 text-purple-950 border-purple-400/60',
};
export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'];
