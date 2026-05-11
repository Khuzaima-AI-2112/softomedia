import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
export function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No authorization token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        // Attach user info to request
        req.user = decoded;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * Role-Based Access Control Middleware
 * Restricts access to specific user roles
 * 
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Function} Express middleware
 * 
 * @example
 * router.get('/admin-only', requireRole(['admin']), handler);
 * router.get('/brand-or-admin', requireRole(['brand', 'admin']), handler);
 */
export function requireRole(allowedRoles) {
    return (req, res, next) => {
        // Ensure user is authenticated first
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                required_role: allowedRoles,
                your_role: req.user.role
            });
        }

        next();
    };
}

/**
 * Resource Ownership Middleware
 * Ensures user owns the resource or is an admin
 * 
 * @param {string} resourceType - Type of resource (retailer, brand, campaign)
 * @param {string} paramName - URL parameter name containing resource ID
 * @returns {Function} Express middleware
 */
export function requireOwnership(resourceType, paramName = 'id') {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Admins bypass ownership check
            if (req.user.role === 'admin') {
                return next();
            }

            const resourceId = req.params[paramName];

            // Check if user's linked entity matches the resource
            if (req.user.linked_entity_id !== resourceId) {
                return res.status(403).json({
                    error: 'You do not have permission to access this resource'
                });
            }

            next();
        } catch (error) {
            console.error('Ownership check error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    };
}

/**
 * Optional Authentication Middleware
 * Attaches user if token is present, but doesn't require it
 */
export function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        }

        next();
    } catch (error) {
        // Ignore token errors for optional auth
        next();
    }
}
