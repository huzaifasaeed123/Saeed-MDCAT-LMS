import React from 'react';
import { Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const Home = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <div className="home-page">
      <div className="hero">
        <div className="hero-content">
          <h1>Saeed MDCAT Learning Management System</h1>
          <p>Your comprehensive platform for MDCAT test preparation</p>
          
          {isAuthenticated ? (
            <Link to="/dashboard" className="btn btn-primary">
              Go to Dashboard
            </Link>
          ) : (
            <div className="hero-buttons">
              <Link to="/login" className="btn btn-primary">
                Login
              </Link>
              <Link to="/register" className="btn btn-secondary">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
      
      <div className="features">
        <div className="feature">
          <h2>Practice MCQs</h2>
          <p>Practice with thousands of MCQs curated by experts</p>
        </div>
        
        <div className="feature">
          <h2>Video Lectures</h2>
          <p>Learn from comprehensive video lectures</p>
        </div>
        
        <div className="feature">
          <h2>Smart Analytics</h2>
          <p>Track your progress with detailed analytics and insights</p>
        </div>
        
        <div className="feature">
          <h2>Community Support</h2>
          <p>Get help from teachers and other students</p>
        </div>
      </div>
    </div>
  );
};

export default Home;