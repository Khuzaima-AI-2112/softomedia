import { describe, expect, it } from 'vitest';
import { ROLES } from '../constants/roles';
import { getNavItems } from './navItems';

// Each of these pages needs platform.governance or organizations.manage (#23).
const SUPER_ADMIN_PAGES = [
    '/dashboard/admin/users',
    '/dashboard/admin/organizations',
    '/dashboard/admin/pricing',
    '/dashboard/admin/pricing-config',
];

const paths = persona => getNavItems(persona).map(item => item.to);

describe('role navigation', () => {
    it('does not offer an Admin the pages only a Super Administrator may use', () => {
        const adminPaths = paths(ROLES.ADMIN);
        for (const page of SUPER_ADMIN_PAGES) expect(adminPaths).not.toContain(page);
        expect(adminPaths).toContain('/dashboard/admin/campaigns');
    });

    it('offers a Super Administrator every network page, including governance', () => {
        const superAdminPaths = paths(ROLES.SUPERADMIN);
        for (const page of SUPER_ADMIN_PAGES) expect(superAdminPaths).toContain(page);
        for (const page of paths(ROLES.ADMIN)) expect(superAdminPaths).toContain(page);
    });

    it('offers Creative Approvals to the Super Administrator and the Retailer Administrator only (ADR 0007)', () => {
        for (const role of [ROLES.SUPERADMIN, ROLES.RETAILERADMIN]) {
            expect(paths(role)).toContain('/dashboard/creative-approvals');
        }
        for (const role of [ROLES.ADMIN, ROLES.BRAND, ROLES.TECHOPERATOR]) {
            expect(paths(role)).not.toContain('/dashboard/creative-approvals');
        }
    });

    it('offers the delivery report to every role that holds a report grant, and not to a Technical Operator', () => {
        for (const role of [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.BRAND, ROLES.RETAILERADMIN]) {
            expect(paths(role)).toContain('/dashboard/delivery-report');
        }
        expect(paths(ROLES.TECHOPERATOR)).not.toContain('/dashboard/delivery-report');
    });
});
