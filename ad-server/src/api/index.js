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
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// --- Public Routes ---
router.use('/auth', authRouter);
router.use('/health', healthRouter);
router.use('/assets', assetsRouter);
// Note: 'playlist' (singular) is the Player endpoint, 'playlists' (plural) is the Admin CRUD
router.use('/playlist', playlistRouter);
router.use('/playlists', playlistsRouter);
router.use('/loops', loopsRouter);
router.use('/telemetry', telemetryRouter);
router.use('/stores', storesRouter);
router.use('/pricing', pricingRouter);
router.use('/campaigns', campaignsRouter);
router.use('/retailers', retailersRouter);
router.use('/advertisers', advertisersRouter);
router.use('/screens', screensRouter);

// --- Protected Routes ---
router.use('/monitoring', authenticate, monitoringRouter);
router.use('/dashboard', authenticate, dashboardRouter);
router.use('/locations', authenticate, locationsRouter);
router.use('/notifications', authenticate, notificationsRouter);
router.use('/schedules', authenticate, schedulesRouter);
router.use('/users', authenticate, usersRouter);
router.use('/ops', authenticate, opsRouter);
router.use('/audit', authenticate, auditRouter);

export default router;
