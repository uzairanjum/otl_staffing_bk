const jwt = require('jsonwebtoken');
const config = require('../../config');
const User = require('../../common/models/User');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    const decoded = jwt.verify(token, config.jwt.secret);
    
    const user = await User.findById(decoded.user_id)
      .select('_id company_id role first_login is_active client_rep_id')
      .lean();

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = user;
    req.company_id = user.company_id;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(500).json({ error: 'Authentication error' });
  }
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This action requires role: ${roles.join(' or ')}. Your account role is "${req.user.role || 'unknown'}".`,
        requiredRoles: roles,
        currentRole: req.user.role,
      });
    }
    
    next();
  };
};

const requireFirstLoginChange = (req, res, next) => {
  if (req.user.first_login) {
    return res.status(403).json({ 
      error: 'First login - password change required',
      first_login_required: true 
    });
  }
  next();
};

module.exports = {
  authenticate,
  requireRole,
  requireFirstLoginChange
};
