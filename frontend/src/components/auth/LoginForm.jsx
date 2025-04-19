import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import useAuth from '../../hooks/useAuth';

// Validation schema
const LoginSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email address')
    .required('Email is required'),
  password: Yup.string()
    .required('Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

const LoginForm = () => {
  const { login, loginWithGoogle } = useAuth();
  const [serverError, setServerError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the intended destination
  const from = location.state?.from?.pathname || '/dashboard';
  
  const handleSubmit = async (values, { setSubmitting }) => {
    try {
      setServerError('');
      const response = await login(values);
      
      if (response.success) {
        navigate(from, { replace: true });
      }
    } catch (error) {
      setServerError(
        error.response?.data?.message || 'An error occurred during login'
      );
    } finally {
      setSubmitting(false);
    }
  };
  
  return (
    <div className="login-form">
      <h2>Login to Your Account</h2>
      
      {serverError && <div className="error-message">{serverError}</div>}
      
      <Formik
        initialValues={{ email: '', password: '' }}
        validationSchema={LoginSchema}
        onSubmit={handleSubmit}
      >
        {({ isSubmitting }) => (
          <Form>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <Field type="email" name="email" id="email" className="form-control" />
              <ErrorMessage name="email" component="div" className="error-text" />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <Field type="password" name="password" id="password" className="form-control" />
              <ErrorMessage name="password" component="div" className="error-text" />
            </div>
            
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Logging in...' : 'Login'}
            </button>
          </Form>
        )}
      </Formik>
      
      <div className="social-login">
        <p>Or login with:</p>
        <button
          type="button"
          className="btn btn-google"
          onClick={loginWithGoogle}
        >
          Google
        </button>
      </div>
      
      <div className="register-link">
        <p>
          Don't have an account?{' '}
          <a href="/register">Register</a>
        </p>
      </div>
    </div>
  );
};

export default LoginForm;