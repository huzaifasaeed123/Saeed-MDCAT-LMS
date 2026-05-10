const app = require('./app');
const connectDB = require('./config/db');
const { createAdminUser }= require('./controllers/userController');
const { startLeaderboardJob } = require('./jobs/leaderboardJob');

// Connect to database
connectDB();

const PORT = process.env.PORT || 5000;
// Create admin user from environment variables
createAdminUser();

// Start leaderboard background recompute job (runs every 10 minutes)
startLeaderboardJob();
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});




// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});