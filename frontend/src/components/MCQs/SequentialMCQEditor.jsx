// File: components/MCQs/SequentialMCQEditor.jsx

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../utils/axiosConfig';
import useAuth from '../../hooks/useAuth';
import { toast } from 'react-toastify';
import { FiChevronLeft, FiChevronRight, FiSave, FiX } from 'react-icons/fi';
import MCQFormFields from './MCQFromStructure';

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

  // Default form state
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
        await fetchTestDetails();
        await fetchAllMCQs();
      } catch (error) {
        console.error('Error loading initial data:', error);
        toast.error('Failed to load test data');
      }
    };
    
    loadInitialData();
    // Don't return anything from this effect
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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-white shadow-md rounded-lg p-6">
          {/* Use our shared MCQFormFields component */}
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
        </div>
      </div>
    </div>
  );
};

export default SequentialMCQEditor;