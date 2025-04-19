const User = require('../models/User');
const { validationResult } = require('express-validator');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false,
      message: "Please Enter the correct Details",
      errors: errors.array() 
    });
  }

  try {
    const { fullName, email, contactNumber, password, role } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user
    user = await User.create({
      fullName,
      email,
      contactNumber,
      password,
      role: role || 'student'  // Default to student if not specified
    });

    // Generate token and send response
    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  // console.log(req.body)
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Please Enter the correct Email And Password",
      errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token and send response
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
exports.googleCallback = async (req, res) => {
  try {
    // Handled by passport, this is just the callback after successful auth
    await sendTokenResponse(req.user, 200, res);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error processing Google authentication'
    });
  }
};

// @desc    Logout user / clear cookies
// @route   GET /api/auth/logout
// @access  Private
exports.logout = async (req, res) => {
  try {
    // Find the user and clear the refresh token
    if (req.user && req.user.id) {
      await User.findByIdAndUpdate(req.user.id, { refreshToken: null });
    }
    
    // Clear both cookies
    res.cookie('accessToken', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });
    
    res.cookie('refreshToken', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/api/auth' // Restrict cookie to auth routes
    });

    res.status(200).json({
      success: true,
      message: 'User logged out successfully'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Refresh token
// @route   POST /api/auth/refresh-token
// @access  Public
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided'
      });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Find user with the refresh token
    const user = await User.findById(decoded.id).select('+refreshToken');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    // Check if stored refresh token matches
    if (user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token is not valid'
      });
    }
    
    // Generate new tokens
    const accessToken = user.getSignedAccessToken();
    const newRefreshToken = user.getSignedRefreshToken();
    
    // Save updated refresh token
    await user.save();
    
    // Send tokens in cookies
    sendTokenCookies(accessToken, newRefreshToken, res);
    
    res.status(200).json({
      success: true,
      accessToken
    });
  } catch (error) {
    console.error(error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expired, please login again'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server Error'
    });
  }
};

// Helper function to set token cookies
const sendTokenCookies = (accessToken, refreshToken, res) => {
  // Access token cookie - short lived
  const accessOptions = {
    expires: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    httpOnly: true,
     // sameSite: 'Strict',  // <== This prevents CSRF  Use only when both frontend and backend server is on same domain and port,domain can be subdomain
    //  secure: true,  //When deploy on server on same domain
  };
  
  // Refresh token cookie - long lived
  const refreshOptions = {
    expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    httpOnly: true,
    // sameSite: 'Strict',  // <== This prevents CSRF  Use only when both frontend and backend server is on same domain and port,domain can be subdomain
    // secure: true,  //When deploy on server on same domain
    path: '/api/auth' // Restrict cookie to auth routes
  };

  // Set secure flag in production
  if (process.env.NODE_ENV === 'production') {
    accessOptions.secure = true;
    accessOptions.sameSite = 'Strict';
    refreshOptions.secure = true;
    refreshOptions.sameSite = 'Strict';
  }

  // Set cookies
  res.cookie('accessToken', accessToken, accessOptions);
  res.cookie('refreshToken', refreshToken, refreshOptions);
};

// Helper function to send token response
const sendTokenResponse = async (user, statusCode, res) => {
  // Create tokens
  const accessToken = user.getSignedAccessToken();
  const refreshToken = user.getSignedRefreshToken();
  
  // Save user with refresh token
  await user.save();
  
  // Set cookies
  sendTokenCookies(accessToken, refreshToken, res);

  res.status(statusCode).json({
    success: true,
    accessToken,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role
    }
  });
};