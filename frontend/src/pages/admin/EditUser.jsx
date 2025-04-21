// src/pages/admin/EditUser.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { getUserById, updateUser } from '../../services/userService';

// Validation schema for editing users
const EditUserSchema = Yup.object().shape({
  fullName: Yup.string()
    .required('Full name is required')
    .max(50, 'Full name cannot be more than 50 characters'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  contactNumber: Yup.string()
    .required('Contact number is required')
    .matches(/^\+?[0-9]{10,14}$/, 'Invalid contact number format'),
  role: Yup.string()
    .required('Role is required')
    .oneOf(['student', 'teacher', 'admin'], 'Invalid role'),
  password: Yup.string()
    .min(6, 'If provided, password must be at least 6 characters')
    .nullable(),
});

const EditUser = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch user data on component mount
  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const response = await getUserById(id);
        
        if (response.success) {
          setUser(response.data);
        } else {
          setError('Failed to fetch user data');
          toast.error('Failed to fetch user data');
        }
      } catch (error) {
        setError(error.response?.data?.message || 'Failed to fetch user');
        toast.error('Failed to fetch user');
      } finally {
        setLoading(false);
      }
    };
    
    fetchUser();
  }, [id]);
  
  // Handle form submission
  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const response = await updateUser(id, values);
      
      if (response.success) {
        toast.success('User updated successfully');
        navigate('/admin/users');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return <div className="loading">Loading user data...</div>;
  }
  
  if (error) {
    return <div className="error-message">{error}</div>;
  }
  
  if (!user) {
    return <div className="error-message">User not found</div>;
  }
  
  // Initial form values from user data
  const initialValues = {
    fullName: user.fullName || '',
    email: user.email || '',
    contactNumber: user.contactNumber || '',
    role: user.role || 'student',
    password: '', // Empty password field for existing users
  };
  
  return (
    <div className="edit-user-page">
      <div className="page-header">
        <h1>Edit User</h1>
      </div>
      
      <div className="user-form-container">
        <Formik
          initialValues={initialValues}
          validationSchema={EditUserSchema}
          onSubmit={handleSubmit}
          enableReinitialize
        >
          {({ isSubmitting }) => (
            <Form className="user-form">
              <div className="form-group">
                <label htmlFor="fullName">Full Name</label>
                <Field type="text" name="fullName" id="fullName" className="form-control" />
                <ErrorMessage name="fullName" component="div" className="error-text" />
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <Field type="email" name="email" id="email" className="form-control" />
                <ErrorMessage name="email" component="div" className="error-text" />
              </div>
              
              <div className="form-group">
                <label htmlFor="contactNumber">Contact Number</label>
                <Field type="text" name="contactNumber" id="contactNumber" className="form-control" />
                <ErrorMessage name="contactNumber" component="div" className="error-text" />
              </div>
              
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <Field as="select" name="role" id="role" className="form-control">
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </Field>
                <ErrorMessage name="role" component="div" className="error-text" />
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password (Leave empty to keep current)</label>
                <Field type="password" name="password" id="password" className="form-control" />
                <ErrorMessage name="password" component="div" className="error-text" />
                <small className="form-text text-muted">
                  Only enter a password if you want to change it.
                </small>
              </div>
              
              <div className="form-buttons">
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Updating...' : 'Update User'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate('/admin/users')}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default EditUser;