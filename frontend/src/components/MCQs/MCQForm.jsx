// File: components/MCQs/MCQForm.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../utils/axiosConfig';
import RichTextEditor from '../common/RichTextEditor';
import useAuth from '../../hooks/useAuth';
import { toast } from 'react-toastify';
import { FiInfo } from 'react-icons/fi';

const MCQForm = () => {
  const navigate = useNavigate();
  const { testId, mcqId } = useParams();
  const { user } = useAuth();
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);
  const [error, setError] = useState('');
  
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
    difficulty: 'Medium', // Default difficulty
    isPublic: true, // Default to public
  });

  // For existing MCQs
  const [revisionInfo, setRevisionInfo] = useState({
    revisionCount: 0,
    lastRevised: null
  });

  // For statistics
  const [statistics, setStatistics] = useState(null);

  useEffect(() => {
    const loadInitialData = async () => {
      setFetchingData(true);
      await fetchTestDetails();
      
      if (mcqId) {
        await fetchMCQ();
      }
      setFetchingData(false);
    };
    
    loadInitialData();
  }, [testId, mcqId]);

  const fetchTestDetails = async () => {
    try {
      const response = await apiClient.get(`/tests/${testId}`);
      const testData = response.data.data;
      setTest(testData);
      
      // Pre-fill test details
      setFormData(prev => ({
        ...prev,
        session: testData.session || prev.session,
        subject: testData.subject || prev.subject,
        unit: testData.unit || prev.unit,
        topic: testData.topic || prev.topic,
        subTopic: testData.subTopic || prev.subTopic
      }));
    } catch (error) {
      console.error('Error fetching test details:', error);
      toast.error('Failed to load test details');
    }
  };

  const fetchMCQ = async () => {
    try {
      const response = await apiClient.get(`/mcqs/${mcqId}`);
      
      if (response.data.success && response.data.data) {
        const mcqData = response.data.data;
        
        // Ensure we have options with the correct structure
        let formattedOptions = [];
        if (Array.isArray(mcqData.options) && mcqData.options.length > 0) {
          formattedOptions = mcqData.options.map(opt => ({
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
        setFormData({
          questionText: mcqData.questionText || '',
          options: formattedOptions,
          explanationText: mcqData.explanationText || '',
          category: mcqData.category || '',
          session: mcqData.session || '',
          subject: mcqData.subject || '',
          unit: mcqData.unit || '',
          topic: mcqData.topic || '',
          subTopic: mcqData.subTopic || '',
          difficulty: mcqData.difficulty || 'Medium',
          isPublic: mcqData.isPublic !== undefined ? mcqData.isPublic : true,
        });

        // Set revision info
        setRevisionInfo({
          revisionCount: mcqData.revisionCount || 0,
          lastRevised: mcqData.lastRevised || null
        });

        // Set statistics if available
        if (mcqData.statistics) {
          setStatistics(mcqData.statistics);
        }
      } else {
        setError('Failed to load MCQ data - Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching MCQ:', error);
      setError(error.response?.data?.message || 'Failed to load MCQ data');
      toast.error('Failed to load MCQ data');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const submitData = {
        ...formData,
        testId: testId,
      };

      if (mcqId) {
        await apiClient.put(`/mcqs/${mcqId}`, submitData);
        toast.success('MCQ updated successfully');
      } else {
        await apiClient.post('/mcqs', submitData);
        toast.success('MCQ created successfully');
      }
      navigate(`/tests/${testId}`);
    } catch (error) {
      console.error('Error saving MCQ:', error);
      setError(error.response?.data?.message || 'Failed to save MCQ');
      toast.error(error.response?.data?.message || 'Failed to save MCQ');
    } finally {
      setLoading(false);
    }
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

  if (fetchingData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        <span className="ml-3 text-gray-600">Loading MCQ data...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          {mcqId ? 'Edit Question' : 'Add Question'}
        </h1>

        {test && (
          <div className="bg-blue-50 p-4 rounded-lg mb-6">
            <h2 className="font-semibold">Test: {test.title}</h2>
            <p className="text-sm text-gray-600">
              {test.subject} - {test.unit} - {test.topic}
            </p>
          </div>
        )}

        {/* Revision Info for Existing MCQs */}
        {mcqId && (
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
                <span className="font-medium">Created:</span> {formatDate(formData.createdAt)}
              </div>
              <div>
                <span className="font-medium">Author:</span> {formData.author || user?.fullName}
              </div>
            </div>
          </div>
        )}

        {/* Statistics Section */}
        {mcqId && statistics && (
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

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Question Text
            </label>
            <RichTextEditor
              value={formData.questionText}
              onChange={(value) => setFormData({ ...formData, questionText: value })}
              placeholder="Enter your question here..."
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Options
            </label>
            <div className="space-y-4">
              {formData.options.map((option, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    <span className="font-semibold text-lg">{option.optionLetter}.</span>
                  </div>
                  
                  <div className="flex-grow">
                    <RichTextEditor
                      value={option.optionText}
                      onChange={(value) => handleOptionChange(index, 'optionText', value)}
                      placeholder={`Option ${option.optionLetter} text...`}
                      minimal={true}
                    />
                  </div>
                  
                  <div className="flex-shrink-0 space-x-2">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        checked={option.isCorrect}
                        onChange={() => handleOptionChange(index, 'isCorrect', true)}
                        className="form-radio text-green-500"
                      />
                      <span className="ml-2">Correct</span>
                    </label>
                    
                    {formData.options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="text-red-500 hover:text-red-700"
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
                className="mt-4 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg"
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
              value={formData.explanationText}
              onChange={(value) => setFormData({ ...formData, explanationText: value })}
              placeholder="Provide an explanation for the correct answer..."
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

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate(`/tests/${testId}`)}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg mr-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
            >
              {loading ? 'Saving...' : mcqId ? 'Update Question' : 'Save Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MCQForm;