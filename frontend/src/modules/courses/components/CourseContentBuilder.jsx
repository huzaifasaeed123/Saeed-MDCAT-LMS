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
  DragOverlay,
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
  FiPlus,
  FiTrash2,
  FiChevronDown,
  FiChevronUp,
  FiMenu,
  FiUpload,
  FiExternalLink,
  FiYoutube,
  FiFileText,
  FiCheckSquare,
  FiBookOpen,
  FiLayers,
  FiTag,
} from 'react-icons/fi';

const STATIC_BASE = 'http://localhost:5000';

// ─── ID helpers ───────────────────────────────────────────────────────────────
const genId = () => `tmp_${Date.now()}_${Math.floor(Math.random() * 99999)}`;

const emptyResource = (type = 'lecture') => ({
  _tmpId: genId(),
  type,
  title: '',
  testId: '',
  fileUrl: '',
  fileName: '',
  youtubeUrl: '',
  order: 0,
});
const emptyTopic = () => ({ _tmpId: genId(), title: '', order: 0, resources: [] });
const emptyChapter = () => ({ _tmpId: genId(), title: '', order: 0, useTopics: false, topics: [], resources: [] });
const emptySubject = () => ({ _tmpId: genId(), title: '', order: 0, chapters: [] });

const itemKey = (item) => item._id || item._tmpId;

// ─── Drag handle ──────────────────────────────────────────────────────────────
const DragHandle = ({ listeners, attributes }) => (
  <button
    type="button"
    {...listeners}
    {...attributes}
    className="cursor-grab active:cursor-grabbing p-1.5 text-gray-400 hover:text-gray-600 rounded touch-none flex-shrink-0"
    title="Drag to reorder"
    tabIndex={-1}
  >
    <FiMenu className="w-4 h-4" />
  </button>
);

// ─── SortableWrapper ──────────────────────────────────────────────────────────
const SortableWrapper = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        position: 'relative',
        zIndex: isDragging ? 50 : 'auto',
      }}
    >
      {children({ listeners, attributes })}
    </div>
  );
};

