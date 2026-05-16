// Advanced date-based course viewer.
// Top: horizontal scrollable date timeline (with TODAY marker).
// Left: detailed sidebar list of all entries.
// Main: hero header (calendar tile, weekday, countdown) + resources + Prev/Next.
import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FiCalendar, FiLock, FiUnlock, FiCheck, FiClock,
  FiChevronLeft, FiChevronRight,
  FiVideo, FiFileText, FiCheckSquare, FiLink,
  FiExternalLink, FiPlay, FiMenu, FiX,
} from 'react-icons/fi';
import { getBackendUrl } from '../../../../shared/utils/fixImageUrls';

const STATIC_BASE = getBackendUrl();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pkt = (v, opts) => {
  if (!v) return '';
  try { return new Date(v).toLocaleString('en-PK', { timeZone: 'Asia/Karachi', ...opts }); }
  catch { return ''; }
};

const fmtWeekday    = (v) => pkt(v, { weekday: 'long' });
const fmtWeekdayShort=(v) => pkt(v, { weekday: 'short' });
const fmtDateFull   = (v) => pkt(v, { day: 'numeric', month: 'long', year: 'numeric' });
const fmtDateShort  = (v) => pkt(v, { day: 'numeric', month: 'short' });
const fmtTime       = (v) => pkt(v, { hour: '2-digit', minute: '2-digit' });
const fmtMonthShort = (v) => pkt(v, { month: 'short' });
const fmtDayNum     = (v) => pkt(v, { day: 'numeric' });

const entryStatus  = (s) => (!s.unlockAt || new Date() >= new Date(s.unlockAt)) ? 'available' : 'locked';

