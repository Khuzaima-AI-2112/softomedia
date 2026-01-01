// Validation Middleware
// Input validation using express-validator

import { body, param, validationResult } from 'express-validator';

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array().map(err => ({
                field: err.path,
                message: err.msg,
                value: err.value
            }))
        });
    }
    next();
};

/**
 * Login validation rules
 */
export const validateLogin = [
    body('email')
        .exists().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail()
        .trim(),
    handleValidationErrors
];

/**
 * Screen registration validation rules
 */
export const validateScreenRegistration = [
    body('screen_id')
        .exists().withMessage('Screen ID is required')
        .isString().withMessage('Screen ID must be a string')
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Screen ID must be 1-100 characters')
        .matches(/^[a-zA-Z0-9_-]+$/).withMessage('Screen ID can only contain letters, numbers, hyphens, and underscores'),
    handleValidationErrors
];

/**
 * Impression recording validation rules
 */
export const validateImpression = [
    param('screenId')
        .exists().withMessage('Screen ID is required')
        .isString().withMessage('Screen ID must be a string')
        .trim(),
    body('ad_id')
        .exists().withMessage('Ad ID is required')
        .isString().withMessage('Ad ID must be a string')
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Ad ID must be 1-100 characters'),
    handleValidationErrors
];

/**
 * Playlist request validation rules
 */
export const validatePlaylistRequest = [
    param('screenId')
        .exists().withMessage('Screen ID is required')
        .isString().withMessage('Screen ID must be a string')
        .trim()
        .isLength({ min: 1, max: 100 }).withMessage('Screen ID must be 1-100 characters'),
    handleValidationErrors
];
