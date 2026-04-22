// modules/questionbank/components/QBHierarchyBuilder.jsx
import React, { useState } from 'react';
import {
  FiPlus, FiTrash2, FiChevronDown, FiChevronRight,
  FiLayers, FiBookOpen, FiTag,
} from 'react-icons/fi';

// ─── ID generator ─────────────────────────────────────────────────────────────
let _n = 0;
const genId = () => `tmp_${Date.now()}_${++_n}`;
const itemKey = (item) => item._id || item._tmpId;

// ─── Topic row ────────────────────────────────────────────────────────────────
const TopicRow = ({ topic, onChange, onDelete }) => (
  <div className="flex items-center gap-2 pl-2 py-1.5 rounded-lg bg-violet-50 border border-violet-100">
    <FiTag className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
    <input
      type="text"
      value={topic.title}
      onChange={(e) => onChange({ ...topic, title: e.target.value })}
      placeholder="Topic title"
      className="flex-1 text-sm bg-transparent border-none outline-none text-gray-700 placeholder-gray-400"
    />
    <button
      type="button"
      onClick={onDelete}
      className="p-1 text-red-400 hover:text-red-600 rounded transition-colors"
    >
      <FiTrash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

// ─── Chapter accordion ────────────────────────────────────────────────────────
const ChapterRow = ({ chapter, onChange, onDelete }) => {
  const [open, setOpen] = useState(true);

  const addTopic = () => {
    const newTopic = { _tmpId: genId(), title: '', order: chapter.topics.length };
    onChange({ ...chapter, topics: [...chapter.topics, newTopic] });
  };

  const updateTopic = (idx, updated) => {
    const topics = chapter.topics.map((t, i) => (i === idx ? updated : t));
    onChange({ ...chapter, topics });
  };

  const deleteTopic = (idx) => {
    const topics = chapter.topics
      .filter((_, i) => i !== idx)
      .map((t, i) => ({ ...t, order: i }));
    onChange({ ...chapter, topics });
  };

  return (
    <div className="border border-sky-200 rounded-lg overflow-hidden">
      {/* Chapter header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-sky-50">
        <button type="button" onClick={() => setOpen(!open)} className="text-sky-500">
          {open ? <FiChevronDown className="w-4 h-4" /> : <FiChevronRight className="w-4 h-4" />}
        </button>
        <FiBookOpen className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
        <input
          type="text"
          value={chapter.title}
          onChange={(e) => onChange({ ...chapter, title: e.target.value })}
          placeholder="Chapter title"
          className="flex-1 text-sm bg-transparent border-none outline-none font-medium text-sky-800 placeholder-sky-300"
        />
        <span className="text-xs text-sky-400 mr-2">{chapter.topics.length} topic{chapter.topics.length !== 1 ? 's' : ''}</span>
        <button type="button" onClick={onDelete} className="p-1 text-red-400 hover:text-red-600 rounded transition-colors">
          <FiTrash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Topics */}
      {open && (
        <div className="p-3 space-y-2 bg-white">
          {chapter.topics.map((topic, idx) => (
            <TopicRow
              key={itemKey(topic)}
              topic={topic}
              onChange={(updated) => updateTopic(idx, updated)}
              onDelete={() => deleteTopic(idx)}
            />
          ))}
          <button
            type="button"
            onClick={addTopic}
            className="flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium mt-1"
          >
            <FiPlus className="w-3.5 h-3.5" /> Add Topic
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Subject accordion ────────────────────────────────────────────────────────
const SubjectRow = ({ subject, onChange, onDelete }) => {
  const [open, setOpen] = useState(true);

  const addChapter = () => {
    const newChapter = { _tmpId: genId(), title: '', order: subject.chapters.length, topics: [] };
    onChange({ ...subject, chapters: [...subject.chapters, newChapter] });
  };

  const updateChapter = (idx, updated) => {
    const chapters = subject.chapters.map((c, i) => (i === idx ? updated : c));
    onChange({ ...subject, chapters });
  };

  const deleteChapter = (idx) => {
    const chapters = subject.chapters
      .filter((_, i) => i !== idx)
      .map((c, i) => ({ ...c, order: i }));
    onChange({ ...subject, chapters });
  };

  return (
    <div className="border-2 border-indigo-200 rounded-xl overflow-hidden">
      {/* Subject header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white">
        <button type="button" onClick={() => setOpen(!open)} className="text-indigo-200">
          {open ? <FiChevronDown className="w-4 h-4" /> : <FiChevronRight className="w-4 h-4" />}
        </button>
        <FiLayers className="w-4 h-4 flex-shrink-0" />
        <input
          type="text"
          value={subject.title}
          onChange={(e) => onChange({ ...subject, title: e.target.value })}
          placeholder="Subject title"
          className="flex-1 text-sm bg-transparent border-none outline-none font-bold text-white placeholder-indigo-200"
        />
        <span className="text-xs text-indigo-200 mr-2">{subject.chapters.length} chapter{subject.chapters.length !== 1 ? 's' : ''}</span>
        <button type="button" onClick={onDelete} className="p-1 text-red-300 hover:text-white rounded transition-colors">
          <FiTrash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Chapters */}
      {open && (
        <div className="p-4 space-y-3 bg-indigo-50/40">
          {subject.chapters.map((chapter, idx) => (
            <ChapterRow
              key={itemKey(chapter)}
              chapter={chapter}
              onChange={(updated) => updateChapter(idx, updated)}
              onDelete={() => deleteChapter(idx)}
            />
          ))}
          <button
            type="button"
            onClick={addChapter}
            className="flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-800 font-medium mt-1"
          >
            <FiPlus className="w-3.5 h-3.5" /> Add Chapter
          </button>
        </div>
      )}
    </div>
  );
};

// ─── Main QBHierarchyBuilder ──────────────────────────────────────────────────
const QBHierarchyBuilder = ({ subjects = [], onChange }) => {
  const addSubject = () => {
    const newSubject = { _tmpId: genId(), title: '', order: subjects.length, chapters: [] };
    onChange([...subjects, newSubject]);
  };

  const updateSubject = (idx, updated) => {
    onChange(subjects.map((s, i) => (i === idx ? updated : s)));
  };

  const deleteSubject = (idx) => {
    onChange(subjects.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i })));
  };

  return (
    <div className="space-y-4">
      {subjects.map((subject, idx) => (
        <SubjectRow
          key={itemKey(subject)}
          subject={subject}
          onChange={(updated) => updateSubject(idx, updated)}
          onDelete={() => deleteSubject(idx)}
        />
      ))}

      <button
        type="button"
        onClick={addSubject}
        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-indigo-300 rounded-xl text-sm font-medium text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
      >
        <FiPlus className="w-4 h-4" /> Add Subject
      </button>
    </div>
  );
};

export default QBHierarchyBuilder;
