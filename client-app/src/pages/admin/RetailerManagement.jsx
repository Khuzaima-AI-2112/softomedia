import { useState, useEffect, useCallback } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import apiService from '../../services/ApiService';
import { Trash2, Pencil } from 'lucide-react';
import { ToastContainer, useToasts } from '../../components/Toast';

const TRAFFIC_OPTIONS = ['low', 'medium', 'high'];

const EMPTY_STORE_FORM = {
    name: '',
    address: '',
    city: '',
    traffic_level: 'medium'
};

function RetailerManagement() {
    const [retailers, setRetailers] = useState([]);
    const [stores, setStores] = useState([]);
    const [screens, setScreens] = useState([]);
    const [loading, setLoading] = useState(true);

    // Retailer modal
    const [showModal, setShowModal] = useState(false);
    const [editingRetailer, setEditingRetailer] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        logo: '🏪',
        contact_email: '',
        contract_start: new Date().toISOString().split('T')[0]
    });
    const [modalError, setModalError] = useState('');

    // Store modal
    const [showStoreModal, setShowStoreModal] = useState(false);
    const [editingStore, setEditingStore] = useState(null);
    const [storeParentRetailer, setStoreParentRetailer] = useState(null);
    const [storeFormData, setStoreFormData] = useState(EMPTY_STORE_FORM);
    const [storeModalError, setStoreModalError] = useState('');

    const [selectedRetailer, setSelectedRetailer] = useState(null);
    const [pageError, setPageError] = useState('');
    const [togglingIds, setTogglingIds] = useState(new Set());
    const [deletingStoreIds, setDeletingStoreIds] = useState(new Set());

    const { toasts, addToast, removeToast } = useToasts();

    const loadData = useCallback(async () => {
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
            setPageError('');
        } catch (error) {
            console.error('Failed to load retailer management data:', error);
            setPageError('Failed to load data. Please refresh.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // ── Retailer CRUD ──────────────────────────────────────────────────

    const handleSubmit = async (e) => {
        e.preventDefault();
        setModalError('');
        try {
            if (editingRetailer) {
                await apiService.updateRetailer(editingRetailer.id, formData);
                addToast(`Retailer "${editingRetailer.name}" updated.`, 'success');
            } else {
                const created = await apiService.createRetailer({ ...formData, status: 'active' });
                addToast(`Retailer "${created?.name || formData.name}" created.`, 'success');
            }
            await loadData();
            closeModal();
        } catch (error) {
            console.error('Failed to save retailer:', error);
            setModalError(error?.data?.message || error.message || 'Failed to save retailer');
        }
    };

    const handleDelete = async (retailer) => {
        if (!retailer?.id) return;
        if (!window.confirm(`Are you sure you want to delete "${retailer.name}"? This action cannot be undone.`)) return;
        try {
            setPageError('');
            await apiService.deleteRetailer(retailer.id);
            setRetailers(prev => prev.filter(r => r.id !== retailer.id));
            if (selectedRetailer?.id === retailer.id) setSelectedRetailer(null);
            addToast(`Retailer "${retailer.name}" deleted.`, 'success');
        } catch (error) {
            console.error('Failed to delete retailer:', error);
            setPageError(error?.data?.message || error.message || 'Failed to delete retailer');
        }
    };

    const toggleStatus = async (retailer) => {
        const newStatus = retailer.status === 'active' ? 'inactive' : 'active';
        if (togglingIds.has(retailer.id)) return;
        setTogglingIds(prev => { const n = new Set(prev); n.add(retailer.id); return n; });
        try {
            setPageError('');
            const updated = await apiService.patchRetailer(retailer.id, { status: newStatus });
            setRetailers(prev => prev.map(r =>
                r.id === retailer.id ? { ...r, status: updated?.status || newStatus } : r
            ));
            addToast(`Retailer "${retailer.name}" is now ${newStatus}.`, 'success');
        } catch (error) {
            console.error('Failed to toggle retailer status:', error);
            setPageError(error?.data?.message || error.message || 'Failed to toggle retailer status');
        } finally {
            setTogglingIds(prev => { const n = new Set(prev); n.delete(retailer.id); return n; });
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
            setFormData({ name: '', logo: '🏪', contact_email: '', contract_start: new Date().toISOString().split('T')[0] });
        }
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setEditingRetailer(null); setModalError(''); };

    // ── Store CRUD ─────────────────────────────────────────────────────

    const openStoreModal = (retailer, store = null) => {
        setStoreModalError('');
        setStoreParentRetailer(retailer);
        if (store) {
            setEditingStore(store);
            setStoreFormData({
                name: store.name,
                address: store.address,
                city: store.city,
                traffic_level: store.traffic_level || 'medium'
            });
        } else {
            setEditingStore(null);
            setStoreFormData(EMPTY_STORE_FORM);
        }
        setShowStoreModal(true);
    };

    const closeStoreModal = () => {
        setShowStoreModal(false);
        setEditingStore(null);
        setStoreParentRetailer(null);
        setStoreModalError('');
    };

    const handleStoreSubmit = async (e) => {
        e.preventDefault();
        setStoreModalError('');
        try {
            if (editingStore) {
                await apiService.updateStore(editingStore.id, storeFormData);
                addToast(`Store "${storeFormData.name}" updated.`, 'success');
            } else {
                const payload = { ...storeFormData, retailer_id: storeParentRetailer.id };
                const created = await apiService.createStore(payload);
                addToast(`Store "${created?.name || storeFormData.name}" added to ${storeParentRetailer.name}.`, 'success');
            }
            await loadData();
            closeStoreModal();
        } catch (error) {
            console.error('Failed to save store:', error);
            setStoreModalError(error?.data?.message || error.message || 'Failed to save store');
        }
    };

    const handleStoreDelete = async (retailer, store) => {
        if (!store?.id) return;
        if (deletingStoreIds.has(store.id)) return;
        if (!window.confirm(`Delete store "${store.name}"? This cannot be undone.`)) return;
        setDeletingStoreIds(prev => { const n = new Set(prev); n.add(store.id); return n; });
        try {
            await apiService.deleteStore(store.id);
            setStores(prev => prev.filter(s => s.id !== store.id));
            addToast(`Store "${store.name}" deleted.`, 'success');
        } catch (error) {
            console.error('Failed to delete store:', error);
            addToast(error?.data?.message || error.message || `Failed to delete store "${store.name}".`, 'error');
        } finally {
            setDeletingStoreIds(prev => { const n = new Set(prev); n.delete(store.id); return n; });
        }
    };

    // ── Derived helpers ────────────────────────────────────────────────

    const getRetailerStores = (retailerId) => stores.filter(s => s.retailer_id === retailerId);
    const getRetailerScreens = (retailerId) => screens.filter(s => s.retailer_id === retailerId);
    const getOnlineScreens = (retailerId) => getRetailerScreens(retailerId).filter(s => s.status === 'online');

    const totalStores = stores.length;
    const totalScreens = screens.length;
    const onlineScreens = screens.filter(s => s.status === 'online').length;

    // ── Table columns ──────────────────────────────────────────────────

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
                        <p className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">{retailer.name}</p>
                        <p className="text-xs text-slate-500">{retailer.contact_email}</p>
                    </div>
                </div>
            )
        },
        {
            header: 'Stores',
            render: (retailer) => (
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-slate-400">storefront</span>
                    <span className="font-medium">{getRetailerStores(retailer.id).length}</span>
                </div>
            )
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
                    {new Date(retailer.contract_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
            )
        },
        {
            header: 'Status',
            render: (retailer) => <StatusBadge status={retailer.status === 'active' ? 'Active' : 'Inactive'} />
        },
        {
            header: 'Actions',
            className: 'text-right',
            render: (retailer) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => openModal(retailer)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        aria-label={`Edit retailer ${retailer.name}`}
                        title="Edit"
                    >
                        <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                        onClick={() => toggleStatus(retailer)}
                        disabled={togglingIds.has(retailer.id)}
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                            retailer.status === 'active'
                                ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                : 'text-slate-400 bg-slate-100 dark:bg-slate-800 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                        }`}
                        aria-label={retailer.status === 'active' ? `Deactivate ${retailer.name}` : `Activate ${retailer.name}`}
                        title={retailer.status === 'active' ? 'Deactivate' : 'Activate'}
                    >
                        <span className="material-symbols-outlined text-lg">
                            {togglingIds.has(retailer.id) ? 'progress_activity' : retailer.status === 'active' ? 'toggle_on' : 'toggle_off'}
                        </span>
                    </button>
                    <button
                        onClick={() => handleDelete(retailer)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        aria-label={`Delete retailer ${retailer.name}`}
                        title="Delete"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    // ── Render ─────────────────────────────────────────────────────────

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Retailer Management</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage retail partners and their store networks</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">add_business</span>
                    Add Retailer
                </button>
            </div>

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
                    <p className="text-xs text-emerald-500 mt-1">{retailers.filter(r => r.status === 'active').length} active</p>
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

            {/* Retailers Table */}
            <DataTable columns={columns} data={retailers} loading={loading} emptyMessage="No retailers found" />

            {/* Selected Retailer — Store Cards */}
            {selectedRetailer && (
                <GlassCard>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{selectedRetailer.logo}</span>
                            <div>
                                <h3 className="font-bold text-lg">{selectedRetailer.name} — Stores</h3>
                                <p className="text-sm text-slate-500">
                                    {getRetailerStores(selectedRetailer.id).length} location{getRetailerStores(selectedRetailer.id).length !== 1 ? 's' : ''}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => openStoreModal(selectedRetailer)}
                                className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors flex items-center gap-1.5"
                            >
                                <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
                                Add Store
                            </button>
                            <button
                                onClick={() => setSelectedRetailer(null)}
                                className="p-1 text-slate-400 hover:text-slate-600"
                                aria-label="Close store panel"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                    </div>

                    {getRetailerStores(selectedRetailer.id).length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-3">storefront</span>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">No stores yet</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">Add the first location for {selectedRetailer.name}.</p>
                            <button
                                onClick={() => openStoreModal(selectedRetailer)}
                                className="px-4 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors"
                            >
                                Add First Store
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {getRetailerStores(selectedRetailer.id).map(store => {
                                const storeScreens = screens.filter(s => s.store_id === store.id);
                                const storeOnline = storeScreens.filter(s => s.status === 'online').length;
                                const isDeleting = deletingStoreIds.has(store.id);
                                return (
                                    <div
                                        key={store.id}
                                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0 mr-2">
                                                <p className="font-semibold text-sm truncate">{store.name}</p>
                                                <p className="text-xs text-slate-500 truncate">{store.address}</p>
                                            </div>
                                            <div className="flex items-center gap-1 flex-shrink-0">
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

                                        <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                            <button
                                                onClick={() => openStoreModal(selectedRetailer, store)}
                                                className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                aria-label={`Edit store ${store.name}`}
                                                title="Edit store"
                                            >
                                                <Pencil className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleStoreDelete(selectedRetailer, store)}
                                                disabled={isDeleting}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                aria-label={`Delete store ${store.name}`}
                                                title="Delete store"
                                            >
                                                {isDeleting
                                                    ? <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                                                    : <Trash2 className="w-3.5 h-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </GlassCard>
            )}

            {/* Retailer Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <GlassCard className="w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{editingRetailer ? 'Edit Retailer' : 'Add New Retailer'}</h2>
                        {modalError && (
                            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{modalError}</div>
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
                                        type="text" required
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
                                    type="email" required
                                    value={formData.contact_email}
                                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="admin@retailer.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Contract Start Date</label>
                                <input
                                    type="date" required
                                    value={formData.contract_start}
                                    onChange={(e) => setFormData({ ...formData, contract_start: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={closeModal}
                                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium">
                                    Cancel
                                </button>
                                <button type="submit"
                                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover shadow-lg shadow-primary/20">
                                    {editingRetailer ? 'Save Changes' : 'Create Retailer'}
                                </button>
                            </div>
                        </form>
                    </GlassCard>
                </div>
            )}

            {/* Store Add/Edit Modal */}
            {showStoreModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <GlassCard className="w-full max-w-md">
                        <h2 className="text-xl font-bold mb-1">
                            {editingStore ? 'Edit Store' : 'Add New Store'}
                        </h2>
                        {storeParentRetailer && (
                            <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
                                <span>{storeParentRetailer.logo}</span>
                                <span>{storeParentRetailer.name}</span>
                            </p>
                        )}
                        {storeModalError && (
                            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{storeModalError}</div>
                        )}
                        <form onSubmit={handleStoreSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Store Name</label>
                                <input
                                    type="text" required
                                    value={storeFormData.name}
                                    onChange={(e) => setStoreFormData({ ...storeFormData, name: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Downtown Flagship"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Address</label>
                                <input
                                    type="text" required
                                    value={storeFormData.address}
                                    onChange={(e) => setStoreFormData({ ...storeFormData, address: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="123 Main St"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">City</label>
                                <input
                                    type="text" required
                                    value={storeFormData.city}
                                    onChange={(e) => setStoreFormData({ ...storeFormData, city: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Montreal"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Traffic Level</label>
                                <select
                                    value={storeFormData.traffic_level}
                                    onChange={(e) => setStoreFormData({ ...storeFormData, traffic_level: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none capitalize"
                                >
                                    {TRAFFIC_OPTIONS.map(t => (
                                        <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" onClick={closeStoreModal}
                                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium">
                                    Cancel
                                </button>
                                <button type="submit"
                                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover shadow-lg shadow-primary/20">
                                    {editingStore ? 'Save Changes' : 'Add Store'}
                                </button>
                            </div>
                        </form>
                    </GlassCard>
                </div>
            )}

            <ToastContainer toasts={toasts} onDismiss={removeToast} />
        </div>
    );
}

export default RetailerManagement;
