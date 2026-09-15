import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';
process.env.DEMO_ASSETS_BUCKET = process.env.DEMO_ASSETS_BUCKET
    || `${process.env.GOOGLE_CLOUD_PROJECT}.firebasestorage.app`;

const hasEmulators = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST
    && process.env.STORAGE_EMULATOR_HOST
    && process.env.FIREBASE_AUTH_EMULATOR_HOST
);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

jest.setTimeout(30_000);

describeWithEmulators('Brand Campaign HTTP API with Firebase emulators', () => {
    const password = 'Phase1-demo-password!';
    let request;
    let app;
    let firestore;
    let storage;
    let brandToken;
    let secondaryBrandToken;
    const createdCampaignIds = [];
    const createdMediaIds = [];
    const createdObjectNames = [];
    const createdProofOfPlayIds = [];
    const createdLoopIds = [];
    const createdScheduleIds = [];

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { Firestore } = await import('@google-cloud/firestore');
        const { Storage } = await import('@google-cloud/storage');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
        storage = new Storage({ projectId: process.env.GOOGLE_CLOUD_PROJECT });

        const { resetDemoBaseline } = await import('../src/services/DemoResetService.js');
        await resetDemoBaseline({
            firestore,
            storage,
            activeProjectId: process.env.GOOGLE_CLOUD_PROJECT,
            expectedProjectId: 'softomedia-demo',
            bucketName: process.env.DEMO_ASSETS_BUCKET,
            resetAt: new Date('2030-01-15T10:30:00.000Z'),
        });

        const { provisionDemoPersonas } = await import('../src/services/DemoPersonaProvisioner.js');
        await provisionDemoPersonas({ password, expectedProjectId: 'softomedia-demo' });
        [brandToken, secondaryBrandToken] = await Promise.all([
            signIn('brand@demo.softomedia.test', password),
            signIn('brand-secondary@demo.softomedia.test', password),
        ]);
        ({ default: app } = await import('../index.js'));
    });

    afterAll(async () => {
        await Promise.all(createdCampaignIds.map(id => firestore.collection('campaigns').doc(id).delete()));
        await Promise.all(createdMediaIds.map(id => firestore.collection('media').doc(id).delete()));
        await Promise.all(createdProofOfPlayIds.map(id => firestore.collection('impressions').doc(id).delete()));
        await Promise.all(createdLoopIds.map(id => firestore.collection('loops').doc(id).delete()));
        await Promise.all(createdScheduleIds.map(id => firestore.collection('daily_schedules').doc(id).delete()));
        const bucket = storage.bucket(process.env.DEMO_ASSETS_BUCKET);
        await Promise.all(createdObjectNames.map(name => bucket.file(name).delete({ ignoreNotFound: true })));
        await firestore?.terminate();
    });

    test('Brand browses sanitized Bookable Inventory across Retailers', async () => {
        const pricingRef = firestore.collection('pricing_config').doc('global');
        await pricingRef.set({
            dateOverrides: {
                '2030-01-16': { multiplier: 1.2, hourlyTiers: { 12: 'high' } },
            },
        }, { merge: true });
        await firestore.collection('screens').doc('test-private-screen').set({
            name: 'Private Screen',
            retailer_id: 'demo-retailer-freshmart',
            store_id: 'demo-store-mtl-north',
            location_id: 'demo-location-mtl-entrance',
            bookable: false,
            last_seen: 'internal-only',
        });

        const response = await request(app)
            .get('/api/inventory')
            .set('Authorization', `Bearer ${brandToken}`);

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(3);
        expect(response.body.items.map(item => item.screen.id)).not.toContain('test-private-screen');
        expect(response.body.items.map(item => item.retailer.name)).toEqual([
            'FreshMart Synthetic Retailer',
            'FreshMart Synthetic Retailer',
            'HarborCart Synthetic Retailer',
        ]);
        const entrance = response.body.items.find(item => item.location.id === 'demo-location-mtl-entrance');
        expect(entrance).toEqual(expect.objectContaining({
            store: expect.objectContaining({
                id: 'demo-store-mtl-north',
                name: 'FreshMart North Synthetic Store',
                time_zone: 'America/Toronto',
            }),
            location: expect.objectContaining({ name: 'Entrance Placement' }),
            screen: expect.objectContaining({
                id: 'demo-screen-north-1',
                resolution: '1920x1080',
                orientation: 'landscape',
            }),
            availability: { status: 'available', bookable: true },
            booking_price: expect.objectContaining({
                currency: 'USD',
                unit: 'CPM',
                base: 15,
                traffic_tiers: expect.any(Array),
                date_overrides: expect.objectContaining({
                    '2030-01-16': { multiplier: 1.2, hourly_tiers: { 12: 'high' } },
                }),
            }),
        }));

        const rawScreens = await request(app)
            .get('/api/screens')
            .set('Authorization', `Bearer ${brandToken}`);
        expect(rawScreens.status).toBe(403);
        await firestore.collection('screens').doc('test-private-screen').delete();
        await pricingRef.update({ dateOverrides: {} });

        const serialized = JSON.stringify(response.body);
        for (const privateField of [
            'campaign', 'budget', 'invoice', 'contact_email', 'last_seen',
            'demo_reset_scope', 'internal',
        ]) {
            expect(serialized.toLowerCase()).not.toContain(privateField);
        }
    });

    test('Brand submission persists identity-owned creative, Campaign, selection, and Proof-of-Play visibility', async () => {
        const pngBytes = Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ...Buffer.from('brand campaign creative'),
        ]);
        const upload = await request(app)
            .post('/api/assets/upload')
            .set('Authorization', `Bearer ${brandToken}`)
            .field('title', 'BonVie launch creative')
            .field('category', 'paid')
            .field('owner_type', 'brand')
            .field('owner_id', 'demo-advertiser-secondary')
            .field('approval_status', 'approved')
            .field('duration', '5')
            .attach('file', pngBytes, { filename: 'launch.png', contentType: 'image/png' });

        expect(upload.status).toBe(201);
        expect(upload.body).toMatchObject({
            owner_type: 'brand',
            owner_id: 'demo-advertiser-bonvie',
            approval_status: 'pending_approval',
        });
        createdMediaIds.push(upload.body.id);
        createdObjectNames.push(upload.body.storage_path.split('/').slice(3).join('/'));

        const inventorySelection = [{
            retailer_id: 'demo-retailer-secondary',
            store_id: 'demo-store-phoenix',
            location_id: 'demo-location-phoenix-entrance',
            screen_id: 'demo-screen-secondary-1',
        }];
        const creation = await request(app)
            .post('/api/campaigns')
            .set('Authorization', `Bearer ${brandToken}`)
            .send({
                name: 'BonVie cross-retailer launch',
                brand_id: 'demo-advertiser-secondary',
                advertiser_id: 'demo-advertiser-secondary',
                media_id: upload.body.id,
                creative_url: 'https://attacker.invalid/unowned-creative.mp4',
                start_date: '2030-01-16',
                end_date: '2030-01-20',
                budget: 1200,
                status: 'approved',
                inventory_selection: inventorySelection,
            });

        expect(creation.status).toBe(201);
        expect(creation.body).toMatchObject({
            brand_id: 'demo-advertiser-bonvie',
            advertiser_id: 'demo-advertiser-bonvie',
            media_id: upload.body.id,
            status: 'pending_approval',
            inventory_selection: inventorySelection,
        });
        // The creative is read through the API by media_id; a submitted URL is never stored.
        expect(creation.body).not.toHaveProperty('creative_url');
        createdCampaignIds.push(creation.body.id);
        const conflictingLegacyId = `conflicting-brand-${Date.now()}`;
        createdCampaignIds.push(conflictingLegacyId);
        await firestore.collection('campaigns').doc(conflictingLegacyId).set({
            name: 'Conflicting legacy owner',
            brand_id: 'demo-advertiser-secondary',
            advertiser_id: 'demo-advertiser-bonvie',
            status: 'pending_approval',
        });

        const persisted = await firestore.collection('campaigns').doc(creation.body.id).get();
        expect(persisted.data()).toMatchObject({
            brand_id: 'demo-advertiser-bonvie',
            advertiser_id: 'demo-advertiser-bonvie',
            media_id: upload.body.id,
            inventory_selection: inventorySelection,
        });

        const ownList = await request(app)
            .get('/api/campaigns')
            .set('Authorization', `Bearer ${brandToken}`);
        expect(ownList.status).toBe(200);
        expect(ownList.body.map(campaign => campaign.id)).toEqual([creation.body.id]);

        const otherRead = await request(app)
            .get('/api/campaigns/demo-secondary-campaign-1')
            .set('Authorization', `Bearer ${brandToken}`);
        expect(otherRead.status).toBe(403);
        expect(JSON.stringify(otherRead.body)).not.toContain('Northstar');

        const otherMutation = await request(app)
            .put('/api/campaigns/demo-secondary-campaign-1')
            .set('Authorization', `Bearer ${brandToken}`)
            .send({ name: 'stolen' });
        expect(otherMutation.status).toBe(403);

        // Campaigns reach loops only through loop generation; direct slot booking is gone.
        const ownBooking = await request(app)
            .post(`/api/campaigns/${creation.body.id}/book`)
            .set('Authorization', `Bearer ${brandToken}`)
            .send({
                slots: [{
                    loopId: 'demo-loop-mtl-next-day-08',
                    slotIndex: 0,
                    creativeUrl: 'https://attacker.invalid/unowned-creative.mp4',
                }],
            });
        expect(ownBooking.status).toBe(404);
        const afterBookingAttempt = await firestore.collection('campaigns').doc(creation.body.id).get();
        expect(afterBookingAttempt.data().status).toBe('pending_approval');

        // Stand in for Retailer approval (#9) and Allocation Window generation (#8): Proof of Play
        // is accepted only for an approved Campaign that the Screen is scheduled to present at the
        // supplied time, and never for a future presentation, so anchor the fixture to the real clock.
        const { storeLocalDateAndHour } = await import('../src/services/PlaybackService.js');
        const presentationStartedAt = new Date(Date.now() - 1_000);
        const proofStore = await firestore.collection('stores').doc('demo-store-phoenix').get();
        const broadcast = storeLocalDateAndHour(presentationStartedAt, proofStore.data().time_zone);
        await firestore.collection('media').doc(upload.body.id).update({
            approval_status: 'approved',
            eligible_for_playback: true,
        });
        await firestore.collection('campaigns').doc(creation.body.id).update({
            status: 'approved',
            start_date: broadcast.date,
            end_date: broadcast.date,
        });

        const proofLoopId = `brand-proof-loop-${Date.now()}`;
        const proofEventId = `brand-proof-event-${Date.now()}`;
        const proofScheduleId = `demo-store-phoenix_${broadcast.date}`;
        createdLoopIds.push(proofLoopId);
        createdScheduleIds.push(proofScheduleId);
        await firestore.collection('daily_schedules').doc(proofScheduleId).set({
            id: proofScheduleId,
            retailer_id: 'demo-retailer-secondary',
            store_id: 'demo-store-phoenix',
            date: broadcast.date,
            operating_hours: [broadcast.hour],
            loop_ids: [proofLoopId],
        });
        await firestore.collection('loops').doc(proofLoopId).set({
            id: proofLoopId,
            status: 'approved',
            retailer_id: 'demo-retailer-secondary',
            store_id: 'demo-store-phoenix',
            date: broadcast.date,
            hour: broadcast.hour,
            screen_ids: ['demo-screen-secondary-1'],
            slots: [{
                position: 2,
                campaign_id: creation.body.id,
                asset_id: upload.body.id,
                content_kind: 'campaign',
                is_fallback: false,
                duration: 5,
            }],
        });
        const issuedDeviceKey = await request(app)
            .post('/api/screens/demo-screen-secondary-1/device-key')
            .set('Authorization', `Bearer ${await signIn('techoperator@demo.softomedia.test', password)}`);
        expect(issuedDeviceKey.status).toBe(200);
        const telemetry = await request(app)
            .post('/api/device/proof-of-play')
            .set('Authorization', `Device demo-screen-secondary-1:${issuedDeviceKey.body.device_key}`)
            .send({
                event_id: proofEventId,
                campaign_id: creation.body.id,
                asset_id: upload.body.id,
                screen_id: 'demo-screen-secondary-1',
                location_id: 'demo-location-phoenix-entrance',
                loop_id: proofLoopId,
                slot_position: 2,
                presentation_started_at: presentationStartedAt.toISOString(),
                intended_duration_seconds: 5,
            });
        expect(telemetry.status).toBe(201);

        const proofs = await eventually(async () => request(app)
            .get(`/api/campaigns/${creation.body.id}/proofs-of-play`)
            .set('Authorization', `Bearer ${brandToken}`), response => response.body.length === 1);
        expect(proofs.status).toBe(200);
        expect(proofs.body).toEqual([
            expect.objectContaining({
                id: telemetry.body.event_id,
                event_id: proofEventId,
                campaign_id: creation.body.id,
                asset_id: upload.body.id,
                screen_id: 'demo-screen-secondary-1',
                loop_id: proofLoopId,
                slot_position: 2,
            }),
        ]);
        const proofDocuments = await firestore.collection('impressions')
            .where('campaign_id', '==', creation.body.id).get();
        createdProofOfPlayIds.push(...proofDocuments.docs.map(document => document.id));

        const crossBrandProofOfPlayRead = await request(app)
            .get(`/api/campaigns/${creation.body.id}/proofs-of-play`)
            .set('Authorization', `Bearer ${secondaryBrandToken}`);
        expect(crossBrandProofOfPlayRead.status).toBe(403);

        const secondaryOwnCampaign = await request(app)
            .get('/api/campaigns/demo-secondary-campaign-1')
            .set('Authorization', `Bearer ${secondaryBrandToken}`);
        expect(secondaryOwnCampaign.status).toBe(200);
        expect(secondaryOwnCampaign.body.id).toBe('demo-secondary-campaign-1');
    });
});

async function signIn(email, password) {
    const response = await fetch(
        `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
        },
    );
    if (!response.ok) throw new Error(`Firebase emulator sign-in failed: ${await response.text()}`);
    return (await response.json()).idToken;
}

async function eventually(action, predicate) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const result = await action();
        if (predicate(result)) return result;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    return action();
}
