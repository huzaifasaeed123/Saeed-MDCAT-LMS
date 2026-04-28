const jwt = require('jsonwebtoken');

// Protect routes — verifies the access token from Authorization header or cookie.
// Does NOT query the database — the JWT payload already carries id, role, fullName.
// Any endpoint that needs the full User document fetches it itself.
exports.protect = (req, res, next) => {
  let token;

  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    // Expose both .id and ._id so all controllers work regardless of which they use.
    req.user = {
      id:             decoded.id,
      _id:            decoded.id,
      role:           decoded.role,
      fullName:       decoded.fullName,
      profilePicture: decoded.profilePicture || null,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please refresh your token.',
        tokenExpired: true,
      });
    }
    return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
  }
};

// Role-based access control — must be used after protect.
exports.authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Not authorized for this action.' });
  }
  next();
};