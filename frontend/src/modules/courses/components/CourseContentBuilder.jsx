// modules/courses/components/CourseContentBuilder.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import apiClient from '../../../core/api/axiosConfig';
import {
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiMenu,
  FiExternalLink,
  FiVideo,
  FiFileText,
  FiCheckSquare,
  FiBookOpen,
  FiLayers,
  FiTag,
  FiLink,
  FiClock,
  FiCalendar,
  FiSettings,
  FiX,
  FiPlus,
  FiCheck,
} from 'react-icons/fi';
import { getBackendUrl } from '../../../shared/utils/fixImageUrls';

const STATIC_BASE = getBackendUrl();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const extractDriveFileId = (url) => {
  if (!url) return '';
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return url.trim();
};

const toDateTimeLocal = (v) => {
  if (!v) return '';
  try {
    const d = new Date(v);
    if (isNaN(d)) return '';
    const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pkt.getUTCFullYear()}-${pad(pkt.getUTCMonth() + 1)}-${pad(pkt.getUTCDate())}T${pad(pkt.getUTCHours())}:${pad(pkt.getUTCMinutes())}`;
  } catch { return ''; }
};

const pktInputToUtc = (localStr) => {
  if (!localStr) return '';
  return new Date(localStr + ':00+05:00').toISOString();
};

const genId = () => `tmp_${Date.now()}_${Math.floor(Math.random() * 99999)}`;

// ─── Empty object factories ───────────────────────────────────────────────────

const emptyResource = (type = 'lecture') => ({
  _tmpId: genId(), type, title: '',
  testId: '', fileUrl: '', fileName: '', youtubeUrl: '',
  externalUrl: '', driveFileId: '',
  availability: 'public', unlockAt: '', lockAt: '', order: 0,
  // External-test display metadata (only used when type === 'external').
  externalMcqCount: 0, externalDurationMin: 0, externalTestType: '',
  externalStartAt: '', externalEndAt: '',
  externalSyllabus: [],
});

const emptyTopic   = () => ({ _tmpId: genId(), title: '', order: 0, resources: [] });
const emptyChapter = () => ({ _tmpId: genId(), title: '', order: 0, useTopics: false, topics: [], resources: [] });
const emptySubject = () => ({
  _tmpId: genId(), title: '', order: 0,
  unlockAt: '', lockAt: '', useSubGroups: false,
  resources: [], chapters: [],
});

const itemKey = (item) => item._id || item._tmpId;

// ─── Drag handle ──────────────────────────────────────────────────────────────
const DragHandle = ({ listeners, attributes }) => (
  <button type="button" {...listeners} {...attributes}
    className="cursor-grab active:cursor-grabbing p-1.5 text-gray-400 hover:text-gray-600 rounded touch-none flex-shrink-0"
    title="Drag to reorder" tabIndex={-1}>
    <FiMenu className="w-4 h-4" />
  </button>
);

// ─── SortableWrapper ──────────────────────────────────────────────────────────
const SortableWrapper = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform), transition,
      opacity: isDragging ? 0.45 : 1, position: 'relative', zIndex: isDragging ? 50 : 'auto',
    }}>
      {children({ listeners, attributes })}
    </div>
  );
};

// ─── Resource type config ─────────────────────────────────────────────────────
// ─── External-test config modal ───────────────────────────────────────────
// Admin-side dialog that collects all the metadata for an external test
// resource — URL, MCQ count, duration, type, schedule (display-only),
// and a syllabus with up to 5 subjects (each with its own list of
// chapters). Values are committed back via the `onSave(next)` callback,
// which merges them into the parent ResourceItem's resource object.
//
// Everything here is INFORMATIONAL on the student side; the resource's
// existing `availability` + `unlockAt` / `lockAt` (set further down the
// resource card) still govern actual access.
const MAX_SUBJECTS = 5;

const dateTimeLocalToIso = (s) => (s ? new Date(s).toISOString() : '');
const isoToDateTimeLocal = (iso) => {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    // Use the local timezone — admin enters wall-clock; we round-trip
    // through ISO for storage. This matches how the other course-resource
    // datetime inputs in this builder behave.
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
};

const ExternalTestModal = ({ resource, onClose, onSave }) => {
  const [draft, setDraft] = useState(() => ({
    title:               resource.title || '',
    externalUrl:         resource.externalUrl || '',
    externalMcqCount:    resource.externalMcqCount || 0,
    externalDurationMin: resource.externalDurationMin || 0,
    externalTestType:    resource.externalTestType || '',
    externalStartAt:     resource.externalStartAt || '',
    externalEndAt:       resource.externalEndAt || '',
    externalSyllabus:    Array.isArray(resource.externalSyllabus)
      ? resource.externalSyllabus.map((s) => ({
          subject:  s.subject  || '',
          chapters: Array.isArray(s.chapters) ? [...s.chapters] : [],
        }))
      : [],
  }));

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const addSubject = () => {
    if (draft.externalSyllabus.length >= MAX_SUBJECTS) return;
    update({ externalSyllabus: [...draft.externalSyllabus, { subject: '', chapters: [''] }] });
  };
  const removeSubject = (i) => {
    update({ externalSyllabus: draft.externalSyllabus.filter((_, idx) => idx !== i) });
  };
  const setSubjectTitle = (i, val) => {
    const next = [...draft.externalSyllabus];
    next[i] = { ...next[i], subject: val };
    update({ externalSyllabus: next });
  };
  const addChapter = (i) => {
    const next = [...draft.externalSyllabus];
    next[i] = { ...next[i], chapters: [...(next[i].chapters || []), ''] };
    update({ externalSyllabus: next });
  };
  const setChapter = (i, j, val) => {
    const next = [...draft.externalSyllabus];
    const chs = [...(next[i].chapters || [])];
    chs[j] = val;
    next[i] = { ...next[i], chapters: chs };
    update({ externalSyllabus: next });
  };
  const removeChapter = (i, j) => {
    const next = [...draft.externalSyllabus];
    next[i] = { ...next[i], chapters: (next[i].chapters || []).filter((_, idx) => idx !== j) };
    update({ externalSyllabus: next });
  };

  const save = () => {
    // Clean syllabus before commit — drop empty subjects + chapters so
    // the persisted shape matches what `cleanResource` will accept.
    const syllabus = draft.externalSyllabus
      .map((s) => ({
        subject:  (s.subject || '').trim(),
        chapters: (s.chapters || []).map((c) => (c || '').trim()).filter(Boolean),
      }))
      .filter((s) => s.subject);
    onSave({
      title:               draft.title.trim(),
      externalUrl:         draft.externalUrl.trim(),
      externalMcqCount:    Number(draft.externalMcqCount) || 0,
      externalDurationMin: Number(draft.externalDurationMin) || 0,
      externalTestType:    draft.externalTestType.trim(),
      externalStartAt:     draft.externalStartAt
        ? dateTimeLocalToIso(draft.externalStartAt)
        : '',
      externalEndAt:       draft.externalEndAt
        ? dateTimeLocalToIso(draft.externalEndAt)
        : '',
      externalSyllabus:    syllabus,
    });
  };

  const inputCls =
    'w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-purple-400 focus:outline-none';
  const labelCls = 'text-xs font-semibold text-gray-700 mb-1 block';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <FiLink className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">External Test</h3>
              <p className="text-[11px] text-gray-500">Configure how this off-platform test appears to students.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100">
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Basics */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Test title</label>
              <input
                type="text" placeholder="e.g. TEST 02 — Full Length Mock"
                value={draft.title}
                onChange={(e) => update({ title: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>External test URL</label>
              <input
                type="url" placeholder="https://…"
                value={draft.externalUrl}
                onChange={(e) => update({ externalUrl: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>No. of MCQs</label>
              <input
                type="number" min={0} placeholder="180"
                value={draft.externalMcqCount || ''}
                onChange={(e) => update({ externalMcqCount: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Duration (minutes)</label>
              <input
                type="number" min={0} placeholder="180"
                value={draft.externalDurationMin || ''}
                onChange={(e) => update({ externalDurationMin: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Test type</label>
              <input
                type="text" placeholder="e.g. Full Length / Topical / Mock"
                value={draft.externalTestType}
                onChange={(e) => update({ externalTestType: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {/* Timeline — informational only, not enforced. */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="text-xs font-semibold text-gray-700 mb-2 inline-flex items-center gap-1.5">
              <FiClock className="w-3.5 h-3.5 text-purple-500" /> Test timeline
              <span className="text-[10px] font-normal text-gray-400">(shown to students — not enforced)</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Starts at</label>
                <input
                  type="datetime-local"
                  value={isoToDateTimeLocal(draft.externalStartAt)}
                  onChange={(e) => update({ externalStartAt: e.target.value
                    ? new Date(e.target.value).toISOString() : '' })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Ends at</label>
                <input
                  type="datetime-local"
                  value={isoToDateTimeLocal(draft.externalEndAt)}
                  onChange={(e) => update({ externalEndAt: e.target.value
                    ? new Date(e.target.value).toISOString() : '' })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Syllabus — up to MAX_SUBJECTS subjects, each with chapters. */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-gray-700 inline-flex items-center gap-1.5">
                <FiBookOpen className="w-3.5 h-3.5 text-purple-500" /> Syllabus covered
                <span className="text-[10px] font-normal text-gray-400">
                  ({draft.externalSyllabus.length} / {MAX_SUBJECTS})
                </span>
              </div>
              <button
                type="button"
                onClick={addSubject}
                disabled={draft.externalSyllabus.length >= MAX_SUBJECTS}
                className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FiPlus className="w-3.5 h-3.5" /> Add subject
              </button>
            </div>

            {draft.externalSyllabus.length === 0 ? (
              <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-300 rounded-lg">
                No subjects added yet. Click "Add subject" to start.
              </div>
            ) : (
              <div className="space-y-3">
                {draft.externalSyllabus.map((sub, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-mono font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                        S{i + 1}
                      </span>
                      <input
                        type="text" placeholder="Subject name (e.g. Biology)"
                        value={sub.subject}
                        onChange={(e) => setSubjectTitle(i, e.target.value)}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-purple-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => removeSubject(i)}
                        className="p-1 text-gray-400 hover:text-rose-500"
                        title="Remove subject"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="ml-6 space-y-1.5">
                      {(sub.chapters || []).map((ch, j) => (
                        <div key={j} className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-400 w-8">{i + 1}.{j + 1}</span>
                          <input
                            type="text" placeholder="Chapter / topic"
                            value={ch}
                            onChange={(e) => setChapter(i, j, e.target.value)}
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-purple-300 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeChapter(i, j)}
                            className="p-1 text-gray-300 hover:text-rose-400"
                            title="Remove chapter"
                          >
                            <FiX className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => addChapter(i)}
                        className="text-[11px] text-purple-600 hover:text-purple-700 font-semibold inline-flex items-center gap-1"
                      >
                        <FiPlus className="w-3 h-3" /> Add chapter
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"
          >
            <FiCheck className="w-4 h-4" /> Save details
          </button>
        </div>
      </div>
    </div>
  );
};

// Inline summary card for an external-test resource inside the builder.
// Shows whatever the admin has filled in so far (or an empty-state with
// a "Configure" CTA), and toggles the rich modal above for editing.
const ExternalTestSummary = ({ resource, onChange }) => {
  const [open, setOpen] = useState(false);
  const hasUrl   = !!resource.externalUrl;
  const subjects = Array.isArray(resource.externalSyllabus) ? resource.externalSyllabus.length : 0;
  const mcqs     = resource.externalMcqCount || 0;
  const minutes  = resource.externalDurationMin || 0;

  return (
    <>
      <div className="rounded-lg border border-purple-200 bg-purple-50/40 p-2.5">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center flex-shrink-0">
            <FiLink className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            {hasUrl ? (
              <>
                <p className="text-xs font-bold text-gray-800 truncate">
                  {resource.title || 'Untitled external test'}
                </p>
                <p className="text-[11px] text-purple-700 truncate">
                  {resource.externalUrl}
                </p>
                <p className="text-[11px] text-gray-500 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                  {mcqs > 0    && <span>{mcqs} MCQs</span>}
                  {minutes > 0 && <span>· {minutes} min</span>}
                  {resource.externalTestType && <span>· {resource.externalTestType}</span>}
                  {subjects > 0 && <span>· {subjects} subject{subjects > 1 ? 's' : ''}</span>}
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-500 italic">
                No external test configured yet. Click "Configure" to add the URL, MCQ count, syllabus and timeline shown to students.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-purple-600 hover:text-purple-700 px-2 py-1 rounded-lg hover:bg-purple-100"
          >
            <FiSettings className="w-3.5 h-3.5" /> Configure
          </button>
        </div>
      </div>
      {open && (
        <ExternalTestModal
          resource={resource}
          onClose={() => setOpen(false)}
          onSave={(patch) => {
            onChange({ ...resource, ...patch });
            setOpen(false);
          }}
        />
      )}
    </>
  );
};

const RESOURCE_TYPES = {
  lecture:  { label: 'Lecture',       color: 'text-red-500',     bg: 'bg-red-50',     border: 'border-red-200',     Icon: FiVideo       },
  notes:    { label: 'Notes',         color: 'text-orange-500',  bg: 'bg-orange-50',  border: 'border-orange-200',  Icon: FiFileText    },
  test:     { label: 'Test',          color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', Icon: FiCheckSquare },
  external: { label: 'External Test', color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-200',  Icon: FiLink        },
};

// ─── ResourceItem ─────────────────────────────────────────────────────────────
const ResourceItem = ({ resource, onChange, onDelete, availableTests, dragListeners, dragAttributes }) => {
  const cfg = RESOURCE_TYPES[resource.type] || RESOURCE_TYPES.lecture;

  return (
    <div className={`flex gap-2 rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
      <DragHandle listeners={dragListeners} attributes={dragAttributes} />
      <div className={`flex-shrink-0 mt-0.5 ${cfg.color}`}><cfg.Icon className="w-4 h-4" /></div>

      <div className="flex-1 min-w-0 space-y-2">
        {/* Type + title row */}
        <div className="flex gap-2 flex-wrap">
          <select value={resource.type}
            onChange={(e) => onChange({ ...resource, type: e.target.value, testId: '', fileUrl: '', fileName: '', youtubeUrl: '', externalUrl: '', driveFileId: '', title: '' })}
            className="border border-gray-300 rounded px-2 py-1 text-xs bg-white font-medium">
            {Object.entries(RESOURCE_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          {resource.type !== 'test' && (
            <input type="text" placeholder="Resource title…" value={resource.title}
              onChange={(e) => onChange({ ...resource, title: e.target.value })}
              className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-sm" />
          )}
        </div>

        {/* Type-specific fields */}
        {resource.type === 'test' && (
          <select value={resource.testId?._id ?? resource.testId ?? ''}
            onChange={(e) => {
              const t = availableTests.find((x) => x._id === e.target.value);
              onChange({ ...resource, testId: e.target.value, title: t?.title || '' });
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white">
            <option value="">— Select a test —</option>
            {availableTests.map((t) => (
              <option key={t._id} value={t._id}>{t.title}  ·  {t.subject}</option>
            ))}
          </select>
        )}

        {resource.type === 'notes' && (
          <div className="space-y-1.5">
            <input type="url"
              placeholder="Google Drive share link  (drive.google.com/file/d/…)"
              value={resource.driveFileId
                ? `https://drive.google.com/file/d/${resource.driveFileId}/view`
                : (resource._driveNotesInput || '')}
              onChange={(e) => {
                const raw = e.target.value;
                onChange({ ...resource, driveFileId: extractDriveFileId(raw), _driveNotesInput: raw });
              }}
              className="w-full border border-orange-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-orange-400 focus:outline-none"
            />
            {resource.driveFileId ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-600 font-medium">✓ File ID saved</span>
                <a href={`https://drive.google.com/file/d/${resource.driveFileId}/preview`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-orange-600 hover:underline">
                  <FiExternalLink className="w-3 h-3" /> Preview
                </a>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Paste a Google Drive share link to any PDF or Doc</p>
            )}
          </div>
        )}

        {resource.type === 'lecture' && (() => {
          // Single source-of-truth for the lecture's video source. We infer
          // the active source from which field is populated; if neither
          // (a brand-new lecture), default to YouTube as the more common
          // case. The dropdown swaps between two compact input groups so
          // the form never shows both at once — cleaner mental model than
          // "fill whichever you have".
          const source = resource.driveFileId ? 'drive' : (resource.youtubeUrl ? 'youtube' : (resource._lectureSource || 'youtube'));
          const setSource = (next) => {
            // Switching source clears the OTHER source's fields so only one
            // is persisted at a time. We stash the picked source on the
            // resource itself (under a transient `_lectureSource` key) so
            // the dropdown sticks even when both fields are empty.
            if (next === 'drive') {
              onChange({ ...resource, youtubeUrl: '', _lectureSource: 'drive' });
            } else {
              onChange({
                ...resource,
                driveFileId: '',
                _driveLectureInput: '',
                _lectureSource: 'youtube',
              });
            }
          };
          return (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">Source</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="border border-red-300 rounded px-2 py-1 text-xs bg-white font-medium"
                >
                  <option value="youtube">YouTube link</option>
                  <option value="drive">Google Drive video</option>
                </select>
              </div>

              {source === 'drive' ? (
                <div className="space-y-1">
                  <input type="url"
                    placeholder="Google Drive video share link  (drive.google.com/file/d/…)"
                    value={resource.driveFileId
                      ? `https://drive.google.com/file/d/${resource.driveFileId}/view`
                      : (resource._driveLectureInput || '')}
                    onChange={(e) => {
                      const raw = e.target.value;
                      onChange({ ...resource, driveFileId: extractDriveFileId(raw), _driveLectureInput: raw, _lectureSource: 'drive' });
                    }}
                    className="w-full border border-red-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-red-400 focus:outline-none"
                  />
                  {resource.driveFileId ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 font-medium">✓ File ID saved</span>
                      <a href={`https://drive.google.com/file/d/${resource.driveFileId}/preview`}
                        target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                        <FiExternalLink className="w-3 h-3" /> Preview
                      </a>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400">Paste a Google Drive share link to any video file</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <input type="url"
                    placeholder="YouTube link  (youtube.com/watch?v=… or youtu.be/…)"
                    value={resource.youtubeUrl || ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      onChange({ ...resource, youtubeUrl: raw, _lectureSource: 'youtube' });
                    }}
                    className="w-full border border-red-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-red-400 focus:outline-none"
                  />
                  {(() => {
                    const m = (resource.youtubeUrl || '').match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
                    const vid = m ? m[1] : null;
                    if (resource.youtubeUrl && !vid) {
                      return <p className="text-[11px] text-amber-600 font-medium">Could not detect a YouTube video ID — please paste the full link.</p>;
                    }
                    if (vid) {
                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600 font-medium">✓ Video ID: {vid}</span>
                          <a href={`https://www.youtube.com/watch?v=${vid}`}
                            target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
                            <FiExternalLink className="w-3 h-3" /> Preview
                          </a>
                        </div>
                      );
                    }
                    return <p className="text-[11px] text-gray-400">Paste a YouTube watch / share / embed link</p>;
                  })()}
                </div>
              )}
            </div>
          );
        })()}

        {resource.type === 'external' && (
          <ExternalTestSummary
            resource={resource}
            onChange={onChange}
          />
        )}

        {/* Scheduling */}
        <div className="mt-1 pt-2 border-t border-gray-200/70 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium">
              <FiClock className="w-3 h-3" /> Access:
            </span>
            <select value={resource.availability || 'public'}
              onChange={(e) => onChange({ ...resource, availability: e.target.value, unlockAt: '', lockAt: '' })}
              className="border border-gray-300 rounded px-2 py-0.5 text-xs bg-white">
              <option value="public">Always Public</option>
              <option value="unlock_date">Unlock on Date / Time</option>
              <option value="window">Time Window (opens &amp; closes)</option>
            </select>
          </div>
          {(resource.availability === 'unlock_date' || resource.availability === 'window') && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-14">Opens at:</span>
              <input type="datetime-local" value={toDateTimeLocal(resource.unlockAt)}
                onChange={(e) => onChange({ ...resource, unlockAt: pktInputToUtc(e.target.value) })}
                className="border border-gray-300 rounded px-2 py-0.5 text-xs" />
              <span className="text-xs text-gray-400">PKT</span>
            </div>
          )}
          {resource.availability === 'window' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 w-14">Closes at:</span>
              <input type="datetime-local" value={toDateTimeLocal(resource.lockAt)}
                onChange={(e) => onChange({ ...resource, lockAt: pktInputToUtc(e.target.value) })}
                className="border border-gray-300 rounded px-2 py-0.5 text-xs" />
              <span className="text-xs text-gray-400">PKT</span>
            </div>
          )}
        </div>
      </div>

      <button type="button" onClick={onDelete}
        className="flex-shrink-0 text-gray-400 hover:text-red-500 p-1 rounded ml-1 self-start">
        <FiTrash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─── SortableResourceList ─────────────────────────────────────────────────────
const SortableResourceList = ({ resources, onChange, availableTests }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = resources.map(itemKey);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const reordered = arrayMove(resources, ids.indexOf(active.id), ids.indexOf(over.id))
      .map((r, i) => ({ ...r, order: i }));
    onChange(reordered);
  };

  const update = (idx, updated) => { const n = [...resources]; n[idx] = updated; onChange(n); };
  const remove = (idx) => onChange(resources.filter((_, i) => i !== idx));
  const add    = (type) => onChange([...resources, emptyResource(type)]);

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {resources.map((r, idx) => (
            <SortableWrapper key={itemKey(r)} id={itemKey(r)}>
              {({ listeners, attributes }) => (
                <ResourceItem resource={r} onChange={(u) => update(idx, u)} onDelete={() => remove(idx)}
                  availableTests={availableTests} dragListeners={listeners} dragAttributes={attributes} />
              )}
            </SortableWrapper>
          ))}
        </SortableContext>
      </DndContext>
      <div className="flex gap-2 pt-1 flex-wrap">
        {Object.entries(RESOURCE_TYPES).map(([type, cfg]) => (
          <button key={type} type="button" onClick={() => add(type)}
            className={`inline-flex items-center gap-1 text-xs border rounded-full px-3 py-1 font-medium ${cfg.color} ${cfg.border} bg-white hover:${cfg.bg} transition-colors`}>
            <FiPlus className="w-3 h-3" /> {cfg.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── TopicBlock ───────────────────────────────────────────────────────────────
const TopicBlock = ({ topic, onChange, onDelete, availableTests, dragListeners, dragAttributes, label = 'Topic' }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-violet-200 rounded-lg bg-violet-50 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-violet-100">
        <DragHandle listeners={dragListeners} attributes={dragAttributes} />
        <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 bg-violet-200 px-2 py-0.5 rounded-full flex-shrink-0">
          <FiTag className="w-3 h-3" /> {label.toUpperCase()}
        </span>
        <input type="text" placeholder={`${label} title…`} value={topic.title}
          onChange={(e) => onChange({ ...topic, title: e.target.value })}
          className="flex-1 min-w-0 border border-violet-300 bg-white rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
        <button type="button" onClick={() => setOpen(!open)} className="text-violet-500 hover:text-violet-700 p-1 flex-shrink-0">
          {open ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onDelete} className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0">
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <div className="p-3">
          <SortableResourceList resources={topic.resources}
            onChange={(res) => onChange({ ...topic, resources: res })}
            availableTests={availableTests} />
        </div>
      )}
    </div>
  );
};

// ─── SortableTopicList ────────────────────────────────────────────────────────
const SortableTopicList = ({ topics, onChange, availableTests, topicLabel = 'Topic' }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = topics.map(itemKey);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onChange(arrayMove(topics, ids.indexOf(active.id), ids.indexOf(over.id)).map((t, i) => ({ ...t, order: i })));
  };

  const update = (idx, updated) => { const n = [...topics]; n[idx] = updated; onChange(n); };
  const remove = (idx) => { if (window.confirm(`Remove this ${topicLabel.toLowerCase()} and all its resources?`)) onChange(topics.filter((_, i) => i !== idx)); };
  const add    = () => onChange([...topics, emptyTopic()]);

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {topics.map((topic, idx) => (
            <SortableWrapper key={itemKey(topic)} id={itemKey(topic)}>
              {({ listeners, attributes }) => (
                <TopicBlock topic={topic} onChange={(u) => update(idx, u)} onDelete={() => remove(idx)}
                  availableTests={availableTests} dragListeners={listeners} dragAttributes={attributes}
                  label={topicLabel} />
              )}
            </SortableWrapper>
          ))}
        </SortableContext>
      </DndContext>
      <button type="button" onClick={add}
        className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium border border-violet-300 rounded-full px-3 py-1 bg-white hover:bg-violet-50 transition-colors">
        <FiPlus className="w-3.5 h-3.5" /> Add {topicLabel}
      </button>
    </div>
  );
};

// ─── ChapterBlock ─────────────────────────────────────────────────────────────
const ChapterBlock = ({ chapter, onChange, onDelete, availableTests, dragListeners, dragAttributes, label = 'Chapter', topicLabel = 'Topic' }) => {
  const [open, setOpen] = useState(true);

  const toggleMode = () => {
    if ((chapter.useTopics ? chapter.topics.length : chapter.resources.length) > 0) {
      if (!window.confirm('Switching mode will clear existing content. Continue?')) return;
    }
    onChange({ ...chapter, useTopics: !chapter.useTopics, topics: [], resources: [] });
  };

  return (
    <div className="border border-sky-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 border-b border-sky-200">
        <DragHandle listeners={dragListeners} attributes={dragAttributes} />
        <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full flex-shrink-0">
          <FiBookOpen className="w-3 h-3" /> {label.toUpperCase()}
        </span>
        <input type="text" placeholder={`${label} title…`} value={chapter.title}
          onChange={(e) => onChange({ ...chapter, title: e.target.value })}
          className="flex-1 min-w-0 border border-sky-300 bg-white rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-sky-400"
        />
        <button type="button" onClick={() => setOpen(!open)} className="text-sky-500 hover:text-sky-700 p-1 flex-shrink-0">
          {open ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onDelete} className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0">
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-xs text-gray-500 font-medium mr-1">Content type:</span>
            <button type="button" onClick={() => !chapter.useTopics ? null : toggleMode()}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${!chapter.useTopics ? 'bg-sky-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
              Direct Resources
            </button>
            <button type="button" onClick={() => chapter.useTopics ? null : toggleMode()}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${chapter.useTopics ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>
              Organize by {topicLabel}s
            </button>
          </div>

          {chapter.useTopics ? (
            <SortableTopicList topics={chapter.topics}
              onChange={(t) => onChange({ ...chapter, topics: t })}
              availableTests={availableTests} topicLabel={topicLabel} />
          ) : (
            <SortableResourceList resources={chapter.resources}
              onChange={(r) => onChange({ ...chapter, resources: r })}
              availableTests={availableTests} />
          )}
        </div>
      )}
    </div>
  );
};

// ─── SortableChapterList ──────────────────────────────────────────────────────
const SortableChapterList = ({ chapters, onChange, availableTests, chapterLabel = 'Chapter', topicLabel = 'Topic' }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = chapters.map(itemKey);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onChange(arrayMove(chapters, ids.indexOf(active.id), ids.indexOf(over.id)).map((c, i) => ({ ...c, order: i })));
  };

  const update = (idx, updated) => { const n = [...chapters]; n[idx] = updated; onChange(n); };
  const remove = (idx) => { if (window.confirm(`Remove this ${chapterLabel.toLowerCase()} and all its content?`)) onChange(chapters.filter((_, i) => i !== idx)); };
  const add    = () => onChange([...chapters, emptyChapter()]);

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {chapters.map((ch, idx) => (
            <SortableWrapper key={itemKey(ch)} id={itemKey(ch)}>
              {({ listeners, attributes }) => (
                <ChapterBlock chapter={ch} onChange={(u) => update(idx, u)} onDelete={() => remove(idx)}
                  availableTests={availableTests} dragListeners={listeners} dragAttributes={attributes}
                  label={chapterLabel} topicLabel={topicLabel} />
              )}
            </SortableWrapper>
          ))}
        </SortableContext>
      </DndContext>
      <button type="button" onClick={add}
        className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-800 font-medium border border-sky-300 rounded-full px-3 py-1 bg-white hover:bg-sky-50 transition-colors">
        <FiPlus className="w-3.5 h-3.5" /> Add {chapterLabel}
      </button>
    </div>
  );
};

