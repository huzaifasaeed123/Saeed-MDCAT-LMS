// shared/components/SequentialMCQEditor.jsx
// Reusable sequential MCQ editor UI used by both test and QB contexts.
// Parent page handles data fetching and save API calls; this component only
// renders the numbered nav, form fields, and action buttons.
import React, { useRef, useEffect } from 'react';
import { FiChevronLeft, FiSave, FiX } from 'react-icons/fi';
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
        <span className="ml-3 text-gray-600">Loading questions…</span>
      </div>
    );
  }

  if (totalMcqs === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          No questions found.
        </div>
        <button onClick={onCancel} className="bg-gray-600 text-white px-4 py-2 rounded-md">Back</button>
      </div>
    );
  }

  if (currentIndex >= totalMcqs) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Invalid question index.
        </div>
        <button onClick={() => onNavigate(0)} className="bg-primary-600 text-white px-4 py-2 rounded-md mr-2">First Question</button>
        <button onClick={onCancel} className="bg-gray-600 text-white px-4 py-2 rounded-md">Back</button>
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
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">{title || 'Edit Questions'}</h1>
          <span className="text-gray-700">Question {currentIndex + 1} of {totalMcqs}</span>
        </div>

        {/* Number navigation bar */}
        <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
          <div className="flex space-x-2 overflow-x-auto py-2 px-1 max-h-24"
            ref={numbersContainerRef} style={{ scrollbarWidth: 'thin' }}>
            {mcqs.map((_, idx) => (
              <button key={idx} onClick={() => onNavigate(idx)}
                className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  idx === currentIndex
                    ? 'bg-primary-600 text-white active-mcq-number'
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}>
                {idx + 1}
              </button>
            ))}
          </div>
          <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-x-4">
            <span>Alt+Left: Previous</span>
            <span>Alt+Right: Save &amp; Next</span>
            <span>Alt+S: Save &amp; Exit</span>
            <span>Esc: Cancel</span>
          </div>
        </div>

        {infoBlock}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
        )}

        <div className="bg-white shadow-md rounded-lg p-6">
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

          <div className="flex justify-between mt-8">
            <button type="button" onClick={() => onNavigate(currentIndex - 1)}
              disabled={currentIndex === 0}
              className={`px-6 py-3 rounded-lg flex items-center ${
                currentIndex === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}>
              <FiChevronLeft className="mr-2" /> Previous
            </button>

            <button type="button" onClick={onCancel}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg flex items-center">
              <FiX className="mr-2" /> Cancel
            </button>

            <button type="button" onClick={onSaveAndNext} disabled={saving}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg flex items-center">
              <FiSave className="mr-2" />
              {saving ? 'Saving…' : currentIndex === totalMcqs - 1 ? 'Save & Finish' : 'Save & Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SequentialMCQEditor;
