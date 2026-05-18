import { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import apiService from '../../services/ApiService';
import { Trash2 } from 'lucide-react';

const ROLES = [
    { value: 'superadmin', label: 'Super Admin', color: 'text-purple-500', icon: 'shield_person' },
    { value: 'contentmanager', label: 'Content Manager', color: 'text-blue-500', icon: 'edit_note' },
    { value: 'techoperator', label: 'Tech Operator', color: 'text-amber-500', icon: 'engineering' },
    { value: 'retaileradmin', label: 'Retailer Admin', color: 'text-emerald-500', icon: 'storefront' },
    { value: 'advertiser', label: 'Advertiser', color: 'text-rose-500', icon: 'campaign' }
];

function UserManagement() {
    const [users, setUsers] = useState([]);
    const [retailers, setRetailers] = useState([]);
    const [advertisers, setAdvertisers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'advertiser',
        linkedentityid: ''
    });
    const [filterRole, setFilterRole] = useState('all');
    const [modalError, setModalError] = useState('');
    const [pageError, setPageError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

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
        } catch (err) {
            console.error('Failed to load data', err);
            setPageError('Failed to load users. Please refresh.');
        } finally {
            setLoading(false);
        }
    };

    const validate = () => {
        const errs = [];
        if (!formData.name.trim()) errs.push('Name is required');
        if (!formData.email.trim()) {
            errs.push('Email is required');
        } else {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.email)) errs.push('Email must be a valid address');
        }
        if (formData.role === 'advertiser' || formData.role === 'retaileradmin') {
            if (!formData.linkedentityid.trim()) {
                errs.push('Linked entity ID is required for selected role');
            }
        }
        return errs;
    };

    const handleDelete = async (id) => {
        const confirmed = window.confirm('Are you sure you want to delete this user?');
        if (confirmed) {
            try {
                setPageError('');
                await apiService.deleteUser(id);
                setSuccessMessage('User deleted');
                await loadData();
            } catch (err) {
                setPageError(err.message || 'Failed to delete user');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setModalError('');
        const validationErrors = validate();
        if (validationErrors.length) {
            setModalError(validationErrors.join(' | '));
            return;
        }
        try {
            if (formData.editingUser) {
                await apiService.updateUser(formData.editingUser.id, formData);
            } else {
                await apiService.createUser({ ...formData, status: 'active' });
            }
            setSuccessMessage('User saved successfully');
            setFormData({ name: '', email: '', role: 'advertiser', linkedentityid: '' });
            await loadData();
            closeModal();
        } catch (err) {
            setModalError(err.message || 'Network error');
        }
    };

    const closeModal = () => {
        setShowModal(false);
        setModalError('');
        setFormData({ name: '', email: '', role: 'advertiser', linkedentityid: '' });
        setSuccessMessage('');
    };

    const filteredUsers = filterRole === 'all' ? users : users.filter(u => u.role === filterRole);

    // Columns use { key, label, render(value, row) } — compatible with updated DataTable
    const columns = [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        {
            key: 'role',
            label: 'Role',
            render: (value) => {
                const roleObj = ROLES.find(r => r.value === value);
                return roleObj
                    ? <span className={`font-medium ${roleObj.color}`}>{roleObj.label}</span>
                    : value ?? '';
            }
        },
        { key: 'linkedentityid', label: 'Linked Entity' },
        {
            key: 'status',
            label: 'Status',
            render: (value) => <StatusBadge status={value ? (value.charAt(0).toUpperCase() + value.slice(1)) : 'Unknown'} />
        },
        {
            key: 'id',
            label: 'Actions',
            render: (value) => (
                <button
                    onClick={() => handleDelete(value)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete user"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )
        }
    ];

    return (
        <GlassCard>
            <div className="flex items-center gap-3 mb-4">
                <StatusBadge status={loading ? 'Loading' : 'Ready'} />
            </div>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">User Management</h2>
                <button
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors"
                    onClick={() => setShowModal(true)}
                >Add User</button>
            </div>

            {pageError && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    {pageError}
                </div>
            )}

            <div className="mb-4">
                <label className="mr-2 text-sm font-medium text-slate-600 dark:text-slate-400">Filter by Role:</label>
                <select
                    className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-800"
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                >
                    <option value="all">All Roles</option>
                    {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                </select>
            </div>

            <DataTable
                columns={columns}
                data={filteredUsers}
                loading={loading}
                emptyMessage="No users found"
            />

            {showModal && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg w-full max-w-md">
                        <h3 className="text-lg font-semibold mb-4">Add / Edit User</h3>

                        {modalError && (
                            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium">
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Name</label>
                                <input
                                    type="text"
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Role</label>
                                <select
                                    className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value, linkedentityid: '' })}
                                >
                                    {ROLES.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>
                            {(formData.role === 'advertiser' || formData.role === 'retaileradmin') && (
                                <div>
                                    <label className="block text-sm font-medium mb-1">Linked Entity ID</label>
                                    <input
                                        type="text"
                                        className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                        value={formData.linkedentityid}
                                        onChange={(e) => setFormData({ ...formData, linkedentityid: e.target.value })}
                                        required
                                    />
                                </div>
                            )}
                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium"
                                    onClick={closeModal}
                                >Cancel</button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover shadow-lg shadow-primary/20"
                                >Save</button>
                            </div>
                            {successMessage && (
                                <p className="mt-2 text-emerald-600 text-sm">{successMessage}</p>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </GlassCard>
    );
}

export default UserManagement;
