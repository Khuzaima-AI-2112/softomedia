import { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import apiService from '../../services/ApiService';
import { Trash2 } from 'lucide-react';

function RetailerManagement() {
    const [retailers, setRetailers] = useState([]);
    const [stores, setStores] = useState([]);
    const [screens, setScreens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRetailer, setEditingRetailer] = useState(null);
    const [selectedRetailer, setSelectedRetailer] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        logo: '🏪',
        contact_email: '',
        contract_start: new Date().toISOString().split('T')[0]
    });
    const [modalError, setModalError] = useState('');
    const [pageError, setPageError] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [allRetailers, allStores, allScreens] = await Promise.all([
                apiService.getRetailers(),
                apiService.getStores(),
                apiService.getScreens()
            ]);
            setRetailers(allRetailers);
            setStores(allStores);
            setScreens(allScreens);
        } catch (error) {
            console.error('Failed to load retailer management data:', error);
            setPageError('Failed to load data. Please refresh.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setModalError('');
        try {
            if (editingRetailer) {
                await apiService.updateRetailer(editingRetailer.id, formData);
            } else {
                await apiService.createRetailer({
                    ...formData,
                    status: 'active'
                });
            }
            await loadData();
            closeModal();
        } catch (error) {
            setModalError(error.message || 'Failed to save retailer');
        }
    };

    const handleDelete = async (retailer) => {
        if (!retailer?.id) return;
        const confirmed = window.confirm(`Are you sure you want to delete "${retailer.name}"? This action cannot be undone.`);
        if (!confirmed) return;
        try {
            setPageError('');
            await apiService.deleteRetailer(retailer.id);
            // Remove the row from the list immediately
            setRetailers(prev => prev.filter(r => r.id !== retailer.id));
            // Deselect if the deleted retailer was expanded
            if (selectedRetailer?.id === retailer.id) setSelectedRetailer(null);
        } catch (error) {
            setPageError(error.message || 'Failed to delete retailer');
        }
    };

    const toggleStatus = async (retailer) => {
        const newStatus = retailer.status === 'active' ? 'inactive' : 'active';
        try {
            setPageError('');
            await apiService.patchRetailer(retailer.id, { status: newStatus });
            setRetailers(prev => prev.map(r =>
                r.id === retailer.id ? { ...r, status: newStatus } : r
            ));
        } catch (error) {
            setPageError(error.message || 'Failed to toggle retailer status');
        }
    };

    const openModal = (retailer = null) => {
        setModalError('');
        if (retailer) {
            setEditingRetailer(retailer);
            setFormData({
                name: retailer.name,
                logo: retailer.logo,
                contact_email: retailer.contact_email,
                contract_start: retailer.contract_start
            });
        } else {
            setEditingRetailer(null);
            setFormData({
                name: '',
                logo: '🏪',
                contact_email: '',
                contract_start: new Date().toISOString().split('T')[0]
            });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingRetailer(null);
        setModalError('');
    };

    const getRetailerStores = (retailerId) => stores.filter(s => s.retailer_id === retailerId);
    const getRetailerScreens = (retailerId) => screens.filter(s => s.retailer_id === retailerId);
    const getOnlineScreens = (retailerId) => getRetailerScreens(retailerId).filter(s => s.status === 'online');

    const columns = [
        {
            header: 'Retailer',
            render: (retailer) => (
                <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => setSelectedRetailer(selectedRetailer?.id === retailer.id ? null : retailer)}
                >
                    <div className="size-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center text-2xl border border-slate-200 dark:border-slate-700">
                        {retailer.logo}
                    </div>
                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                            {retailer.name}
                        </p>
                        <p className="text-xs text-slate-500">{retailer.contact_email}</p>
                    </div>
                </div>
            )
        },
        {
            header: 'Stores',
            render: (retailer) => {
                const storeCount = getRetailerStores(retailer.id).length;
                return (
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">storefront</span>
                        <span className="font-medium">{storeCount}</span>
                    </div>
                );
            }
        },
        {
            header: 'Screens',
            render: (retailer) => {
                const total = getRetailerScreens(retailer.id).length;
                const online = getOnlineScreens(retailer.id).length;
                return (
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">tv</span>
                        <span className="font-medium">{online}</span>
                        <span className="text-slate-400">/ {total}</span>
                    </div>
                );
            }
        },
        {
            header: 'Contract Start',
            render: (retailer) => (
                <span className="text-sm text-slate-600 dark:text-slate-400">
                    {new Date(retailer.contract_start).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    })}
                </span>
            )
        },
        {
            header: 'Status',
            render: (retailer) => (
                <StatusBadge status={retailer.status === 'active' ? 'Active' : 'Inactive'} />
            )
        },
        {
            header: 'Actions',
            className: 'text-right',
            render: (retailer) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => openModal(retailer)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    {/* Status toggle — persistent colour reflects current state */}
                    <button
                        onClick={() => toggleStatus(retailer)}
                        className={`p-1.5 rounded-lg transition-colors ${
                            retailer.status === 'active'
                                ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                : 'text-slate-400 bg-slate-100 dark:bg-slate-800 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                        }`}
                        title={retailer.status === 'active' ? 'Deactivate' : 'Activate'}
                    >
                        <span className="material-symbols-outlined text-lg">
                            {retailer.status === 'active' ? 'toggle_on' : 'toggle_off'}
                        </span>
                    </button>
                    <button
                        onClick={() => handleDelete(retailer)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    const totalStores = stores.length;
    const totalScreens = screens.length;
    const onlineScreens = screens.filter(s => s.status === 'online').length;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Retailer Management
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Manage retail partners and their store networks
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">add_business</span>
                    Add Retailer
                </button>
            </div>

            {/* Page-level error */}
            {pageError && (
                <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    {pageError}
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="border-l-4 border-l-primary">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Retailers</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{retailers.length}</p>
                    <p className="text-xs text-emerald-500 mt-1">
                        {retailers.filter(r => r.status === 'active').length} active
                    </p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-amber-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Stores</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{totalStores}</p>
                    <p className="text-xs text-slate-400 mt-1">Across all retailers</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-emerald-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Screens Online</p>
                    <p className="text-3xl font-bold text-emerald-500">{onlineScreens}</p>
                    <p className="text-xs text-slate-400 mt-1">of {totalScreens} total</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-blue-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Network Health</p>
                    <p className="text-3xl font-bold text-blue-500">
                        {totalScreens > 0 ? Math.round((onlineScreens / totalScreens) * 100) : 0}%
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Uptime ratio</p>
                </GlassCard>
            </div>

            {/* Retailers Table — loading prop wired so spinner shows during initial fetch */}
            <DataTable columns={columns} data={retailers} loading={loading} emptyMessage="No retailers found" />

            {/* Selected Retailer Details */}
            {selectedRetailer && (
                <GlassCard>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{selectedRetailer.logo}</span>
                            <div>
                                <h3 className="font-bold text-lg">{selectedRetailer.name} - Stores</h3>
                                <p className="text-sm text-slate-500">{getRetailerStores(selectedRetailer.id).length} locations</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedRetailer(null)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {getRetailerStores(selectedRetailer.id).map(store => {
                            const storeScreens = screens.filter(s => s.store_id === store.id);
                            const storeOnline = storeScreens.filter(s => s.status === 'online').length;
                            return (
                                <div
                                    key={store.id}
                                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="font-semibold text-sm">{store.name}</p>
                                            <p className="text-xs text-slate-500">{store.address}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            store.traffic_level === 'high'
                                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                : store.traffic_level === 'low'
                                                    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                        }`}>
                                            {store.traffic_level} traffic
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs mt-3">
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm text-slate-400">tv</span>
                                            {storeOnline}/{storeScreens.length} screens
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-sm text-slate-400">location_on</span>
                                            {store.city}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </GlassCard>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <GlassCard className="w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {editingRetailer ? 'Edit Retailer' : 'Add New Retailer'}
                        </h2>
                        {modalError && (
                            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                                {modalError}
                            </div>
                        )}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <label className="block text-sm font-medium mb-1">Icon</label>
                                    <select
                                        value={formData.logo}
                                        onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                                        className="w-16 h-16 text-2xl text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                    >
                                        {['🏪', '🛒', '🥬', '⚡', '🏬', '🛍️', '🏢', '🏭'].map(emoji => (
                                            <option key={emoji} value={emoji}>{emoji}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium mb-1">Company Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                        placeholder="Acme Retail Corp"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Contact Email</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.contact_email}
                                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="admin@retailer.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Contract Start Date</label>
                                <input
                                    type="date"
                                    required
                                    value={formData.contract_start}
                                    onChange={(e) => setFormData({ ...formData, contract_start: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>

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
                                    {editingRetailer ? 'Save Changes' : 'Create Retailer'}
                                </button>
                            </div>
                        </form>
                    </GlassCard>
                </div>
            )}
        </div>
    );
}

export default RetailerManagement;