// ─── SubjectBlock (Structure Mode) ───────────────────────────────────────────
const SubjectBlock = ({ subject, onChange, onDelete, availableTests, dragListeners, dragAttributes, nodeLabels = {} }) => {
  const [open, setOpen] = useState(true);
  const l1 = nodeLabels.level1 || 'Subject';
  const l2 = nodeLabels.level2 || 'Chapter';
  const l3 = nodeLabels.level3 || 'Topic';
  const chapterCount = subject.chapters?.length || 0;

  return (
    <div className="border-2 border-indigo-300 rounded-2xl bg-white shadow overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white">
        <DragHandle listeners={dragListeners} attributes={dragAttributes} />
        <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full flex-shrink-0">
          <FiLayers className="w-3 h-3" /> {l1.toUpperCase()}
        </span>
        <input type="text" placeholder={`${l1} title…`} value={subject.title}
          onChange={(e) => onChange({ ...subject, title: e.target.value })}
          className="flex-1 min-w-0 bg-white/10 border border-white/30 placeholder-white/60 text-white rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:bg-white/20"
        />
        <span className="text-xs text-indigo-200 flex-shrink-0 hidden sm:block">
          {chapterCount} {l2.toLowerCase()}{chapterCount !== 1 ? 's' : ''}
        </span>
        <button type="button" onClick={() => setOpen(!open)} className="text-white/70 hover:text-white p-1">
          {open ? <FiChevronUp className="w-5 h-5" /> : <FiChevronDown className="w-5 h-5" />}
        </button>
        <button type="button" onClick={onDelete} className="text-white/70 hover:text-red-300 p-1">
          <FiTrash2 className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div className="p-4 bg-indigo-50/30">
          {chapterCount === 0 && (
            <p className="text-sm text-gray-400 text-center py-3 mb-2">
              No {l2.toLowerCase()}s yet. Click "Add {l2}" below.
            </p>
          )}
          <SortableChapterList chapters={subject.chapters}
            onChange={(ch) => onChange({ ...subject, chapters: ch })}
            availableTests={availableTests}
            chapterLabel={l2} topicLabel={l3} />
        </div>
      )}
    </div>
  );
};