const isSameDayPKT = (d1, d2) => {
  if (!d1 || !d2) return false;
  const f = (d) => pkt(d, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return f(d1) === f(d2);
};

const resStatus = (r) => {
  const { availability: av, unlockAt, lockAt } = r;
  if (!av || av === 'public') return 'available';
  const now = new Date();
  if (av === 'unlock_date') return unlockAt && now < new Date(unlockAt) ? 'locked' : 'available';
  if (av === 'window') {
    if (unlockAt && now < new Date(unlockAt)) return 'locked';
    if (lockAt   && now > new Date(lockAt))   return 'closed';
    return 'available';
  }
  return 'available';
};

// Friendly countdown until unlock — "in 3d 4h", "in 5h 12m", "in 8m"
const fmtCountdown = (target) => {
  if (!target) return '';
  const ms = new Date(target) - new Date();
  if (ms <= 0) return '';
  const m = Math.floor(ms / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0)  return `in ${d}d ${h % 24}h`;
  if (h > 0)  return `in ${h}h ${m % 60}m`;
  if (m > 0)  return `in ${m}m`;
  return 'opening soon';
};

const RES_CFG = {
  lecture:  { label: 'Lecture',       Icon: FiVideo,       color: 'text-red-500',     solidBg: 'bg-red-500',     hoverBg: 'hover:bg-red-600',     lightBg: 'bg-red-50',     border: 'border-red-200'     },
  notes:    { label: 'Notes',         Icon: FiFileText,    color: 'text-orange-500',  solidBg: 'bg-orange-500',  hoverBg: 'hover:bg-orange-600',  lightBg: 'bg-orange-50',  border: 'border-orange-200'  },
  test:     { label: 'Test',          Icon: FiCheckSquare, color: 'text-emerald-600', solidBg: 'bg-emerald-600', hoverBg: 'hover:bg-emerald-700', lightBg: 'bg-emerald-50', border: 'border-emerald-200' },
  external: { label: 'External Test', Icon: FiLink,        color: 'text-purple-600',  solidBg: 'bg-purple-600',  hoverBg: 'hover:bg-purple-700',  lightBg: 'bg-purple-50',  border: 'border-purple-200'  },
};

// ─── ResourceCard ─────────────────────────────────────────────────────────────
const ResourceCard = ({ resource, onStartTest, onOpenViewer, entryLocked }) => {
  const cfg = RES_CFG[resource.type] || RES_CFG.lecture;
  const title = resource.title || (resource.type === 'test' && resource.testId?.title) || 'Untitled';
  const st = resStatus(resource);

  if (entryLocked) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 bg-white/60">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <cfg.Icon className="w-4 h-4 text-gray-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-400 truncate">{title}</p>
          <p className="text-xs text-gray-300 mt-0.5">{cfg.label}</p>
        </div>
        <FiLock className="w-4 h-4 text-gray-300 flex-shrink-0" />
      </div>
    );
  }

  if (st === 'locked') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50/60">
        <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
          <cfg.Icon className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700 truncate">{title}</p>
          <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
            <FiClock className="w-3 h-3" /> Opens {fmtDateShort(resource.unlockAt)} {fmtTime(resource.unlockAt)} PKT
          </p>
        </div>
        <FiLock className="w-4 h-4 text-amber-400 flex-shrink-0" />
      </div>
    );
  }

  if (st === 'closed') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 opacity-60">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
          <cfg.Icon className="w-4 h-4 text-gray-300" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-400 truncate">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">Closed</p>
        </div>
        <FiClock className="w-4 h-4 text-gray-400 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl border ${cfg.border} bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all`}>
      <div className={`w-10 h-10 rounded-xl ${cfg.lightBg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
        <cfg.Icon className={`w-4 h-4 ${cfg.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{title}</p>
        <p className="text-xs text-gray-400 mt-0.5">{cfg.label}</p>
      </div>
      <div className="flex-shrink-0">
        {resource.type === 'lecture' && resource.driveFileId && (
          <button onClick={() => onOpenViewer({ type: 'video', driveFileId: resource.driveFileId, title })}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold text-white ${cfg.solidBg} ${cfg.hoverBg} rounded-lg px-3.5 py-2 transition-colors shadow-sm`}>
            <FiPlay className="w-3 h-3" /> Watch
          </button>
        )}
        {resource.type === 'notes' && resource.driveFileId && (
          <button onClick={() => onOpenViewer({ type: 'pdf', driveFileId: resource.driveFileId, title })}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold text-white ${cfg.solidBg} ${cfg.hoverBg} rounded-lg px-3.5 py-2 transition-colors shadow-sm`}>
            <FiFileText className="w-3 h-3" /> View
          </button>
        )}
        {resource.type === 'notes' && !resource.driveFileId && resource.fileUrl && (
          <a href={`${STATIC_BASE}${resource.fileUrl}`} target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-xs font-semibold text-white ${cfg.solidBg} ${cfg.hoverBg} rounded-lg px-3.5 py-2 transition-colors shadow-sm`}>
            <FiExternalLink className="w-3 h-3" /> Open PDF
          </a>
        )}
        {resource.type === 'test' && resource.testId && (
          <button onClick={() => onStartTest(resource.testId._id || resource.testId)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold text-white ${cfg.solidBg} ${cfg.hoverBg} rounded-lg px-3.5 py-2 transition-colors shadow-sm`}>
            <FiCheckSquare className="w-3 h-3" /> Start Test
          </button>
        )}
        {resource.type === 'external' && resource.externalUrl && (
          <a href={resource.externalUrl} target="_blank" rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-xs font-semibold text-white ${cfg.solidBg} ${cfg.hoverBg} rounded-lg px-3.5 py-2 transition-colors shadow-sm`}>
            <FiExternalLink className="w-3 h-3" /> Open Test
          </a>
        )}
      </div>
    </div>
  );
};

// ─── DateTimeline ─────────────────────────────────────────────────────────────
const DateTimeline = ({ sorted, selectedIdx, onSelect }) => {
  const containerRef = useRef(null);
  const today = new Date();

  // Auto-scroll active pill into view
  useEffect(() => {
    const el = containerRef.current?.querySelector(`[data-idx="${selectedIdx}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedIdx]);

  if (sorted.length === 0) return null;

  return (
    <div className="relative bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-gray-200 px-3 py-3">
      <div ref={containerRef} className="flex gap-2 overflow-x-auto scrollbar-thin pb-1" style={{ scrollbarWidth: 'thin' }}>
        {sorted.map((entry, idx) => {
          const isActive = idx === selectedIdx;
          const locked   = entryStatus(entry) === 'locked';
          const isToday  = entry.unlockAt && isSameDayPKT(entry.unlockAt, today);

          return (
            <button
              key={entry._id} data-idx={idx}
              onClick={() => onSelect(idx)}
              title={entry.title}
              className={`relative flex-shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-2 min-w-[68px] border transition-all ${
                isActive
                  ? 'bg-gradient-to-br from-teal-500 to-emerald-500 text-white border-teal-500 shadow-lg scale-105'
                  : locked
                    ? 'bg-white text-amber-600 border-amber-200 hover:border-amber-300'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-teal-300 hover:bg-teal-50'
              }`}
            >
              {/* TODAY badge */}
              {isToday && !isActive && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-wide bg-rose-500 text-white px-1.5 py-0.5 rounded-full shadow">
                  Today
                </span>
              )}
              {entry.unlockAt ? (
                <>
                  <span className={`text-[10px] uppercase tracking-wider font-semibold ${
                    isActive ? 'text-teal-100' : locked ? 'text-amber-500' : 'text-gray-500'
                  }`}>
                    {fmtWeekdayShort(entry.unlockAt)}
                  </span>
                  <span className={`text-xl font-black leading-tight ${
                    isActive ? 'text-white' : locked ? 'text-amber-600' : 'text-gray-800'
                  }`}>
                    {fmtDayNum(entry.unlockAt)}
                  </span>
                  <span className={`text-[10px] font-semibold uppercase ${
                    isActive ? 'text-teal-100' : 'text-gray-400'
                  }`}>
                    {fmtMonthShort(entry.unlockAt)}
                  </span>
                </>
              ) : (
                <>
                  <FiCalendar className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-white' : 'text-gray-500'}`}>ANY</span>
                </>
              )}
              {locked && !isActive && (
                <FiLock className="absolute top-1 right-1 w-2.5 h-2.5 text-amber-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ─── SidebarList ──────────────────────────────────────────────────────────────
const SidebarList = ({ sorted, selectedIdx, onSelect, availableCount, onClose }) => (
  <div className="flex flex-col h-full">
    <div className="px-4 py-3.5 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-emerald-50 flex items-center justify-between flex-shrink-0">
      <div>
        <p className="font-bold text-gray-800 text-sm flex items-center gap-1.5">
          <FiCalendar className="w-4 h-4 text-teal-500" /> Course Schedule
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          <span className="text-emerald-600 font-semibold">{availableCount}</span> available
          <span className="text-gray-300 mx-1">·</span>
          <span className="text-amber-600 font-semibold">{sorted.length - availableCount}</span> upcoming
        </p>
      </div>
      {onClose && (
        <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white/60">
          <FiX className="w-4 h-4" />
        </button>
      )}
    </div>

    <div className="flex-1 overflow-y-auto">
      {sorted.map((entry, idx) => {
        const st = entryStatus(entry);
        const isActive = idx === selectedIdx;
        const locked = st === 'locked';

        return (
          <button key={entry._id} onClick={() => onSelect(idx)}
            className={`w-full text-left px-4 py-3 border-b border-gray-100 flex items-start gap-3 transition-colors ${
              isActive
                ? 'bg-teal-50 border-l-[3px] border-l-teal-500 pl-[13px]'
                : locked
                  ? 'hover:bg-gray-50 opacity-70'
                  : 'hover:bg-gray-50'
            }`}>
            {/* Date tile */}
            <div className={`flex-shrink-0 w-11 rounded-lg overflow-hidden border text-center ${
              isActive ? 'border-teal-300 shadow-sm' : locked ? 'border-amber-200' : 'border-gray-200'
            }`}>
              <div className={`text-[8px] py-0.5 font-bold uppercase ${
                isActive ? 'bg-teal-500 text-white' : locked ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {entry.unlockAt ? fmtWeekdayShort(entry.unlockAt).slice(0, 3) : 'ANY'}
              </div>
              <div className="bg-white py-1">
                {entry.unlockAt ? (
                  <p className={`text-base font-black leading-none ${
                    isActive ? 'text-teal-600' : locked ? 'text-amber-700' : 'text-gray-700'
                  }`}>
                    {fmtDayNum(entry.unlockAt)}
                  </p>
                ) : (
                  <FiCalendar className="w-3 h-3 mx-auto text-gray-400" />
                )}
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold leading-snug line-clamp-2 ${
                isActive ? 'text-teal-700' : locked ? 'text-gray-500' : 'text-gray-800'
              }`}>{entry.title || 'Untitled Entry'}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${
                locked ? 'text-amber-500' : 'text-gray-400'
              }`}>
                {locked
                  ? <><FiLock className="w-3 h-3" /> {fmtCountdown(entry.unlockAt) || 'Locked'}</>
                  : <><FiCheck className="w-3 h-3 text-emerald-500" /> Available</>}
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {(entry.resources || []).length} item{(entry.resources || []).length !== 1 ? 's' : ''}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

// ─── DateCourseView ───────────────────────────────────────────────────────────
const DateCourseView = ({ subjects, sortOrder, onStartTest, onOpenViewer }) => {
  const sorted = useMemo(() => {
    return [...subjects].sort((a, b) => {
      const aDate = a.unlockAt ? new Date(a.unlockAt) : null;
      const bDate = b.unlockAt ? new Date(b.unlockAt) : null;
      if (!aDate && !bDate) return (a.order || 0) - (b.order || 0);
      if (!aDate) return 1;
      if (!bDate) return -1;
      return sortOrder === 'past_first' ? aDate - bDate : bDate - aDate;
    });
  }, [subjects, sortOrder]);

  // Default to the MOST RECENTLY unlocked entry (largest unlockAt that's <= now),
  // independent of admin's sort direction so student lands on today's content.
  const defaultIdx = useMemo(() => {
    let bestIdx = 0;
    let bestTime = -Infinity;
    const now = Date.now();
    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i].unlockAt ? new Date(sorted[i].unlockAt).getTime() : 0;
      if (t > now) continue; // skip locked/future
      if (t > bestTime) { bestTime = t; bestIdx = i; }
    }
    return bestIdx;
  }, [sorted]);

  const [selectedIdx, setSelectedIdx] = useState(defaultIdx);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => { setSelectedIdx(defaultIdx); }, [defaultIdx]);

  const entry = sorted[selectedIdx];
  const isLocked = entry ? entryStatus(entry) === 'locked' : false;
  const resources = entry ? [...(entry.resources || [])].sort((a, b) => (a.order || 0) - (b.order || 0)) : [];
  const availableCount = sorted.filter((s) => entryStatus(s) === 'available').length;

  const goTo = (idx) => {
    if (idx >= 0 && idx < sorted.length) {
      setSelectedIdx(idx);
      setSidebarOpen(false);
      document.getElementById('date-course-main')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevEntry = selectedIdx > 0 ? sorted[selectedIdx - 1] : null;
  const nextEntry = selectedIdx < sorted.length - 1 ? sorted[selectedIdx + 1] : null;

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border">
        <FiCalendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No content available yet.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-80 max-w-[85vw] bg-white h-full flex flex-col shadow-2xl border-r border-gray-200">
            <SidebarList sorted={sorted} selectedIdx={selectedIdx}
              onSelect={(i) => { setSelectedIdx(i); setSidebarOpen(false); }}
              availableCount={availableCount}
              onClose={() => setSidebarOpen(false)} />
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Date timeline (top) */}
        <DateTimeline sorted={sorted} selectedIdx={selectedIdx} onSelect={goTo} />

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-white shadow-sm">
            <FiMenu className="w-4 h-4" /> Outline
          </button>
          <span className="text-sm font-medium text-gray-500">
            {selectedIdx + 1} <span className="text-gray-300 mx-0.5">/</span> {sorted.length}
          </span>
          <div className="flex gap-1.5">
            <button onClick={() => goTo(selectedIdx - 1)} disabled={!prevEntry}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed">
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => goTo(selectedIdx + 1)} disabled={!nextEntry}
              className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-white shadow-sm disabled:opacity-30 disabled:cursor-not-allowed">
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex min-h-[600px]">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex w-72 lg:w-80 flex-col border-r border-gray-200 flex-shrink-0">
            <SidebarList sorted={sorted} selectedIdx={selectedIdx}
              onSelect={goTo} availableCount={availableCount} onClose={null} />
          </aside>

          {/* Main */}
          <main id="date-course-main" className="flex-1 min-w-0 flex flex-col overflow-y-auto">

            {/* HERO header */}
            <div className={`relative px-6 py-7 border-b flex-shrink-0 overflow-hidden ${
              isLocked
                ? 'bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border-amber-100'
                : 'bg-gradient-to-br from-teal-50 via-emerald-50 to-cyan-50 border-teal-100'
            }`}>
              {/* Decorative blob */}
              <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-20 blur-2xl ${
                isLocked ? 'bg-amber-300' : 'bg-teal-300'
              }`} />

              <div className="relative flex items-start gap-5">
                {/* Big calendar tile */}
                <div className={`flex-shrink-0 rounded-2xl overflow-hidden border-2 shadow-md text-center ${
                  isLocked ? 'border-amber-300' : 'border-teal-300'
                }`} style={{ minWidth: 80 }}>
                  <div className={`py-1.5 text-[10px] font-black uppercase tracking-widest ${
                    isLocked ? 'bg-amber-400 text-amber-900' : 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white'
                  }`}>
                    {entry.unlockAt ? fmtWeekdayShort(entry.unlockAt).toUpperCase() : 'ANY'}
                  </div>
                  <div className={`py-2.5 bg-white ${isLocked ? 'text-amber-700' : 'text-teal-700'}`}>
                    {entry.unlockAt ? (
                      <>
                        <p className="text-3xl font-black leading-none">
                          {fmtDayNum(entry.unlockAt)}
                        </p>
                        <p className="text-[10px] font-bold mt-1 tracking-wider">
                          {fmtMonthShort(entry.unlockAt).toUpperCase()}
                        </p>
                      </>
                    ) : (
                      <FiCalendar className="w-7 h-7 mx-auto text-teal-400" />
                    )}
                  </div>
                </div>

                {/* Title block */}
                <div className="flex-1 min-w-0">
                  {entry.unlockAt && (
                    <p className={`text-[11px] font-black uppercase tracking-widest mb-1.5 ${
                      isLocked ? 'text-amber-500' : 'text-teal-600'
                    }`}>
                      {fmtWeekday(entry.unlockAt)} · {fmtDateFull(entry.unlockAt)}
                    </p>
                  )}
                  <h2 className="text-2xl sm:text-3xl font-black text-gray-800 leading-tight">
                    {entry.title || 'Untitled Entry'}
                  </h2>

                  {/* Status row */}
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    {isLocked ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-3 py-1.5">
                        <FiLock className="w-3 h-3" /> Locked · {fmtCountdown(entry.unlockAt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 rounded-full px-3 py-1.5">
                        <FiUnlock className="w-3 h-3" /> Available
                      </span>
                    )}
                    {entry.unlockAt && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-white/70 border border-gray-200 rounded-full px-3 py-1.5">
                        <FiClock className="w-3 h-3" /> {fmtTime(entry.unlockAt)} PKT
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
                      {resources.length} item{resources.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Resources */}
            <div className="flex-1 px-5 sm:px-6 py-5">
              {isLocked && (
                <div className="mb-4 flex items-start gap-3 px-4 py-3.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  <FiLock className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <p className="font-semibold">This content unlocks {fmtCountdown(entry.unlockAt)}</p>
                    <p className="text-xs text-amber-600 mt-0.5">
                      Available on {fmtWeekday(entry.unlockAt)}, {fmtDateFull(entry.unlockAt)} at {fmtTime(entry.unlockAt)} PKT
                    </p>
                  </div>
                </div>
              )}

              {resources.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FiCalendar className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">No content added to this entry yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {resources.map((r) => (
                    <ResourceCard key={r._id} resource={r}
                      onStartTest={onStartTest} onOpenViewer={onOpenViewer}
                      entryLocked={isLocked} />
                  ))}
                </div>
              )}
            </div>

            {/* Footer nav */}
            <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex-shrink-0">
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => goTo(selectedIdx - 1)} disabled={!prevEntry}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 bg-white hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none min-w-0 flex-1 max-w-[42%]"
                >
                  <FiChevronLeft className="w-4 h-4 flex-shrink-0" />
                  <div className="text-left min-w-0 hidden sm:block">
                    <p className="text-[10px] uppercase text-gray-400 tracking-wider leading-none">Previous</p>
                    <p className="text-sm truncate mt-0.5">
                      {prevEntry?.title || 'Start'}
                    </p>
                  </div>
                  <span className="sm:hidden">Prev</span>
                </button>

                <div className="flex flex-col items-center flex-shrink-0">
                  <span className="text-sm font-bold text-gray-700">
                    {selectedIdx + 1}
                    <span className="text-gray-300 mx-1">/</span>
                    <span className="text-gray-500">{sorted.length}</span>
                  </span>
                  <div className="flex gap-1 mt-1.5">
                    {sorted.slice(0, Math.min(sorted.length, 11)).map((_, i) => (
                      <button key={i} onClick={() => goTo(i)} title={sorted[i]?.title}
                        className={`rounded-full transition-all ${
                          i === selectedIdx
                            ? 'w-4 h-1.5 bg-teal-500'
                            : entryStatus(sorted[i]) === 'locked'
                              ? 'w-1.5 h-1.5 bg-amber-300'
                              : 'w-1.5 h-1.5 bg-gray-300 hover:bg-teal-300'
                        }`}
                      />
                    ))}
                    {sorted.length > 11 && (
                      <span className="text-[10px] text-gray-400 ml-0.5">+{sorted.length - 11}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => goTo(selectedIdx + 1)} disabled={!nextEntry}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl border border-teal-200 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 hover:shadow-md transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:shadow-none min-w-0 flex-1 max-w-[42%]"
                >
                  <div className="text-right min-w-0 hidden sm:block">
                    <p className="text-[10px] uppercase text-teal-500 tracking-wider leading-none">Next</p>
                    <p className="text-sm truncate mt-0.5">
                      {nextEntry?.title || 'End'}
                    </p>
                  </div>
                  <span className="sm:hidden">Next</span>
                  <FiChevronRight className="w-4 h-4 flex-shrink-0" />
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DateCourseView;
