import express from 'express';
import authRouter from './auth.js';
import monitoringRouter from './monitoring.js';
import playlistRouter from './playlist.js';
import screensRouter from './screens.js';
import healthRouter from './health.js';
import assetsRouter from './assets.js';
import dashboardRouter from './dashboard.js';
import locationsRouter from './locations.js';
import notificationsRouter from './notifications.js';
import schedulesRouter from './schedules.js';
import usersRouter from './users.js';
import opsRouter from './ops.js';
import telemetryRouter from './telemetry.js';
import playlistsRouter from './playlists.js';
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
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// --- Public Routes ---
router.use('/auth', authRouter);
router.use('/health', healthRouter);
router.use('/assets', assetsRouter);
// Note: 'playlist' (singular) is the Player endpoint, 'playlists' (plural) is the Admin CRUD
router.use('/playlist', playlistRouter);
router.use('/playlists', playlistsRouter);
router.use('/telemetry', telemetryRouter);
router.use('/stores', storesRouter);
router.use('/pricing', pricingRouter);
router.use('/campaigns', campaignsRouter);
router.use('/retailers', retailersRouter);
router.use('/advertisers', advertisersRouter);
router.use('/screens', screensRouter);

// --- Observability: UI error reporting (public — fires from ErrorBoundary
//     before/during auth failures, so must not require authentication) ---
router.post('/logs/error', (req, res) => {
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

// --- Protected Routes ---
router.use('/loops', authenticate, loopsRouter);
router.use('/monitoring', authenticate, monitoringRouter);
router.use('/dashboard', authenticate, dashboardRouter);
router.use('/locations', authenticate, locationsRouter);
router.use('/notifications', authenticate, notificationsRouter);
router.use('/schedules', authenticate, schedulesRouter);
router.use('/users', authenticate, usersRouter);
router.use('/ops', authenticate, opsRouter);
router.use('/audit', authenticate, auditRouter);
router.use('/impressions', authenticate, impressionsRouter);
router.use('/invoices', authenticate, invoicesRouter);
router.use('/tickets', authenticate, ticketsRouter);
router.use('/analytics', authenticate, analyticsRouter);

export default router;
