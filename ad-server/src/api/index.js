import express from 'express';
import authRouter from './auth.js';
import monitoringRouter from './monitoring.js';
import screensRouter from './screens.js';
import healthRouter from './health.js';
import assetsRouter from './assets.js';
import locationsRouter from './locations.js';
import notificationsRouter from './notifications.js';
import schedulesRouter from './schedules.js';
import usersRouter from './users.js';
import loopsRouter from './loops.js';
import campaignsRouter from './campaigns.js';
import storesRouter from './stores.js';
import pricingRouter from './pricing.js';
import auditRouter from './audit.js';
import retailersRouter from './retailers.js';
import advertisersRouter from './advertisers.js';
import impressionsRouter from './impressions.js';
import invoicesRouter from './invoices.js';
import ticketsRouter from './tickets.js';
import analyticsRouter from './analytics.js';
import platformRouter from './platform.js';
import inventoryRouter from './inventory.js';
import deviceRouter from './device.js';
import { authenticate } from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Every route is one of: trusted device (device key), health, deliberately
// public, or authenticated user. tests/route-classification.test.js enforces it.

// --- Trusted Screen/device routes (device key, never a user token) ---
router.use('/device', deviceRouter);

// --- Health ---
router.use('/health', healthRouter);

// --- Deliberately public: UI crash reports from ErrorBoundary, which can fire
//     before sign-in. Rate limited and size capped. ---
const CRASH_REPORT_MAX_BYTES = 16 * 1024;
const crashReportLimiter = createRateLimiter({ maxHits: 20 });

router.post('/logs/error', crashReportLimiter, (req, res) => {
    if (Buffer.byteLength(JSON.stringify(req.body ?? {})) > CRASH_REPORT_MAX_BYTES) {
        return res.status(413).json({ error: 'Crash report too large' });
    }
    const { message, stack, componentStack, href, timestamp } = req.body || {};
    // Log to server stdout so it appears in Cloud Run logs
    console.error('[UI Error Report]', JSON.stringify({
        message:        message        || '(no message)',
        href:           href           || '(unknown)',
        timestamp:      timestamp      || new Date().toISOString(),
        stack:          stack          || null,
        componentStack: componentStack || null,
    }));
    res.status(204).end();
});

// --- Authenticated user routes ---
// These routers authenticate inside, route by route.
router.use('/auth', authRouter);
router.use('/stores', storesRouter);
router.use('/screens', screensRouter);
router.use('/inventory', inventoryRouter);
router.use('/pricing', pricingRouter);
router.use('/retailers', retailersRouter);
router.use('/advertisers', advertisersRouter);
router.use('/campaigns', authenticate, campaignsRouter);
router.use('/assets', authenticate, assetsRouter);
router.use('/loops', authenticate, loopsRouter);
router.use('/monitoring', authenticate, monitoringRouter);
router.use('/locations', authenticate, locationsRouter);
router.use('/notifications', authenticate, notificationsRouter);
router.use('/schedules', authenticate, schedulesRouter);
router.use('/users', authenticate, usersRouter);
router.use('/audit', authenticate, auditRouter);
router.use('/impressions', authenticate, impressionsRouter);
router.use('/invoices', authenticate, invoicesRouter);
router.use('/tickets', authenticate, ticketsRouter);
router.use('/analytics', authenticate, analyticsRouter);
router.use('/platform', authenticate, platformRouter);

export default router;
