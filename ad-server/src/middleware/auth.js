import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Authentication Middleware
 * Validates JWT token and attaches user to request
 */
export const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    // Development/Test Bypas for QA Audit
    if (process.env.NODE_ENV !== 'production' && authHeader === 'Bearer demo-token') {
        // Extract role from the request or use a default
        // In a real bypass we might want to decode a mock payload, 
        // but for now we'll just let it through and rely on the frontend 
        // to have set the correct persona in its mockUser object if we were doing RBAC here.
        // Actually, the frontend sends a mockUser but the backend needs req.user for authorize middleware.
        // Let's make it smarter: if demo-token, check for a X-Demo-Role header or similar.
        const demoRole = req.headers['x-demo-role'] || 'admin';
        req.user = { role: demoRole, email: `demo-${demoRole}@example.com`, id: `demo-${demoRole}` };
        return next();
    }

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
        // Development/Test Bypass for QA Audit
        if (process.env.NODE_ENV !== 'production' && req.user && req.user.email && req.user.email.startsWith('demo-')) {
            return next();
        }

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
