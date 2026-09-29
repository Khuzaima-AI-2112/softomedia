import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals';
import { failStorage } from './fixtures/storage-failure.js';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'softomedia-demo';
process.env.FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'softomedia-demo';

const hasEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST);
const describeWithEmulators = hasEmulators ? describe : describe.skip;

jest.setTimeout(30_000);

/**
 * The Super Administrator's user, Retailer and Brand management, through
 * the whole server and saved in Firestore.
 */
describeWithEmulators('User, Retailer and Brand administration', () => {
    const suffix = Date.now();
    const created = { users: [], retailers: [], advertisers: [] };
    let request;
    let app;
    let firestore;
    let as;
    let repositories;

    beforeAll(async () => {
        ({ default: request } = await import('supertest'));
        const { Firestore } = await import('@google-cloud/firestore');
        firestore = new Firestore({ projectId: process.env.GOOGLE_CLOUD_PROJECT });
        ({ default: app } = await import('../index.js'));
        repositories = await import('../src/repositories/index.js');
        const { signInAs } = await import('./fixtures/emulator-sign-in.js');
        as = {
            superadmin: (await signInAs('superadmin')).headers,
            admin: (await signInAs('admin')).headers,
            retailer: (await signInAs('retaileradmin', { organizationId: `retailer-${suffix}` })).headers,
            brand: (await signInAs('brand', { organizationId: `adv-own-${suffix}` })).headers,
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    afterAll(async () => {
        await Promise.all(Object.entries(created).flatMap(([collection, ids]) =>
            ids.map(id => firestore.collection(collection).doc(id).delete())));
    });


    describe('users', () => {
        const createUser = body => request(app).post('/api/users').set(as.superadmin).send(body);

        test('a Super Administrator creates a user with a lowercased email and the organization fields sign-in reads', async () => {
            const response = await createUser({
                name: '  Dana Retail  ', email: `Dana.${suffix}@Example.com`, role: 'retaileradmin', linkedentityid: ' retailer-one ',
            });

            expect(response.status).toBe(201);
            created.users.push(response.body.id);
            expect(response.body).toEqual(expect.objectContaining({
                name: 'Dana Retail',
                email: `dana.${suffix}@example.com`,
                role: 'retaileradmin',
                organization_id: 'retailer-one',
                linked_entity_id: 'retailer-one',
                status: 'active',
            }));
            const saved = await firestore.collection('users').doc(response.body.id).get();
            expect(saved.data().email).toBe(`dana.${suffix}@example.com`);

            const listed = await request(app).get('/api/users').set(as.superadmin);
            expect(listed.status).toBe(200);
            expect(listed.body.map(user => user.id)).toContain(response.body.id);
        });

        test('a user without an organization is saved with none', async () => {
            const response = await createUser({ name: 'Tech', email: `tech.${suffix}@example.com`, role: 'techoperator' });

            expect(response.status).toBe(201);
            created.users.push(response.body.id);
            expect(response.body).toEqual(expect.objectContaining({ organization_id: null, linked_entity_id: null }));
        });

        test('creating a user reports every missing or invalid field at once', async () => {
            const missing = await createUser({});
            expect(missing.status).toBe(400);
            expect(missing.body.error).toContain('Name is required');
            expect(missing.body.error).toContain('Email is required');
            expect(missing.body.error).toContain('Role is required');

            const invalid = await createUser({ name: 'Dana', email: 'not-an-email', role: 'owner' });
            expect(invalid.status).toBe(400);
            expect(invalid.body.error).toContain('Email must be a valid email address');
            expect(invalid.body.error).toContain('Role is required and must be one of');
        });

        test('a full update changes only the fields sent and validates each of them', async () => {
            const { body: user } = await createUser({ name: 'Before', email: `put.${suffix}@example.com`, role: 'brand' });
            created.users.push(user.id);

            const updated = await request(app).put(`/api/users/${user.id}`).set(as.superadmin).send({
                name: ' After ', email: `PUT2.${suffix}@Example.com`, role: 'admin', linkedentityid: '', status: 'inactive',
            });
            expect(updated.status).toBe(200);
            expect(updated.body).toEqual(expect.objectContaining({
                name: 'After', email: `put2.${suffix}@example.com`, role: 'admin', organization_id: null, status: 'inactive',
            }));

            const invalid = await request(app).put(`/api/users/${user.id}`).set(as.superadmin).send({
                name: ' ', email: 42, role: 'owner', status: 'archived',
            });
            expect(invalid.status).toBe(400);
            expect(invalid.body.error).toContain('Name must be a non-empty string');
            expect(invalid.body.error).toContain('Email must be a string');
            expect(invalid.body.error).toContain('Role must be one of');
            expect(invalid.body.error).toContain('Status must be one of');

            const badEmail = await request(app).put(`/api/users/${user.id}`).set(as.superadmin).send({ email: 'nope' });
            expect(badEmail.status).toBe(400);
            expect(badEmail.body.error).toBe('Email must be a valid email address');

            const unchanged = await request(app).put(`/api/users/${user.id}`).set(as.superadmin).send({});
            expect(unchanged.status).toBe(200);
            expect(unchanged.body.name).toBe('After');
        });

        test('a partial update changes only the fields sent and validates each of them', async () => {
            const { body: user } = await createUser({ name: 'Patch', email: `patch.${suffix}@example.com`, role: 'brand' });
            created.users.push(user.id);

            const patched = await request(app).patch(`/api/users/${user.id}`).set(as.superadmin).send({
                name: ' Patched ', email: `PATCHED.${suffix}@example.com`, role: 'brand', linkedentityid: 'brand-one', status: 'active',
            });
            expect(patched.status).toBe(200);
            expect(patched.body).toEqual(expect.objectContaining({
                name: 'Patched', email: `patched.${suffix}@example.com`, organization_id: 'brand-one',
            }));

            const invalid = await request(app).patch(`/api/users/${user.id}`).set(as.superadmin).send({
                name: '', email: 'nope', role: 'owner', status: 'archived',
            });
            expect(invalid.status).toBe(400);
            expect(invalid.body.error.split(' | ')).toHaveLength(4);
        });

        test('an email with spaces around it is saved trimmed, and one with a space inside is refused', async () => {
            const response = await createUser({ name: 'Padded', email: `  Padded.${suffix}@Example.com `, role: 'brand' });
            expect(response.status).toBe(201);
            created.users.push(response.body.id);
            expect(response.body.email).toBe(`padded.${suffix}@example.com`);
            const url = `/api/users/${response.body.id}`;

            const put = await request(app).put(url).set(as.superadmin).send({ email: ` Padded.Put.${suffix}@Example.com ` });
            expect(put.status).toBe(200);
            expect(put.body.email).toBe(`padded.put.${suffix}@example.com`);

            const patch = await request(app).patch(url).set(as.superadmin).send({ email: ` Padded.Patch.${suffix}@Example.com ` });
            expect(patch.status).toBe(200);
            expect(patch.body.email).toBe(`padded.patch.${suffix}@example.com`);

            const inner = `pad ded.${suffix}@example.com`;
            expect((await createUser({ name: 'Inner', email: inner, role: 'brand' })).status).toBe(400);
            expect((await request(app).put(url).set(as.superadmin).send({ email: inner })).status).toBe(400);
            expect((await request(app).patch(url).set(as.superadmin).send({ email: inner })).status).toBe(400);
            expect((await request(app).patch(url).set(as.superadmin).send({ email: ['listed@example.com'] })).status).toBe(400);
        });

        test('updating or deleting a user who does not exist answers 404', async () => {
            const missing = `missing-user-${suffix}`;
            expect((await request(app).put(`/api/users/${missing}`).set(as.superadmin).send({ name: 'X' })).status).toBe(404);
            expect((await request(app).patch(`/api/users/${missing}`).set(as.superadmin).send({ name: 'X' })).status).toBe(404);
            expect((await request(app).delete(`/api/users/${missing}`).set(as.superadmin)).status).toBe(404);
        });

        test('a deleted user is gone from Firestore', async () => {
            const { body: user } = await createUser({ name: 'Leaving', email: `leaving.${suffix}@example.com`, role: 'brand' });

            const deleted = await request(app).delete(`/api/users/${user.id}`).set(as.superadmin);

            expect(deleted.status).toBe(200);
            expect((await firestore.collection('users').doc(user.id).get()).exists).toBe(false);
        });

        test('only the Super Administrator manages users', async () => {
            const denied = await request(app).get('/api/users').set(as.admin);
            expect(denied.status).toBe(403);
            expect(denied.body).toEqual({ error: 'Forbidden', required: 'superadmin', actual: 'admin' });
        });

        test('a storage failure answers 500 on every user route', async () => {
            const { userRepository } = repositories;
            const { body: user } = await createUser({ name: 'Fragile', email: `fragile.${suffix}@example.com`, role: 'brand' });
            created.users.push(user.id);
            const valid = { name: 'Fragile', email: `fragile2.${suffix}@example.com`, role: 'brand' };

            failStorage(userRepository, 'findAll');
            expect((await request(app).get('/api/users').set(as.superadmin)).status).toBe(500);
            failStorage(userRepository, 'create');
            expect((await createUser(valid)).status).toBe(500);
            failStorage(userRepository, 'update');
            expect((await request(app).put(`/api/users/${user.id}`).set(as.superadmin).send({ name: 'X' })).status).toBe(500);
            expect((await request(app).patch(`/api/users/${user.id}`).set(as.superadmin).send({ name: 'X' })).status).toBe(500);
            failStorage(userRepository, 'delete');
            expect((await request(app).delete(`/api/users/${user.id}`).set(as.superadmin)).status).toBe(500);
        });
    });

    describe('Retailers', () => {
        const createRetailer = body => request(app).post('/api/retailers').set(as.superadmin).send(body);
        const valid = id => ({ id, name: ` Northwind ${suffix} `, contact_email: 'ops@northwind.test', contract_start: '2030-01-01' });

        test('a created Retailer defaults to active with a shop logo, and any signed-in user can read it', async () => {
            const id = `ret-new-${suffix}`;
            const response = await createRetailer(valid(id));

            expect(response.status).toBe(201);
            created.retailers.push(id);
            expect(response.body).toEqual(expect.objectContaining({
                id, name: `Northwind ${suffix}`, contact_email: 'ops@northwind.test', status: 'active', logo: '🏪',
            }));
            const read = await request(app).get(`/api/retailers/${id}`).set(as.brand);
            expect(read.status).toBe(200);
            expect(read.body.name).toBe(`Northwind ${suffix}`);
        });

        test('a Retailer without an ID is given one by the server', async () => {
            const response = await createRetailer({ ...valid(), status: 'inactive', logo: 'N' });

            expect(response.status).toBe(201);
            created.retailers.push(response.body.id);
            expect(response.body.id).toEqual(expect.any(String));
            expect(response.body).toEqual(expect.objectContaining({ status: 'inactive', logo: 'N' }));
        });

        test('creating a Retailer reports every missing or invalid field at once', async () => {
            const missing = await createRetailer({});
            expect(missing.status).toBe(400);
            expect(missing.body.error.split(' | ')).toEqual([
                'Name is required and must be a non-empty string',
                'Contact email is required',
                'Contract start date is required',
            ]);

            const invalid = await createRetailer({ name: 'N', contact_email: 'nope', contract_start: 'soon' });
            expect(invalid.status).toBe(400);
            expect(invalid.body.error).toContain('Contact email must be a valid email address');
            expect(invalid.body.error).toContain('Contract start date must be a valid date string');
        });

        test('a contact email with spaces around it is saved trimmed, and one with a space inside is refused', async () => {
            const id = `ret-padded-${suffix}`;
            const response = await createRetailer({ ...valid(id), contact_email: '  Ops@Northwind.test ' });

            expect(response.status).toBe(201);
            created.retailers.push(id);
            expect(response.body.contact_email).toBe('Ops@Northwind.test');

            const inner = await createRetailer({ ...valid(`ret-inner-${suffix}`), contact_email: 'ops @northwind.test' });
            expect(inner.status).toBe(400);
            expect(inner.body.error).toBe('Contact email must be a valid email address');
        });

        test('creating a Retailer with an ID already in use answers 409', async () => {
            const id = `ret-dup-${suffix}`;
            expect((await createRetailer(valid(id))).status).toBe(201);
            created.retailers.push(id);

            const duplicate = await createRetailer(valid(id));

            expect(duplicate.status).toBe(409);
            expect(duplicate.body).toEqual({ error: 'Retailer already exists' });
        });

        test('a deactivated Retailer is listed, but not offered for campaigns', async () => {
            const id = `ret-toggle-${suffix}`;
            await createRetailer(valid(id));
            created.retailers.push(id);

            const deactivated = await request(app).patch(`/api/retailers/${id}`).set(as.superadmin).send({ status: 'inactive' });
            expect(deactivated.status).toBe(200);
            expect(deactivated.body).toEqual(expect.objectContaining({ id, status: 'inactive' }));
            expect(deactivated.body.deleted_at).toBeUndefined();

            const all = await request(app).get('/api/retailers').set(as.admin);
            expect(all.body.map(retailer => retailer.id)).toContain(id);
            const bookable = await request(app).get('/api/retailers?for=campaign').set(as.admin);
            expect(bookable.status).toBe(200);
            expect(bookable.body.map(retailer => retailer.id)).not.toContain(id);
        });

        test('a Retailer status must be active or inactive, and the Retailer must exist', async () => {
            const id = `ret-status-${suffix}`;
            await createRetailer(valid(id));
            created.retailers.push(id);

            const invalid = await request(app).patch(`/api/retailers/${id}`).set(as.superadmin).send({ status: 'suspended' });
            expect(invalid.status).toBe(400);
            const missing = await request(app).patch(`/api/retailers/missing-${suffix}`).set(as.superadmin).send({ status: 'active' });
            expect(missing.status).toBe(404);
        });

        test('an updated Retailer keeps the fields it was not sent', async () => {
            const id = `ret-put-${suffix}`;
            await createRetailer(valid(id));
            created.retailers.push(id);

            const updated = await request(app).put(`/api/retailers/${id}`).set(as.superadmin).send({ name: 'Renamed' });

            expect(updated.status).toBe(200);
            expect(updated.body).toEqual(expect.objectContaining({ name: 'Renamed', contact_email: 'ops@northwind.test' }));
        });

        test('a deleted Retailer is kept in Firestore but no longer listed or readable', async () => {
            const id = `ret-delete-${suffix}`;
            await createRetailer(valid(id));
            created.retailers.push(id);

            const deleted = await request(app).delete(`/api/retailers/${id}`).set(as.superadmin);

            expect(deleted.status).toBe(200);
            expect(deleted.body).toEqual(expect.objectContaining({ id, status: 'inactive', deleted_at: expect.any(String) }));
            expect((await firestore.collection('retailers').doc(id).get()).data().deleted_at).toEqual(expect.any(String));
            const listed = await request(app).get('/api/retailers').set(as.admin);
            expect(listed.body.map(retailer => retailer.id)).not.toContain(id);
            expect((await request(app).get(`/api/retailers/${id}`).set(as.admin)).status).toBe(404);
        });

        test('reading or deleting a Retailer that does not exist answers 404', async () => {
            expect((await request(app).get(`/api/retailers/missing-${suffix}`).set(as.admin)).status).toBe(404);
            expect((await request(app).delete(`/api/retailers/missing-${suffix}`).set(as.superadmin)).status).toBe(404);
        });

        test('a storage failure answers 500 on every Retailer route', async () => {
            const { retailerRepository } = repositories;
            const id = `ret-fragile-${suffix}`;

            failStorage(retailerRepository, 'findAll');
            expect((await request(app).get('/api/retailers').set(as.admin)).status).toBe(500);
            failStorage(retailerRepository, 'findById');
            expect((await request(app).get(`/api/retailers/${id}`).set(as.admin)).status).toBe(500);
            failStorage(retailerRepository, 'createNew');
            expect((await createRetailer(valid(id))).status).toBe(500);
            failStorage(retailerRepository, 'update');
            expect((await request(app).put(`/api/retailers/${id}`).set(as.superadmin).send({ name: 'X' })).status).toBe(500);
            failStorage(retailerRepository, 'softDelete');
            expect((await request(app).delete(`/api/retailers/${id}`).set(as.superadmin)).status).toBe(500);
            failStorage(retailerRepository, 'updateStatus');
            expect((await request(app).patch(`/api/retailers/${id}`).set(as.superadmin).send({ status: 'active' })).status).toBe(500);
        });
    });

    describe('Brands (/api/advertisers)', () => {
        const createAdvertiser = body => request(app).post('/api/advertisers').set(as.superadmin).send(body);
        const valid = id => ({
            id, name: ' Acme ', logo: ' A ', industry: ' Coffee ', contactemail: 'Buyer@Acme.test', budget: '2500',
        });

        test('a created Brand is trimmed, lowercased and active by default', async () => {
            const id = `adv-new-${suffix}`;
            const response = await createAdvertiser(valid(id));

            expect(response.status).toBe(201);
            created.advertisers.push(id);
            expect(response.body).toEqual(expect.objectContaining({
                id, name: 'Acme', logo: 'A', industry: 'Coffee', contactemail: 'buyer@acme.test', budget: 2500, status: 'active',
            }));
        });

        test('a Brand without an ID is given an adv_ one', async () => {
            const response = await createAdvertiser({ ...valid(), status: 'inactive' });

            expect(response.status).toBe(201);
            created.advertisers.push(response.body.id);
            expect(response.body.id).toMatch(/^adv_\d+_[a-z0-9]+$/);
            expect(response.body.status).toBe('inactive');
        });

        test('creating a Brand reports every missing or invalid field at once', async () => {
            const response = await createAdvertiser({ budget: -1 });

            expect(response.status).toBe(400);
            expect(response.body.error.split('; ')).toEqual([
                'name is required',
                'logo is required',
                'industry is required',
                'contactemail must be a valid email address',
                'budget must be a non-negative number',
            ]);
        });

        test('a contact email with spaces around it is saved trimmed, and one with a space inside is refused', async () => {
            const id = `adv-padded-${suffix}`;
            const response = await createAdvertiser({ ...valid(id), contactemail: '  Buyer@Acme.test ' });

            expect(response.status).toBe(201);
            created.advertisers.push(id);
            expect(response.body.contactemail).toBe('buyer@acme.test');

            const inner = await createAdvertiser({ ...valid(`adv-inner-${suffix}`), contactemail: 'buy er@acme.test' });
            expect(inner.status).toBe(400);
            expect(inner.body.error).toBe('contactemail must be a valid email address');
        });

        test('creating a Brand with an ID already in use answers 409', async () => {
            const id = `adv-dup-${suffix}`;
            await createAdvertiser(valid(id));
            created.advertisers.push(id);

            const duplicate = await createAdvertiser(valid(id));

            expect(duplicate.status).toBe(409);
        });

        test('a Brand user reads only its own Brand; Admin and Super Administrator read all', async () => {
            const own = `adv-own-${suffix}`;
            const other = `adv-other-${suffix}`;
            await createAdvertiser(valid(own));
            await createAdvertiser(valid(other));
            created.advertisers.push(own, other);

            const brandList = await request(app).get('/api/advertisers').set(as.brand);
            expect(brandList.status).toBe(200);
            expect(brandList.body.map(advertiser => advertiser.id)).toEqual([own]);
            expect((await request(app).get(`/api/advertisers/${own}`).set(as.brand)).status).toBe(200);
            expect((await request(app).get(`/api/advertisers/${other}`).set(as.brand)).status).toBe(404);

            const adminList = await request(app).get('/api/advertisers').set(as.admin);
            expect(adminList.body.map(advertiser => advertiser.id)).toEqual(expect.arrayContaining([own, other]));
            expect((await request(app).get(`/api/advertisers/${other}`).set(as.admin)).status).toBe(200);
        });

        test('a Retailer Administrator cannot read Brands', async () => {
            expect((await request(app).get('/api/advertisers').set(as.retailer)).status).toBe(403);
        });

        test('a partial update changes only the allowed fields and never the deletion marker', async () => {
            const id = `adv-patch-${suffix}`;
            await createAdvertiser(valid(id));
            created.advertisers.push(id);

            const patched = await request(app).patch(`/api/advertisers/${id}`).set(as.superadmin)
                .send({ name: 'Acme Two', status: 'inactive', deleted_at: '2030-01-01' });
            expect(patched.status).toBe(200);
            expect(patched.body).toEqual(expect.objectContaining({ name: 'Acme Two', status: 'inactive' }));
            expect(patched.body.deleted_at).toBeUndefined();

            const suspended = await request(app).patch(`/api/advertisers/${id}`).set(as.superadmin).send({ status: 'suspended' });
            expect(suspended.status).toBe(400);
            const nothing = await request(app).patch(`/api/advertisers/${id}`).set(as.superadmin).send({ deleted_at: 'x' });
            expect(nothing.status).toBe(400);
            expect(nothing.body).toEqual({ error: 'No patchable fields provided' });
        });

        test('a full update saves the fields sent', async () => {
            const id = `adv-put-${suffix}`;
            await createAdvertiser(valid(id));
            created.advertisers.push(id);

            const updated = await request(app).put(`/api/advertisers/${id}`).set(as.superadmin).send({ budget: 10 });

            expect(updated.status).toBe(200);
            expect(updated.body).toEqual(expect.objectContaining({ budget: 10, name: 'Acme' }));
        });

        test('a deleted Brand is suspended in Firestore and no longer listed or readable', async () => {
            const id = `adv-delete-${suffix}`;
            await createAdvertiser(valid(id));
            created.advertisers.push(id);

            const deleted = await request(app).delete(`/api/advertisers/${id}`).set(as.superadmin);

            expect(deleted.status).toBe(200);
            expect(deleted.body).toEqual(expect.objectContaining({ status: 'suspended', deleted_at: expect.any(String) }));
            expect((await firestore.collection('advertisers').doc(id).get()).data().status).toBe('suspended');
            const listed = await request(app).get('/api/advertisers').set(as.admin);
            expect(listed.body.map(advertiser => advertiser.id)).not.toContain(id);
            expect((await request(app).get(`/api/advertisers/${id}`).set(as.admin)).status).toBe(404);
            expect((await request(app).delete(`/api/advertisers/missing-${suffix}`).set(as.superadmin)).status).toBe(404);
        });

        test('a storage failure answers 500 on every Brand route', async () => {
            const { advertiserRepository } = repositories;
            const id = `adv-fragile-${suffix}`;

            failStorage(advertiserRepository, 'findAll');
            expect((await request(app).get('/api/advertisers').set(as.admin)).status).toBe(500);
            failStorage(advertiserRepository, 'findById');
            expect((await request(app).get(`/api/advertisers/${id}`).set(as.admin)).status).toBe(500);
            failStorage(advertiserRepository, 'create');
            expect((await createAdvertiser(valid(id))).status).toBe(500);
            failStorage(advertiserRepository, 'update');
            expect((await request(app).put(`/api/advertisers/${id}`).set(as.superadmin).send({ name: 'X' })).status).toBe(500);
            expect((await request(app).patch(`/api/advertisers/${id}`).set(as.superadmin).send({ name: 'X' })).status).toBe(500);
            failStorage(advertiserRepository, 'softDelete');
            expect((await request(app).delete(`/api/advertisers/${id}`).set(as.superadmin)).status).toBe(500);
        });
    });
});
