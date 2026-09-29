import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { failStorage } from './fixtures/storage-failure.js';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';

const hasEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

jest.setTimeout(30_000);

/**
 * Invoices, in-app notices, impressions, delivery analytics and demo
 * organizations, through the whole server and saved in Firestore.
 */
describeWithEmulators('Reporting', () => {
    const suffix = Date.now();
    const brandId = `rep-brand-${suffix}`;
    const retailerId = `rep-retailer-${suffix}`;
    const created = { campaigns: [], invoices: [], notifications: [], impressions: [], demo_organizations: [] };
    let request;
    let app;
    let firestore;
    let as;
    let users;
    let repositories;


    async function save(collection, id, data) {
        created[collection].push(id);
        await firestore.collection(collection).doc(id).set({ id, ...data });
    }

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { Firestore } = await import('@google-cloud/firestore');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
        ({ default: app } = await import('../index.js'));
        repositories = await import('../src/repositories/index.js');
        const { signInAs } = await import('./fixtures/emulator-sign-in.js');
        users = {
            superadmin: await signInAs('superadmin'),
            admin: await signInAs('admin'),
            brand: await signInAs('brand', { organizationId: brandId }),
            otherBrand: await signInAs('brand', { organizationId: `rep-other-brand-${suffix}` }),
            unlinkedBrand: await signInAs('brand'),
            retailer: await signInAs('retaileradmin', { organizationId: retailerId }),
            unlinkedRetailer: await signInAs('retaileradmin'),
            tech: await signInAs('techoperator'),
        };
        as = Object.fromEntries(Object.entries(users).map(([name, user]) => [name, user.headers]));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await Promise.all(Object.entries(created).flatMap(([collection, ids]) =>
            ids.map(id => firestore.collection(collection).doc(id).delete())));
    });

    describe('invoices', () => {
        const generate = campaignId => request(app).post('/api/invoices/generate').set(as.admin).send({ campaignId });

        test('a completed Campaign is billed at the rate agreed when it was booked', async () => {
            await save('campaigns', `rep-agreed-${suffix}`, {
                status: 'completed', advertiser_id: brandId, agreed_cpm: 12.5, impressions_delivered: 2000,
            });

            const invoice = await generate(`rep-agreed-${suffix}`);

            expect(invoice.status).toBe(201);
            created.invoices.push(invoice.body.id);
            expect(invoice.body).toEqual(expect.objectContaining({
                campaignId: `rep-agreed-${suffix}`, advertiserId: brandId, impressionsDelivered: 2000, cpmRate: 12.5, amount: 25,
            }));
        });

        test('a Campaign booked before rates were recorded is billed at the configured rate, or $15 without one', async () => {
            await save('campaigns', `rep-legacy-${suffix}`, { status: 'completed', advertiser_id: brandId, impressionsDelivered: 1000 });

            const configured = await generate(`rep-legacy-${suffix}`);
            expect(configured.status).toBe(201);
            created.invoices.push(configured.body.id);
            expect(configured.body.cpmRate).toEqual(expect.any(Number));

            const { default: PricingRepository } = await import('../src/repositories/PricingRepository.js');
            failStorage(PricingRepository, 'getConfig');
            const fallback = await generate(`rep-legacy-${suffix}`);
            expect(fallback.status).toBe(201);
            created.invoices.push(fallback.body.id);
            expect(fallback.body).toEqual(expect.objectContaining({ cpmRate: 15, amount: 15 }));
        });

        test('only a completed Campaign that exists is billed', async () => {
            await save('campaigns', `rep-live-${suffix}`, { status: 'live', advertiser_id: brandId });

            expect((await request(app).post('/api/invoices/generate').set(as.admin).send({})).status).toBe(400);
            expect((await generate(`rep-missing-${suffix}`)).status).toBe(404);
            const live = await generate(`rep-live-${suffix}`);
            expect(live.status).toBe(400);
            expect(live.body).toEqual({ error: 'Campaign must be completed' });
        });

        test('a Brand reads only its own invoices; Admin and Super Administrator read all', async () => {
            await save('invoices', `rep-own-invoice-${suffix}`, { advertiserId: brandId, amount: 10 });
            await save('invoices', `rep-other-invoice-${suffix}`, { advertiserId: `rep-other-brand-${suffix}`, amount: 20 });

            const own = await request(app).get('/api/invoices?limit=100').set(as.brand);
            expect(own.status).toBe(200);
            expect(own.body.page).toBe(1);
            expect(own.body.invoices.every(invoice => invoice.advertiserId === brandId)).toBe(true);
            expect(own.body.total).toBe(own.body.invoices.length);

            const network = await request(app).get('/api/invoices?page=2').set(as.admin);
            expect(network.status).toBe(200);
            expect(network.body.page).toBe(2);

            expect((await request(app).get(`/api/invoices/rep-own-invoice-${suffix}`).set(as.brand)).status).toBe(200);
            expect((await request(app).get(`/api/invoices/rep-other-invoice-${suffix}`).set(as.brand)).status).toBe(403);
            expect((await request(app).get(`/api/invoices/rep-other-invoice-${suffix}`).set(as.admin)).status).toBe(200);
            expect((await request(app).get(`/api/invoices/rep-missing-${suffix}`).set(as.admin)).status).toBe(404);
        });

        test('invoice data for a PDF is scoped the same way', async () => {
            const pdf = await request(app).get(`/api/invoices/rep-own-invoice-${suffix}/pdf`).set(as.brand);
            expect(pdf.status).toBe(200);
            expect(pdf.body).toEqual({
                message: 'PDF generation not yet available',
                invoiceData: expect.objectContaining({ id: `rep-own-invoice-${suffix}` }),
            });

            expect((await request(app).get(`/api/invoices/rep-other-invoice-${suffix}/pdf`).set(as.brand)).status).toBe(403);
            expect((await request(app).get(`/api/invoices/rep-other-invoice-${suffix}/pdf`).set(as.admin)).status).toBe(200);
            expect((await request(app).get(`/api/invoices/rep-missing-${suffix}/pdf`).set(as.admin)).status).toBe(404);
        });

        test('a Brand user without a Brand and the Retailer Administrator read no invoices', async () => {
            const unlinked = await request(app).get('/api/invoices').set(as.unlinkedBrand);
            expect(unlinked.status).toBe(403);
            expect(unlinked.body).toEqual({ error: 'Advertiser account not linked' });
            expect((await request(app).get('/api/invoices').set(as.retailer)).status).toBe(403);
        });

        test('a storage failure answers 500 on every invoice route', async () => {
            const { campaignRepository } = await import('../src/repositories/CampaignRepository.js');
            failStorage(campaignRepository, 'findById');
            expect((await generate(`rep-agreed-${suffix}`)).status).toBe(500);

            // The invoice store is private to its router: fail only its reads, not sign-in's.
            const { BaseRepository } = await import('../src/repositories/BaseRepository.js');
            const failInvoices = method => {
                const original = BaseRepository.prototype[method];
                jest.spyOn(BaseRepository.prototype, method).mockImplementation(function (...args) {
                    if (this.collectionName === 'invoices') return Promise.reject(new Error('Firestore unavailable'));
                    return original.apply(this, args);
                });
            };
            failInvoices('findAll');
            expect((await request(app).get('/api/invoices').set(as.admin)).status).toBe(500);
            failInvoices('findById');
            expect((await request(app).get(`/api/invoices/rep-own-invoice-${suffix}`).set(as.admin)).status).toBe(500);
            expect((await request(app).get(`/api/invoices/rep-own-invoice-${suffix}/pdf`).set(as.admin)).status).toBe(500);
        });
    });

    describe('in-app notices', () => {
        const notice = (name, user, fields = {}) => save('notifications', `rep-ntf-${name}-${suffix}`, {
            user_id: user.uid, title: name, message: `${name} happened`, type: 'info', read: false,
            created_at: new Date().toISOString(), ...fields,
        });

        beforeAll(async () => {
            await notice('first', users.retailer);
            await notice('second', users.retailer);
            await notice('seen', users.retailer, { read: true });
            await notice('theirs', users.tech);
        });

        test('a user lists only their own notices, up to a limit', async () => {
            const all = await request(app).get('/api/notifications').set(as.retailer);
            expect(all.status).toBe(200);
            expect(all.body.map(item => item.title).sort()).toEqual(['first', 'second', 'seen']);

            const limited = await request(app).get('/api/notifications?limit=1').set(as.retailer);
            expect(limited.body).toHaveLength(1);
        });

        test('a notice is marked read by its owner only', async () => {
            expect((await request(app).get('/api/notifications/unread').set(as.retailer)).body).toEqual({ count: 2 });

            const url = `/api/notifications/rep-ntf-first-${suffix}/read`;
            expect((await request(app).patch(url).set(as.tech)).status).toBe(404);
            const read = await request(app).patch(url).set(as.retailer);
            expect(read.status).toBe(200);
            expect(read.body.read).toBe(true);
            expect((await request(app).get('/api/notifications/unread').set(as.retailer)).body).toEqual({ count: 1 });
            expect((await request(app).patch(`/api/notifications/rep-ntf-missing-${suffix}/read`).set(as.retailer)).status).toBe(404);
        });

        test('marking all read leaves no unread notices and touches no one else\'s', async () => {
            const all = await request(app).patch('/api/notifications/read-all').set(as.retailer);

            expect(all.status).toBe(200);
            expect(all.body).toEqual({ updated: 1 });
            expect((await request(app).get('/api/notifications/unread').set(as.retailer)).body).toEqual({ count: 0 });
            expect((await request(app).get('/api/notifications/unread').set(as.tech)).body).toEqual({ count: 1 });
        });

        test('a storage failure answers 500 on every notice route', async () => {
            const { notificationRepository } = repositories;
            failStorage(notificationRepository, 'findAll');
            expect((await request(app).get('/api/notifications').set(as.retailer)).status).toBe(500);
            expect((await request(app).get('/api/notifications/unread').set(as.retailer)).status).toBe(500);
            expect((await request(app).patch('/api/notifications/read-all').set(as.retailer)).status).toBe(500);
            failStorage(notificationRepository, 'findById');
            expect((await request(app).patch(`/api/notifications/rep-ntf-first-${suffix}/read`).set(as.retailer)).status).toBe(500);
        });
    });

    describe('impressions', () => {
        const impression = (name, fields) => save('impressions', `rep-imp-${name}-${suffix}`, {
            campaign_id: `rep-campaign-${suffix}`, retailer_id: retailerId, location_id: `rep-loc-${suffix}`,
            screen_id: `rep-screen-${suffix}`, timestamp: '2031-03-05T10:15:00', ...fields,
        });

        beforeAll(async () => {
            await impression('own', {});
            await impression('foreign', { retailer_id: `rep-other-retailer-${suffix}`, screen_id: `rep-screen-${suffix}` });
        });

        test('Admin and Super Administrator query impressions by Campaign, Location or Screen', async () => {
            const byCampaign = await request(app).get(`/api/impressions?campaign_id=rep-campaign-${suffix}`).set(as.admin);
            expect(byCampaign.status).toBe(200);
            expect(byCampaign.body).toHaveLength(2);
            const byLocation = await request(app).get(`/api/impressions?location_id=rep-loc-${suffix}`).set(as.admin);
            expect(byLocation.body).toHaveLength(2);
            const byScreen = await request(app).get(`/api/impressions?screen_id=rep-screen-${suffix}`).set(as.admin);
            expect(byScreen.body).toHaveLength(2);
            expect((await request(app).get('/api/impressions').set(as.admin)).status).toBe(400);
        });

        test('a Retailer Administrator sees only their own Retailer\'s impressions, never by Location', async () => {
            const byCampaign = await request(app).get(`/api/impressions?campaign_id=rep-campaign-${suffix}`).set(as.retailer);
            expect(byCampaign.body.map(item => item.id)).toEqual([`rep-imp-own-${suffix}`]);
            const byScreen = await request(app).get(`/api/impressions?screen_id=rep-screen-${suffix}`).set(as.retailer);
            expect(byScreen.body.map(item => item.id)).toEqual([`rep-imp-own-${suffix}`]);

            expect((await request(app).get(`/api/impressions?location_id=rep-loc-${suffix}`).set(as.retailer)).status).toBe(403);
            expect((await request(app).get('/api/impressions').set(as.retailer)).status).toBe(400);
            expect((await request(app).get('/api/impressions?screen_id=x').set(as.unlinkedRetailer)).status).toBe(403);
        });

        test('a storage failure answers 500', async () => {
            failStorage(repositories.impressionRepository, 'findAll');
            expect((await request(app).get(`/api/impressions?screen_id=rep-screen-${suffix}`).set(as.admin)).status).toBe(500);
        });
    });

    describe('delivery analytics', () => {
        test('a day\'s impressions are counted per broadcast hour, with out-of-hours plays in the nearest hour', async () => {
            const date = '2031-06-07';
            await save('impressions', `rep-imp-ten-${suffix}`, { played_at: `${date}T10:05:00` });
            await save('impressions', `rep-imp-early-${suffix}`, { played_at: `${date}T06:00:00` });
            await save('impressions', `rep-imp-late-${suffix}`, { timestamp: `${date}T23:30:00` });

            const response = await request(app).get(`/api/analytics/loops?date=${date}`).set(as.admin);

            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(14);
            const completions = Object.fromEntries(response.body.map(hour => [hour.hour, hour.loopCompletions]));
            expect(completions).toEqual(expect.objectContaining({ 8: 1, 10: 1, 21: 1, 9: 0 }));
        });

        test('analytics need a date, and are for Admin and Super Administrator only', async () => {
            expect((await request(app).get('/api/analytics/loops').set(as.admin)).status).toBe(400);
            expect((await request(app).get('/api/analytics/loops?date=2031-06-07').set(as.retailer)).status).toBe(403);
            failStorage(repositories.impressionRepository, 'findAll');
            expect((await request(app).get('/api/analytics/loops?date=2031-06-07').set(as.admin)).status).toBe(500);
        });
    });

    describe('demo organizations', () => {
        test('the Super Administrator creates, renames and deactivates a demo organization', async () => {
            const createdOrg = await request(app).post('/api/platform/organizations').set(as.superadmin)
                .send({ name: ' Acme Retail ', type: ' retailer ' });
            expect(createdOrg.status).toBe(201);
            created.demo_organizations.push(createdOrg.body.id);
            expect(createdOrg.body).toEqual(expect.objectContaining({ name: 'Acme Retail', type: 'retailer', status: 'active' }));

            const updated = await request(app).patch(`/api/platform/organizations/${createdOrg.body.id}`).set(as.superadmin)
                .send({ name: 'Acme', type: 'brand', status: 'inactive' });
            expect(updated.status).toBe(200);
            expect(updated.body).toEqual(expect.objectContaining({ name: 'Acme', type: 'brand', status: 'inactive' }));

            const listed = await request(app).get('/api/platform/organizations').set(as.superadmin);
            expect(listed.body.map(org => org.id)).toContain(createdOrg.body.id);
            expect((await request(app).get('/api/platform/audit').set(as.superadmin)).status).toBe(200);
        });

        test('a demo organization needs a name and a type, and edits must be valid', async () => {
            const url = '/api/platform/organizations';
            expect((await request(app).post(url).set(as.superadmin).send({ type: 'brand' })).status).toBe(400);
            expect((await request(app).post(url).set(as.superadmin).send({ name: 'Acme' })).status).toBe(400);

            const patch = body => request(app).patch(`${url}/any-${suffix}`).set(as.superadmin).send(body);
            expect((await patch({ name: ' ' })).body).toEqual({ error: 'Organization name must be a non-empty string' });
            expect((await patch({ type: 7 })).body).toEqual({ error: 'Organization type must be a non-empty string' });
            expect((await patch({ status: 'archived' })).body).toEqual({ error: 'Organization status must be active or inactive' });
            expect((await patch({})).body).toEqual({ error: 'At least one organization field is required' });
            expect((await patch({ name: 'Missing' })).status).toBe(404);
        });

        test('a storage failure answers 500 on every demo organization route', async () => {
            const { demoOrganizationRepository, platformAuditRepository } = repositories;
            failStorage(demoOrganizationRepository, 'findAll');
            expect((await request(app).get('/api/platform/organizations').set(as.superadmin)).status).toBe(500);
            failStorage(platformAuditRepository, 'findAll');
            expect((await request(app).get('/api/platform/audit').set(as.superadmin)).status).toBe(500);
            failStorage(demoOrganizationRepository, 'create');
            expect((await request(app).post('/api/platform/organizations').set(as.superadmin)
                .send({ name: 'A', type: 'brand' })).status).toBe(500);
            failStorage(demoOrganizationRepository, 'findById');
            expect((await request(app).patch(`/api/platform/organizations/any-${suffix}`).set(as.superadmin)
                .send({ name: 'A' })).status).toBe(500);
        });
    });
});
