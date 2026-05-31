// shared/components/QBClassificationPicker.jsx
// Cascading Subject → Chapter → Topic dropdowns scoped to a single Question
// Bank. Self-contained: give it a questionBankId and it fetches that QB's
// structure itself, so it drops into any MCQ editor (QB or test context)
// without the parent having to load the QB tree.
//
// Two ways to feed the structure:
//   • questionBankId  → the picker fetches GET /question-banks/:id itself
//   • qbStructure     → parent already has the subjects[] array, pass it in
//                        (skips the fetch). Takes precedence when provided.
//
// Selections are reported up via onChange({ subjectId, chapterId, topicId }).
// When the MCQ has no questionBankId AND no qbStructure, the picker renders
// nothing (a pure test MCQ has no QB classification to edit).
import React, { useState, useEffect, useMemo } from 'react';
import { FiBookOpen } from 'react-icons/fi';
import apiClient from '../../core/api/axiosConfig';

const QBClassificationPicker = ({
  questionBankId,
  qbStructure: qbStructureProp,
  subjectId, chapterId, topicId,
  onChange,
}) => {
  const [fetched, setFetched] = useState(null);

  // Fetch the QB tree only when the parent didn't hand us one and we have an id.
  useEffect(() => {
    if (qbStructureProp || !questionBankId) { setFetched(null); return; }
    let alive = true;
    apiClient.get(`/question-banks/${questionBankId}`)
      .then((res) => { if (alive && res.data?.success) setFetched(res.data.data?.subjects || []); })
      .catch(() => { if (alive) setFetched([]); });
    return () => { alive = false; };
  }, [questionBankId, qbStructureProp]);

  const qbStructure = qbStructureProp || fetched || [];

  // Backfill missing ancestors. Callers often know only the leaf id (e.g. a
  // topicId from the QB list URL) — the cascading dropdowns can't show that
  // topic until its subject + chapter are also selected. Once the tree is
  // loaded, walk it to find which subject/chapter own the given topic (or
  // chapter) and report the full {subjectId, chapterId, topicId} up so the
  // dropdowns pre-fill. Runs only when an ancestor is actually missing, so it
  // doesn't fight the admin's manual changes.
  useEffect(() => {
    if (qbStructure.length === 0) return;
    // Need backfill only if a chapter/topic is set but its subject isn't, or a
    // topic is set but its chapter isn't. Otherwise leave the selection alone.
    const needsBackfill = ((chapterId || topicId) && !subjectId) || (topicId && !chapterId);
    if (!needsBackfill) return;

    for (const s of qbStructure) {
      for (const c of (s.chapters || [])) {
        if (topicId && (c.topics || []).some((t) => String(t._id) === String(topicId))) {
          onChange({ subjectId: String(s._id), chapterId: String(c._id), topicId: String(topicId) });
          return;
        }
        if (!topicId && chapterId && String(c._id) === String(chapterId)) {
          onChange({ subjectId: String(s._id), chapterId: String(chapterId), topicId: '' });
          return;
        }
      }
    }
  // onChange intentionally omitted — parent passes a stable setter; including
  // it would re-run on every render. Keyed on the ids + tree identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qbStructure, subjectId, chapterId, topicId]);

  const selectedSubject = useMemo(
    () => qbStructure.find((s) => String(s._id) === subjectId) || null,
    [qbStructure, subjectId],
  );
  const selectedChapter = useMemo(
    () => selectedSubject?.chapters?.find((c) => String(c._id) === chapterId) || null,
    [selectedSubject, chapterId],
  );

  // No QB context → nothing to classify against.
  if (!questionBankId && (!qbStructureProp || qbStructureProp.length === 0)) return null;

  const handleSubject = (e) => onChange({ subjectId: e.target.value, chapterId: '', topicId: '' });
  const handleChapter = (e) => onChange({ subjectId, chapterId: e.target.value, topicId: '' });
  const handleTopic   = (e) => onChange({ subjectId, chapterId, topicId: e.target.value });

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <FiBookOpen className="w-4 h-4 text-primary-500" />
        <span className="font-semibold text-[var(--text-strong)] text-sm">Classification</span>
        <span className="text-xs text-[var(--text-faint)]">(Subject · Chapter · Topic)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Subject */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Subject</label>
          <select
            value={subjectId}
            onChange={handleSubject}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
          >
            <option value="">— None —</option>
            {qbStructure.map((s) => (
              <option key={s._id} value={String(s._id)}>{s.title}</option>
            ))}
          </select>
        </div>

        {/* Chapter — only enabled once a subject is picked */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Chapter</label>
          <select
            value={chapterId}
            onChange={handleChapter}
            disabled={!selectedSubject}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">— None —</option>
            {(selectedSubject?.chapters || []).map((c) => (
              <option key={c._id} value={String(c._id)}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* Topic — only enabled once a chapter is picked */}
        <div>
          <label className="block text-xs font-semibold text-[var(--text-muted)] mb-1">Topic</label>
          <select
            value={topicId}
            onChange={handleTopic}
            disabled={!selectedChapter}
            className="w-full px-3 py-2 text-sm border border-[var(--border)] bg-[var(--bg-surface)] text-[var(--text)] rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">— None —</option>
            {(selectedChapter?.topics || []).map((t) => (
              <option key={t._id} value={String(t._id)}>{t.title}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default QBClassificationPicker;
