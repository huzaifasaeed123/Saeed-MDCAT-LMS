import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import useAuth from '../hooks/useAuth';
import { updateProfile } from '../services/userService';
import { FiUser, FiMail, FiPhone, FiShield, FiEdit, FiSave, FiX } from 'react-icons/fi';

// Validation schema for profile update
const ProfileSchema = Yup.object().shape({
  fullName: Yup.string()
    .required('Full name is required')
    .max(50, 'Full name cannot be more than 50 characters'),
  contactNumber: Yup.string()
    .required('Contact number is required')
    .matches(/^\+?[0-9]{10,14}$/, 'Invalid contact number format'),
  password: Yup.string()
    .min(6, 'If provided, password must be at least 6 characters')
    .nullable(),
});

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  // Handle profile update
  const handleUpdateProfile = async (values, { setSubmitting }) => {
    try {
      // Only send password if it's not empty
      console.log(values)
      const dataToSubmit = {
        fullName: values.fullName,
        contactNumber: values.contactNumber
      };
      
      if (values.password && values.password.trim() !== '') {
        dataToSubmit.password = values.password;
      }
      
      const response = await updateProfile(dataToSubmit);
      
      // Check the structure of the response and handle accordingly
      console.log('Profile update response:', response); // Add this to debug
      
      if (response.success && response.data) {
        // Update user in the auth context
        updateUser(response.data);
        toast.success('Profile updated successfully');
        setIsEditing(false);
      } else {
        // If response format is different
        toast.success('Profile updated successfully');
        setIsEditing(false);
        
        // Refresh user data by reloading the page or fetching current user
        window.location.reload(); // A simple but effective approach
      }
    } catch (error) {
      console.error('Profile update error:', error); // Add this to debug
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="p-6 bg-gray-50">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
        {!isEditing && (
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md inline-flex items-center transition-colors duration-200"
            onClick={() => setIsEditing(true)}
          >
            <FiEdit className="mr-2" />
            Edit Profile
          </button>
        )}
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isEditing ? (
          <div className="p-6">
            <Formik
              initialValues={{
                fullName: user?.fullName || '',
                contactNumber: user?.contactNumber || '',
                password: '',
              }}
              validationSchema={ProfileSchema}
              onSubmit={handleUpdateProfile}
            >
              {({ isSubmitting }) => (
                <Form>
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                        Full Name
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiUser className="h-5 w-5 text-gray-400" />
                        </div>
                        <Field
                          type="text"
                          name="fullName"
                          id="fullName"
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Your full name"
                        />
                      </div>
                      <ErrorMessage name="fullName" component="p" className="mt-1 text-sm text-red-600" />
                    </div>
                    
                    <div>
                      <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Number
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiPhone className="h-5 w-5 text-gray-400" />
                        </div>
                        <Field
                          type="text"
                          name="contactNumber"
                          id="contactNumber"
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Your contact number"
                        />
                      </div>
                      <ErrorMessage name="contactNumber" component="p" className="mt-1 text-sm text-red-600" />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiMail className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={user?.email || ''}
                          disabled
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                        />
                      </div>
                      <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiShield className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          value={user?.role || ''}
                          disabled
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                        />
                      </div>
                      <p className="mt-1 text-sm text-gray-500">Role can only be changed by an admin</p>
                    </div>
                    
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password (Leave empty to keep current)
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <Field
                          type="password"
                          name="password"
                          id="password"
                          className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="New password (optional)"
                        />
                      </div>
                      <ErrorMessage name="password" component="p" className="mt-1 text-sm text-red-600" />
                    </div>
                    
                    <div className="flex space-x-4 pt-4">
                      <button
                        type="submit"
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          <>
                            <FiSave className="mr-2 -ml-1 h-5 w-5" />
                            Save Changes
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        onClick={() => setIsEditing(false)}
                        disabled={isSubmitting}
                      >
                        <FiX className="mr-2 -ml-1 h-5 w-5" />
                        Cancel
                      </button>
                    </div>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex flex-col md:flex-row">
              <div className="flex-shrink-0 mb-6 md:mb-0 md:mr-8">
                <div className="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-4xl">
                  {user?.fullName?.charAt(0) || 'U'}
                </div>
              </div>
              
              <div className="flex-grow space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Full Name</h3>
                  <p className="mt-1 text-lg font-medium">{user?.fullName}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Email</h3>
                  <p className="mt-1 text-lg">{user?.email}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Contact Number</h3>
                  <p className="mt-1 text-lg">{user?.contactNumber}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Role</h3>
                  <p className="mt-1">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user?.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : user?.role === 'teacher'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user?.role || 'student'}
                    </span>
                  </p>
                </div>
                
                <div>
                   <h3 className="text-sm font-medium text-gray-500">Account Created</h3>
                  <p className="mt-1 text-lg">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;