// ─── Resource type config ─────────────────────────────────────────────────────
const RESOURCE_TYPES = {
  lecture: { label: 'Lecture', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', Icon: FiYoutube },
  notes:   { label: 'Notes',   color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', Icon: FiFileText },
  test:    { label: 'Test',    color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', Icon: FiCheckSquare },
};

// ─── ResourceItem ─────────────────────────────────────────────────────────────
const ResourceItem = ({ resource, onChange, onDelete, availableTests, onUploadPdf, uploadingId, dragListeners, dragAttributes }) => {
  const cfg = RESOURCE_TYPES[resource.type] || RESOURCE_TYPES.lecture;
  const isUploading = uploadingId === itemKey(resource);

  return (
    <div className={`flex gap-2 rounded-lg border ${cfg.border} ${cfg.bg} p-3`}>
      {/* Drag */}
      <DragHandle listeners={dragListeners} attributes={dragAttributes} />

      {/* Type icon */}
      <div className={`flex-shrink-0 mt-0.5 ${cfg.color}`}>
        <cfg.Icon className="w-4 h-4" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        {/* Type selector + title row */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={resource.type}
            onChange={(e) => onChange({ ...resource, type: e.target.value, testId: '', fileUrl: '', fileName: '', youtubeUrl: '', title: '' })}
            className="border border-gray-300 rounded px-2 py-1 text-xs bg-white font-medium"
          >
            {Object.entries(RESOURCE_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {resource.type !== 'test' && (
            <input
              type="text"
              placeholder="Resource title…"
              value={resource.title}
              onChange={(e) => onChange({ ...resource, title: e.target.value })}
              className="flex-1 min-w-0 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          )}
        </div>

        {/* Type-specific fields */}
        {resource.type === 'test' && (
          <select
            value={resource.testId}
            onChange={(e) => {
              const t = availableTests.find((x) => x._id === e.target.value);
              onChange({ ...resource, testId: e.target.value, title: t?.title || '' });
            }}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white"
          >
            <option value="">— Select a test —</option>
            {availableTests.map((t) => (
              <option key={t._id} value={t._id}>
                {t.title}  ·  {t.subject}
              </option>
            ))}
          </select>
        )}

        {resource.type === 'notes' && (
          <div className="flex items-center gap-2 flex-wrap">
            <label className={`inline-flex items-center gap-1.5 cursor-pointer border border-orange-300 bg-white hover:bg-orange-50 rounded px-3 py-1 text-xs font-medium text-orange-600 ${isUploading ? 'opacity-60 pointer-events-none' : ''}`}>
              <FiUpload className="w-3 h-3" />
              {isUploading ? 'Uploading…' : 'Upload PDF'}
              <input type="file" accept="application/pdf" className="hidden" disabled={isUploading}
                onChange={(e) => onUploadPdf(e.target.files[0], resource, onChange)} />
            </label>
            {resource.fileUrl && (
              <a href={`${STATIC_BASE}${resource.fileUrl}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-orange-600 hover:underline truncate max-w-xs">
                <FiExternalLink className="w-3 h-3 flex-shrink-0" />
                {resource.fileName || 'View PDF'}
              </a>
            )}
          </div>
        )}

        {resource.type === 'lecture' && (
          <input
            type="text"
            placeholder="YouTube embed URL  (https://www.youtube.com/embed/…)"
            value={resource.youtubeUrl}
            onChange={(e) => onChange({ ...resource, youtubeUrl: e.target.value })}
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        )}
      </div>

      {/* Delete */}
      <button type="button" onClick={onDelete}
        className="flex-shrink-0 text-gray-400 hover:text-red-500 p-1 rounded ml-1 self-start">
        <FiTrash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─── SortableResourceList ─────────────────────────────────────────────────────
const SortableResourceList = ({ resources, onChange, availableTests, onUploadPdf, uploadingId }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = resources.map(itemKey);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(active.id);
    const newIdx = ids.indexOf(over.id);
    const reordered = arrayMove(resources, oldIdx, newIdx).map((r, i) => ({ ...r, order: i }));
    onChange(reordered);
  };

  const update = (idx, updated) => { const n = [...resources]; n[idx] = updated; onChange(n); };
  const remove = (idx) => onChange(resources.filter((_, i) => i !== idx));
  const add = (type) => onChange([...resources, emptyResource(type)]);

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {resources.map((r, idx) => (
            <SortableWrapper key={itemKey(r)} id={itemKey(r)}>
              {({ listeners, attributes }) => (
                <ResourceItem
                  resource={r}
                  onChange={(updated) => update(idx, updated)}
                  onDelete={() => remove(idx)}
                  availableTests={availableTests}
                  onUploadPdf={onUploadPdf}
                  uploadingId={uploadingId}
                  dragListeners={listeners}
                  dragAttributes={attributes}
                />
              )}
            </SortableWrapper>
          ))}
        </SortableContext>
      </DndContext>

      {/* Add resource buttons */}
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
const TopicBlock = ({ topic, onChange, onDelete, availableTests, onUploadPdf, uploadingId, dragListeners, dragAttributes }) => {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-violet-200 rounded-lg bg-violet-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-violet-100">
        <DragHandle listeners={dragListeners} attributes={dragAttributes} />
        <span className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 bg-violet-200 px-2 py-0.5 rounded-full flex-shrink-0">
          <FiTag className="w-3 h-3" /> TOPIC
        </span>
        <input
          type="text"
          placeholder="Topic title…"
          value={topic.title}
          onChange={(e) => onChange({ ...topic, title: e.target.value })}
          className="flex-1 min-w-0 border border-violet-300 bg-white rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
        <button type="button" onClick={() => setOpen(!open)}
          className="text-violet-500 hover:text-violet-700 p-1 flex-shrink-0">
          {open ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onDelete}
          className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0">
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="p-3">
          <SortableResourceList
            resources={topic.resources}
            onChange={(res) => onChange({ ...topic, resources: res })}
            availableTests={availableTests}
            onUploadPdf={onUploadPdf}
            uploadingId={uploadingId}
          />
        </div>
      )}
    </div>
  );
};

// ─── SortableTopicList ────────────────────────────────────────────────────────
const SortableTopicList = ({ topics, onChange, availableTests, onUploadPdf, uploadingId }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = topics.map(itemKey);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(active.id);
    const newIdx = ids.indexOf(over.id);
    const reordered = arrayMove(topics, oldIdx, newIdx).map((t, i) => ({ ...t, order: i }));
    onChange(reordered);
  };

  const update = (idx, updated) => { const n = [...topics]; n[idx] = updated; onChange(n); };
  const remove = (idx) => { if (window.confirm('Remove this topic and all its resources?')) onChange(topics.filter((_, i) => i !== idx)); };
  const add = () => onChange([...topics, emptyTopic()]);

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {topics.map((topic, idx) => (
            <SortableWrapper key={itemKey(topic)} id={itemKey(topic)}>
              {({ listeners, attributes }) => (
                <TopicBlock
                  topic={topic}
                  onChange={(u) => update(idx, u)}
                  onDelete={() => remove(idx)}
                  availableTests={availableTests}
                  onUploadPdf={onUploadPdf}
                  uploadingId={uploadingId}
                  dragListeners={listeners}
                  dragAttributes={attributes}
                />
              )}
            </SortableWrapper>
          ))}
        </SortableContext>
      </DndContext>
      <button type="button" onClick={add}
        className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:text-violet-800 font-medium border border-violet-300 rounded-full px-3 py-1 bg-white hover:bg-violet-50 transition-colors">
        <FiPlus className="w-3.5 h-3.5" /> Add Topic
      </button>
    </div>
  );
};

// ─── ChapterBlock ─────────────────────────────────────────────────────────────
const ChapterBlock = ({ chapter, onChange, onDelete, availableTests, onUploadPdf, uploadingId, dragListeners, dragAttributes }) => {
  const [open, setOpen] = useState(true);

  const toggleMode = () => {
    if ((chapter.useTopics ? chapter.topics.length : chapter.resources.length) > 0) {
      if (!window.confirm('Switching mode will clear existing content. Continue?')) return;
    }
    onChange({ ...chapter, useTopics: !chapter.useTopics, topics: [], resources: [] });
  };

  return (
    <div className="border border-sky-200 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-sky-50 border-b border-sky-200">
        <DragHandle listeners={dragListeners} attributes={dragAttributes} />
        <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full flex-shrink-0">
          <FiBookOpen className="w-3 h-3" /> CHAPTER
        </span>
        <input
          type="text"
          placeholder="Chapter title…"
          value={chapter.title}
          onChange={(e) => onChange({ ...chapter, title: e.target.value })}
          className="flex-1 min-w-0 border border-sky-300 bg-white rounded px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-sky-400"
        />
        <button type="button" onClick={() => setOpen(!open)}
          className="text-sky-500 hover:text-sky-700 p-1 flex-shrink-0">
          {open ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </button>
        <button type="button" onClick={onDelete}
          className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0">
          <FiTrash2 className="w-4 h-4" />
        </button>
      </div>

      {open && (
        <div className="p-4 space-y-3">
          {/* Mode toggle */}
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
            <span className="text-xs text-gray-500 font-medium mr-1">Content type:</span>
            <button
              type="button"
              onClick={() => !chapter.useTopics ? null : toggleMode()}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${!chapter.useTopics ? 'bg-sky-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}`}
            >
              Direct Resources
            </button>
            <button
              type="button"
              onClick={() => chapter.useTopics ? null : toggleMode()}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${chapter.useTopics ? 'bg-violet-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}`}
            >
              Organize by Topics
            </button>
          </div>

          {chapter.useTopics ? (
            <SortableTopicList
              topics={chapter.topics}
              onChange={(t) => onChange({ ...chapter, topics: t })}
              availableTests={availableTests}
              onUploadPdf={onUploadPdf}
              uploadingId={uploadingId}
            />
          ) : (
            <SortableResourceList
              resources={chapter.resources}
              onChange={(r) => onChange({ ...chapter, resources: r })}
              availableTests={availableTests}
              onUploadPdf={onUploadPdf}
              uploadingId={uploadingId}
            />
          )}
        </div>
      )}
    </div>
  );
};

// ─── SortableChapterList ──────────────────────────────────────────────────────
const SortableChapterList = ({ chapters, onChange, availableTests, onUploadPdf, uploadingId }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = chapters.map(itemKey);

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(active.id);
    const newIdx = ids.indexOf(over.id);
    const reordered = arrayMove(chapters, oldIdx, newIdx).map((c, i) => ({ ...c, order: i }));
    onChange(reordered);
  };

  const update = (idx, updated) => { const n = [...chapters]; n[idx] = updated; onChange(n); };
  const remove = (idx) => { if (window.confirm('Remove this chapter and all its content?')) onChange(chapters.filter((_, i) => i !== idx)); };
  const add = () => onChange([...chapters, emptyChapter()]);

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {chapters.map((ch, idx) => (
            <SortableWrapper key={itemKey(ch)} id={itemKey(ch)}>
              {({ listeners, attributes }) => (
                <ChapterBlock
                  chapter={ch}
                  onChange={(u) => update(idx, u)}
                  onDelete={() => remove(idx)}
                  availableTests={availableTests}
                  onUploadPdf={onUploadPdf}
                  uploadingId={uploadingId}
                  dragListeners={listeners}
                  dragAttributes={attributes}
                />
              )}
            </SortableWrapper>
          ))}
        </SortableContext>
      </DndContext>
      <button type="button" onClick={add}
        className="inline-flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-800 font-medium border border-sky-300 rounded-full px-3 py-1 bg-white hover:bg-sky-50 transition-colors">
        <FiPlus className="w-3.5 h-3.5" /> Add Chapter
      </button>
    </div>
  );
};

// ─── SubjectBlock ─────────────────────────────────────────────────────────────
const SubjectBlock = ({ subject, onChange, onDelete, availableTests, onUploadPdf, uploadingId, dragListeners, dragAttributes }) => {
  const [open, setOpen] = useState(true);
  const chapterCount = subject.chapters?.length || 0;

  return (
    <div className="border-2 border-indigo-300 rounded-2xl bg-white shadow overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white">
        <DragHandle listeners={dragListeners} attributes={dragAttributes} />
        <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/20 px-2.5 py-0.5 rounded-full flex-shrink-0">
          <FiLayers className="w-3 h-3" /> SUBJECT
        </span>
        <input
          type="text"
          placeholder="Subject title  (e.g. Biology)"
          value={subject.title}
          onChange={(e) => onChange({ ...subject, title: e.target.value })}
          className="flex-1 min-w-0 bg-white/10 border border-white/30 placeholder-white/60 text-white rounded-lg px-3 py-1.5 text-sm font-semibold focus:outline-none focus:bg-white/20"
        />
        <span className="text-xs text-indigo-200 flex-shrink-0 hidden sm:block">
          {chapterCount} chapter{chapterCount !== 1 ? 's' : ''}
        </span>
        <button type="button" onClick={() => setOpen(!open)}
          className="text-white/70 hover:text-white p-1">
          {open ? <FiChevronUp className="w-5 h-5" /> : <FiChevronDown className="w-5 h-5" />}
        </button>
        <button type="button" onClick={onDelete}
          className="text-white/70 hover:text-red-300 p-1">
          <FiTrash2 className="w-5 h-5" />
        </button>
      </div>

      {open && (
        <div className="p-4 bg-indigo-50/30">
          {chapterCount === 0 && (
            <p className="text-sm text-gray-400 text-center py-3 mb-2">No chapters yet. Click "Add Chapter" below.</p>
          )}
          <SortableChapterList
            chapters={subject.chapters}
            onChange={(ch) => onChange({ ...subject, chapters: ch })}
            availableTests={availableTests}
            onUploadPdf={onUploadPdf}
            uploadingId={uploadingId}
          />
        </div>
      )}
    </div>
  );
};

// ─── CourseContentBuilder (root export) ──────────────────────────────────────
const CourseContentBuilder = ({ value, onChange }) => {
  const [availableTests, setAvailableTests] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);

  const subjects = value || [];

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
    const oldIdx = ids.indexOf(active.id);
    const newIdx = ids.indexOf(over.id);
    const reordered = arrayMove(subjects, oldIdx, newIdx).map((s, i) => ({ ...s, order: i }));
    onChange(reordered);
  };

  const updateSubject = useCallback((idx, updated) => {
    const next = [...subjects];
    next[idx] = updated;
    onChange(next);
  }, [subjects, onChange]);

  const deleteSubject = (idx) => {
    if (window.confirm('Remove this subject and ALL its content? This cannot be undone.')) {
      onChange(subjects.filter((_, i) => i !== idx));
    }
  };

  const addSubject = () => onChange([...subjects, emptySubject()]);

  const handleUploadPdf = async (file, resource, resourceOnChange) => {
    if (!file) return;
    const id = itemKey(resource);
    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      const res = await apiClient.post('/courses/upload/pdf', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        resourceOnChange({ ...resource, fileUrl: res.data.url, fileName: res.data.fileName });
        toast.success('PDF uploaded successfully');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'PDF upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Course Content</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Structure: Subject → Chapter → Topic (optional) → Resources &nbsp;·&nbsp; Drag <FiMenu className="inline w-3 h-3" /> to reorder any item
          </p>
        </div>
        <button
          type="button"
          onClick={addSubject}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-colors"
        >
          <FiPlus className="w-4 h-4" /> Add Subject
        </button>
      </div>

      {/* Empty state */}
      {subjects.length === 0 && (
        <div className="text-center py-14 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
          <FiLayers className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-400">No content yet</p>
          <p className="text-xs text-gray-400 mt-1 mb-4">
            Click "Add Subject" to start structuring your course
          </p>
          <button type="button" onClick={addSubject}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <FiPlus className="w-4 h-4" /> Add First Subject
          </button>
        </div>
      )}

      {/* Subject list with top-level DnD */}
      {subjects.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-5">
              {subjects.map((subject, idx) => (
                <SortableWrapper key={itemKey(subject)} id={itemKey(subject)}>
                  {({ listeners, attributes }) => (
                    <SubjectBlock
                      subject={subject}
                      onChange={(u) => updateSubject(idx, u)}
                      onDelete={() => deleteSubject(idx)}
                      availableTests={availableTests}
                      onUploadPdf={handleUploadPdf}
                      uploadingId={uploadingId}
                      dragListeners={listeners}
                      dragAttributes={attributes}
                    />
                  )}
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
