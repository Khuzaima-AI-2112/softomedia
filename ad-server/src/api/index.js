/**
 * api/index.js — central route registry
 * Sprint 9: added /analytics route
 */
import express from 'express';

import authRouter         from './auth.js';
import usersRouter        from './users.js';
import advertisersRouter  from './advertisers.js';
import campaignsRouter    from './campaigns.js';
import adsRouter          from './ads.js';
import assetsRouter       from './assets.js';
import schedulesRouter    from './schedules.js';
import screensRouter      from './screens.js';
import loopsRouter        from './loops.js';
import playlistRouter     from './playlist.js';
import playlistsRouter    from './playlists.js';
import healthRouter       from './health.js';
import dashboardRouter    from './dashboard.js';
import locationsRouter    from './locations.js';
import storesRouter       from './stores.js';
import retailersRouter    from './retailers.js';
import pricingRouter      from './pricing.js';
import monitoringRouter   from './monitoring.js';
import notificationsRouter from './notifications.js';
import telemetryRouter    from './telemetry.js';
import ticketsRouter      from './tickets.js';
import auditRouter        from './audit.js';
import opsRouter          from './ops.js';
import analyticsRouter    from './analytics.js';

const router = express.Router();

router.use('/auth',          authRouter);
router.use('/users',         usersRouter);
router.use('/advertisers',   advertisersRouter);
router.use('/campaigns',     campaignsRouter);
router.use('/ads',           adsRouter);
router.use('/assets',        assetsRouter);
router.use('/schedules',     schedulesRouter);
router.use('/screens',       screensRouter);
router.use('/loops',         loopsRouter);
router.use('/playlist',      playlistRouter);
router.use('/playlists',     playlistsRouter);
router.use('/health',        healthRouter);
router.use('/dashboard',     dashboardRouter);
router.use('/locations',     locationsRouter);
router.use('/stores',        storesRouter);
router.use('/retailers',     retailersRouter);
router.use('/pricing',       pricingRouter);
router.use('/monitoring',    monitoringRouter);
router.use('/notifications', notificationsRouter);
router.use('/telemetry',     telemetryRouter);
router.use('/tickets',       ticketsRouter);
router.use('/audit',         auditRouter);
router.use('/ops',           opsRouter);
router.use('/analytics',     analyticsRouter);

export default router;
