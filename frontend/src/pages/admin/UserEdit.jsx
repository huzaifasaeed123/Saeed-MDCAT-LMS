import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { getUserById, updateUser, createUser } from '../../services/userService';

// Validation schema for creating/editing users
const UserSchema = Yup.object().shape({
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
    .when('isNewUser', {
      is: true,
      then: Yup.string()
        .required('Password is required')
        .min(6, 'Password must be at least 6 characters'),
      otherwise: Yup.string()
        .min(6, 'Password must be at least 6 characters')
        .nullable(),
    }),
});

const UserEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNewUser = id === 'new';
  
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!isNewUser);
  const [error, setError] = useState(null);
  
  // Fetch user data if editing existing user
  useEffect(() => {
    if (!isNewUser) {
      fetchUser();
    }
  }, [id]);
  
  const fetchUser = async () => {
    try {
      setLoading(true);
      const response = await getUserById(id);
      
      if (response.success) {
        setUser(response.data);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch user');
      toast.error('Failed to fetch user');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle form submission
  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      let response;
      
      if (isNewUser) {
        response = await createUser(values);
        toast.success('User created successfully');
      } else {
        // If password is empty, remove it from the request
        if (!values.password) {
          const { password, ...userData } = values;
          response = await updateUser(id, userData);
        } else {
          response = await updateUser(id, values);
        }
        toast.success('User updated successfully');
      }
      
      if (response.success) {
        navigate('/admin/users');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save user');
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
  
  // Initial form values
  const initialValues = isNewUser
    ? {
        fullName: '',
        email: '',
        contactNumber: '',
        role: 'student',
        password: '',
        isNewUser: true,
      }
    : {
        fullName: user?.fullName || '',
        email: user?.email || '',
        contactNumber: user?.contactNumber || '',
        role: user?.role || 'student',
        password: '',
        isNewUser: false,
      };
  
  return (
    <div className="user-edit-page">
      <div className="page-header">
        <h1>{isNewUser ? 'Create New User' : 'Edit User'}</h1>
      </div>
      
      <div className="user-form-container">
        <Formik
          initialValues={initialValues}
          validationSchema={UserSchema}
          onSubmit={handleSubmit}
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
                <label htmlFor="password">
                  {isNewUser ? 'Password' : 'Password (Leave empty to keep current)'}
                </label>
                <Field type="password" name="password" id="password" className="form-control" />
                <ErrorMessage name="password" component="div" className="error-text" />
              </div>
              
              <div className="form-buttons">
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save User'}
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

export default UserEdit;