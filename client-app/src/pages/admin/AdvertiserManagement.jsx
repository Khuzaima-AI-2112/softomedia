import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import PriceDisplay from '../../components/PriceDisplay';
import apiService from '../../services/ApiService';
import pricingService from '../../services/PricingService';

const INDUSTRIES = [
    'Electronics', 'Food & Beverage', 'Fashion', 'Automotive', 'Healthcare',
    'Finance', 'Entertainment', 'Travel', 'Sports', 'Home & Garden', 'Other'
];

const LOGOS = ['📱', '🥤', '👗', '🚗', '💊', '💰', '🎬', '✈️', '⚽', '🏠', '🏢'];

function AdvertiserManagement() {
    const [advertisers, setAdvertisers] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAdvertiser, setEditingAdvertiser] = useState(null);
    const [selectedAdvertiser, setSelectedAdvertiser] = useState(null);
    const [modalError, setModalError] = useState('');
    const [toastMessage, setToastMessage] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        logo: '🏢',
        industry: 'Other',
        contact_email: '',
        budget: 10000
    });

    useEffect(() => {
        loadData();
    }, []);

    const showToast = (message) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 4000);
    };

    const loadData = async () => {
        try {
            setLoading(true);
            const [allAdvertisers, allCampaigns] = await Promise.all([
                apiService.getAdvertisers(),
                apiService.getCampaigns()
            ]);
            setAdvertisers(allAdvertisers);
            setCampaigns(allCampaigns);
        } catch (error) {
            console.error('Failed to load advertiser management data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Task 3.4 fix: display error inside modal, do not close on error
    const handleSubmit = async (e) => {
        e.preventDefault();
        setModalError('');
        try {
            if (editingAdvertiser) {
                await apiService.updateAdvertiser(editingAdvertiser.id, formData);
            } else {
                await apiService.createAdvertiser({
                    ...formData,
                    contactemail: formData.contact_email,
                    status: 'active'
                });
            }
            await loadData();
            closeModal();
        } catch (error) {
            const message = error?.response?.data?.error || error?.message || 'Failed to save advertiser. Please try again.';
            setModalError(message);
            // Modal stays open — do NOT call closeModal()
        }
    };

    const openModal = (advertiser = null) => {
        setModalError('');
        if (advertiser) {
            setEditingAdvertiser(advertiser);
            setFormData({
                name: advertiser.name,
                logo: advertiser.logo,
                industry: advertiser.industry,
                contact_email: advertiser.contact_email || advertiser.contactemail || '',
                budget: advertiser.budget
            });
        } else {
            setEditingAdvertiser(null);
            setFormData({
                name: '',
                logo: '🏢',
                industry: 'Other',
                contact_email: '',
                budget: 10000
            });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingAdvertiser(null);
        setModalError('');
    };

    const toggleStatus = async (advertiserId) => {
        const advertiser = advertisers.find(a => a.id === advertiserId);
        if (advertiser) {
            try {
                await apiService.updateAdvertiser(advertiserId, {
                    status: advertiser.status === 'active' ? 'inactive' : 'active'
                });
                await loadData();
            } catch (error) {
                console.error('Failed to toggle advertiser status:', error);
                showToast('Failed to update status. Please try again.');
            }
        }
    };

    // Task 3.5: soft-delete handler
    const handleDelete = async (advertiser) => {
        const confirmed = window.confirm(
            `Are you sure you want to remove "${advertiser.name}"? This action will suspend the advertiser and cannot be undone.`
        );
        if (!confirmed) return;

        try {
            await apiService.deleteAdvertiser(advertiser.id);
            setAdvertisers(prev => prev.filter(a => a.id !== advertiser.id));
            if (selectedAdvertiser?.id === advertiser.id) setSelectedAdvertiser(null);
        } catch (error) {
            const message = error?.response?.data?.error || error?.message || 'Failed to remove advertiser.';
            showToast(message);
        }
    };

    const getAdvertiserCampaigns = (advertiserId) => campaigns.filter(c => c.advertiser_id === advertiserId);
    const getLiveCampaigns = (advertiserId) => getAdvertiserCampaigns(advertiserId).filter(c => c.status === 'live');
    const getTotalSpent = (advertiserId) => getAdvertiserCampaigns(advertiserId).reduce((sum, c) => sum + (c.spent || 0), 0);

    const columns = [
        {
            header: 'Advertiser',
            render: (advertiser) => (
                <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => setSelectedAdvertiser(selectedAdvertiser?.id === advertiser.id ? null : advertiser)}
                >
                    <div className="size-12 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-center text-2xl border border-amber-200 dark:border-amber-800">
                        {advertiser.logo}
                    </div>
                    <div>
                        <p className="font-semibold text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                            {advertiser.name}
                        </p>
                        <p className="text-xs text-slate-500">{advertiser.industry}</p>
                    </div>
                </div>
            )
        },
        {
            header: 'Campaigns',
            render: (advertiser) => {
                const total = getAdvertiserCampaigns(advertiser.id).length;
                const live = getLiveCampaigns(advertiser.id).length;
                return (
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-400">campaign</span>
                        <span className="font-medium">{live}</span>
                        <span className="text-slate-400">live / {total} total</span>
                    </div>
                );
            }
        },
        {
            header: 'Budget',
            render: (advertiser) => (
                <PriceDisplay price={advertiser.budget} size="small" />
            )
        },
        {
            header: 'Spent',
            render: (advertiser) => {
                const spent = getTotalSpent(advertiser.id);
                const percentage = advertiser.budget > 0 ? (spent / advertiser.budget) * 100 : 0;
                return (
                    <div className="w-24">
                        <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium">{pricingService.formatPrice(spent)}</span>
                            <span className="text-slate-400">{Math.round(percentage)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                            <div
                                className="h-1.5 rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                        </div>
                    </div>
                );
            }
        },
        {
            header: 'Status',
            render: (advertiser) => (
                <StatusBadge status={
                    advertiser.status === 'active' ? 'Active' :
                    advertiser.status === 'suspended' ? 'Suspended' : 'Inactive'
                } />
            )
        },
        {
            header: 'Actions',
            className: 'text-right',
            render: (advertiser) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => openModal(advertiser)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Edit"
                    >
                        <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                        onClick={() => toggleStatus(advertiser.id)}
                        className={`p-1.5 rounded-lg transition-colors ${
                            advertiser.status === 'active'
                                ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                        }`}
                        title={advertiser.status === 'active' ? 'Deactivate' : 'Activate'}
                    >
                        <span className="material-symbols-outlined text-lg">
                            {advertiser.status === 'active' ? 'toggle_on' : 'toggle_off'}
                        </span>
                    </button>
                    {/* Task 3.5 — Remove / soft-delete */}
                    <button
                        onClick={() => handleDelete(advertiser)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove advertiser"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            )
        }
    ];

    const totalBudget = advertisers.reduce((sum, a) => sum + (a.budget || 0), 0);
    const totalSpent = advertisers.reduce((sum, a) => sum + getTotalSpent(a.id), 0);
    const liveCampaigns = campaigns.filter(c => c.status === 'live').length;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Error Toast */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 px-5 py-3 bg-red-600 text-white rounded-xl shadow-xl animate-in fade-in duration-200">
                    {toastMessage}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        Advertiser Management
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400">
                        Manage brand and agency advertising accounts
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium shadow-lg shadow-primary/20 hover:bg-primary-hover transition-colors flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    Add Advertiser
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <GlassCard className="border-l-4 border-l-amber-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Advertisers</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">{advertisers.length}</p>
                    <p className="text-xs text-emerald-500 mt-1">
                        {advertisers.filter(a => a.status === 'active').length} active
                    </p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-emerald-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Live Campaigns</p>
                    <p className="text-3xl font-bold text-emerald-500">{liveCampaigns}</p>
                    <p className="text-xs text-slate-400 mt-1">of {campaigns.length} total</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-primary">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Budget</p>
                    <PriceDisplay price={totalBudget} size="large" />
                    <p className="text-xs text-slate-400 mt-1">Allocated funds</p>
                </GlassCard>
                <GlassCard className="border-l-4 border-l-blue-500">
                    <p className="text-sm font-medium text-slate-500 mb-1">Total Spent</p>
                    <PriceDisplay price={totalSpent} size="large" />
                    <p className="text-xs text-slate-400 mt-1">
                        {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}% utilization
                    </p>
                </GlassCard>
            </div>

            {/* Advertisers Table */}
            <DataTable columns={columns} data={advertisers} />

            {/* Selected Advertiser Campaigns */}
            {selectedAdvertiser && (
                <GlassCard>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{selectedAdvertiser.logo}</span>
                            <div>
                                <h3 className="font-bold text-lg">{selectedAdvertiser.name} - Campaigns</h3>
                                <p className="text-sm text-slate-500">{getAdvertiserCampaigns(selectedAdvertiser.id).length} campaigns</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSelectedAdvertiser(null)}
                            className="p-1 text-slate-400 hover:text-slate-600"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <div className="space-y-3">
                        {getAdvertiserCampaigns(selectedAdvertiser.id).length === 0 ? (
                            <p className="text-slate-400 text-center py-8">No campaigns yet</p>
                        ) : (
                            getAdvertiserCampaigns(selectedAdvertiser.id).map(campaign => (
                                <div
                                    key={campaign.id}
                                    className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="size-16 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-700">
                                            <img
                                                src={campaign.creative_url}
                                                alt={campaign.name}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{campaign.name}</p>
                                            <p className="text-xs text-slate-500">
                                                {campaign.start_date} → {campaign.end_date}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500">Budget</p>
                                            <PriceDisplay price={campaign.budget} size="small" />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs text-slate-500">Spent</p>
                                            <PriceDisplay price={campaign.spent} size="small" />
                                        </div>
                                        <StatusBadge status={
                                            campaign.status === 'live' ? 'Live' :
                                                campaign.status === 'scheduled' ? 'Scheduled' :
                                                    campaign.status === 'pending_approval' ? 'Pending' : 'Ended'
                                        } />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </GlassCard>
            )}

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <GlassCard className="w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">
                            {editingAdvertiser ? 'Edit Advertiser' : 'Add New Advertiser'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0">
                                    <label className="block text-sm font-medium mb-1">Icon</label>
                                    <select
                                        value={formData.logo}
                                        onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                                        className="w-16 h-16 text-2xl text-center rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                                    >
                                        {LOGOS.map(emoji => (
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
                                        placeholder="Brand Name"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Industry</label>
                                <select
                                    value={formData.industry}
                                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                >
                                    {INDUSTRIES.map(industry => (
                                        <option key={industry} value={industry}>{industry}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Contact Email</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.contact_email}
                                    onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="marketing@brand.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Initial Budget</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                                    <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        required
                                        value={formData.budget}
                                        onChange={(e) => setFormData({ ...formData, budget: parseFloat(e.target.value) || 0 })}
                                        className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>

                            {/* Task 3.4 — in-modal error display */}
                            {modalError && (
                                <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                                    {modalError}
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
                                    {editingAdvertiser ? 'Save Changes' : 'Create Advertiser'}
                                </button>
                            </div>
                        </form>
                    </GlassCard>
                </div>
            )}
        </div>
    );
}

export default AdvertiserManagement;
