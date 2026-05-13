import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import * as svc from '../services/syllabusService';

// Week tab: lazy-load once on first open, then keep the result in local
// state. Navigation (prev/next/today) re-fetches the chosen window.
//
// This component owns its own data — it doesn't touch the parent's progress
// state. That's fine because the Week view is read-only.
const fmt = (s) => {
  if (!s) return '';
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

const WeekPane = () => {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  // First load — only happens when the user opens this tab for the first time
  // since WeekPane is mounted only when the parent's tab state === 'week'.
  useEffect(() => {
    let alive = true;
    svc.getWeek()
      .then((r) => alive && setData(r))
      .catch(() => alive && toast.error('Failed to load week'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const shift = async (delta) => {
    if (!data) return;
    const [y, m, d] = data.start.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + delta));
    const ns = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
    try {
      const r = await svc.getWeek(ns);
      setData(r);
    } catch { toast.error('Failed to shift week'); }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>;
  }
  if (!data) return <div className="p-6 text-slate-500">No data.</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold text-white">Weekly revision calendar</h3>
        <div className="flex items-center gap-2 text-sm">
          <button onClick={() => shift(-7)} className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200">‹</button>
          <span className="text-slate-300 font-semibold">{fmt(data.start)} – {fmt(data.end)}</span>
          <button onClick={() => shift(0)} className="px-3 h-8 text-xs font-bold rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">Today</button>
          <button onClick={() => shift(7)} className="w-8 h-8 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200">›</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {data.days.map((d) => (
          <div key={d.day} className={`bg-slate-900 border ${d.isToday ? 'border-emerald-400 ring-1 ring-emerald-400/40' : 'border-slate-800'} rounded-xl p-3 ${d.isPast ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{fmt(d.day)}</p>
                {d.isToday && <p className="text-[9px] font-bold text-emerald-400">TODAY</p>}
              </div>
              <span className="text-[10px] text-emerald-400 font-bold">{d.reviewedCount}✓</span>
            </div>
            {d.scheduled.length === 0 && d.todos.length === 0 ? (
              <p className="text-[11px] text-slate-600">Nothing planned</p>
            ) : (
              <>
                {d.scheduled.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[9px] uppercase text-slate-500 font-bold mb-1">Revisions ({d.scheduled.length})</p>
                    <ul className="space-y-0.5">
                      {d.scheduled.slice(0, 4).map((s) => (
                        <li key={s._id} className="text-[10px] text-slate-300 truncate">
                          <span className="font-bold text-emerald-400">{s.outcomeCode}</span> {s.outcomeText}
                        </li>
                      ))}
                      {d.scheduled.length > 4 && <li className="text-[9px] text-slate-500">+{d.scheduled.length - 4} more</li>}
                    </ul>
                  </div>
                )}
                {d.todos.length > 0 && (
                  <div>
                    <p className="text-[9px] uppercase text-slate-500 font-bold mb-1">Todos ({d.todos.length})</p>
                    <ul className="space-y-0.5">
                      {d.todos.slice(0, 4).map((t) => (
                        <li key={t._id} className={`text-[10px] truncate ${t.done ? 'line-through text-slate-600' : 'text-slate-300'}`}>
                          <span className="font-bold capitalize text-amber-400">{t.taskType}:</span> {t.outcomeCode || t.taskText || '—'}
                        </li>
                      ))}
                      {d.todos.length > 4 && <li className="text-[9px] text-slate-500">+{d.todos.length - 4} more</li>}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeekPane;
