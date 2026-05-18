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
    // Single string error replaces the list — matches the modal "Network error" banner pattern
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
            // Surface API / network errors as a single inline banner in the modal
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

    return (
        <GlassCard>
            <StatusBadge status={loading ? 'loading' : 'ready'} />
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">User Management</h2>
                <button
                    className="px-4 py-2 bg-blue-600 text-white rounded"
                    onClick={() => setShowModal(true)}
                >Add User</button>
            </div>

            {/* Page-level error banner */}
            {pageError && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    {pageError}
                </div>
            )}

            <div className="mb-4">
                <label className="mr-2">Filter by Role:</label>
                <select
                    className="border rounded px-2 py-1"
                    value={filterRole}
                    onChange={(e) => setFilterRole(e.target.value)}
                >
                    <option value="all">All Roles</option>
                    {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                            {r.label}
                        </option>
                    ))}
                </select>
            </div>
            <DataTable
                columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'role', label: 'Role', render: (role) => {
                        const roleObj = ROLES.find(r => r.value === role);
                        return roleObj ? roleObj.label : role;
                    }},
                    { key: 'linkedentityid', label: 'Linked Entity ID' },
                    { key: 'status', label: 'Status' },
                    { key: 'actions', label: 'Actions', render: (_, row) => (
                        <button
                            onClick={() => handleDelete(row.id)}
                            className="mr-2"
                        >
                            <Trash2 className="w-5 h-5 text-red-600" />
                        </button>
                    )}
                ]}
                data={filteredUsers}
            />
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-lg w-full max-w-md">
                        <h3 className="text-lg font-medium mb-4">Add / Edit User</h3>

                        {/* Inline error banner — single line, matches "Network error" pattern in screenshot */}
                        {modalError && (
                            <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-medium">
                                {modalError}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="mb-3">
                                <label className="block mb-1">Name</label>
                                <input
                                    type="text"
                                    className="w-full border rounded px-2 py-1"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="mb-3">
                                <label className="block mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full border rounded px-2 py-1"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="mb-3">
                                <label className="block mb-1">Role</label>
                                <select
                                    className="w-full border rounded px-2 py-1"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value, linkedentityid: '' })}
                                >
                                    {ROLES.map((r) => (
                                        <option key={r.value} value={r.value}>
                                            {r.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {(formData.role === 'advertiser' || formData.role === 'retaileradmin') && (
                                <div className="mb-3">
                                    <label className="block mb-1">Linked Entity ID</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded px-2 py-1"
                                        value={formData.linkedentityid}
                                        onChange={(e) => setFormData({ ...formData, linkedentityid: e.target.value })}
                                        required
                                    />
                                </div>
                            )}
                            <div className="flex justify-end space-x-2">
                                <button
                                    type="button"
                                    className="px-4 py-2 bg-gray-300 rounded"
                                    onClick={closeModal}
                                >Cancel</button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-green-600 text-white rounded"
                                >Save</button>
                            </div>
                            {successMessage && (
                                <p className="mt-2 text-green-600">{successMessage}</p>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </GlassCard>
    );
}

export default UserManagement;
