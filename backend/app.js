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
const courseRoutes       = require('./routes/courseRoutes');
const questionBankRoutes = require('./routes/questionBankRoutes');
const settingsRoutes     = require('./routes/settingsRoutes');
const mcqReportRoutes    = require('./routes/mcqReportRoutes');
const messageRoutes      = require('./routes/messageRoutes');
const communityRoutes    = require('./routes/communityRoutes');
const notesRoutes        = require('./routes/notesRoutes');
const videosRoutes       = require('./routes/videosRoutes');
const leaderboardRoutes  = require('./routes/leaderboardRoutes');
const { openStream }     = require('./controllers/streamController');
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


// Static file serving for all uploads (images, course images, notes PDFs)
app.use(
  '/uploads',
  cors({ origin: 'http://localhost:5173' }),
  express.static(path.join(__dirname, 'uploads'), {
    setHeaders: (res, filePath) => {
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
// SSE stream mounted directly on app — BEFORE uploadRoutes.
// uploadRoutes uses router.use(protect) which runs for every /api/* request,
// which would intercept and reject the SSE connection before it reaches the
// stream handler (EventSource cannot send an Authorization header).
// Mounting directly on app bypasses all router-level middleware entirely.
app.get('/api/stream', openStream);
// Notes stream — has its own auth (view token in query string). Must be mounted
// directly on app BEFORE uploadRoutes, for the same reason as /api/stream above:
// uploadRoutes carries a global router.use(protect) that catches all /api/* requests.
const { streamFile } = require('./controllers/notesController');
app.get('/api/notes/files/:id/stream',  streamFile);
app.get('/api/videos/files/:id/stream', streamFile);
app.use('/api', uploadRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/question-banks', questionBankRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/mcq-reports', mcqReportRoutes);
app.use('/api/messages',   messageRoutes);
app.use('/api/community',  communityRoutes);
app.use('/api/notes',       notesRoutes);
app.use('/api/videos',      videosRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
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