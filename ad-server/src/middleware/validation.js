import { validationResult } from 'express-validator';

/**
 * Validation Result Middleware
 * Checks express-validator results and returns 400 if invalid
 */
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};
