import React, { useState, useEffect } from 'react';
import { usersAPI } from '../../services/api.js';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import SlideDrawer from '../../components/SlideDrawer';
import '../../design-tokens.css';
import { Trash2 } from 'lucide-react';

import useUsersStore from '../../stores/useUsersStore.js';

/**
 * UserManagement - State 17: User Management Tables (Admin CRM)
 * Manage retailers, brands, and admins with invite flow
 */
function UserManagement() {
    const [activeTab, setActiveTab] = useState('retailers'); // 'retailers', 'brands', 'admins'

    // Add back form state
    const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
    const [inviteForm, setInviteForm] = useState({
        name: '',
        email: '',
        role: 'retailer',
        businessName: '',
        linked_entity_id: ''
    });

    const { users, fetchUsers, createUser, deleteUser } = useUsersStore();

    useEffect(() => {
        fetchUsers(activeTab);
    }, [activeTab, fetchUsers]);

    const handleDelete = async (userId, userEmail) => {
        if (window.confirm(`Are you sure you want to delete user ${userEmail}?`)) {
            await deleteUser(userId);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();

        try {
            await createUser({
                email: inviteForm.email,
                role: inviteForm.role,
                name: inviteForm.name,
                linked_entity_id: inviteForm.linked_entity_id || null
            });

            alert(`User created: ${inviteForm.email}`);

            // Reset form and close drawer
            setInviteForm({ name: '', email: '', role: 'retailer', businessName: '', linked_entity_id: '' });
            setInviteDrawerOpen(false);
        } catch (error) {
            console.error('Creation failed:', error);
            alert('Failed to create user: ' + error.message);
        }
    };


    const getInviteButtonText = () => {
        return activeTab === 'retailers' ? 'Invite New Retailer' :
            activeTab === 'brands' ? 'Invite New Brand' :
                'Add New Admin';
    };

    const getTableColumns = () => {
        if (activeTab === 'retailers') {
            return ['Business Name', 'Contact Person', 'Email', 'Screens Deployed', 'Status'];
        } else if (activeTab === 'brands') {
            return ['Company Name', 'Contact Person', 'Email', 'Active Campaigns', 'Status'];
        } else {
            return ['Name', 'Email', 'Role', 'Status'];
        }
    };

    return (
        <div className="dashboard-ui" style={{ padding: 'var(--space-6)' }}>
            <GlassCard>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-6)' }}>
                    <div>
                        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--font-bold)', marginBottom: 'var(--space-2)' }}>
                            User Management
                        </h1>
                        <p style={{ color: 'var(--color-text-secondary)' }}>
                            Manage network users and send invitations
                        </p>
                    </div>
                    <button
                        onClick={() => setInviteDrawerOpen(true)}
                        style={{
                            padding: 'var(--space-3) var(--space-6)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-semibold)',
                            color: 'white',
                            backgroundColor: 'var(--color-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            transition: 'all var(--transition-base)',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        + {getInviteButtonText()}
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ borderBottom: '2px solid var(--color-border)', marginBottom: 'var(--space-6)', display: 'flex', gap: 'var(--space-4)' }}>
                    {['retailers', 'brands', 'admins'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: 'var(--space-3) var(--space-4)',
                                fontSize: 'var(--text-base)',
                                fontWeight: activeTab === tab ? 'var(--font-semibold)' : 'var(--font-medium)',
                                color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                                backgroundColor: 'transparent',
                                border: 'none',
                                borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
                                marginBottom: '-2px',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                                transition: 'all var(--transition-fast)',
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                                {getTableColumns().map(col => (
                                    <th key={col} style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                                        {col}
                                    </th>
                                ))}
                                <th style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)' }}>
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr
                                    key={user.id}
                                    style={{ borderBottom: '1px solid var(--color-border-light)', transition: 'background-color var(--transition-fast)' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    <td style={{ padding: 'var(--space-3)', fontWeight: 'var(--font-medium)' }}>
                                        {user.businessName}
                                    </td>
                                    <td style={{ padding: 'var(--space-3)' }}>
                                        {user.name}
                                    </td>
                                    <td style={{ padding: 'var(--space-3)', color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
                                        {user.email}
                                    </td>
                                    <td style={{ padding: 'var(--space-3)' }}>
                                        {activeTab === 'retailers' ? user.screensDeployed :
                                            activeTab === 'brands' ? user.activeCampaigns :
                                                user.role}
                                    </td>
                                    <td style={{ padding: 'var(--space-3)' }}>
                                        <StatusBadge status={user.status} />
                                    </td>
                                    <td style={{ padding: 'var(--space-3)' }}>
                                        <button
                                            onClick={() => alert(`View details for ${user.name}`)}
                                            style={{
                                                padding: 'var(--space-2) var(--space-3)',
                                                fontSize: 'var(--text-xs)',
                                                color: 'var(--color-primary)',
                                                backgroundColor: 'transparent',
                                                border: '1px solid var(--color-primary)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                transition: 'all var(--transition-fast)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'var(--color-primary)';
                                                e.currentTarget.style.color = 'white';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = 'var(--color-primary)';
                                            }}
                                        >
                                            View
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user.id, user.email)}
                                            style={{
                                                padding: 'var(--space-2) var(--space-3)',
                                                marginLeft: 'var(--space-2)',
                                                fontSize: 'var(--text-xs)',
                                                color: 'var(--color-danger, #ef4444)',
                                                backgroundColor: 'transparent',
                                                border: '1px solid var(--color-danger, #ef4444)',
                                                borderRadius: 'var(--radius-md)',
                                                cursor: 'pointer',
                                                transition: 'all var(--transition-fast)',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'var(--color-danger, #ef4444)';
                                                e.currentTarget.style.color = 'white';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.color = 'var(--color-danger, #ef4444)';
                                            }}
                                            title="Delete User"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                                        No users found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            {/* Invite Drawer */}
            <SlideDrawer
                isOpen={inviteDrawerOpen}
                onClose={() => setInviteDrawerOpen(false)}
                title={getInviteButtonText()}
                width="500px"
            >
                <form onSubmit={handleInvite}>
                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>
                            Contact Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={inviteForm.name}
                            onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                            placeholder="John Smith"
                            style={{
                                width: '100%',
                                padding: 'var(--space-3)',
                                fontSize: 'var(--text-base)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                outline: 'none',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                        />
                    </div>

                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>
                            Email *
                        </label>
                        <input
                            type="email"
                            required
                            value={inviteForm.email}
                            onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                            placeholder="john@business.com"
                            style={{
                                width: '100%',
                                padding: 'var(--space-3)',
                                fontSize: 'var(--text-base)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                outline: 'none',
                            }}
                            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                        />
                    </div>

                    <div style={{ marginBottom: 'var(--space-6)' }}>
                        <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>
                            Role *
                        </label>
                        <select
                            value={inviteForm.role}
                            onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                            style={{
                                width: '100%', padding: 'var(--space-3)',
                                fontSize: 'var(--text-base)', border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)', outline: 'none', marginBottom: 'var(--space-4)'
                            }}
                        >
                            <option value="retailer">Retailer</option>
                            <option value="brand">Brand</option>
                            <option value="advertiser">Advertiser</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    {inviteForm.role === 'advertiser' && (
                        <div style={{ marginBottom: 'var(--space-6)' }}>
                            <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--font-medium)', marginBottom: 'var(--space-2)' }}>
                                Assign to Advertiser (Entity ID) *
                            </label>
                            <input
                                type="text"
                                required
                                value={inviteForm.linked_entity_id}
                                onChange={(e) => setInviteForm({ ...inviteForm, linked_entity_id: e.target.value })}
                                placeholder="Entity ID"
                                style={{
                                    width: '100%', padding: 'var(--space-3)',
                                    fontSize: 'var(--text-base)', border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-md)', outline: 'none'
                                }}
                            />
                            {inviteForm.role === 'advertiser' && !inviteForm.linked_entity_id && (
                                <p style={{ color: 'red', fontSize: '12px', marginTop: '4px' }}>Role = 'advertiser' requires linked entity id (FK)</p>
                            )}
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                        <button
                            type="button"
                            onClick={() => setInviteDrawerOpen(false)}
                            style={{
                                padding: 'var(--space-3) var(--space-6)',
                                fontSize: 'var(--text-base)',
                                fontWeight: 'var(--font-medium)',
                                color: 'var(--color-text-secondary)',
                                backgroundColor: 'transparent',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={inviteForm.role === 'advertiser' && !inviteForm.linked_entity_id}
                            style={{
                                padding: 'var(--space-3) var(--space-8)',
                                fontSize: 'var(--text-base)',
                                fontWeight: 'var(--font-semibold)',
                                color: 'white',
                                backgroundColor: (inviteForm.role === 'advertiser' && !inviteForm.linked_entity_id) ? '#ccc' : 'var(--color-primary)',
                                border: 'none',
                                borderRadius: 'var(--radius-md)',
                                cursor: (inviteForm.role === 'advertiser' && !inviteForm.linked_entity_id) ? 'not-allowed' : 'pointer',
                                transition: 'all var(--transition-base)',
                            }}
                            onMouseEnter={(e) => {
                                if (inviteForm.role === 'advertiser' && !inviteForm.linked_entity_id) return;
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                            }}
                            onMouseLeave={(e) => {
                                if (inviteForm.role === 'advertiser' && !inviteForm.linked_entity_id) return;
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            Create User
                        </button>
                    </div>
                </form>
            </SlideDrawer>
        </div>
    );
}

export default UserManagement;
