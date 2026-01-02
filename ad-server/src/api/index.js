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
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// --- Public Routes ---
router.use('/auth', authRouter);
router.use('/health', healthRouter);
router.use('/assets', assetsRouter);
router.use('/playlist', playlistRouter); // Ad Player access

// --- Protected Routes ---
router.use('/monitoring', authenticate, monitoringRouter);
router.use('/screens', authenticate, screensRouter);
router.use('/dashboard', authenticate, dashboardRouter);
router.use('/locations', authenticate, locationsRouter);
router.use('/notifications', authenticate, notificationsRouter);
router.use('/schedules', authenticate, schedulesRouter);
router.use('/users', authenticate, usersRouter);
router.use('/ops', authenticate, opsRouter);

export default router;
