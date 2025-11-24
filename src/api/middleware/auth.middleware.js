const jwt = require('jsonwebtoken');

/**
 * Middleware: Protect routes
 * Checks for a valid JWT in the Authorization header.
 * Attaches the decoded user payload to req.user.
 */
exports.protect = (req, res, next) => {
  let token;

  // 1. Check if the Authorization header is present and formatted correctly
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 2. Get the token from the header (format: "Bearer <token>")
      token = req.headers.authorization.split(' ')[1];

      // 3. Verify the token using your JWT_SECRET
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4. Attach the decoded payload (e.g., { userId, firstName, role }) to req.user
      req.user = decoded;

      // 5. Grant access to the next function in the stack
      next();

    } catch (err) {
      // Token is invalid (e.g., expired, malformed)
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  // If no token is found at all
  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }
};

/**
 * Middleware: Check User Role (RBAC)
 * This is a higher-order function. It takes an array of allowed roles
 * and returns a middleware function.
 * * MUST be used *after* the 'protect' middleware.
 * Example: router.get('/', protect, checkRole(['Bureau', 'Leader']), ...)
 */
exports.checkRole = (allowedRoles) => {
  return (req, res, next) => {
    // 1. Check if req.user (from 'protect' middleware) exists
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // 2. Check if the user's role is in the allowedRoles array
    const hasPermission = allowedRoles.includes(req.user.role);

    if (!hasPermission) {
      return res.status(403).json({ 
        message: 'Forbidden: You do not have permission to perform this action.' 
      });
    }

    // 3. User has the correct role. Grant access.
    next();
  };
};