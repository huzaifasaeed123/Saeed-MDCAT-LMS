// Visual config for the four announcement types — used by every card variant
// (sidebar, dashboard widget, admin list) so styling stays consistent.
import { FiInfo, FiCalendar, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

export const TYPE_META = {
  info: {
    label: 'INFO',
    Icon: FiInfo,
    badgeClass: 'bg-blue-500/20 text-blue-300 border border-blue-500/40',
    iconWrap:   'bg-blue-500/20 text-blue-300',
    accent:     'border-blue-400',
  },
  test: {
    label: 'TEST',
    Icon: FiCalendar,
    badgeClass: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
    iconWrap:   'bg-purple-500/20 text-purple-300',
    accent:     'border-purple-400',
  },
  update: {
    label: 'UPDATE',
    Icon: FiRefreshCw,
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    iconWrap:   'bg-emerald-500/20 text-emerald-300',
    accent:     'border-emerald-400',
  },
  urgent: {
    label: 'URGENT',
    Icon: FiAlertTriangle,
    badgeClass: 'bg-red-500/90 text-white border border-red-400',
    iconWrap:   'bg-red-500/30 text-red-300',
    accent:     'border-red-400',
  },
};

export const AUDIENCE_LABEL = {
  everyone: 'EVERYONE',
  students: 'STUDENTS',
  teachers: 'TEACHERS',
  admins:   'ADMINS',
};

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