// ─── DateEntryBlock (Date Mode) ───────────────────────────────────────────────
// Simplified: one unlock date + direct resources only, no sub-group nesting.
const DateEntryBlock = ({ subject, onChange, onDelete, availableTests, dragListeners, dragAttributes }) => {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-2 border-teal-300 rounded-2xl bg-white shadow overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white">
        <DragHandle listeners={dragListeners} attributes={dragAttributes} />
        <FiCalendar className="w-4 h-4 flex-shrink-0 opacity-80" />
        <input type="text" placeholder="Entry title  (e.g. Day 1 — Genetics Basics)"
          value={subject.title}
          onChange={(e) => onChange({ ...subject, title: e.target.value })}
          className="flex-1 min-w-0 bg-white/10 border border-white/30 placeholder-white/60 text-white rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:bg-white/20"
        />
        <button type="button" onClick={() => setOpen(!open)} className="text-white/70 hover:text-white p-1">
          {open ? <FiChevronUp className="w-5 h-5" /> : <FiChevronDown className="w-5 h-5" />}
        </button>
        <button type="button" onClick={onDelete} className="text-white/70 hover:text-red-300 p-1">
          <FiTrash2 className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div className="p-4 space-y-3 bg-teal-50/20">
          {/* Unlock date */}
          <div className="flex items-center gap-3 flex-wrap bg-white border border-teal-200 rounded-lg px-3 py-2.5">
            <FiClock className="w-4 h-4 text-teal-500 flex-shrink-0" />
            <span className="text-sm text-gray-600 font-medium">Available from:</span>
            <input type="datetime-local" value={toDateTimeLocal(subject.unlockAt)}
              onChange={(e) => onChange({ ...subject, unlockAt: pktInputToUtc(e.target.value) })}
              className="border border-gray-300 rounded px-2 py-1 text-sm" />
            <span className="text-xs text-gray-400">PKT</span>
            {subject.unlockAt ? (
              <button type="button" onClick={() => onChange({ ...subject, unlockAt: '' })}
                className="text-xs text-red-400 hover:text-red-600 ml-auto">
                ✕ Clear (always available)
              </button>
            ) : (
              <span className="text-xs text-green-600 ml-auto">No date — always available</span>
            )}
          </div>

          {/* Direct resources — no sub-group nesting in Date Mode */}
          <SortableResourceList resources={subject.resources}
            onChange={(r) => onChange({ ...subject, resources: r })}
            availableTests={availableTests} />
        </div>
      )}
    </div>
  );
};

