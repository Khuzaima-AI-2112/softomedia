import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';

const hasFirestoreEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const describeWithEmulator = hasFirestoreEmulator ? describe : describe.skip;

jest.setTimeout(30_000);

const { signInAs } = await import('./fixtures/emulator-sign-in.js');
const headersFor = async (role, options) => (await signInAs(role, options)).headers;
// Network Proof of Play visibility is an explicit grant on the operator's profile.
const operatorHeaders = () => headersFor('techoperator', { permissions: ['proof_of_play.view_network'] });

describeWithEmulator('Proof of Play HTTP API with Firestore persistence', () => {
    const suffix = `${Date.now()}`;
    const presentationStartedAt = new Date(Date.now() - 1_000);
    const broadcastDate = presentationStartedAt.toISOString().slice(0, 10);
    const broadcastHour = presentationStartedAt.getUTCHours();
    const ids = {
        event: `pop-event-${suffix}`,
        campaign: `pop-campaign-${suffix}`,
        screen: `pop-screen-${suffix}`,
        location: `pop-location-${suffix}`,
        loop: `pop-loop-${suffix}`,
        asset: `pop-asset-${suffix}`,
        fallbackAsset: `pop-fallback-${suffix}`,
        brand: `pop-brand-${suffix}`,
        retailer: `pop-retailer-${suffix}`,
        store: `pop-store-${suffix}`,
        schedule: `pop-store-${suffix}_${broadcastDate}`,
    };
    let request;
    let app;
    let firestore;

    let deviceKey;
    const asScreen = pending => pending.set('Authorization', `Device ${ids.screen}:${deviceKey}`);
    const submitProof = body => asScreen(request(app).post('/api/device/proof-of-play')).send(body);

    const proof = {
        event_id: ids.event,
        screen_id: ids.screen,
        location_id: ids.location,
        loop_id: ids.loop,
        slot_position: 0,
        campaign_id: ids.campaign,
        asset_id: ids.asset,
        presentation_started_at: presentationStartedAt.toISOString(),
        intended_duration_seconds: 5,
    };

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { Firestore } = await import('@google-cloud/firestore');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });

        await firestore.collection('campaigns').doc(ids.campaign).set({
            id: ids.campaign,
            brand_id: ids.brand,
            advertiser_id: ids.brand,
            status: 'approved',
            play_count: 0,
            retailer_id: ids.retailer,
            store_id: ids.store,
            asset_id: ids.asset,
            start_date: broadcastDate,
            end_date: broadcastDate,
        });
        await firestore.collection('media').doc(ids.asset).set({
            id: ids.asset,
            category: 'paid',
            owner_type: 'brand',
            owner_id: ids.brand,
            approval_status: 'approved',
            eligible_for_playback: true,
        });
        await firestore.collection('media').doc(ids.fallbackAsset).set({
            id: ids.fallbackAsset,
            category: 'fallback',
            content_kind: 'neutral_fallback',
            owner_type: 'platform',
            owner_id: null,
            approval_status: 'approved',
            eligible_for_playback: true,
        });
        await firestore.collection('stores').doc(ids.store).set({
            id: ids.store,
            retailer_id: ids.retailer,
            time_zone: 'UTC',
        });
        await firestore.collection('locations').doc(ids.location).set({
            id: ids.location,
            retailer_id: ids.retailer,
            store_id: ids.store,
        });
        const { deviceCredentialService } = await import('../src/services/DeviceCredentialService.js');
        const credential = deviceCredentialService.newCredential();
        deviceKey = credential.deviceKey;
        await firestore.collection('screens').doc(ids.screen).set({
            ...credential.fields,
            id: ids.screen,
            location_id: ids.location,
            retailer_id: ids.retailer,
            store_id: ids.store,
            status: 'ONLINE',
        });
        await firestore.collection('loops').doc(ids.loop).set({
            id: ids.loop,
            status: 'approved',
            retailer_id: ids.retailer,
            store_id: ids.store,
            date: broadcastDate,
            hour: broadcastHour,
            slots: [
                {
                    position: 0,
                    campaign_id: ids.campaign,
                    asset_id: ids.asset,
                    content_kind: 'campaign',
                    is_fallback: false,
                    duration: 5,
                },
                {
                    position: 1,
                    campaign_id: null,
                    asset_id: ids.fallbackAsset,
                    content_kind: 'fallback',
                    is_fallback: true,
                    duration: 5,
                },
            ],
        });
        await firestore.collection('daily_schedules').doc(ids.schedule).set({
            id: ids.schedule,
            retailer_id: ids.retailer,
            store_id: ids.store,
            date: broadcastDate,
            operating_hours: [broadcastHour],
            loop_ids: [ids.loop],
        });

        ({ default: app } = await import('../index.js'));
    });

    afterAll(async () => {
        await Promise.all([
            firestore.collection('impressions').doc(ids.event).delete(),
            firestore.collection('playback_observations').doc(`${ids.event}-fallback-observation`).delete(),
            firestore.collection('playback_observations').doc(`${ids.event}-holding-observation`).delete(),
            firestore.collection('campaigns').doc(ids.campaign).delete(),
            firestore.collection('media').doc(ids.asset).delete(),
            firestore.collection('media').doc(ids.fallbackAsset).delete(),
            firestore.collection('stores').doc(ids.store).delete(),
            firestore.collection('locations').doc(ids.location).delete(),
            firestore.collection('screens').doc(ids.screen).delete(),
            firestore.collection('loops').doc(ids.loop).delete(),
            firestore.collection('daily_schedules').doc(ids.schedule).delete(),
        ]);
        await firestore.terminate();
    });

    test('requires the complete presentation contract and refuses fallback delivery', async () => {
        const legacy = await request(app).post('/api/monitoring/impression').set(await operatorHeaders()).send({
            screenId: ids.screen,
            campaignId: ids.campaign,
        });
        expect(legacy.status).toBe(410);

        // The Screen is identified by its device credential, never by the request body.
        const missing = await submitProof({});
        expect(missing.status).toBe(400);
        expect(missing.body).toEqual({
            error: 'Invalid Proof of Play',
            missing_fields: [
                'event_id',
                'location_id',
                'loop_id',
                'slot_position',
                'campaign_id',
                'asset_id',
                'presentation_started_at',
                'intended_duration_seconds',
            ],
        });

        const future = await submitProof({
            ...proof,
            event_id: `${ids.event}-future`,
            presentation_started_at: new Date(Date.now() + 60_000).toISOString(),
        });
        expect(future.status).toBe(422);
        expect(future.body).toEqual({ error: 'presentation_started_at cannot be in the future' });

        const fallback = await submitProof({
            ...proof,
            event_id: `${ids.event}-fallback`,
            slot_position: 1,
            campaign_id: ids.campaign,
            asset_id: ids.fallbackAsset,
        });
        expect(fallback.status).toBe(422);
        expect(fallback.body).toEqual({ error: 'The presented Slot is not Campaign delivery' });
    });

    test('atomically deduplicates concurrent submission and returns a truthful retry result', async () => {
        const responses = await Promise.all([
            submitProof(proof),
            submitProof(proof),
        ]);

        expect(responses.map(response => response.status).sort()).toEqual([200, 201]);
        expect(responses.map(response => response.body.status).sort()).toEqual(['duplicate', 'recorded']);
        expect(responses.every(response => response.body.event_id === ids.event)).toBe(true);

        const retry = await submitProof(proof);
        expect(retry.status).toBe(200);
        expect(retry.body).toEqual({ status: 'duplicate', event_id: ids.event });

        const [eventDocument, campaignDocument] = await Promise.all([
            firestore.collection('impressions').doc(ids.event).get(),
            firestore.collection('campaigns').doc(ids.campaign).get(),
        ]);
        expect(eventDocument.data()).toEqual(expect.objectContaining(proof));
        expect(campaignDocument.data().play_count).toBe(1);
    });

    test('restricts Brand delivery to owned Campaigns and grants explicit operator visibility', async () => {
        const own = await request(app)
            .get(`/api/campaigns/${ids.campaign}/proofs-of-play`)
            .set(await headersFor('brand', { organizationId: ids.brand }));
        expect(own.status).toBe(200);
        expect(own.body).toEqual([expect.objectContaining({ event_id: ids.event })]);

        const foreign = await request(app)
            .get(`/api/campaigns/${ids.campaign}/proofs-of-play`)
            .set(await headersFor('brand', { organizationId: 'another-brand' }));
        expect(foreign.status).toBe(403);

        const operator = await request(app)
            .get(`/api/campaigns/${ids.campaign}/proofs-of-play`)
            .set(await operatorHeaders());
        expect(operator.status).toBe(200);
        expect(operator.body).toEqual([expect.objectContaining({ event_id: ids.event })]);

        const admin = await request(app)
            .get(`/api/campaigns/${ids.campaign}/proofs-of-play`)
            .set(await headersFor('admin'));
        expect(admin.status).toBe(403);

        const futureFallback = await asScreen(request(app).post('/api/device/playback-observations')).send({
            event_id: `${ids.event}-future-fallback-observation`,
            screen_id: ids.screen,
            location_id: ids.location,
            loop_id: ids.loop,
            slot_position: 1,
            asset_id: ids.fallbackAsset,
            presentation_type: 'fallback',
            presentation_started_at: new Date(Date.now() + 60_000).toISOString(),
            intended_duration_seconds: 5,
        });
        expect(futureFallback.status).toBe(422);

        const unassignedFallback = await asScreen(request(app).post('/api/device/playback-observations')).send({
            event_id: `${ids.event}-unassigned-fallback-observation`,
            screen_id: ids.screen,
            location_id: ids.location,
            loop_id: 'another-loop',
            slot_position: 1,
            asset_id: ids.fallbackAsset,
            presentation_type: 'fallback',
            presentation_started_at: presentationStartedAt.toISOString(),
            intended_duration_seconds: 5,
        });
        expect(unassignedFallback.status).toBe(422);

        await asScreen(request(app).post('/api/device/playback-observations')).send({
            event_id: `${ids.event}-fallback-observation`,
            screen_id: ids.screen,
            location_id: ids.location,
            loop_id: ids.loop,
            slot_position: 1,
            asset_id: ids.fallbackAsset,
            presentation_type: 'fallback',
            presentation_started_at: presentationStartedAt.toISOString(),
            intended_duration_seconds: 5,
        });
        const invalidHolding = await asScreen(request(app).post('/api/device/playback-observations')).send({
            event_id: `${ids.event}-holding-observation`,
            screen_id: ids.screen,
            location_id: ids.location,
            presentation_type: 'holding_slide',
            presentation_started_at: presentationStartedAt.toISOString(),
            intended_duration_seconds: 60,
        });
        expect(invalidHolding.status).toBe(422);

        await firestore.collection('daily_schedules').doc(ids.schedule).delete();
        const holding = await asScreen(request(app).post('/api/device/playback-observations')).send({
            event_id: `${ids.event}-holding-observation`,
            screen_id: ids.screen,
            location_id: ids.location,
            presentation_type: 'holding_slide',
            presentation_started_at: presentationStartedAt.toISOString(),
            intended_duration_seconds: 60,
        });
        expect(holding.status).toBe(201);

        const report = await request(app)
            .get('/api/monitoring/delivery-report')
            .set(await operatorHeaders());
        expect(report.status).toBe(200);
        expect(report.body).toEqual(expect.objectContaining({
            allocated_capacity: {
                scope: 'all_approved_hourly_loops',
                approved_hourly_loop_count: expect.any(Number),
                approved_slot_count: expect.any(Number),
            },
            campaign_delivery: expect.any(Number),
            fallback_playback: 1,
            holding_slide_playback: 1,
            recent_campaign_delivery: [expect.objectContaining({ event_id: ids.event })],
        }));
    });
});
