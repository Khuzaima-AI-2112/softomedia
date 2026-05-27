import { useState, useEffect, useCallback } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import { ToastContainer, useToasts } from '../../components/Toast';
import apiService from '../../services/ApiService';

// Allowed screen statuses (matches backend enum).
const SCREEN_STATUS = Object.freeze({ ACTIVE: 'active', INACTIVE: 'inactive' });

// Error codes returned by the backend for campaign-aware rejections.
const ERR_STATUS_ACTIVE_CAMPAIGNS  = 'SCREEN_STATUS_CHANGE_REJECTED_ACTIVE_CAMPAIGNS';
const ERR_DELETE_ACTIVE_CAMPAIGNS  = 'SCREEN_DELETE_REJECTED_ACTIVE_CAMPAIGNS';

function ScreenManagement() {
    const [screens, setScreens] = useState([]);
    const [retailers, setRetailers] = useState([]);
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pageError, setPageError] = useState('');
    const [togglingIds, setTogglingIds] = useState(new Set());
    const [showAddModal, setShowAddModal] = useState(false);
    const [newScreen, setNewScreen] = useState({
        screen_id: '',
        resolution: '1920x1080',
        user_agent: 'Manual Admin Entry',
        retailer_id: '',
        store_id: '',
    });

    const { toasts, addToast, removeToast } = useToasts();

    const loadData = useCallback(async () => {
        setLoading(true);
        setPageError('');
        try {
            const [screensData, retailersData, storesData] = await Promise.all([
                apiService.getScreens(),
                apiService.getRetailers(),
                apiService.getStores(),
            ]);
            setScreens(screensData || []);
            setRetailers(retailersData || []);
            setStores(storesData || []);
        } catch (error) {
            console.error('Failed to load screen data:', error);
            setPageError('Failed to load screens. Please refresh.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    /**
     * Toggle a screen between active / inactive.
     *
     * Steps:
     *  1. Mark as toggling (disables button).
     *  2. Optimistically update local state.
     *  3. Call dedicated status endpoint.
     *  4a. Success  → show success toast, clear toggling flag.
     *  4b. Rejection (campaign conflict) → revert state, show specific error.
     *  4c. Other error → revert state, show generic error.
     */
    const handleToggleStatus = useCallback(async (screen) => {
        const nextStatus =
            screen.status === SCREEN_STATUS.ACTIVE
                ? SCREEN_STATUS.INACTIVE
                : SCREEN_STATUS.ACTIVE;

        // Prevent double-clicks.
        if (togglingIds.has(screen.id)) return;
        setTogglingIds(prev => new Set(prev).add(screen.id));

        // Optimistic update.
        setScreens(prev =>
            prev.map(s => s.id === screen.id ? { ...s, status: nextStatus } : s)
        );

        try {
            await apiService.updateScreenStatus(screen.id, nextStatus);
            addToast(
                `Screen "${screen.screen_id}" is now ${nextStatus}.`,
                'success'
            );
        } catch (error) {
            // Revert on any failure.
            setScreens(prev =>
                prev.map(s => s.id === screen.id ? { ...s, status: screen.status } : s)
            );

            const errorCode = error?.data?.error ?? error?.code ?? '';
            if (errorCode === ERR_STATUS_ACTIVE_CAMPAIGNS) {
                addToast(
                    `Cannot set "${screen.screen_id}" to inactive — it is part of active or upcoming campaigns. ` +
                    'Adjust those campaigns first.',
                    'error',
                    8000
                );
            } else {
                console.error('Screen status toggle failed:', error);
                addToast(
                    error?.data?.message || error?.message || 'Failed to update screen status.',
                    'error'
                );
            }
        } finally {
            setTogglingIds(prev => {
                const next = new Set(prev);
                next.delete(screen.id);
                return next;
            });
        }
    }, [togglingIds, addToast]);

    /**
     * Delete a screen.
     *
     * Steps:
     *  1. Confirmation dialog.
     *  2. Call DELETE /api/screens/:id.
     *  3a. Success  → remove row, show success toast.
     *  3b. Campaign conflict (409) → row stays, show admin-friendly error toast.
     *  3c. Other error → row stays, show generic error toast.
     */
    const handleDelete = useCallback(async (screen) => {
        if (!confirm(`Delete screen "${screen.screen_id}"? This action cannot be undone.`)) return;

        try {
            await apiService.deleteScreen(screen.id);
            setScreens(prev => prev.filter(s => s.id !== screen.id));
            addToast(`Screen "${screen.screen_id}" deleted.`, 'success');
        } catch (error) {
            const errorCode = error?.data?.error ?? error?.code ?? '';

            if (errorCode === ERR_DELETE_ACTIVE_CAMPAIGNS) {
                addToast(
                    `"${screen.screen_id}" can't be deleted — it's used by an active or upcoming campaign. End or reassign those campaigns first.`,
                    'error',
                    8000
                );
            } else {
                console.error('Failed to delete screen:', error);
                addToast(
                    error?.data?.message || error?.message || 'Failed to delete screen.',
                    'error'
                );
            }
        }
    }, [addToast]);

    const handleCreateScreen = useCallback(async (e) => {
        e.preventDefault();
        try {
            await apiService.createScreen(newScreen);
            setShowAddModal(false);
            setNewScreen({
                screen_id: '',
                resolution: '1920x1080',
                user_agent: 'Manual Admin Entry',
                retailer_id: '',
                store_id: '',
            });
            await loadData();
            addToast('Screen registered successfully.', 'success');
        } catch (error) {
            console.error('Failed to create screen:', error);
            setPageError(error?.data?.message || error?.message || 'Failed to register screen.');
        }
    }, [newScreen, loadData, addToast]);

    const getStoreName = useCallback((screen) => {
        const store = stores.find(s => s.id === screen.store_id);
        const retailer = retailers.find(r => r.id === screen.retailer_id);
        if (store) return `${store.name}${retailer ? ` — ${retailer.name}` : ''}`;
        return screen.location_id || 'Unassigned';
    }, [stores, retailers]);

    return (
        <>
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Screen Management
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400">
                            Provision and monitor physical display units
                        </p>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add_to_queue</span>
                        Add Screen
                    </button>
                </div>

                {pageError && (
                    <div
                        role="alert"
                        className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm"
                    >
                        {pageError}
                    </div>
                )}

                <GlassCard>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left" aria-label="Screens">
                            <thead>
                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                    <th className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Screen ID</th>
                                    <th className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Location</th>
                                    <th className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Last Seen</th>
                                    <th className="py-3 px-4 font-semibold text-slate-900 dark:text-white">Status</th>
                                    <th className="py-3 px-4 font-semibold text-slate-900 dark:text-white text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="py-8 text-center text-slate-500">
                                            Loading fleet data…
                                        </td>
                                    </tr>
                                ) : screens.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="py-8 text-center text-slate-500">
                                            No screens registered. Add one to get started.
                                        </td>
                                    </tr>
                                ) : (
                                    screens.map(screen => (
                                        <tr
                                            key={screen.id ?? screen.screen_id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                                                {screen.screen_id}
                                            </td>
                                            <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                                                {getStoreName(screen)}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500 text-sm">
                                                {screen.last_seen
                                                    ? new Date(screen.last_seen).toLocaleString()
                                                    : 'Never'}
                                            </td>
                                            <td className="py-3 px-4">
                                                <StatusBadge status={screen.status} />
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {/* Status toggle */}
                                                <button
                                                    onClick={() => handleToggleStatus(screen)}
                                                    disabled={togglingIds.has(screen.id)}
                                                    aria-label={
                                                        screen.status === SCREEN_STATUS.ACTIVE
                                                            ? `Set "${screen.screen_id}" inactive`
                                                            : `Set "${screen.screen_id}" active`
                                                    }
                                                    className={[
                                                        'p-2 rounded-lg transition-colors mr-1',
                                                        'disabled:opacity-40 disabled:cursor-not-allowed',
                                                        screen.status === SCREEN_STATUS.ACTIVE
                                                            ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                                            : 'text-slate-400 bg-slate-100 dark:bg-slate-800 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
                                                    ].join(' ')}
                                                >
                                                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                                                        {togglingIds.has(screen.id)
                                                            ? 'progress_activity'
                                                            : screen.status === SCREEN_STATUS.ACTIVE
                                                                ? 'toggle_on'
                                                                : 'toggle_off'}
                                                    </span>
                                                </button>

                                                {/* Delete */}
                                                <button
                                                    onClick={() => handleDelete(screen)}
                                                    aria-label={`Delete screen "${screen.screen_id}"`}
                                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-colors"
                                                >
                                                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </GlassCard>

                {/* Add Screen Modal */}
                {showAddModal && (
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="add-screen-title"
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    >
                        <GlassCard className="w-full max-w-md relative">
                            <h2 id="add-screen-title" className="text-xl font-bold mb-4">Register New Screen</h2>
                            <form onSubmit={handleCreateScreen} className="space-y-4">
                                <div>
                                    <label htmlFor="screen-hw-id" className="block text-sm font-medium mb-1">
                                        Screen Hardware ID
                                    </label>
                                    <input
                                        id="screen-hw-id"
                                        type="text"
                                        required
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                        placeholder="e.g. lobby-disp-01"
                                        value={newScreen.screen_id}
                                        onChange={e => setNewScreen({ ...newScreen, screen_id: e.target.value })}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="screen-retailer" className="block text-sm font-medium mb-1">Retailer</label>
                                        <select
                                            id="screen-retailer"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                            value={newScreen.retailer_id}
                                            onChange={e => setNewScreen({ ...newScreen, retailer_id: e.target.value, store_id: '' })}
                                        >
                                            <option value="">Select Retailer…</option>
                                            {retailers.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label htmlFor="screen-store" className="block text-sm font-medium mb-1">Store</label>
                                        <select
                                            id="screen-store"
                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                            value={newScreen.store_id}
                                            onChange={e => setNewScreen({ ...newScreen, store_id: e.target.value })}
                                            disabled={!newScreen.retailer_id}
                                        >
                                            <option value="">Select Store…</option>
                                            {stores
                                                .filter(s => s.retailer_id === newScreen.retailer_id)
                                                .map(s => (
                                                    <option key={s.id} value={s.id}>{s.name} ({s.city})</option>
                                                ))}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label htmlFor="screen-resolution" className="block text-sm font-medium mb-1">Resolution</label>
                                    <select
                                        id="screen-resolution"
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                        value={newScreen.resolution}
                                        onChange={e => setNewScreen({ ...newScreen, resolution: e.target.value })}
                                    >
                                        <option value="1920x1080">1080p (Landscape)</option>
                                        <option value="1080x1920">1080p (Portrait)</option>
                                        <option value="3840x2160">4K (Landscape)</option>
                                    </select>
                                </div>
                                <div className="flex justify-end gap-3 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        className="px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover shadow-lg shadow-primary/20"
                                    >
                                        Register Device
                                    </button>
                                </div>
                            </form>
                        </GlassCard>
                    </div>
                )}
            </div>

            <ToastContainer toasts={toasts} onDismiss={removeToast} />
        </>
    );
}

export default ScreenManagement;
