import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import apiService from '../../services/ApiService';
import { useAuth } from '../../contexts/AuthContext';
import { Pencil } from 'lucide-react';
import { ROLES as ROLE_NAMES } from '../../constants/roles';

const ROLES = [
    { value: ROLE_NAMES.SUPERADMIN, label: 'Super Administrator', color: 'text-purple-500', icon: 'shield_person' },
    { value: ROLE_NAMES.ADMIN, label: 'Admin', color: 'text-blue-500', icon: 'edit_note' },
    { value: ROLE_NAMES.TECHOPERATOR, label: 'Technical Operator', color: 'text-amber-500', icon: 'engineering' },
    { value: ROLE_NAMES.RETAILERADMIN, label: 'Retailer Administrator', color: 'text-emerald-500', icon: 'storefront' },
    { value: ROLE_NAMES.BRAND, label: 'Brand', color: 'text-rose-500', icon: 'campaign' }
];

function UserManagement() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();

    // Phase 3: gate entire page behind superadmin.
    // Guard behind loading so we never redirect during the auth hydration
    // window when user is still null and isSuperAdmin would be a false negative.
    const isSuperAdmin = user?.role === ROLE_NAMES.SUPERADMIN;

    const [users, setUsers] = useState([]);
    const [retailers, setRetailers] = useState([]);
    const [advertisers, setAdvertisers] = useState([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '', email: '', role: ROLE_NAMES.BRAND, linkedentityid: ''
    });
    const [editingUserId, setEditingUserId] = useState(null);
    const [filterRole, setFilterRole] = useState('all');
    const [modalError, setModalError] = useState('');
    const [pageError, setPageError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        // Wait for auth to finish hydrating before making access decisions
        if (loading) return;
        if (!isSuperAdmin) {
            navigate('/dashboard/admin', { replace: true });
            return;
        }
        loadData();
    }, [loading, isSuperAdmin]);

    const loadData = async () => {
        try {
            setDataLoading(true);
            const [allUsers, allRetailers, allAdvertisers] = await Promise.all([
                apiService.getUsers(),
                apiService.getRetailers(),
                apiService.getAdvertisers()
            ]);
            setUsers(allUsers || []);
            setRetailers(allRetailers || []);
            setAdvertisers(allAdvertisers || []);
        } catch (err) {
            setPageError('Failed to load data. Please try again.');
            console.error('UserManagement loadData error:', err);
        } finally {
            setDataLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingUserId(null);
        setFormData({ name: '', email: '', role: ROLE_NAMES.BRAND, linkedentityid: '' });
        setModalError('');
        setShowModal(true);
    };

    const openEditModal = (u) => {
        setEditingUserId(u.id);
        setFormData({
            name: u.name || '',
            email: u.email || '',
            role: u.role || ROLE_NAMES.BRAND,
            linkedentityid: u.organization_id || u.linked_entity_id || u.linkedentityid || ''
        });
        setModalError('');
        setShowModal(true);
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setModalError('');
        try {
            if (editingUserId) {
                await apiService.updateUser(editingUserId, formData);
                setSuccessMessage('User updated successfully.');
            } else {
                await apiService.createUser(formData);
                setSuccessMessage('User created successfully.');
            }
            setShowModal(false);
            loadData();
        } catch (err) {
            setModalError(err?.message || 'An error occurred. Please try again.');
        }
    };

    const changeUserStatus = async (targetUser) => {
        const status = targetUser.status === 'inactive' ? 'active' : 'inactive';
        try {
            await apiService.updateUser(targetUser.id, { status });
            setSuccessMessage(`User ${status === 'inactive' ? 'deactivated' : 'reactivated'} successfully.`);
            loadData();
        } catch (err) {
            setPageError(err?.message || 'Failed to update user status.');
        }
    };

    const filteredUsers = filterRole === 'all'
        ? users
        : users.filter(u => u.role === filterRole);

    const linkedEntityOptions = () => {
        if (formData.role === ROLE_NAMES.RETAILERADMIN) return retailers;
        if (formData.role === ROLE_NAMES.BRAND) return advertisers;
        return [];
    };

    // NOTE: DataTable calls col.render(value, row) — the full row object is
    // always the SECOND argument. Use (_value, row) for columns that need
    // the whole row, or (value) for columns that only need the cell value.
    const columns = [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        {
            key: 'role',
            label: 'Role',
            render: (_value, row) => {
                const role = ROLES.find(r => r.value === row.role);
                return (
                    <span className={`font-medium ${role?.color || ''}`}>
                        {role?.label || row.role}
                    </span>
                );
            }
        },
        {
            key: 'status',
            label: 'Status',
            render: (_value, row) => <StatusBadge status={row.status || 'active'} />
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_value, row) => (
                <div className="flex gap-2">
                    <button
                        onClick={() => openEditModal(row)}
                        className="p-1 text-blue-400 hover:text-blue-300 transition-colors"
                        title="Edit user"
                    >
                        <Pencil size={16} />
                    </button>
                    <button
                        onClick={() => changeUserStatus(row)}
                        className="p-1 text-red-400 hover:text-red-300 transition-colors"
                        title={row.status === 'inactive' ? 'Reactivate user' : 'Deactivate user'}
                    >
                        {row.status === 'inactive' ? 'Reactivate' : 'Deactivate'}
                    </button>
                </div>
            )
        }
    ];

    // Still hydrating auth — render nothing to avoid redirect flash
    if (loading) return null;

    if (dataLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">User Management</h1>
                <button
                    data-testid="btn-add-user"
                    onClick={openCreateModal}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                >
                    + Add User
                </button>
            </div>

            {pageError && (
                <div className="p-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg">
                    {pageError}
                </div>
            )}
            {successMessage && (
                <div className="p-3 bg-green-900/40 border border-green-700 text-green-300 rounded-lg">
                    {successMessage}
                </div>
            )}

            {/* Role filter */}
            <div className="flex gap-2 flex-wrap">
                <button
                    onClick={() => setFilterRole('all')}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${filterRole === 'all'
                            ? 'bg-purple-600 text-white'
                            : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                >
                    All
                </button>
                {ROLES.map(r => (
                    <button
                        key={r.value}
                        onClick={() => setFilterRole(r.value)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${filterRole === r.value
                                ? 'bg-purple-600 text-white'
                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                            }`}
                    >
                        {r.label}
                    </button>
                ))}
            </div>

            <GlassCard data-testid="users-list">
                <DataTable columns={columns} data={filteredUsers} />
            </GlassCard>

            {/* Create / Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                    <div data-testid="modal-user-form" className="bg-gray-900 border border-white/10 rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h2 className="text-lg font-semibold text-white mb-4">
                            {editingUserId ? 'Edit User' : 'Create User'}
                        </h2>

                        {modalError && (
                            <div className="mb-3 p-2 bg-red-900/40 border border-red-700 text-red-300 rounded">
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Name</label>
                                <input
                                    name="name"
                                    data-testid="input-user-displayname"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Email</label>
                                <input
                                    name="email"
                                    data-testid="input-user-email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleFormChange}
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-gray-400 mb-1">Role</label>
                                <select
                                    name="role"
                                    data-testid="select-user-role"
                                    value={formData.role}
                                    onChange={handleFormChange}
                                    className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                                >
                                    {ROLES.map(r => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            {linkedEntityOptions().length > 0 && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-1">
                                        Linked {formData.role === 'retaileradmin' ? 'Retailer' : 'Advertiser'}
                                    </label>
                                    <select
                                        name="linkedentityid"
                                        data-testid="input-user-entity-id"
                                        value={formData.linkedentityid}
                                        onChange={handleFormChange}
                                        className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
                                    >
                                        <option value="">— None —</option>
                                        {linkedEntityOptions().map(e => (
                                            <option key={e.id} value={e.id}>{e.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="submit"
                                    data-testid="btn-user-form-submit"
                                    className="flex-1 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                                >
                                    {editingUserId ? 'Save Changes' : 'Create User'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 py-2 bg-white/10 hover:bg-white/20 text-gray-300 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UserManagement;
