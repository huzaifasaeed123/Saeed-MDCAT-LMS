// File: components/MCQs/MCQFormFields.jsx

import React from 'react';
import RichTextEditor from '../common/RichTextEditor';
import { FiInfo } from 'react-icons/fi';

const MCQFormFields = ({
  formData,
  setFormData,
  revisionInfo,
  statistics,
  currentMcq,
  user,
  handleOptionChange,
  addOption,
  removeOption,
  readOnly = false
}) => {
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <>
      {/* Revision Info for Existing MCQs */}
      {currentMcq && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6 border border-gray-200">
          <div className="flex items-center mb-2">
            <FiInfo className="text-blue-500 mr-2" />
            <h3 className="font-medium">Revision Information</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Revision Count:</span> {revisionInfo.revisionCount}
            </div>
            <div>
              <span className="font-medium">Last Revised:</span> {formatDate(revisionInfo.lastRevised)}
            </div>
            <div>
              <span className="font-medium">Created:</span> {formatDate(currentMcq.createdAt)}
            </div>
            <div>
              <span className="font-medium">Author:</span> {currentMcq.author || user?.fullName}
            </div>
          </div>
        </div>
      )}

      {/* Statistics Section */}
      {currentMcq && statistics && (
        <div className="bg-yellow-50 p-4 rounded-lg mb-6 border border-yellow-200">
          <div className="flex items-center mb-2">
            <FiInfo className="text-yellow-500 mr-2" />
            <h3 className="font-medium">Student Performance Statistics</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {statistics.correctPercentage !== undefined && (
              <div>
                <span className="font-medium">Correct Percentage:</span> {statistics.correctPercentage}%
              </div>
            )}
            {statistics.recommendedDifficulty && (
              <div>
                <span className="font-medium">Student-Based Difficulty:</span> {statistics.recommendedDifficulty}
              </div>
            )}
            {statistics.lastUpdated && (
              <div>
                <span className="font-medium">Statistics Last Updated:</span> {formatDate(statistics.lastUpdated)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Question Text */}
      <div className="mb-6">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Question Text
        </label>
        <RichTextEditor
          key={`question-${currentMcq?._id || 'new'}`}
          value={formData.questionText}
          onChange={(value) => setFormData({ ...formData, questionText: value })}
          placeholder="Enter your question here..."
          showTips={true}
          readOnly={readOnly}
        />
      </div>

      {/* Options section */}
      <div className="mb-6">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Options
        </label>
        <div className="space-y-3">
          {formData.options.map((option, index) => (
            <div 
              key={`${currentMcq?._id || 'new'}-option-${index}`} 
              className="flex border rounded-lg overflow-hidden"
            >
              {/* Option letter in a compact circle */}
              <div className="flex-shrink-0 w-8 h-auto flex items-center justify-center bg-gray-100 border-r">
                <span className="font-semibold">{option.optionLetter}</span>
              </div>
              
              {/* Option content with proper wrapping */}
              <div className="flex-grow min-w-0 relative">
                <RichTextEditor
                  key={`${currentMcq?._id || 'new'}-option-${index}-text`}
                  value={option.optionText}
                  onChange={(value) => handleOptionChange(index, 'optionText', value)}
                  placeholder={`Option ${option.optionLetter} text...`}
                  minimal={true}
                  showTips={false}
                  minHeight="60px"
                  className="option-editor"
                  readOnly={readOnly}
                />
              </div>
              
              {/* Controls in a compact vertical layout */}
              <div className="flex-shrink-0 flex flex-col items-center justify-center px-2 py-1 border-l bg-gray-50">
                <label className="inline-flex items-center whitespace-nowrap mb-1">
                  <input
                    type="radio"
                    checked={option.isCorrect}
                    onChange={() => handleOptionChange(index, 'isCorrect', true)}
                    className="form-radio text-green-500"
                    disabled={readOnly}
                  />
                  <span className="ml-1 text-xs">Correct</span>
                </label>
                
                {!readOnly && formData.options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {!readOnly && formData.options.length < 5 && (
          <button
            type="button"
            onClick={addOption}
            className="mt-3 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 text-sm rounded"
          >
            Add Option
          </button>
        )}
      </div>

      {/* Explanation */}
      <div className="mb-6">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          Explanation (Optional)
        </label>
        <RichTextEditor
          key={`explanation-${currentMcq?._id || 'new'}`}
          value={formData.explanationText}
          onChange={(value) => setFormData({ ...formData, explanationText: value })}
          placeholder="Provide an explanation for the correct answer..."
          showTips={false}
          readOnly={readOnly}
        />
      </div>

      {/* Difficulty and Public/Private setting */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Difficulty Level
          </label>
          <select
            value={formData.difficulty}
            onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={readOnly}
          >
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
        
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Visibility
          </label>
          <div className="mt-2 space-x-4">
            <label className="inline-flex items-center">
              <input
                type="radio"
                value="public"
                checked={formData.isPublic}
                onChange={() => setFormData({ ...formData, isPublic: true })}
                className="form-radio text-primary-500"
                disabled={readOnly}
              />
              <span className="ml-2">Public</span>
            </label>
            <label className="inline-flex items-center">
              <input
                type="radio"
                value="private"
                checked={!formData.isPublic}
                onChange={() => setFormData({ ...formData, isPublic: false })}
                className="form-radio text-primary-500"
                disabled={readOnly}
              />
              <span className="ml-2">Private</span>
            </label>
          </div>
        </div>
        
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Category
          </label>
          <input
            type="text"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={readOnly}
          />
        </div>
      </div>
      
      {/* Sub-Topic field */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-gray-700 text-sm font-bold mb-2">
            Sub-Topic
          </label>
          <input
            type="text"
            value={formData.subTopic}
            onChange={(e) => setFormData({ ...formData, subTopic: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            disabled={readOnly}
          />
        </div>
      </div>
    </>
  );
};

export default MCQFormFields;