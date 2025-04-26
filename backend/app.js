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
const userTestRoutes=require('./routes/userTestRoutes')
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
// Apply CORS globally for API routes (keep this!)
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));


// ✅ ALSO apply CORS specifically to static image route:
app.use(
  '/uploads',
  cors({ origin: 'http://localhost:5173' }),
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, path) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }
  })
);
// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Initialize Passport
app.use(passport.initialize());

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// Add these routes after your other route declarations
app.use('/api/mcqs', mcqRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/user-tests',userTestRoutes );
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