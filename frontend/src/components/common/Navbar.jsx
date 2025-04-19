import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';

const Navbar = () => {
  const { isAuthenticated, user, logout, isAdmin, isTeacher } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">Saeed MDCAT LMS</Link>
      </div>
      
      <div className="navbar-menu">
        <div className="navbar-start">
          <Link to="/" className="navbar-item">Home</Link>
          
          {isAuthenticated && (
            <Link to="/dashboard" className="navbar-item">Dashboard</Link>
          )}
          
          {isAdmin && (
            <div className="navbar-item has-dropdown is-hoverable">
              <a className="navbar-link">Admin</a>
              <div className="navbar-dropdown">
                <Link to="/admin/users" className="navbar-item">Users</Link>
                <Link to="/admin/courses" className="navbar-item">Courses</Link>
                <Link to="/admin/mcqs" className="navbar-item">MCQs</Link>
              </div>
            </div>
          )}
          
          {isTeacher && (
            <div className="navbar-item has-dropdown is-hoverable">
              <a className="navbar-link">Teacher</a>
              <div className="navbar-dropdown">
                <Link to="/teacher/queries" className="navbar-item">Student Queries</Link>
                <Link to="/teacher/mcqs" className="navbar-item">MCQs</Link>
              </div>
            </div>
          )}
        </div>
        
        <div className="navbar-end">
          {isAuthenticated ? (
            <>
              <div className="navbar-item has-dropdown is-hoverable">
                <a className="navbar-link">
                  {user.fullName}
                </a>
                <div className="navbar-dropdown">
                  <Link to="/profile" className="navbar-item">Profile</Link>
                  <hr className="navbar-divider" />
                  <a className="navbar-item" onClick={handleLogout}>Logout</a>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="navbar-item">
                <Link to="/login" className="button is-light">Log in</Link>
              </div>
              <div className="navbar-item">
                <Link to="/register" className="button is-primary">Sign up</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;