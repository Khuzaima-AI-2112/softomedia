/**
 * Admin Dashboard Mocks
 * Aligned with api/admin/overview schema
 */
export const mockAdminStats = {
    retailers: 4,
    advertisers: 3,
    activeScreens: 12,
    totalScreens: 15,
    pendingLoops: 2,
    totalUsers: 8
};

export const mockQuickActions = [
    { label: 'CPM Pricing', path: '/dashboard/admin/pricing' },
    { label: 'Users', path: '/dashboard/admin/users' }
];
