import { useState, useEffect } from 'react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import apiService from '../../services/ApiService';

function ScreenManagement() {
    const [screens, setScreens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newScreen, setNewScreen] = useState({ screen_id: '', resolution: '1920x1080', user_agent: 'Manual Admin Entry' });

    const fetchScreens = async () => {
        setLoading(true);
        try {
            const data = await apiService.getScreens();
            setScreens(data || []);
        } catch (error) {
            console.error('Failed to fetch screens:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchScreens();
    }, []);

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this screen? This action cannot be undone.')) return;
        try {
            await apiService.deleteScreen(id);
            await fetchScreens();
        } catch (error) {
            console.error('Failed to delete screen:', error);
            alert('Failed to delete screen');
        }
    };

    const handleCreateScreen = async (e) => {
        e.preventDefault();
        try {
            await apiService.registerScreen(newScreen);
            setShowAddModal(false);
            setNewScreen({ screen_id: '', resolution: '1920x1080', user_agent: 'Manual Admin Entry' }); // Reset
            await fetchScreens(); // Refresh list
        } catch (error) {
            console.error('Failed to create screen:', error);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Screen Management</h1>
                    <p className="text-slate-500 dark:text-slate-400">Provision and monitor physical display units</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">add_to_queue</span>
                    Add Screen
                </button>
            </div>

            <GlassCard>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
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
                                <tr><td colSpan="5" className="py-8 text-center text-slate-500">Loading fleet data...</td></tr>
                            ) : screens.length === 0 ? (
                                <tr><td colSpan="5" className="py-8 text-center text-slate-500">No screens registered. Add one to get started.</td></tr>
                            ) : (
                                screens.map(screen => (
                                    <tr key={screen.id || screen.screen_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">{screen.screen_id}</td>
                                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400">{screen.location_id || 'Unassigned'}</td>
                                        <td className="py-3 px-4 text-slate-500 text-sm">
                                            {screen.last_seen ? new Date(screen.last_seen).toLocaleString() : 'Never'}
                                        </td>
                                        <td className="py-3 px-4">
                                            <StatusBadge status={screen.status} />
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors mr-1" title="Settings">
                                                <span className="material-symbols-outlined text-[20px]">settings</span>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(screen.screen_id)}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-colors"
                                                title="Delete Screen"
                                            >
                                                <span className="material-symbols-outlined text-[20px]">delete</span>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <GlassCard className="w-full max-w-md relative">
                        <h2 className="text-xl font-bold mb-4">Register New Screen</h2>
                        <form onSubmit={handleCreateScreen} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Screen Hardware ID</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="e.g. lobby-disp-01"
                                    value={newScreen.screen_id}
                                    onChange={e => setNewScreen({ ...newScreen, screen_id: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Resolution</label>
                                <select
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
    );
}

export default ScreenManagement;
