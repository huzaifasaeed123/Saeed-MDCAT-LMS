import React, { useState, useRef } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import useAuth from '../../../core/auth/useAuth';
import { updateProfile } from '../../users/services/userService';
import apiClient from '../../../core/api/axiosConfig';
import { FiUser, FiMail, FiPhone, FiShield, FiEdit, FiSave, FiX, FiCamera } from 'react-icons/fi';

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

const getBackendUrl = () => {
  if (import.meta.env.VITE_BACKEND_URL) return import.meta.env.VITE_BACKEND_URL;
  const apiUrl = import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || '';
  if (apiUrl) return apiUrl.replace(/\/api\/?$/, '');
  return 'http://localhost:5000';
};

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPic, setUploadingPic] = useState(false);
  const fileInputRef = useRef(null);

  const profilePicUrl = user?.profilePicture
    ? user.profilePicture.startsWith('http')
      ? user.profilePicture
      : `${getBackendUrl()}${user.profilePicture}`
    : null;

  const handlePictureClick = () => fileInputRef.current?.click();

  const handlePictureChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a JPEG, PNG, GIF or WebP image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5 MB');
      return;
    }

    setUploadingPic(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const uploadRes = await apiClient.post('/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const imageUrl = uploadRes.data?.url || uploadRes.data?.data?.url;
      if (!imageUrl) throw new Error('No URL returned');

      const profileRes = await updateProfile({ profilePicture: imageUrl });
      const updatedUser = profileRes.data || { ...user, profilePicture: imageUrl };
      updateUser({ ...user, ...updatedUser, profilePicture: imageUrl });
      toast.success('Profile picture updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload picture');
    } finally {
      setUploadingPic(false);
      e.target.value = '';
    }
  };

  const handleUpdateProfile = async (values, { setSubmitting }) => {
    try {
      const dataToSubmit = {
        fullName: values.fullName,
        contactNumber: values.contactNumber,
      };
      if (values.password && values.password.trim() !== '') {
        dataToSubmit.password = values.password;
      }

      const response = await updateProfile(dataToSubmit);
      if (response.success && response.data) {
        updateUser(response.data);
      } else {
        updateUser({ ...user, ...dataToSubmit });
      }
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
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
                      <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiUser className="h-5 w-5 text-gray-400" />
                        </div>
                        <Field type="text" name="fullName" id="fullName"
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Your full name" />
                      </div>
                      <ErrorMessage name="fullName" component="p" className="mt-1 text-sm text-red-600" />
                    </div>

                    <div>
                      <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiPhone className="h-5 w-5 text-gray-400" />
                        </div>
                        <Field type="text" name="contactNumber" id="contactNumber"
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Your contact number" />
                      </div>
                      <ErrorMessage name="contactNumber" component="p" className="mt-1 text-sm text-red-600" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <div className="relative rounded-md shadow-sm">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiMail className="h-5 w-5 text-gray-400" />
                        </div>
                        <input type="text" value={user?.email || ''} disabled
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500" />
                      </div>
                      <p className="mt-1 text-sm text-gray-500">Email cannot be changed</p>
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        New Password <span className="text-gray-400 font-normal">(leave empty to keep current)</span>
                      </label>
                      <Field type="password" name="password" id="password"
                        className="block w-full pl-3 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="New password (optional)" />
                      <ErrorMessage name="password" component="p" className="mt-1 text-sm text-red-600" />
                    </div>

                    <div className="flex space-x-4 pt-4">
                      <button type="submit" disabled={isSubmitting}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:opacity-60">
                        {isSubmitting ? (
                          <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />Saving...</>
                        ) : (
                          <><FiSave className="mr-2 h-4 w-4" />Save Changes</>
                        )}
                      </button>
                      <button type="button" onClick={() => setIsEditing(false)} disabled={isSubmitting}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        <FiX className="mr-2 h-4 w-4" />Cancel
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
              {/* Profile picture */}
              <div className="flex-shrink-0 mb-6 md:mb-0 md:mr-8">
                <div className="relative group w-32 h-32">
                  {profilePicUrl ? (
                    <img
                      src={profilePicUrl}
                      alt="Image"
                      className="w-32 h-32 rounded-full object-cover border-4 border-gray-100 shadow"
                    />
                  ) : (
                    <div className="w-32 h-32 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-4xl border-4 border-gray-100 shadow">
                      {user?.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                  )}
                  {/* Upload overlay */}
                  <button
                    type="button"
                    onClick={handlePictureClick}
                    disabled={uploadingPic}
                    className="absolute inset-0 rounded-full bg-black bg-opacity-0 group-hover:bg-opacity-40 flex items-center justify-center transition-all duration-200"
                    title="Change profile picture"
                  >
                    {uploadingPic ? (
                      <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
                    ) : (
                      <FiCamera className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                    onChange={handlePictureChange}
                  />
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">Click to change</p>
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
                  <p className="mt-1 text-lg">{user?.contactNumber || '—'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Role</h3>
                  <p className="mt-1">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user?.role === 'admin' ? 'bg-purple-100 text-purple-800'
                      : user?.role === 'teacher' ? 'bg-green-100 text-green-800'
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

export default ProfilePage;
