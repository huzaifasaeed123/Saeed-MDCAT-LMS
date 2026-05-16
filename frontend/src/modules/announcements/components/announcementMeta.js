// Visual config for the four announcement types — used by every card variant
// (sidebar, dashboard widget, admin list) so styling stays consistent.
import { FiInfo, FiCalendar, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

// Each type's chip / icon-tile / left-accent. Light values for light mode,
// dark: variants for dark mode — works on every surface the cards land on
// (dashboard widget, sidebar slide-out, admin list).
export const TYPE_META = {
  info: {
    label: 'INFO',
    Icon: FiInfo,
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
    iconWrap:   'bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
    accent:     'border-blue-400 dark:border-blue-600',
  },
  test: {
    label: 'TEST',
    Icon: FiCalendar,
    badgeClass: 'bg-secondary-100 text-secondary-700 dark:bg-secondary-950/40 dark:text-secondary-300',
    iconWrap:   'bg-secondary-100 text-secondary-600 dark:bg-secondary-950/40 dark:text-secondary-300',
    accent:     'border-secondary-400 dark:border-secondary-600',
  },
  update: {
    label: 'UPDATE',
    Icon: FiRefreshCw,
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    iconWrap:   'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    accent:     'border-emerald-400 dark:border-emerald-600',
  },
  urgent: {
    label: 'URGENT',
    Icon: FiAlertTriangle,
    badgeClass: 'bg-rose-500 text-white',
    iconWrap:   'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
    accent:     'border-rose-400 dark:border-rose-600',
  },
};

export const AUDIENCE_LABEL = {
  everyone: 'EVERYONE',
  students: 'STUDENTS',
  teachers: 'TEACHERS',
  admins:   'ADMINS',
};

// Audience chip used by every variant. Subtle so it doesn't compete with the
// type badge.
export const AUDIENCE_BADGE_CLASS =
  'bg-[var(--bg-muted)] text-[var(--text-muted)] border border-[var(--border)]';

// Tiny "3d ago" formatter — avoids pulling in date-fns just for this widget.
export const timeAgo = (date) => {
  if (!date) return '';
  const ms = Date.now() - new Date(date).getTime();
  const s  = Math.floor(ms / 1000);
  if (s < 60)        return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60)        return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)        return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)        return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12)       return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
};
