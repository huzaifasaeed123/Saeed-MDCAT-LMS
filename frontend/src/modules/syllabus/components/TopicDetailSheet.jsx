import React, { useState, useEffect } from 'react';
import {
  FiX, FiVideo, FiBook, FiCheckSquare, FiRotateCcw,
  FiCheck, FiAward,
} from 'react-icons/fi';
import * as svc from '../services/syllabusService';
import { subjectGradient, subjectAbbr, statusStyle, dayLabel, STAGE_INTERVAL_DAYS } from './syllabusMeta';

// SKN-style "topic detail sheet" — a 4-panel modal opened when the student
// clicks any topic row. Each panel handles one of the 4 study pillars:
//   • Lecture  — toggle lecture watched
//   • Book     — toggle book read
//   • MCQs     — counter with +5 / +10 / set / target
//   • Revise   — Again / Good / Easy buttons + Master shortcut
//
// Data flow:
//   • `progress` comes from the parent's progressMap. We mirror it locally
//     so we can apply optimistic patches before the API responds.
//   • Each action makes ONE API call. The response is merged into local +
//     reported up to the parent via onProgressChange(patch) — the parent
//     updates its progressMap in place. NO full-page refetch.
const PANELS = [
  { key: 'lecture', label: 'Lecture', Icon: FiVideo },
  { key: 'book',    label: 'Book',    Icon: FiBook },
  { key: 'mcq',     label: 'MCQs',    Icon: FiCheckSquare },
  { key: 'revise',  label: 'Revise',  Icon: FiRotateCcw },
];

