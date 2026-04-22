const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Please provide full name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  contactNumber: {
    type: String,
    match: [/^\+?[0-9]{10,14}$/, 'Please add a valid contact number']
  },
  password: {
    type: String,
    required: [function() { return !this.googleId; }, 'Please provide a password'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['student', 'teacher', 'admin'],
    default: 'student'
  },
  googleId: { type: String },
  profilePicture: { type: String },

  // Incremented on every new login when sessionMode === 'single'.
  // Embedded in the refresh token; mismatch on refresh = session was replaced.
  sessionVersion: { type: Number, default: 0 },

  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: { type: Date, default: Date.now }
});

// ── Password hashing ──────────────────────────────────────────────────────────
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// ── Access token — 1 hour ─────────────────────────────────────────────────────
// Payload carries id, role, fullName → protect middleware never needs a DB lookup.
// sm (session mode) and sv (session version) are embedded so the refresh endpoint
// can re-validate Mode 2 without an extra query.
UserSchema.methods.getSignedAccessToken = function({ sm = 'multi', sv = 0 } = {}) {
  return jwt.sign(
    { id: this._id, role: this.role, fullName: this.fullName, sm, sv },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );
};

// ── Refresh token — duration set by admin (default 547 days / ~1.5 years) ─────
// sv is embedded so a Mode 2 check on /refresh-token can compare against
// user.sessionVersion without needing to trust the Access Token.
UserSchema.methods.getSignedRefreshToken = function({ sm = 'multi', sv = 0, durationDays = 547 } = {}) {
  return jwt.sign(
    { id: this._id, sm, sv },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: `${durationDays}d` }
  );
};

// ── Password comparison ───────────────────────────────────────────────────────
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