// ─── CourseContentBuilder (root export) ──────────────────────────────────────
const CourseContentBuilder = ({ value, onChange, displayMode = 'structure', nodeLabels = {} }) => {
  const [availableTests, setAvailableTests] = useState([]);
  const subjects = value || [];
  const isDate   = displayMode === 'date';

  const l1 = nodeLabels.level1 || (isDate ? 'Date Entry' : 'Subject');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    apiClient.get('/tests').then((res) => {
      if (res.data.success) setAvailableTests(res.data.data);
    }).catch(() => {});
  }, []);

  const ids = subjects.map(itemKey);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    onChange(arrayMove(subjects, ids.indexOf(active.id), ids.indexOf(over.id)).map((s, i) => ({ ...s, order: i })));
  };

  const updateSubject = useCallback((idx, updated) => {
    const next = [...subjects]; next[idx] = updated; onChange(next);
  }, [subjects, onChange]);

  const deleteSubject = (idx) => {
    const label = isDate ? 'Date Entry' : (nodeLabels.level1 || 'Subject');
    if (window.confirm(`Remove this ${label} and ALL its content? This cannot be undone.`))
      onChange(subjects.filter((_, i) => i !== idx));
  };

  const addSubject = () => onChange([...subjects, emptySubject()]);

  const addLabel     = isDate ? 'Add Date Entry' : `Add ${nodeLabels.level1 || 'Subject'}`;
  const addFirstLabel = isDate ? 'Add First Date Entry' : `Add First ${nodeLabels.level1 || 'Subject'}`;
  const emptyHint     = isDate
    ? 'Click "Add Date Entry" to create your first date-based content entry'
    : `Click "Add ${nodeLabels.level1 || 'Subject'}" to start structuring your course`;
  const structureNote = isDate
    ? 'Date Entry → Resources  ·  Each entry unlocks on its set date & time'
    : `${nodeLabels.level1 || 'Subject'} → ${nodeLabels.level2 || 'Chapter'} → ${nodeLabels.level3 || 'Topic'} (optional) → Resources`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Course Content</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {structureNote} &nbsp;·&nbsp; Drag <FiMenu className="inline w-3 h-3" /> to reorder
          </p>
        </div>
        <button type="button" onClick={addSubject}
          className={`inline-flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors ${
            isDate ? 'bg-teal-600 hover:bg-teal-700' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}>
          <FiPlus className="w-4 h-4" /> {addLabel}
        </button>
      </div>

      {/* Empty state */}
      {subjects.length === 0 && (
        <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
          {isDate
            ? <FiCalendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            : <FiLayers   className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          }
          <p className="text-sm font-medium text-gray-400">No content yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">{emptyHint}</p>
          <button type="button" onClick={addSubject}
            className={`inline-flex items-center gap-2 text-white px-4 py-2 rounded-lg text-sm font-medium ${
              isDate ? 'bg-teal-600 hover:bg-teal-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}>
            <FiPlus className="w-4 h-4" /> {addFirstLabel}
          </button>
        </div>
      )}

      {/* Subject / Date entry list */}
      {subjects.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-5">
              {subjects.map((subject, idx) => (
                <SortableWrapper key={itemKey(subject)} id={itemKey(subject)}>
                  {({ listeners, attributes }) =>
                    isDate ? (
                      <DateEntryBlock subject={subject}
                        onChange={(u) => updateSubject(idx, u)}
                        onDelete={() => deleteSubject(idx)}
                        availableTests={availableTests}
                        dragListeners={listeners} dragAttributes={attributes}
                        nodeLabels={nodeLabels} />
                    ) : (
                      <SubjectBlock subject={subject}
                        onChange={(u) => updateSubject(idx, u)}
                        onDelete={() => deleteSubject(idx)}
                        availableTests={availableTests}
                        dragListeners={listeners} dragAttributes={attributes}
                        nodeLabels={nodeLabels} />
                    )
                  }
                </SortableWrapper>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};

export default CourseContentBuilder;
