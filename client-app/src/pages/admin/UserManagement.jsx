import React, { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import apiService from '../../services/ApiService';

const ROLES = [
    { value: 'super_admin', label: 'Super Admin', color: 'text-purple-500', icon: 'shield_person' },
    { value: 'content_manager', label: 'Content Manager', color: 'text-blue-500', icon: 'edit_note' },
    { value: 'tech_operator', label: 'Tech Operator', color: 'text-amber-500', icon: 'engineering' },
    { value: 'retailer_admin', label: 'Retailer Admin', color: 'text-emerald-500', icon: 'storefront' },
    { value: 'advertiser', label: 'Advertiser', color: 'text-rose-500', icon: 'campaign' }
];

function UserManagement() {
    const [users, setUsers] = useState([]);
    const [retailers, setRetailers] = useState([]);
    const [advertisers, setAdvertisers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'advertiser',
        retailer_id: '',
        advertiser_id: ''
    });
    const [filterRole, setFilterRole] = useState('all');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [allUsers, allRetailers, allAdvertisers] = await Promise.all([
                apiService.getUsers(),
                apiService.getRetailers(),
                apiService.getAdvertisers()
            ]);
            setUsers(allUsers);
            setRetailers(allRetailers);
            setAdvertisers(allAdvertisers);
        } catch (error) {
            console.error('Failed to load user management data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await apiService.updateUser(editingUser.id, formData);
            } else {
                await apiService.createUser({
                    ...formData,
                    status: 'active'
                });
            }
            await loadData();
            closeModal();
        } catch (error) {
            console.error('Failed to save user:', error);
        }
    };

    const openModal = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                name: user.name,
                email: user.email,
                role: user.role,
                retailer_id: user.retailer_id || '',
                advertiser_id: user.advertiser_id || ''
            });
        } else {
            setEditingUser(null);
            setFormData({
                name: '',
                email: '',
                role: 'advertiser',
                retailer_id: '',
                advertiser_id: ''
            });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingUser(null);
    };

    const toggleUserStatus = async (userId) => {
        const user = users.find(u => u.id === userId);
        if (user) {
            try {
                await apiService.updateUser(userId, {
                    status: user.status === 'active' ? 'inactive' : 'active'
                });
                await loadData();
            } catch (error) {
                console.error('Failed to toggle user status:', error);
            }
        }
    };

    const getRoleInfo = (roleName) => ROLES.find(r => r.value === roleName) || ROLES[4];

    const filteredUsers = filterRole === 'all'
        ? users
        : users.filter(u => u.role === filterRole);

    const columns = [
        {
            header: 'User',
            render: (user) => (
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                    </div>
                </div>
            )
        },
        {
            header: 'Role',
            render: (user) => {
                const role = getRoleInfo(user.role);
                return (
                    <div className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-lg ${role.color}`}>{role.icon}</span>
                        <span className="text-sm font-medium">{role.label}</span>
                    </div>
                );
            }
        },
        {
            header: 'Organization',
            render: (user) => {
                if (user.retailer_id) {
                    const retailer = retailers.find(r => r.id === user.retailer_id);
                    return retailer ? (
                        <span className="text-sm">{retailer.logo} {retailer.name}</span>
                    ) : '-';
                }
                if (user.advertiser_id) {
                    const advertiser = advertisers.find(a => a.id === user.advertiser_id);
                    return advertiser ? (
                        <span className="text-sm">{advertiser.logo} {advertiser.name}</span>
                    ) : '-';
                }
                return <span className="text-slate-400">Softomedia</span>;
            }
        },
        {
            header: 'Status',
            render: (user) => (
                <StatusBadge status={user.status === 'active' ? 'Active' : 'Inactive'} />
            )
        },
        {
            header: 'Actions',
            className: 'text-right',
            render: (user) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => openModal(user)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                        onClick={() => toggleUserStatus(user.id)}
                        className={`p-1.5 rounded-lg transition-colors ${user.status === 'active'
                            ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                            : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                            }`}
                        title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                    >
                        <span className="material-symbols-outlined text-lg">
                            {user.status === 'active' ? 'person_off' : 'person_check'}
                        </span>
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        User Management
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Create and manage platform user accounts
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    Add User
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {ROLES.map(role => {
                    const count = users.filter(u => u.role === role.value).length;
                    return (
                        <GlassCard
                            key={role.value}
                            className={`cursor-pointer transition-all ${filterRole === role.value ? 'ring-2 ring-primary' : ''}`}
                            onClick={() => setFilterRole(filterRole === role.value ? 'all' : role.value)}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`material-symbols-outlined text-lg ${role.color}`}>{role.icon}</span>
                                <span className="text-xs text-slate-500">{role.label}s</span>
                            </div>
                            <p className="text-2xl font-bold">{count}</p>
                        </GlassCard>
                    );
                })}
            </div>

            {/* Filter indicator */}
            {filterRole !== 'all' && (
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">Filtering by:</span>
                    <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                        {getRoleInfo(filterRole).label}
                    </span>
                    <button
                        onClick={() => setFilterRole('all')}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>
            )}

            {/* Users Table */}
            <DataTable columns={columns} data={filteredUsers} />

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <GlassCard className="w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {editingUser ? 'Edit User' : 'Add New User'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="John Doe"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="john@example.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                >
                                    {ROLES.map(role => (
                                        <option key={role.value} value={role.value}>{role.label}</option>
                                    ))}
                                </select>
                            </div>

                            {formData.role === 'retailer_admin' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Assign to Retailer</label>
                                    <select
                                        value={formData.retailer_id}
                                        onChange={(e) => setFormData({ ...formData, retailer_id: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="">Select Retailer...</option>
                                        {retailers.map(r => (
                                            <option key={r.id} value={r.id}>{r.logo} {r.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {formData.role === 'advertiser' && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Assign to Advertiser</label>
                                    <select
                                        value={formData.advertiser_id}
                                        onChange={(e) => setFormData({ ...formData, advertiser_id: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    >
                                        <option value="">Select Advertiser...</option>
                                        {advertisers.map(a => (
                                            <option key={a.id} value={a.id}>{a.logo} {a.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover shadow-lg shadow-primary/20"
                                >
                                    {editingUser ? 'Save Changes' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </GlassCard>
                </div>
            )}
        </div>
    );
}

export default UserManagement;