const TopicDetailSheet = ({ topic, progress, today, onClose, onProgressChange }) => {
  const [panel,  setPanel]  = useState('lecture');
  const [busy,   setBusy]   = useState(false);
  const [local,  setLocal]  = useState(progress);
  const [mcqTgt, setMcqTgt] = useState(progress?.mcqTarget || 50);

  useEffect(() => {
    setLocal(progress);
    setMcqTgt(progress?.mcqTarget || 50);
  }, [progress]);

  if (!topic) return null;
  const status = statusStyle(local?.status || 'new');

  // One API call → merge response into local AND bubble the same patch to
  // the parent. Optimistic patches are pre-applied so the UI is snappy.
  const run = async (fn, optimistic) => {
    setBusy(true);
    if (optimistic) {
      setLocal((p) => ({ ...(p || {}), ...optimistic }));
      onProgressChange?.(optimistic);
    }
    try {
      const r = await fn();
      // Strip the envelope's "success" boolean — only progress-field deltas
      // belong in the patch.
      const patch = { ...r };
      delete patch.success;
      setLocal((p) => ({ ...(p || {}), ...patch }));
      onProgressChange?.(patch);
    } catch { /* response will still fire onProgressChange via parent retry */ }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 text-slate-100 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:w-[640px] max-h-[90vh] flex flex-col border border-slate-800">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-800 flex items-start gap-3">
          <div className={`flex-shrink-0 w-12 h-12 rounded-xl ${subjectGradient(topic.subject)} text-white flex flex-col items-center justify-center text-[10px] font-bold leading-none`}>
            <span>{subjectAbbr(topic.subject)}</span>
            <span className="opacity-80 mt-0.5">U{topic.unitNumber}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-emerald-400 font-bold">
              {topic.subject} · Unit {topic.unitNumber} — {topic.unitTitle}
            </p>
            <h3 className="text-base font-bold text-white mt-0.5 leading-snug">
              <span className="text-emerald-400 mr-2">{topic.outcomeCode}</span>
              {topic.outcomeText}
            </h3>
            <div className="flex items-center gap-2 mt-2 text-[11px]">
              <span className={`px-2 py-0.5 rounded border font-bold ${status.cls}`}>{status.label}</span>
              {local && <span className="text-slate-400">Stage {local.leitnerStage || 0}</span>}
              {local?.nextReviewDay && (
                <span className="text-slate-400">· Next: {dayLabel(local.nextReviewDay, today)}</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800" aria-label="Close">
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Panel tabs */}
        <div className="px-5 pt-3 pb-2 flex gap-1.5 overflow-x-auto">
          {PANELS.map((p) => {
            const PanelIcon = p.Icon;
            return (
              <button
                key={p.key}
                onClick={() => setPanel(p.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold flex-shrink-0 transition-colors ${
                  panel === p.key
                    ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <PanelIcon className="w-3.5 h-3.5" /> {p.label}
              </button>
            );
          })}
        </div>

        {/* Panel body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {panel === 'lecture' && (
            <TrackerPanel
              title="Lecture"
              description="Mark the lecture done after you've watched it. This unlocks the book → MCQ → revise pipeline for this topic."
              done={!!local?.lectureDone}
              doneAt={local?.lectureDoneAt}
              disabled={busy}
              onToggle={(d) => run(
                () => svc.setLecture(topic._id, d),
                { lectureDone: d, status: local?.status === 'new' ? 'learning' : local?.status }
              )}
            />
          )}
          {panel === 'book' && (
            <TrackerPanel
              title="Book reading"
              description="Mark the book chapter read. Mostly relevant after you've watched the lecture."
              done={!!local?.bookDone}
              doneAt={local?.bookDoneAt}
              disabled={busy}
              onToggle={(d) => run(
                () => svc.setBook(topic._id, d),
                { bookDone: d, status: local?.status === 'new' ? 'learning' : local?.status }
              )}
            />
          )}
          {panel === 'mcq' && (
            <McqPanel
              count={local?.mcqCount || 0}
              target={mcqTgt}
              onTargetChange={setMcqTgt}
              disabled={busy}
              onAdd={(delta) => run(
                () => svc.setMcqs(topic._id, { delta, target: mcqTgt }),
                {}
              )}
              onSetTarget={() => run(
                () => svc.setMcqs(topic._id, { target: mcqTgt }),
                { mcqTarget: mcqTgt }
              )}
            />
          )}
          {panel === 'revise' && (
            <RevisePanel
              local={local}
              disabled={busy}
              onReview={(outcome) => run(
                () => svc.reviewTopic(topic._id, outcome),
                {}
              )}
              onMaster={() => run(
                () => svc.masterTopic(topic._id),
                { status: 'mastered', leitnerStage: 6, nextReviewDay: '' }
              )}
              onStart={() => run(
                () => svc.startTopic(topic._id),
                { status: 'learning' }
              )}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ── Lecture / Book panel — identical UI, just different field name ──────────
const TrackerPanel = ({ title, description, done, doneAt, disabled, onToggle }) => (
  <div>
    <h4 className="font-semibold text-white mb-1">{title}</h4>
    <p className="text-xs text-slate-400 mb-4">{description}</p>
    <button
      onClick={() => onToggle(!done)}
      disabled={disabled}
      className={`w-full px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
        done
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
          : 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white hover:opacity-90'
      }`}
    >
      <FiCheck className="w-4 h-4" />
      {done ? 'Done — tap to unmark' : `Mark ${title.toLowerCase()} done`}
    </button>
    {done && doneAt && (
      <p className="text-[11px] text-slate-500 text-center mt-2">
        Completed {new Date(doneAt).toLocaleDateString()}
      </p>
    )}
  </div>
);

// ── MCQ panel — counter with quick-add chips + editable target ─────────────
const McqPanel = ({ count, target, onTargetChange, disabled, onAdd, onSetTarget }) => {
  const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100));
  return (
    <div>
      <h4 className="font-semibold text-white mb-1">MCQ practice</h4>
      <p className="text-xs text-slate-400 mb-4">
        Track how many MCQs you've solved on this outcome. Hit your target to unlock the "ready to revise" tracker reminder.
      </p>

      <div className="bg-slate-800/60 rounded-xl p-4 mb-4">
        <div className="flex items-end justify-between mb-2">
          <div>
            <p className="text-4xl font-bold text-white leading-none">{count}</p>
            <p className="text-xs text-slate-400 mt-1">of {target} target</p>
          </div>
          <p className="text-2xl font-semibold text-emerald-400">{pct}%</p>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <p className="text-[11px] uppercase text-slate-500 font-bold tracking-wider mb-2">Quick add</p>
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[-5, +5, +10, +25].map((n) => (
          <button
            key={n}
            onClick={() => onAdd(n)}
            disabled={disabled}
            className={`px-3 py-2 rounded-lg text-sm font-bold border ${
              n < 0
                ? 'bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25'
                : 'bg-slate-800 border-slate-700 text-slate-100 hover:bg-slate-700'
            } disabled:opacity-50`}
          >
            {n > 0 ? `+${n}` : n}
          </button>
        ))}
      </div>

      <p className="text-[11px] uppercase text-slate-500 font-bold tracking-wider mb-2">Target</p>
      <div className="flex gap-2">
        <input
          type="number"
          min={1}
          value={target}
          onChange={(e) => onTargetChange(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm focus:outline-none focus:border-emerald-400"
        />
        <button
          onClick={onSetTarget}
          disabled={disabled}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
        >
          Save target
        </button>
      </div>
    </div>
  );
};

// ── Revise panel — Again / Good / Easy + Master + Start (if not started) ───
const RevisePanel = ({ local, disabled, onReview, onMaster, onStart }) => {
  const stage = local?.leitnerStage ?? 0;
  const intervals = STAGE_INTERVAL_DAYS;

  if (!local) {
    return (
      <div>
        <h4 className="font-semibold text-white mb-1">Start tracking</h4>
        <p className="text-xs text-slate-400 mb-4">
          You haven't started this topic yet. Tap below to add it to your revision plan — it'll surface in your "Due today" list tomorrow.
        </p>
        <button
          onClick={onStart}
          disabled={disabled}
          className="w-full px-4 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-blue-500 text-white hover:opacity-90 disabled:opacity-50"
        >
          Start tracking this topic
        </button>
      </div>
    );
  }

  return (
    <div>
      <h4 className="font-semibold text-white mb-1">Grade your recall</h4>
      <p className="text-xs text-slate-400 mb-4">
        How well do you remember this topic? Stage moves up on Good/Easy and down on Again.
      </p>

      <div className="bg-slate-800/60 rounded-xl p-3 mb-4 text-xs text-slate-300 flex items-center justify-around">
        <Stat label="Stage" value={stage} />
        <Stat label="Interval" value={`${local.intervalDays || 0}d`} />
        <Stat label="Successes" value={local.successCount || 0} />
        <Stat label="Lapses" value={local.failCount || 0} />
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <GradeBtn
          color="red"
          label="Again"
          hint={`+${intervals[Math.max(0, stage - 1)] || 0}d`}
          disabled={disabled || local.status === 'mastered'}
          onClick={() => onReview('again')}
        />
        <GradeBtn
          color="blue"
          label="Good"
          hint={`+${intervals[Math.min(6, stage + 1)] || 0}d`}
          disabled={disabled || local.status === 'mastered'}
          onClick={() => onReview('good')}
        />
        <GradeBtn
          color="emerald"
          label="Easy"
          hint={`+${intervals[Math.min(6, stage + 2)] || 0}d`}
          disabled={disabled || local.status === 'mastered'}
          onClick={() => onReview('easy')}
        />
      </div>

      {local.status !== 'mastered' && (
        <button
          onClick={onMaster}
          disabled={disabled}
          className="w-full px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          <FiAward className="w-3.5 h-3.5" /> Mark as mastered
        </button>
      )}

      <p className="text-[10px] text-slate-500 mt-4 text-center">
        Intervals: 1d → 3d → 7d → 14d → 30d → 60d → Mastered
      </p>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="text-center">
    <p className="text-lg font-bold text-white leading-none">{value}</p>
    <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">{label}</p>
  </div>
);

const COLOR_MAP = {
  red:     'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30',
  blue:    'bg-blue-500/20 border-blue-500/40 text-blue-300 hover:bg-blue-500/30',
  emerald: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30',
};
const GradeBtn = ({ color, label, hint, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-3 py-3 rounded-lg border font-bold text-sm flex flex-col items-center gap-0.5 disabled:opacity-50 ${COLOR_MAP[color]}`}
  >
    <span>{label}</span>
    <span className="text-[10px] opacity-80 font-medium">{hint}</span>
  </button>
);

export default TopicDetailSheet;
