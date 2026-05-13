/**
 * analytics.js — Sprint 9
 *
 * Provides impression, spend, CTR, and performance breakdown data.
 * All queries read from the `impressions` Firestore collection.
 * Role scoping:
 *   admin      → sees everything; can filter by brand_id, campaign_id, location_id
 *   brand      → scoped to their own brand_id automatically
 *   retailer   → scoped to their own store/location impressions
 */

import express from 'express';
import { getFirestore } from 'firebase-admin/firestore';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFirestoreInstance() {
    return getFirestore();
}

/**
 * Build a date-range filter.
 * period: '7d' | '30d' | '90d' | 'custom'
 * from / to: ISO strings used when period === 'custom'
 */
function buildDateRange(period, from, to) {
    const now = new Date();
    let start, end;

    switch (period) {
        case '7d':   start = new Date(now - 7  * 86400000); end = now; break;
        case '30d':  start = new Date(now - 30 * 86400000); end = now; break;
        case '90d':  start = new Date(now - 90 * 86400000); end = now; break;
        case 'custom':
            start = from ? new Date(from) : new Date(now - 30 * 86400000);
            end   = to   ? new Date(to)   : now;
            break;
        default:     start = new Date(now - 30 * 86400000); end = now;
    }

    return { start, end };
}

/** Group impressions by day bucket (YYYY-MM-DD) */
function bucketByDay(impressions) {
    const map = {};
    for (const imp of impressions) {
        const ts = imp.timestamp?.toDate ? imp.timestamp.toDate() : new Date(imp.timestamp);
        const key = ts.toISOString().split('T')[0];
        if (!map[key]) map[key] = { date: key, impressions: 0, clicks: 0, spend: 0 };
        map[key].impressions += 1;
        map[key].clicks      += imp.clicked ? 1 : 0;
        map[key].spend       += imp.cost_usd || 0;
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

/** Aggregate per-campaign breakdown */
function bucketByCampaign(impressions) {
    const map = {};
    for (const imp of impressions) {
        const id = imp.campaign_id || 'unknown';
        if (!map[id]) map[id] = { campaign_id: id, campaign_name: imp.campaign_name || id, impressions: 0, clicks: 0, spend: 0 };
        map[id].impressions += 1;
        map[id].clicks      += imp.clicked ? 1 : 0;
        map[id].spend       += imp.cost_usd || 0;
    }
    return Object.values(map)
        .map(c => ({ ...c, ctr: c.impressions > 0 ? +(c.clicks / c.impressions * 100).toFixed(2) : 0 }))
        .sort((a, b) => b.impressions - a.impressions);
}

/** Aggregate per-location breakdown */
function bucketByLocation(impressions) {
    const map = {};
    for (const imp of impressions) {
        const id = imp.location_id || 'unknown';
        if (!map[id]) map[id] = { location_id: id, location_name: imp.location_name || id, impressions: 0, clicks: 0, spend: 0 };
        map[id].impressions += 1;
        map[id].clicks      += imp.clicked ? 1 : 0;
        map[id].spend       += imp.cost_usd || 0;
    }
    return Object.values(map).sort((a, b) => b.impressions - a.impressions);
}

// ─── GET /api/analytics/summary ───────────────────────────────────────────────
/**
 * Returns KPI totals + daily trend for the requested period.
 * Query params: period, from, to, brand_id, campaign_id, location_id
 */
router.get('/summary', requireAuth, async (req, res) => {
    try {
        const db = getFirestoreInstance();
        const { role, linked_entity_id } = req.user;
        const { period = '30d', from, to, campaign_id, location_id } = req.query;
        let { brand_id } = req.query;

        // Scope brand users to their own data
        if (role === 'brand') brand_id = linked_entity_id;
        if (role === 'retailer' && !location_id) {
            // Retailer without a location_id: fetch their location IDs first
            const storesSnap = await db.collection('stores').where('retailer_id', '==', linked_entity_id).get();
            const locationIds = storesSnap.docs.map(d => d.data().location_id).filter(Boolean);
            if (locationIds.length === 0) {
                return res.json({ summary: { impressions: 0, clicks: 0, ctr: 0, spend: 0 }, trend: [] });
            }
            // Use the first location for scoping (retailer can filter via location_id param)
            req.query.location_id = locationIds[0];
        }

        const { start, end } = buildDateRange(period, from, to);

        let query = db.collection('impressions')
            .where('timestamp', '>=', start)
            .where('timestamp', '<=', end);

        if (brand_id)    query = query.where('brand_id', '==', brand_id);
        if (campaign_id) query = query.where('campaign_id', '==', campaign_id);
        if (location_id || req.query.location_id) {
            query = query.where('location_id', '==', location_id || req.query.location_id);
        }

        const snap = await query.get();
        const impressions = snap.docs.map(d => d.data());

        const totalImpressions = impressions.length;
        const totalClicks      = impressions.filter(i => i.clicked).length;
        const totalSpend       = impressions.reduce((s, i) => s + (i.cost_usd || 0), 0);
        const ctr              = totalImpressions > 0 ? +(totalClicks / totalImpressions * 100).toFixed(2) : 0;

        res.json({
            period,
            date_range: { start: start.toISOString(), end: end.toISOString() },
            summary: {
                impressions: totalImpressions,
                clicks:      totalClicks,
                ctr,
                spend:       +totalSpend.toFixed(2),
            },
            trend: bucketByDay(impressions),
        });
    } catch (error) {
        logger.error('Analytics summary error:', error);
        res.status(500).json({ error: 'Failed to fetch analytics summary' });
    }
});

// ─── GET /api/analytics/campaigns ─────────────────────────────────────────────
/**
 * Per-campaign breakdown: impressions, clicks, CTR, spend.
 * Sorted by impressions desc.
 */
router.get('/campaigns', requireAuth, async (req, res) => {
    try {
        const db = getFirestoreInstance();
        const { role, linked_entity_id } = req.user;
        const { period = '30d', from, to, location_id } = req.query;
        let { brand_id } = req.query;

        if (role === 'brand') brand_id = linked_entity_id;

        const { start, end } = buildDateRange(period, from, to);

        let query = db.collection('impressions')
            .where('timestamp', '>=', start)
            .where('timestamp', '<=', end);

        if (brand_id)    query = query.where('brand_id', '==', brand_id);
        if (location_id) query = query.where('location_id', '==', location_id);

        const snap = await query.get();
        const impressions = snap.docs.map(d => d.data());

        res.json({
            period,
            campaigns: bucketByCampaign(impressions),
            total: impressions.length,
        });
    } catch (error) {
        logger.error('Analytics campaigns error:', error);
        res.status(500).json({ error: 'Failed to fetch campaign analytics' });
    }
});

// ─── GET /api/analytics/locations ─────────────────────────────────────────────
/**
 * Per-location breakdown: impressions, clicks, spend.
 * Admin/brand only (retailers see their own store already via summary).
 */
router.get('/locations', requireAuth, async (req, res) => {
    try {
        const db = getFirestoreInstance();
        const { role, linked_entity_id } = req.user;
        if (!['admin', 'brand'].includes(role)) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        const { period = '30d', from, to } = req.query;
        let { brand_id } = req.query;
        if (role === 'brand') brand_id = linked_entity_id;

        const { start, end } = buildDateRange(period, from, to);

        let query = db.collection('impressions')
            .where('timestamp', '>=', start)
            .where('timestamp', '<=', end);

        if (brand_id) query = query.where('brand_id', '==', brand_id);

        const snap = await query.get();
        const impressions = snap.docs.map(d => d.data());

        res.json({
            period,
            locations: bucketByLocation(impressions),
            total: impressions.length,
        });
    } catch (error) {
        logger.error('Analytics locations error:', error);
        res.status(500).json({ error: 'Failed to fetch location analytics' });
    }
});

// ─── POST /api/analytics/impression ───────────────────────────────────────────
/**
 * Record a single impression event from a screen player.
 * Body: { ad_id, campaign_id, brand_id, location_id, screen_id,
 *         clicked?, cost_usd?, campaign_name?, location_name? }
 * Auth: Required (screen player uses service token)
 */
router.post('/impression', requireAuth, async (req, res) => {
    try {
        const db = getFirestoreInstance();
        const {
            ad_id, campaign_id, brand_id, location_id, screen_id,
            clicked = false, cost_usd = 0, campaign_name, location_name,
        } = req.body;

        if (!ad_id || !campaign_id) {
            return res.status(400).json({ error: 'ad_id and campaign_id are required.' });
        }

        const doc = {
            ad_id, campaign_id, brand_id: brand_id || null,
            location_id: location_id || null,
            location_name: location_name || null,
            screen_id: screen_id || null,
            campaign_name: campaign_name || null,
            clicked,
            cost_usd: Number(cost_usd) || 0,
            timestamp: new Date(),
            recorded_by: req.user.uid,
        };

        const ref = await db.collection('impressions').add(doc);
        res.status(201).json({ id: ref.id, ...doc });
    } catch (error) {
        logger.error('Record impression error:', error);
        res.status(500).json({ error: 'Failed to record impression' });
    }
});

export default router;
