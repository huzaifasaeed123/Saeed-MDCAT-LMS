import React, { useState } from 'react';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import useAuth from '../hooks/useAuth';
import apiClient from '../utils/axiosConfig';

// Validation schema for profile update
const ProfileSchema = Yup.object().shape({
  fullName: Yup.string()
    .required('Full name is required')
    .max(50, 'Full name cannot be more than 50 characters'),
  contactNumber: Yup.string()
    .required('Contact number is required')
    .matches(/^\+?[0-9]{10,14}$/, 'Invalid contact number format'),
});

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  
  // Handle profile update
  const handleUpdateProfile = async (values, { setSubmitting }) => {
    try {
      const response = await apiClient.put(`/users/${user.id}`, values);
      
      if (response.data.success) {
        updateUser(response.data.data);
        toast.success('Profile updated successfully');
        setIsEditing(false);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>My Profile</h1>
        {!isEditing && (
          <button
            className="btn btn-primary"
            onClick={() => setIsEditing(true)}
          >
            Edit Profile
          </button>
        )}
      </div>
      
      <div className="profile-content">
        {isEditing ? (
          <div className="profile-edit">
            <Formik
              initialValues={{
                fullName: user?.fullName || '',
                contactNumber: user?.contactNumber || '',
              }}
              validationSchema={ProfileSchema}
              onSubmit={handleUpdateProfile}
            >
              {({ isSubmitting }) => (
                <Form>
                  <div className="form-group">
                    <label htmlFor="fullName">Full Name</label>
                    <Field type="text" name="fullName" id="fullName" className="form-control" />
                    <ErrorMessage name="fullName" component="div" className="error-text" />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="contactNumber">Contact Number</label>
                    <Field type="text" name="contactNumber" id="contactNumber" className="form-control" />
                    <ErrorMessage name="contactNumber" component="div" className="error-text" />
                  </div>
                  
                  <div className="form-group">
                    <label>Email</label>
                    <p className="form-control-static">{user?.email}</p>
                    <small className="form-text text-muted">Email cannot be changed</small>
                  </div>
                  
                  <div className="form-group">
                    <label>Role</label>
                    <p className="form-control-static">{user?.role}</p>
                    <small className="form-text text-muted">Role can only be changed by an admin</small>
                  </div>
                  
                  <div className="form-buttons">
                    <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setIsEditing(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                  </div>
                </Form>
              )}
            </Formik>
          </div>
        ) : (
          <div className="profile-details">
            <div className="profile-field">
              <h3>Full Name</h3>
              <p>{user?.fullName}</p>
            </div>
            
            <div className="profile-field">
              <h3>Email</h3>
              <p>{user?.email}</p>
            </div>
            
            <div className="profile-field">
              <h3>Contact Number</h3>
              <p>{user?.contactNumber}</p>
            </div>
            
            <div className="profile-field">
              <h3>Role</h3>
              <p>{user?.role}</p>
            </div>
            
            <div className="profile-field">
              <h3>Account Created</h3>
              <p>{new Date(user?.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;