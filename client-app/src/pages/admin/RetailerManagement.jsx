import { useState, useEffect, useCallback, useMemo } from 'react';
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

/** Returns an object of field-level error strings. Empty object = valid. */
function validateStoreForm(data) {
    const errors = {};
    const name = data.name.trim();
    const address = data.address.trim();
    const city = data.city.trim();

    if (!name) {
        errors.name = 'Store name is required.';
    } else if (name.length < 3) {
        errors.name = 'Store name must be at least 3 characters.';
    } else if (name.length > 80) {
        errors.name = 'Store name must be 80 characters or fewer.';
    }

    if (!address) {
        errors.address = 'Address is required.';
    } else if (address.length < 5) {
        errors.address = 'Address must be at least 5 characters.';
    } else if (address.length > 120) {
        errors.address = 'Address must be 120 characters or fewer.';
    }

    if (!city) {
        errors.city = 'City is required.';
    } else if (!/^[A-Za-z\s\-']+$/.test(city)) {
        errors.city = 'City must contain only letters, spaces, or hyphens.';
    } else if (city.length > 60) {
        errors.city = 'City must be 60 characters or fewer.';
    }

    return errors;
}

/** Validation for retailer modal. Mirrors store pattern. */
function validateRetailerForm(data) {
    const errors = {};
    const name = data.name.trim();
    const email = data.contact_email.trim();

    if (!name) {
        errors.name = 'Company name is required.';
    } else if (name.length < 3) {
        errors.name = 'Company name must be at least 3 characters.';
    } else if (name.length > 100) {
        errors.name = 'Company name must be 100 characters or fewer.';
    }

    if (!email) {
        errors.contact_email = 'Contact email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.contact_email = 'Enter a valid email address.';
    }

    if (!data.contract_start) {
        errors.contract_start = 'Contract start date is required.';
    }

    return errors;
}

function FieldError({ message }) {
    if (!message) return null;
    return <p className="mt-1 text-xs text-red-500 dark:text-red-400">{message}</p>;
}

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
    const [retailerFieldErrors, setRetailerFieldErrors] = useState({});
    const [retailerSubmitAttempted, setRetailerSubmitAttempted] = useState(false);
    const [retailerSubmitting, setRetailerSubmitting] = useState(false);

    // Store modal
    const [showStoreModal, setShowStoreModal] = useState(false);
    const [editingStore, setEditingStore] = useState(null);
    const [storeParentRetailer, setStoreParentRetailer] = useState(null);
    const [storeFormData, setStoreFormData] = useState(EMPTY_STORE_FORM);
    const [storeModalError, setStoreModalError] = useState('');
    const [storeFieldErrors, setStoreFieldErrors] = useState({});
    const [storeSubmitting, setStoreSubmitting] = useState(false);
    const [storeSubmitAttempted, setStoreSubmitAttempted] = useState(false);

    // Filters / sorting / selection
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all | active | inactive
    const [sortBy, setSortBy] = useState('name'); // name | stores | screens | contract
    const [sortDirection, setSortDirection] = useState('asc'); // asc | desc

    const [selectedRetailer, setSelectedRetailer] = useState(null);
    const [pageError, setPageError] = useState('');
    const [togglingIds, setTogglingIds] = useState(new Set());
    const [deletingStoreIds, setDeletingStoreIds] = useState(new Set());
    const [bulkBusy, setBulkBusy] = useState(false);

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

    // ── Retailer CRUD ───────────────────────────────────────────────

    const updateRetailerField = (field, value) => {
        const updated = { ...formData, [field]: value };
        setFormData(updated);
        if (retailerSubmitAttempted) {
            setRetailerFieldErrors(validateRetailerForm(updated));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setRetailerSubmitAttempted(true);
        setModalError('');
        const errors = validateRetailerForm(formData);
        setRetailerFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;

        setRetailerSubmitting(true);
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
        } finally {
            setRetailerSubmitting(false);
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
        setRetailerFieldErrors({});
        setRetailerSubmitAttempted(false);
        setRetailerSubmitting(false);
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

    const closeModal = () => {
        setShowModal(false);
        setEditingRetailer(null);
        setModalError('');
        setRetailerFieldErrors({});
        setRetailerSubmitAttempted(false);
        setRetailerSubmitting(false);
    };

    // ── Store CRUD ────────────────────────────────────────────────────

    const openStoreModal = (retailer, store = null) => {
        setStoreModalError('');
        setStoreFieldErrors({});
        setStoreSubmitAttempted(false);
        setStoreSubmitting(false);
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
        setStoreFieldErrors({});
        setStoreSubmitAttempted(false);
        setStoreSubmitting(false);
    };

    /** Update a single store form field; re-run validation live once user has attempted submit */
    const updateStoreField = (field, value) => {
        const updated = { ...storeFormData, [field]: value };
        setStoreFormData(updated);
        if (storeSubmitAttempted) {
            setStoreFieldErrors(validateStoreForm(updated));
        }
    };

    const handleStoreSubmit = async (e) => {
        e.preventDefault();
        setStoreSubmitAttempted(true);
        const errors = validateStoreForm(storeFormData);
        setStoreFieldErrors(errors);
        if (Object.keys(errors).length > 0) return;  // block submit — show inline errors

        setStoreSubmitting(true);
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
        } finally {
            setStoreSubmitting(false);
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

    // ── Derived helpers ──────────────────────────────────────────────

    const getRetailerStores = (retailerId) => stores.filter(s => s.retailer_id === retailerId);
    const getRetailerScreens = (retailerId) => screens.filter(s => s.retailer_id === retailerId);
    const getOnlineScreens = (retailerId) => getRetailerScreens(retailerId).filter(s => s.status === 'online');

    const totalStores = stores.length;
    const totalScreens = screens.length;
    const onlineScreens = screens.filter(s => s.status === 'online').length;

    const storeFormHasErrors = storeSubmitAttempted && Object.keys(storeFieldErrors).length > 0;
    const retailerFormHasErrors = retailerSubmitAttempted && Object.keys(retailerFieldErrors).length > 0;

    // Filter + sort retailers for table
    const filteredAndSortedRetailers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();

        let result = retailers.filter((r) => {
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (!term) return true;
            const haystack = `${r.name} ${r.contact_email}`.toLowerCase();
            return haystack.includes(term);
        });

        result = result.slice().sort((a, b) => {
            const storesA = getRetailerStores(a.id).length;
            const storesB = getRetailerStores(b.id).length;
            const screensA = getRetailerScreens(a.id).length;
            const screensB = getRetailerScreens(b.id).length;

            let cmp = 0;
            switch (sortBy) {
                case 'stores':
                    cmp = storesA - storesB;
                    break;
                case 'screens':
                    cmp = screensA - screensB;
                    break;
                case 'contract':
                    cmp = new Date(a.contract_start) - new Date(b.contract_start);
                    break;
                case 'name':
                default:
                    cmp = a.name.localeCompare(b.name);
            }
            return sortDirection === 'asc' ? cmp : -cmp;
        });

        return result;
    }, [retailers, searchTerm, statusFilter, sortBy, sortDirection, stores, screens]);

    // Bulk: deactivate all retailers with zero stores
    const handleBulkDeactivateEmpty = async () => {
        const targets = retailers.filter((r) => getRetailerStores(r.id).length === 0 && r.status === 'active');
        if (!targets.length) {
            addToast('No active retailers without stores.', 'warning');
            return;
        }
        if (!window.confirm(`Deactivate ${targets.length} retailer(s) with no stores?`)) return;

        setBulkBusy(true);
        try {
            await Promise.all(
                targets.map((r) => apiService.patchRetailer(r.id, { status: 'inactive' }))
            );
            await loadData();
            addToast(`${targets.length} retailer(s) deactivated.`, 'success');
        } catch (error) {
            console.error('Bulk deactivate failed:', error);
            addToast('Failed to deactivate some retailers. Please try again.', 'error');
        } finally {
            setBulkBusy(false);
        }
    };

    // ── Table columns ────────────────────────────────────────────────

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
                        className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${retailer.status === 'active'
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

    // helper: input border class
    const inputClass = (fieldError) =>
        `w-full px-3 py-2 rounded-lg border ${fieldError
            ? 'border-red-400 dark:border-red-500 focus:ring-red-400'
            : 'border-slate-300 dark:border-slate-600 focus:ring-primary'
        } bg-white dark:bg-slate-800 focus:ring-2 outline-none transition-colors`;

    const sortButtonClass = (key) =>
        `inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${sortBy === key
            ? 'border-primary text-primary bg-primary/5'
            : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`;

    const sortIcon = (key) => {
        if (sortBy !== key) return 'unfold_more';
        return sortDirection === 'asc' ? 'expand_less' : 'expand_more';
    };

    const toggleSort = (key) => {
        if (sortBy === key) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(key);
            setSortDirection('asc');
        }
    };

    // ── Render ────────────────────────────────────────────────────────

    return (
        <div data-testid="admin-retailers" className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Retailer Management</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage retail partners and their store networks</p>
                </div>
                <div className="flex flex-col md:flex-row gap-3 md:items-center">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search retailers..."
                                className="pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary outline-none w-52"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-600 dark:text-slate-300"
                        >
                            <option value="all">All statuses</option>
                            <option value="active">Active only</option>
                            <option value="inactive">Inactive only</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleBulkDeactivateEmpty}
                            disabled={bulkBusy}
                            className="px-3 py-1.5 text-xs rounded-lg border border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 dark:border-amber-500 dark:text-amber-300 dark:bg-amber-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                            {bulkBusy && (
                                <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
                            )}
                            Deactivate empty
                        </button>
                        <button
                            data-testid="btn-add-retailer"
                            onClick={() => openModal()}
                            className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2 text-sm"
                        >
                            <span className="material-symbols-outlined text-[20px]">add_business</span>
                            Add Retailer
                        </button>
                    </div>
                </div>
            </div>

            {pageError && (
                <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{pageError}</div>
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

            {/* Sort controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    Showing {filteredAndSortedRetailers.length} of {retailers.length} retailers
                </p>
                <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Sort by:</span>
                    <button type="button" onClick={() => toggleSort('name')} className={sortButtonClass('name')}>
                        Name
                        <span className="material-symbols-outlined text-[16px]">{sortIcon('name')}</span>
                    </button>
                    <button type="button" onClick={() => toggleSort('stores')} className={sortButtonClass('stores')}>
                        Stores
                        <span className="material-symbols-outlined text-[16px]">{sortIcon('stores')}</span>
                    </button>
                    <button type="button" onClick={() => toggleSort('screens')} className={sortButtonClass('screens')}>
                        Screens
                        <span className="material-symbols-outlined text-[16px]">{sortIcon('screens')}</span>
                    </button>
                    <button type="button" onClick={() => toggleSort('contract')} className={sortButtonClass('contract')}>
                        Contract start
                        <span className="material-symbols-outlined text-[16px]">{sortIcon('contract')}</span>
                    </button>
                </div>
            </div>

            {/* Retailers Table */}
            <div data-testid="retailers-list">
                <DataTable
                    columns={columns}
                    data={filteredAndSortedRetailers}
                    loading={loading}
                    emptyMessage="No retailers match your filters"
                />
            </div>

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
                                data-testid="btn-add-store"
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
                        <div data-testid="stores-list" className="flex flex-col items-center justify-center py-12 text-center">
                            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-3">storefront</span>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">No stores yet</p>
                            <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">Add the first location for {selectedRetailer.name}.</p>
                            <button
                                data-testid="btn-add-store"
                                onClick={() => openStoreModal(selectedRetailer)}
                                className="px-4 py-2 text-sm bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors"
                            >
                                Add First Store
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="stores-list">
                            {getRetailerStores(selectedRetailer.id).map(store => {
                                const storeScreens = screens.filter(s => s.store_id === store.id);
                                const storeOnline = storeScreens.filter(s => s.status === 'online').length;
                                const isDeleting = deletingStoreIds.has(store.id);
                                return (
                                    <div key={store.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0 mr-2">
                                                <p className="font-semibold text-sm truncate">{store.name}</p>
                                                <p className="text-xs text-slate-500 truncate">{store.address}</p>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${store.traffic_level === 'high'
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
                    <GlassCard data-testid="modal-retailer-form" className="w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">{editingRetailer ? 'Edit Retailer' : 'Add New Retailer'}</h2>
                        {modalError && (
                            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{modalError}</div>
                        )}
                        <form onSubmit={handleSubmit} noValidate className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <label className="block text-sm font-medium mb-1">Icon</label>
                                    <select
                                        value={formData.logo}
                                        onChange={(e) => updateRetailerField('logo', e.target.value)}
                                        className="w-16 h-16 text-2xl text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                    >
                                        {['🏪', '🛒', '🥬', '⚡', '🏬', '🛍️', '🏢', '🏭'].map(emoji => (
                                            <option key={emoji} value={emoji}>{emoji}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium mb-1" htmlFor="retailer-name">Company Name</label>
                                    <input
                                        id="retailer-name"
                                        data-testid="input-retailer-name"
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => updateRetailerField('name', e.target.value)}
                                        className={inputClass(retailerFieldErrors.name)}
                                        placeholder="Acme Retail Corp"
                                        maxLength={100}
                                        aria-invalid={!!retailerFieldErrors.name}
                                    />
                                    <FieldError message={retailerFieldErrors.name} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" htmlFor="retailer-email">Contact Email</label>
                                <input
                                    id="retailer-email"
                                    type="email"
                                    value={formData.contact_email}
                                    onChange={(e) => updateRetailerField('contact_email', e.target.value)}
                                    data-testid="input-retailer-contact"
                                    className={inputClass(retailerFieldErrors.contact_email)}
                                    placeholder="admin@retailer.com"
                                    aria-invalid={!!retailerFieldErrors.contact_email}
                                />
                                <FieldError message={retailerFieldErrors.contact_email} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" htmlFor="retailer-contract">Contract Start Date</label>
                                <input
                                    id="retailer-contract"
                                    type="date"
                                    value={formData.contract_start}
                                    onChange={(e) => updateRetailerField('contract_start', e.target.value)}
                                    className={inputClass(retailerFieldErrors.contract_start)}
                                    aria-invalid={!!retailerFieldErrors.contract_start}
                                />
                                <FieldError message={retailerFieldErrors.contract_start} />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    disabled={retailerSubmitting}
                                    data-testid="btn-modal-close" className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    data-testid="btn-retailer-form-submit"
                                    disabled={retailerSubmitting || retailerFormHasErrors}
                                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {retailerSubmitting && (
                                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                    )}
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
                    <GlassCard data-testid="modal-store-form" className="w-full max-w-md">
                        <h2 className="text-xl font-bold mb-1">{editingStore ? 'Edit Store' : 'Add New Store'}</h2>
                        {storeParentRetailer && (
                            <p className="text-sm text-slate-500 mb-4 flex items-center gap-1">
                                <span>{storeParentRetailer.logo}</span>
                                <span>{storeParentRetailer.name}</span>
                            </p>
                        )}
                        {storeModalError && (
                            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{storeModalError}</div>
                        )}
                        <form onSubmit={handleStoreSubmit} noValidate className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1" htmlFor="store-name">Store Name</label>
                                <input
                                    id="store-name"
                                    type="text"
                                    data-testid="input-store-name"
                                    value={storeFormData.name}
                                    onChange={(e) => updateStoreField('name', e.target.value)}
                                    className={inputClass(storeFieldErrors.name)}
                                    placeholder="Downtown Flagship"
                                    maxLength={80}
                                    aria-invalid={!!storeFieldErrors.name}
                                />
                                <FieldError message={storeFieldErrors.name} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" htmlFor="store-address">Address</label>
                                <input
                                    id="store-address"
                                    type="text"
                                    data-testid="input-store-address"
                                    value={storeFormData.address}
                                    onChange={(e) => updateStoreField('address', e.target.value)}
                                    className={inputClass(storeFieldErrors.address)}
                                    placeholder="123 Main St"
                                    maxLength={120}
                                    aria-invalid={!!storeFieldErrors.address}
                                />
                                <FieldError message={storeFieldErrors.address} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" htmlFor="store-city">City</label>
                                <input
                                    id="store-city"
                                    type="text"
                                    data-testid="input-store-city"
                                    value={storeFormData.city}
                                    onChange={(e) => updateStoreField('city', e.target.value)}
                                    className={inputClass(storeFieldErrors.city)}
                                    placeholder="Montreal"
                                    maxLength={60}
                                    aria-invalid={!!storeFieldErrors.city}
                                />
                                <FieldError message={storeFieldErrors.city} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1" htmlFor="store-traffic">Traffic Level</label>
                                <select
                                    id="store-traffic"
                                    value={storeFormData.traffic_level}
                                    onChange={(e) => updateStoreField('traffic_level', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none capitalize"
                                >
                                    {TRAFFIC_OPTIONS.map(t => (
                                        <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={closeStoreModal}
                                    disabled={storeSubmitting}
                                    className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    data-testid="btn-store-form-submit"
                                    disabled={storeSubmitting || storeFormHasErrors}
                                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover shadow-lg shadow-primary/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                                >
                                    {storeSubmitting && (
                                        <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                                    )}
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
