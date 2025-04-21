// src/pages/admin/NewUser.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { toast } from 'react-toastify';
import { createUser } from '../../services/userService';

// Validation schema for creating new users
const NewUserSchema = Yup.object().shape({
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
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

const NewUser = () => {
  const navigate = useNavigate();
  
  // Handle form submission
  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      const response = await createUser(values);
      
      if (response.success) {
        toast.success('User created successfully');
        navigate('/admin/users');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Initial form values
  const initialValues = {
    fullName: '',
    email: '',
    contactNumber: '',
    role: 'student',
    password: '',
  };
  
  return (
    <div className="new-user-page">
      <div className="page-header">
        <h1>Create New User</h1>
      </div>
      
      <div className="user-form-container">
        <Formik
          initialValues={initialValues}
          validationSchema={NewUserSchema}
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
                <label htmlFor="password">Password</label>
                <Field type="password" name="password" id="password" className="form-control" />
                <ErrorMessage name="password" component="div" className="error-text" />
              </div>
              
              <div className="form-buttons">
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create User'}
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

export default NewUser;