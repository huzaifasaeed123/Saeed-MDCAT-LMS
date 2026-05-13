import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FiCheck, FiCheckSquare, FiPlus, FiTrash2, FiZap } from 'react-icons/fi';
import * as svc from '../services/syllabusService';

// Same pattern as StickyNotesPanel — each mutation does ONE API call then
// reports back via callbacks. Parent merges into state. No refetch loops.
// "Auto-plan" is the one exception: it bulk-inserts on the server, so we ask
// the parent for a single targeted reload of todos via onSeeded().
const PlanTile = ({ n, label, color }) => (
  <div className={`text-center px-3 py-2 rounded-lg border ${color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : color === 'amber' ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-200'}`}>
    <p className="text-xl font-extrabold leading-none">{n}</p>
    <p className="text-[10px] uppercase tracking-wider mt-0.5 opacity-80">{label}</p>
  </div>
);

const DailyPlanner = ({ todos, onCreated, onUpdated, onDeleted, onSeeded }) => {
  const [text,    setText]    = useState('');
  const [adding,  setAdding]  = useState(false);
  const [seeding, setSeeding] = useState(false);

  const done = todos.filter((t) => t.done).length;
  const pending = todos.length - done;

  const addCustom = async () => {
    if (!text.trim()) return;
    setAdding(true);
    try {
      const r = await svc.createTodo({ taskType: 'custom', taskText: text.trim() });
      onCreated?.(r.data);
      setText('');
    } catch { toast.error('Failed to add'); }
    finally { setAdding(false); }
  };

  const toggle = async (id, nextDone) => {
    try {
      const r = await svc.updateTodo(id, { done: nextDone });
      onUpdated?.(r.data || { _id: id, done: nextDone, doneAt: nextDone ? new Date().toISOString() : null });
    } catch { toast.error('Failed to update'); }
  };

  const del = async (id) => {
    try {
      await svc.deleteTodo(id);
      onDeleted?.(id);
    } catch { toast.error('Failed to delete'); }
  };

  const autoPlan = async () => {
    setSeeding(true);
    try {
      const r = await svc.seedTodo({ includeDue: true, includeTrackers: true, includeNew: 3 });
      toast.success(`Added ${r.added} item${r.added === 1 ? '' : 's'}`);
      // Server bulk-inserted N rows. One targeted reload of the todo list
      // here is cheaper than echoing all the new docs back over the wire.
      onSeeded?.();
    } catch { toast.error('Auto-plan failed'); }
    finally { setSeeding(false); }
  };

  const clearDone = async () => {
    const doneIds = todos.filter((t) => t.done).map((t) => t._id);
    try {
      // Optimistic — remove from local state first, then fire-and-forget.
      doneIds.forEach((id) => onDeleted?.(id));
      await Promise.all(doneIds.map((id) => svc.deleteTodo(id)));
    } catch { toast.error('Some deletes failed — refresh to sync'); }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <FiCheckSquare className="text-emerald-400" /> My plan · Today
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <PlanTile n={todos.length} label="Tasks" />
        <PlanTile n={done}         label="Done"     color="emerald" />
        <PlanTile n={pending}      label="Pending"  color="amber" />
      </div>

      <div className="space-y-1.5 mb-3 max-h-[300px] overflow-y-auto">
        {todos.length === 0 ? (
          <p className="text-center text-xs text-slate-500 py-4">No tasks yet — auto-plan your day or add one below.</p>
        ) : todos.map((t) => (
          <div key={t._id} className={`flex items-start gap-2 px-2.5 py-1.5 rounded-md border ${t.done ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-800 bg-slate-950/50'}`}>
            <button
              onClick={() => toggle(t._id, !t.done)}
              className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border ${t.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-600 hover:border-emerald-400'} flex items-center justify-center`}
            >
              {t.done && <FiCheck className="w-3 h-3" />}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-xs ${t.done ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                <span className="font-bold mr-1 capitalize text-emerald-400">
                  {t.taskType}{t.taskType === 'mcqs' && t.targetCount ? ` ×${t.targetCount}` : ''}:
                </span>
                {t.outcomeCode ? `${t.outcomeCode} — ${t.outcomeText}` : (t.taskText || '—')}
              </p>
              {t.subject && <p className="text-[10px] text-slate-500 mt-0.5">{t.subject} · Unit {t.unitNumber}</p>}
            </div>
            <button onClick={() => del(t._id)} className="text-slate-500 hover:text-red-400" title="Delete">
              <FiTrash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-3">
        <button onClick={autoPlan} disabled={seeding} className="flex-1 px-3 py-1.5 text-xs font-bold rounded-md bg-gradient-to-r from-emerald-500 to-blue-500 text-white disabled:opacity-50 flex items-center justify-center gap-1">
          <FiZap className="w-3.5 h-3.5" /> {seeding ? 'Planning…' : 'Auto-plan my day'}
        </button>
        {done > 0 && (
          <button onClick={clearDone} className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300">
            Clear completed
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addCustom(); }}
          placeholder="Quick custom task (e.g. Revise equations)"
          className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-sm text-slate-100 focus:outline-none focus:border-emerald-400"
        />
        <button onClick={addCustom} disabled={adding || !text.trim()} className="px-3 py-1.5 text-xs font-bold rounded-md bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50 flex items-center gap-1">
          <FiPlus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

export default DailyPlanner;
