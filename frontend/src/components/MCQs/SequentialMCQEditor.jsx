// File: components/MCQs/SequentialMCQEditor.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../utils/axiosConfig';
import RichTextEditor from '../common/RichTextEditor';
import useAuth from '../../hooks/useAuth';
import { toast } from 'react-toastify';
import { FiInfo, FiChevronLeft, FiChevronRight, FiSave, FiX } from 'react-icons/fi';

const SequentialMCQEditor = () => {
  const navigate = useNavigate();
  const { testId, index } = useParams();
  const currentIndex = parseInt(index, 10) || 0;
  const { user } = useAuth();
  const numbersContainerRef = useRef(null);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [test, setTest] = useState(null);
  const [mcqs, setMcqs] = useState([]);
  const [currentMcq, setCurrentMcq] = useState(null);
  const [totalMcqs, setTotalMcqs] = useState(0);
  const [formLoaded, setFormLoaded] = useState(false);

  const [formData, setFormData] = useState({
    questionText: '',
    options: [
      { optionLetter: 'A', optionText: '', isCorrect: false },
      { optionLetter: 'B', optionText: '', isCorrect: false },
      { optionLetter: 'C', optionText: '', isCorrect: false },
      { optionLetter: 'D', optionText: '', isCorrect: false },
    ],
    explanationText: '',
    category: '',
    session: '',
    subject: '',
    unit: '',
    topic: '',
    subTopic: '',
    difficulty: 'Medium',
    isPublic: true,
  });

  // For existing MCQs
  const [revisionInfo, setRevisionInfo] = useState({
    revisionCount: 0,
    lastRevised: null
  });

  // For statistics
  const [statistics, setStatistics] = useState(null);

  // Scroll to center the active number in the navigation bar
  useEffect(() => {
    if (numbersContainerRef.current) {
      const activeButton = numbersContainerRef.current.querySelector('.active-mcq-number');
      if (activeButton) {
        const container = numbersContainerRef.current;
        const scrollLeft = activeButton.offsetLeft - (container.offsetWidth / 2) + (activeButton.offsetWidth / 2);
        container.scrollLeft = scrollLeft;
      }
    }
  }, [currentIndex]);

  // Load initial test and MCQs data
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      setFormLoaded(false);
      try {
        await Promise.all([
          fetchTestDetails(),
          fetchAllMCQs()
        ]);
      } catch (error) {
        console.error('Error loading initial data:', error);
        toast.error('Failed to load test data');
      }
    };
    
    loadInitialData();
  }, [testId]);

  // Load current MCQ data when the MCQ list or current index changes
  useEffect(() => {
    if (mcqs.length > 0 && currentIndex < mcqs.length) {
      setFormLoaded(false);
      loadMcqData(mcqs[currentIndex]);
    }
  }, [mcqs, currentIndex]);
  
  // Add keyboard shortcuts for navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle shortcuts if not in a form input or editable content
      if (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.isContentEditable
      ) {
        return;
      }
      
      // Alt+Left: Previous question
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex > 0) {
          navigate(`/tests/${testId}/mcqs/edit-all/${currentIndex - 1}`);
        }
      }
      
      // Alt+Right: Save and go to next question
      if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIndex < totalMcqs - 1) {
          handleSaveAndNext();
        }
      }
      
      // Alt+S: Save current question
      if (e.altKey && e.key === 's') {
        e.preventDefault();
        handleSaveAndExit();
      }
      
      // Escape: Cancel and return to test
      if (e.key === 'Escape') {
        e.preventDefault();
        if (window.confirm('Are you sure you want to exit? Any unsaved changes will be lost.')) {
          navigate(`/tests/${testId}`);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentIndex, totalMcqs, testId, navigate]);

  const fetchTestDetails = async () => {
    try {
      const response = await apiClient.get(`/tests/${testId}`);
      setTest(response.data.data);
    } catch (error) {
      console.error('Error fetching test details:', error);
      setError('Failed to load test details');
    }
  };

  const fetchAllMCQs = async () => {
    try {
      const response = await apiClient.get(`/mcqs/test/${testId}`);
      const mcqsData = response.data.data;
      setMcqs(mcqsData);
      setTotalMcqs(mcqsData.length);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching MCQs:', error);
      setError('Failed to load questions');
      setLoading(false);
    }
  };

  const loadMcqData = (mcq) => {
    if (!mcq) return;

    console.log("Loading MCQ data:", mcq); // Debug log
    setCurrentMcq(mcq);
    
    // Ensure we have options with the correct structure
    let formattedOptions = [];
    if (Array.isArray(mcq.options) && mcq.options.length > 0) {
      formattedOptions = mcq.options.map(opt => ({
        _id: opt._id,
        optionLetter: opt.optionLetter || '',
        optionText: opt.optionText || '',
        isCorrect: Boolean(opt.isCorrect),
        explanationText: opt.explanationText || ''
      }));
    } else {
      // Default options if none exist
      formattedOptions = [
        { optionLetter: 'A', optionText: '', isCorrect: false },
        { optionLetter: 'B', optionText: '', isCorrect: false },
        { optionLetter: 'C', optionText: '', isCorrect: false },
        { optionLetter: 'D', optionText: '', isCorrect: false },
      ];
    }
    
    // Update form data with existing MCQ data
    const newFormData = {
      questionText: mcq.questionText || '',
      options: formattedOptions,
      explanationText: mcq.explanationText || '',
      category: mcq.category || '',
      session: mcq.session || '',
      subject: mcq.subject || '',
      unit: mcq.unit || '',
      topic: mcq.topic || '',
      subTopic: mcq.subTopic || '',
      difficulty: mcq.difficulty || 'Medium',
      isPublic: mcq.isPublic !== undefined ? mcq.isPublic : true,
    };
    
    console.log("Setting form data:", newFormData); // Debug log
    setFormData(newFormData);

    // Set revision info
    setRevisionInfo({
      revisionCount: mcq.revisionCount || 0,
      lastRevised: mcq.lastRevised || null
    });

    // Set statistics if available
    if (mcq.statistics) {
      setStatistics(mcq.statistics);
    } else {
      setStatistics(null);
    }
    
    // Mark the form as loaded
    setFormLoaded(true);
  };

  const handleSaveAndNext = async () => {
    if (!currentMcq) return;
    
    setSaving(true);
    setError('');

    try {
      const submitData = {
        ...formData,
        testId: testId,
      };

      console.log("Submitting data:", submitData); // Debug log

      await apiClient.put(`/mcqs/${currentMcq._id}`, submitData);
      
      // Use a shorter toast notification (1 second)
      toast.success('Question updated successfully', { autoClose: 1000 });
      
      // Navigate to the next MCQ if available
      if (currentIndex < totalMcqs - 1) {
        navigate(`/tests/${testId}/mcqs/edit-all/${currentIndex + 1}`);
      } else {
        // If this was the last MCQ, show a completion message and go back to test
        toast.success('All questions have been reviewed!', { autoClose: 1000 });
        navigate(`/tests/${testId}`);
      }
    } catch (error) {
      console.error('Error saving MCQ:', error);
      setError(error.response?.data?.message || 'Failed to save question');
      toast.error(error.response?.data?.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndExit = async () => {
    if (!currentMcq) return;
    
    setSaving(true);
    setError('');

    try {
      const submitData = {
        ...formData,
        testId: testId,
      };

      await apiClient.put(`/mcqs/${currentMcq._id}`, submitData);
      toast.success('Question updated successfully', { autoClose: 1000 });
      navigate(`/tests/${testId}`);
    } catch (error) {
      console.error('Error saving MCQ:', error);
      setError(error.response?.data?.message || 'Failed to save question');
      toast.error(error.response?.data?.message || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      navigate(`/tests/${testId}/mcqs/edit-all/${currentIndex - 1}`);
    }
  };

  const handleNavigateToQuestion = (index) => {
    navigate(`/tests/${testId}/mcqs/edit-all/${index}`);
  };

  const handleOptionChange = (index, field, value) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    
    // If setting this option as correct, unset others
    if (field === 'isCorrect' && value === true) {
      newOptions.forEach((option, i) => {
        if (i !== index) option.isCorrect = false;
      });
    }
    
    setFormData({ ...formData, options: newOptions });
  };

  const addOption = () => {
    if (formData.options.length < 5) {
      const nextLetter = String.fromCharCode(65 + formData.options.length);
      setFormData({
        ...formData,
        options: [
          ...formData.options,
          { optionLetter: nextLetter, optionText: '', isCorrect: false }
        ]
      });
    }
  };

  const removeOption = (index) => {
    if (formData.options.length > 2) {
      const newOptions = formData.options.filter((_, i) => i !== index);
      // Reorder option letters
      newOptions.forEach((option, i) => {
        option.optionLetter = String.fromCharCode(65 + i);
      });
      setFormData({ ...formData, options: newOptions });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        <span className="ml-3 text-gray-600">Loading questions...</span>
      </div>
    );
  }

  if (mcqs.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <strong className="font-bold">No Questions!</strong>
          <span className="block sm:inline"> This test doesn't have any questions yet.</span>
        </div>
        <button 
          onClick={() => navigate(`/tests/${testId}`)} 
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md"
        >
          Back to Test
        </button>
      </div>
    );
  }

  if (currentIndex >= mcqs.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <strong className="font-bold">Invalid Question Index!</strong>
          <span className="block sm:inline"> The requested question index is out of range.</span>
        </div>
        <button 
          onClick={() => navigate(`/tests/${testId}/mcqs/edit-all/0`)} 
          className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md mr-2"
        >
          Go to First Question
        </button>
        <button 
          onClick={() => navigate(`/tests/${testId}`)} 
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
        >
          Back to Test
        </button>
      </div>
    );
  }

  if (!formLoaded) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        <span className="ml-3 text-gray-600">Loading question data...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">
            Edit Questions
          </h1>
          <span className="text-gray-700">Question {currentIndex + 1} of {totalMcqs}</span>
        </div>

        {/* Numbered Navigation */}
        <div className="bg-white shadow-sm rounded-lg p-4 mb-6">
          <div 
            className="flex space-x-2 overflow-x-auto py-2 px-1 max-h-24" 
            ref={numbersContainerRef}
            style={{ scrollbarWidth: 'thin' }}
          >
            {mcqs.map((_, idx) => (
              <button
                key={idx}
                onClick={() => handleNavigateToQuestion(idx)}
                className={`w-10 h-10 flex-shrink-0 rounded-full flex items-center justify-center font-semibold transition-colors ${
                  idx === currentIndex 
                    ? 'bg-primary-600 text-white active-mcq-number' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>
          
          {/* Keyboard shortcuts helper */}
          <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-x-4">
            <span title="Navigate to previous question">Alt+Left: Previous</span>
            <span title="Save and navigate to next question">Alt+Right: Save & Next</span>
            <span title="Save current question and exit to test page">Alt+S: Save & Exit</span>
            <span title="Exit without saving">Esc: Cancel</span>
          </div>
        </div>

        {test && (
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h2 className="font-semibold">Test: {test.title}</h2>
            <p className="text-sm text-gray-600">
              {test.subject} - {test.unit} - {test.topic}
            </p>
          </div>
        )}

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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form className="bg-white shadow-md rounded-lg p-6">
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Question Text
            </label>
            <RichTextEditor
              key={`question-${currentMcq?._id}`}
              value={formData.questionText}
              onChange={(value) => setFormData({ ...formData, questionText: value })}
              placeholder="Enter your question here..."
              showTips={true}
            />
          </div>

          {/* Improved Options section with better wrapping */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Options
            </label>
            <div className="space-y-3">
              {formData.options.map((option, index) => (
                <div 
                  key={`${currentMcq?._id}-option-${index}`} 
                  className="flex border rounded-lg overflow-hidden"
                >
                  {/* Option letter in a compact circle */}
                  <div className="flex-shrink-0 w-8 h-auto flex items-center justify-center bg-gray-100 border-r">
                    <span className="font-semibold">{option.optionLetter}</span>
                  </div>
                  
                  {/* Option content with proper wrapping */}
                  <div className="flex-grow min-w-0 relative">
                    <RichTextEditor
                      key={`${currentMcq?._id}-option-${index}-text`}
                      value={option.optionText}
                      onChange={(value) => handleOptionChange(index, 'optionText', value)}
                      placeholder={`Option ${option.optionLetter} text...`}
                      minimal={true}
                      showTips={false}
                      minHeight="60px"
                      className="option-editor"
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
                      />
                      <span className="ml-1 text-xs">Correct</span>
                    </label>
                    
                    {formData.options.length > 2 && (
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
            
            {formData.options.length < 5 && (
              <button
                type="button"
                onClick={addOption}
                className="mt-3 bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 text-sm rounded"
              >
                Add Option
              </button>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Explanation (Optional)
            </label>
            <RichTextEditor
              key={`explanation-${currentMcq?._id}`}
              value={formData.explanationText}
              onChange={(value) => setFormData({ ...formData, explanationText: value })}
              placeholder="Provide an explanation for the correct answer..."
              showTips={false}
            />
          </div>

          {/* New fields: Difficulty and Public/Private setting */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Difficulty Level
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              />
            </div>
          </div>
          
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
              />
            </div>
          </div>

          {/* Simplified button layout */}
          <div className="flex justify-between mt-8">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
              className={`px-6 py-3 rounded-lg flex items-center ${
                currentIndex === 0 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              <FiChevronLeft className="mr-2" /> Previous
            </button>
            
            <button
              type="button"
              onClick={() => navigate(`/tests/${testId}`)}
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg flex items-center"
            >
              <FiX className="mr-2" /> Cancel
            </button>
            
            <button
              type="button"
              onClick={handleSaveAndNext}
              disabled={saving}
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg flex items-center"
            >
              <FiSave className="mr-2" /> {saving ? 'Saving...' : (currentIndex === totalMcqs - 1 ? 'Save & Finish' : 'Save & Next')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SequentialMCQEditor;