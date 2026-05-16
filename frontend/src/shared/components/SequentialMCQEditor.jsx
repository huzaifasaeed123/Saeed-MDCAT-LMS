// shared/components/SequentialMCQEditor.jsx
// Reusable sequential MCQ editor UI used by both test and QB contexts.
// Parent page handles data fetching and save API calls; this component only
// renders the numbered nav, form fields, and action buttons.
import React, { useRef, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight, FiSave, FiX } from 'react-icons/fi';
import MCQFormFields from '../../modules/mcqs/components/MCQFormFields';

const SequentialMCQEditor = ({
  // Data
  mcqs,
  currentIndex,
  formData,
  setFormData,
  revisionInfo,
  statistics,
  currentMcq,
  user,
  // State
  loading,
  saving,
  error,
  formLoaded,
  // Handlers
  handleOptionChange,
  addOption,
  removeOption,
  onNavigate,        // fn(index) — navigate to a question number
  onSaveAndNext,     // fn() — save current and move forward
  onSaveAndExit,     // fn() — save and go back to list
  onCancel,          // fn() — discard and go back to list
  // Display
  title,
  infoBlock,         // optional JSX shown between nav and form
}) => {
  const numbersContainerRef = useRef(null);
  const totalMcqs = mcqs.length;

  // Scroll active number to centre
  useEffect(() => {
    if (numbersContainerRef.current) {
      const active = numbersContainerRef.current.querySelector('.active-mcq-number');
      if (active) {
        const c = numbersContainerRef.current;
        c.scrollLeft = active.offsetLeft - c.offsetWidth / 2 + active.offsetWidth / 2;
      }
    }
  }, [currentIndex]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
        <span className="ml-3 text-[var(--text-muted)]">Loading questions…</span>
      </div>
    );
  }

  if (totalMcqs === 0) {
    return (
      <div>
        <div className="bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300 px-4 py-3 rounded-xl mb-4 text-sm">
          No questions found.
        </div>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
        >
          Back
        </button>
      </div>
    );
  }

  if (currentIndex >= totalMcqs) {
    return (
      <div>
        <div className="bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-300 px-4 py-3 rounded-xl mb-4 text-sm">
          Invalid question index.
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNavigate(0)} className="btn-brand text-sm">First Question</button>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!formLoaded) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div>
      {/* Title row + question counter (counter uses theme tokens — instruction #9) */}
      <div className="flex justify-between items-center mb-5">
        <h1 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--text-strong)] tracking-[-0.01em]">
          {title || 'Edit Questions'}
        </h1>
        <span className="text-xs sm:text-sm text-[var(--text-muted)] font-medium whitespace-nowrap">
          Question <span className="text-[var(--text-strong)] font-bold">{currentIndex + 1}</span> of {totalMcqs}
        </span>
      </div>

      {/* Number navigation bar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-4 mb-6">
        <div
          className="flex space-x-2 overflow-x-auto py-2 px-1 max-h-24"
          ref={numbersContainerRef}
          style={{ scrollbarWidth: 'thin' }}
        >
          {mcqs.map((_, idx) => (
            <button
              key={idx}
              onClick={() => onNavigate(idx)}
              className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-semibold transition-colors ${
                idx === currentIndex
                  ? 'bg-primary-500 text-white active-mcq-number shadow-sm'
                  : 'bg-[var(--bg-muted)] hover:bg-[var(--border)] text-[var(--text)]'
              }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
        <div className="mt-2 text-[11px] text-[var(--text-faint)] flex flex-wrap gap-x-4">
          <span>Alt+Left: Previous</span>
          <span>Alt+Right: Save &amp; Next</span>
          <span>Alt+S: Save &amp; Exit</span>
          <span>Esc: Cancel</span>
        </div>
      </div>

      {infoBlock}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-900 dark:text-red-300 px-4 py-3 rounded-xl mb-4 text-sm">
          {error}
        </div>
      )}

      <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border)] p-5 sm:p-6">
        <MCQFormFields
          formData={formData}
          setFormData={setFormData}
          revisionInfo={revisionInfo}
          statistics={statistics}
          currentMcq={currentMcq}
          user={user}
          handleOptionChange={handleOptionChange}
          addOption={addOption}
          removeOption={removeOption}
          readOnly={false}
        />

        {/* Navigation arrows + save (instruction #9 — theme tokens) */}
        <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-3 pt-5 mt-6 border-t border-[var(--border-faint)]">
          <button
            type="button"
            onClick={() => onNavigate(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-muted)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FiChevronLeft className="w-4 h-4" /> Previous
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 transition-colors"
          >
            <FiX className="w-4 h-4" /> Cancel
          </button>

          <button
            type="button"
            onClick={onSaveAndNext}
            disabled={saving}
            className="btn-brand text-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <FiSave className="w-4 h-4" />
            {saving ? 'Saving…' : currentIndex === totalMcqs - 1 ? 'Save & Finish' : 'Save & Next'}
            {currentIndex !== totalMcqs - 1 && !saving && <FiChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SequentialMCQEditor;
