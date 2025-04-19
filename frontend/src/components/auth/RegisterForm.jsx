import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import useAuth from '../../hooks/useAuth';

// Validation schema
const RegisterSchema = Yup.object().shape({
  fullName: Yup.string()
    .required('Full name is required')
    .max(50, 'Full name cannot be more than 50 characters'),
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  contactNumber: Yup.string()
    .required('Contact number is required')
    .matches(/^\+?[0-9]{10,14}$/, 'Invalid contact number format'),
  password: Yup.string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('password'), null], 'Passwords must match')
    .required('Confirm password is required'),
});

const RegisterForm = () => {
  const { register, loginWithGoogle } = useAuth();
  const [serverError, setServerError] = useState('');
  const navigate = useNavigate();
  
  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setServerError('');
      
      // Remove confirmPassword as it's not needed for the API
      const { confirmPassword, ...userData } = values;
      
      const response = await register(userData);
      
      if (response.success) {
        navigate('/dashboard', { replace: true });
      }
    } catch (error) {
      setServerError(
        error.response?.data?.message || 'An error occurred during registration'
      );
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="register-form">
      <h2>Create an Account</h2>
      
      {serverError && <div className="error-message">{serverError}</div>}
      
      <Formik
        initialValues={{
          fullName: '',
          email: '',
          contactNumber: '',
          password: '',
          confirmPassword: '',
        }}
        validationSchema={RegisterSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting }) => (
          <Form>
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
              <label htmlFor="password">Password</label>
              <Field type="password" name="password" id="password" className="form-control" />
              <ErrorMessage name="password" component="div" className="error-text" />
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <Field type="password" name="confirmPassword" id="confirmPassword" className="form-control" />
              <ErrorMessage name="confirmPassword" component="div" className="error-text" />
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register'}
            </button>
          </Form>
        )}
      </Formik>
      
      <div className="social-login">
        <p>Or sign up with:</p>
        <button
          type="button"
          className="btn btn-google"
          onClick={loginWithGoogle}
        >
          Google
        </button>
      </div>
      
      <div className="login-link">
        <p>
          Already have an account?{' '}
          <a href="/login">Login</a>
        </p>
      </div>
    </div>
  );
};

export default RegisterForm;