// File: components/MCQs/MCQForm.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiClient from '../../utils/axiosConfig';
import useAuth from '../../hooks/useAuth';
import { toast } from 'react-toastify';
import MCQFormFields from './MCQFromStructure';

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
  // Current MCQ data (for editing)
  const [currentMcq, setCurrentMcq] = useState(null);

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
        setCurrentMcq(mcqData);
        
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

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white shadow-md rounded-lg p-6">
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