require('dotenv').config();
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const passport = require('./config/passport');
const errorHandler = require('./utils/errorHandler');
const path = require('path');

// Load env vars
// dotenv.config();

// Route files
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const mcqRoutes = require('./routes/mcqRoutes');
const testRoutes = require('./routes/testRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

const app = express();

// Body parser
app.use(express.json());

// Cookie parser
app.use(cookieParser());

// Secure headers
app.use(helmet());    

app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.originalUrl}`);

  // Optional: log request body for POST/PUT
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    console.log('Body:', req.body);
  }

  next(); // Move to the next middleware
});

// CORS
app.use(cors({
  origin: 'http://localhost:5173', // Update with your frontend URL
  credentials: true
}));

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Initialize Passport
app.use(passport.initialize());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// Add these routes after your other route declarations
app.use('/api/mcqs', mcqRoutes);
app.use('/api/tests', testRoutes);
app.use('/api', uploadRoutes);
// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Saeed MDCAT LMS API' });
});


// app.listen(5000, () => {
//   console.log(`Server running in }`);
// });
// Error handler middleware
app.use(errorHandler);

module.exports = app;