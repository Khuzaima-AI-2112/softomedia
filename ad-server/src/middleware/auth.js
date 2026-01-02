import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Authentication Middleware
 * Validates JWT token and attaches user to request
 */
export const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization header required' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        logger.warn('Invalid token attempt', { error: error.message });
        res.status(403).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Authorization Middleware (RBAC)
 * @param {Array} allowedRoles 
 */
export const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            logger.warn('Unauthorized access attempt', {
                user: req.user?.email,
                role: req.user?.role,
                path: req.path
            });
            return res.status(403).json({ error: 'Access denied: Insufficient permissions' });
        }
        next();
    };
};
