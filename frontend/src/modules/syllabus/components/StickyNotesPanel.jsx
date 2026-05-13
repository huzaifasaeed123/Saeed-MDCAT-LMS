import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { FiPlus } from 'react-icons/fi';
import * as svc from '../services/syllabusService';
import { NOTE_BG, NOTE_COLORS } from './syllabusMeta';

// Surgical state updates: each CRUD action makes ONE API call, then the
// component reports the result back to the parent via the onXxx callbacks.
// The parent merges into its `notes[]` state. No refetch.
const StickyNotesPanel = ({ notes, onCreated, onUpdated, onDeleted }) => {
  const [open, setOpen]   = useState(null); // null=closed, {} for new, {…} for edit
  const [body, setBody]   = useState('');
  const [color, setColor] = useState('yellow');
  const [busy, setBusy]   = useState(false);

  const startNew  = () => { setOpen({}); setBody(''); setColor('yellow'); };
  const startEdit = (n) => { setOpen(n); setBody(n.body); setColor(n.color); };
  const close     = () => setOpen(null);

  const save = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      if (open?._id) {
        const r = await svc.updateNote(open._id, { body: body.trim(), color });
        onUpdated?.(r.data);
      } else {
        const r = await svc.createNote({ body: body.trim(), color });
        onCreated?.(r.data);
      }
      close();
    } catch { toast.error('Failed to save'); }
    finally { setBusy(false); }
  };

  const del = async (id) => {
    try {
      await svc.deleteNote(id);
      onDeleted?.(id);
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <span className="text-amber-400">📌</span> Sticky notes &amp; quick plans
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">{notes.length}</span>
        </h3>
        <button onClick={startNew} className="px-3 py-1.5 text-xs font-bold rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 flex items-center gap-1">
          <FiPlus className="w-3 h-3" /> New note
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-6 px-4 bg-slate-900/50 border border-dashed border-slate-700 rounded-xl">
          <p className="text-sm text-slate-400">No notes yet — pin a quick plan or reminder.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {notes.map((n) => (
            <div key={n._id} className={`group p-3 rounded-xl border ${NOTE_BG[n.color] || NOTE_BG.yellow} shadow-sm flex flex-col`}>
              <p className="text-xs whitespace-pre-wrap flex-1 leading-snug">{n.body}</p>
              <div className="flex items-center justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => startEdit(n)} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/15 hover:bg-black/25">Edit</button>
                <button onClick={() => del(n._id)} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/15 hover:bg-red-500/40 text-red-900 hover:text-white">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/60" onClick={close} />
          <div className="relative bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 w-full max-w-md mx-4">
            <h4 className="font-bold text-white mb-3">{open._id ? 'Edit note' : 'New note'}</h4>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="Quick reminder, plan, or any free-text…"
              autoFocus
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-emerald-400 resize-none"
            />
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[11px] text-slate-400 mr-1">Color:</span>
              {NOTE_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${NOTE_BG[c]} ${color === c ? 'ring-2 ring-white scale-110' : ''}`}
                  title={c}
                />
              ))}
              <div className="flex-1" />
              <button onClick={close} className="px-3 py-1.5 text-xs font-semibold rounded-md text-slate-300 hover:text-white">Cancel</button>
              <button onClick={save} disabled={busy || !body.trim()} className="px-4 py-1.5 text-xs font-bold rounded-md bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-50">
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StickyNotesPanel;
