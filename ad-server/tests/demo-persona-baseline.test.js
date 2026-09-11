import { describe, expect, test } from '@jest/globals';

process.env.NODE_ENV = 'test';
process.env.GOOGLE_CLOUD_PROJECT = 'softomedia-demo';

const { DEMO_PERSONAS } = await import('../src/services/DemoPersonaProvisioner.js');

describe('Phase 1 demo persona baseline', () => {
    test('defines five primary personas and two organization-isolation accounts', () => {
        expect(DEMO_PERSONAS).toHaveLength(7);
        expect(DEMO_PERSONAS.map(persona => persona.role)).toEqual([
            'superadmin',
            'admin',
            'brand',
            'retaileradmin',
            'techoperator',
            'brand',
            'retaileradmin',
        ]);
        expect(DEMO_PERSONAS.map(persona => persona.email)).toEqual([
            'superadmin@demo.softomedia.test',
            'admin@demo.softomedia.test',
            'brand@demo.softomedia.test',
            'retaileradmin@demo.softomedia.test',
            'techoperator@demo.softomedia.test',
            'brand-secondary@demo.softomedia.test',
            'retaileradmin-secondary@demo.softomedia.test',
        ]);
        expect(DEMO_PERSONAS.slice(5).map(persona => persona.linked_entity_id)).toEqual([
            'demo-advertiser-secondary',
            'demo-retailer-secondary',
        ]);
    });
});
