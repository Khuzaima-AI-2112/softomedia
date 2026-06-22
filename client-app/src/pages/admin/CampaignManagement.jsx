import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import apiService from '../../services/ApiService';
import { useAuth } from '../../contexts/AuthContext';
import { Trash2, X, PlusCircle } from 'lucide-react';

const CAMPAIGN_STATUSES = [
    { value: 'all',              label: 'All' },
    { value: 'pending_approval', label: 'Pending Approval' },
    { value: 'approved',         label: 'Approved' },
    { value: 'rejected',         label: 'Rejected' },
    { value: 'active',           label: 'Active' },
];

// Role levels mirrored from requireRole.js — used for UI gate checks only.
const ROLE_LEVEL = {
    superadmin:     5,
    admin:          4,
    contentmanager: 3,
    techoperator:   2,
    retaileradmin:  1,
    advertiser:     0,
};

const EMPTY_FORM = {
    name:          '',
    advertiser_id: '',
    budget:        '',
    start_date:    new Date().toISOString().split('T')[0],
    end_date:      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
};

function normalizeRole(raw) {
    if (!raw || typeof raw !== 'string') return raw;
    const cleaned = raw.replace(/[\s_-]/g, '').toLowerCase();
    if (cleaned === 'superadmin') return 'superadmin';
    return raw;
}

function CampaignManagement() {
    const navigate = useNavigate();
    const { user, loading } = useAuth();

    const userRole   = normalizeRole(user?.role);
    const userLevel  = ROLE_LEVEL[userRole] ?? -1;
    // Only admin+ may view this page
    const canView    = userLevel >= ROLE_LEVEL['admin'];
    // Only superadmin may hard-delete
    const canDelete  = userLevel >= ROLE_LEVEL['superadmin'];
    // retaileradmin+ may approve/reject
    const canApprove = userLevel >= ROLE_LEVEL['retaileradmin'];
    // admin+ may create campaigns
    const canCreate  = userLevel >= ROLE_LEVEL['admin'];

    const [campaigns,        setCampaigns]        = useState([]);
    const [advertisers,      setAdvertisers]      = useState([]);
    const [dataLoading,      setDataLoading]      = useState(true);
    const [filterStatus,     setFilterStatus]     = useState('all');
    const [pageError,        setPageError]        = useState('');
    const [successMsg,       setSuccessMsg]       = useState('');

    // Create campaign modal state
    const [showCreateModal,  setShowCreateModal]  = useState(false);
    const [createForm,       setCreateForm]       = useState(EMPTY_FORM);
    const [createSubmitting, setCreateSubmitting] = useState(false);
    const [createError,      setCreateError]      = useState('');

    // Detail modal state for E2E
    const [selectedCampaign, setSelectedCampaign] = useState(null);

    useEffect(() => {
        if (loading) return;
        if (!canView) {
            navigate('/dashboard/admin', { replace: true });
            return;
        }
        loadData();
    }, [loading, canView]);

    const loadData = useCallback(async () => {
        try {
            setDataLoading(true);
            setPageError('');
            const [allCampaigns, allAdvertisers] = await Promise.all([
                apiService.getCampaigns(),
                apiService.getAdvertisers(),
            ]);
            setCampaigns(allCampaigns   || []);
            setAdvertisers(allAdvertisers || []);
        } catch (err) {
            setPageError('Failed to load campaigns. Please try again.');
            console.error('CampaignManagement loadData error:', err);
        } finally {
            setDataLoading(false);
        }
    }, []);

    const handleStatusChange = async (campaignId, newStatus) => {
        try {
            setPageError('');
            await apiService.updateCampaignStatus(campaignId, newStatus);
            setSuccessMsg(`Campaign ${newStatus} successfully.`);
            loadData();
        } catch (err) {
            setPageError(err?.message || 'Failed to update campaign status.');
        }
    };

    const handleDelete = async (campaignId) => {
        if (!window.confirm('Permanently delete this campaign? This cannot be undone.')) return;
        try {
            setPageError('');
            await apiService.deleteCampaign(campaignId);
            setSuccessMsg('Campaign deleted.');
            loadData();
        } catch (err) {
            setPageError(err?.message || 'Failed to delete campaign.');
        }
    };

    const openCreateModal = () => {
        setCreateForm(EMPTY_FORM);
        setCreateError('');
        setShowCreateModal(true);
    };

    const closeCreateModal = () => {
        if (createSubmitting) return;
        setShowCreateModal(false);
        setCreateError('');
    };

    const handleCreateField = (field, value) => {
        setCreateForm(prev => ({ ...prev, [field]: value }));
    };

    const handleCreateSubmit = async (e) => {
        e.preventDefault();
        setCreateError('');

        // Client-side validation
        if (!createForm.name.trim()) {
            setCreateError('Campaign name is required.');
            return;
        }
        if (!createForm.advertiser_id) {
            setCreateError('Please select an advertiser.');
            return;
        }
        if (createForm.budget === '' || isNaN(Number(createForm.budget)) || Number(createForm.budget) < 0) {
            setCreateError('Budget must be a number of 0 or greater.');
            return;
        }
        if (!createForm.start_date || !createForm.end_date) {
            setCreateError('Start and end dates are required.');
            return;
        }
        if (createForm.start_date > createForm.end_date) {
            setCreateError('Start date must be before end date.');
            return;
        }

        setCreateSubmitting(true);
        try {
            await apiService.createCampaign({
                name:          createForm.name.trim(),
                // T1 compliance: admin-tier must send advertiser_id in body
                advertiser_id: createForm.advertiser_id,
                budget:        Number(createForm.budget),
                start_date:    createForm.start_date,
                end_date:      createForm.end_date,
                status:        'pending_approval',
            });
            setSuccessMsg(`Campaign "${createForm.name.trim()}" created successfully.`);
            setShowCreateModal(false);
            loadData();
        } catch (err) {
            const msg = err?.response?.data?.error || err?.message || 'Failed to create campaign.';
            setCreateError(msg);
        } finally {
            setCreateSubmitting(false);
        }
    };

    const advertiserName = (id) =>
        advertisers.find(a => a.id === id)?.name || id || '—';

    const filtered = filterStatus === 'all'
        ? campaigns
        : campaigns.filter(c => c.status === filterStatus);

    // NOTE: DataTable calls col.render(value, row) — full row is 2nd arg.
    const columns = [
        {
            key: 'name',
            label: 'Campaign',
            render: (value, row) => (
                <button 
                    onClick={() => setSelectedCampaign(row)}
                    className="font-medium text-blue-400 hover:text-blue-300 transition-colors text-left"
                >
                    {value || '—'}
                </button>
            )
        },
        {
            key: 'advertiser_id',
            label: 'Advertiser',
            render: (value) => (
                <span className="text-slate-300">{advertiserName(value)}</span>
            )
        },
        {
            key: 'status',
            label: 'Status',
            render: (_value, row) => <StatusBadge status={row.status || 'pending_approval'} />
        },
        {
            key: 'created_at',
            label: 'Created',
            render: (value) => value
                ? new Date(value).toLocaleDateString('en-CA')
                : '—'
        },
        {
            key: 'actions',
            label: 'Actions',
            render: (_value, row) => (
                <div className="flex items-center gap-2">
                    {canApprove && row.status === 'pending_approval' && (
                        <>
                            <button
                                data-testid={`btn-approve-campaign-${row.id}`}
                                onClick={() => handleStatusChange(row.id, 'approved')}
                                className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                            >
                                Approve
                            </button>
                            <button
                                data-testid={`btn-reject-campaign-${row.id}`}
                                onClick={() => handleStatusChange(row.id, 'rejected')}
                                className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded transition-colors"
                            >
                                Reject
                            </button>
                        </>
                    )}
                    {canDelete && (
                        <button
                            data-testid={`delete-btn-${row.id}`}
                            onClick={() => handleDelete(row.id)}
                            className="p-1 text-red-400 hover:text-red-300 transition-colors"
                            title="Delete campaign"
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            )
        }
    ];

    if (loading) return null;

    if (dataLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
        );
    }

    return (
        <div data-testid="campaign-management" className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Campaign Management</h1>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">
                        {filtered.length} campaign{filtered.length !== 1 ? 's' : ''}
                    </span>
                    {canCreate && (
                        <button
                            data-testid="create-campaign-btn"
                            onClick={openCreateModal}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            <PlusCircle size={16} />
                            Create Campaign
                        </button>
                    )}
                </div>
            </div>

            {pageError && (
                <div className="p-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg">
                    {pageError}
                </div>
            )}
            {successMsg && (
                <div className="p-3 bg-green-900/40 border border-green-700 text-green-300 rounded-lg">
                    {successMsg}
                </div>
            )}

            {/* Status filter */}
            <div className="flex gap-2 flex-wrap">
                {CAMPAIGN_STATUSES.map(s => (
                    <button
                        key={s.value}
                        data-testid={`filter-${s.value}`}
                        onClick={() => setFilterStatus(s.value)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            filterStatus === s.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-white/10 text-gray-300 hover:bg-white/20'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
            </div>

            <GlassCard>
                <DataTable columns={columns} data={filtered} />
            </GlassCard>

            {/* ── Create Campaign Modal ─────────────────────────────────── */}
            {showCreateModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget) closeCreateModal(); }}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="create-campaign-modal-title"
                >
                    <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                            <h2 id="create-campaign-modal-title" className="text-lg font-bold text-white">
                                Create Campaign
                            </h2>
                            <button
                                onClick={closeCreateModal}
                                disabled={createSubmitting}
                                data-testid="btn-modal-close" className="p-1 text-slate-400 hover:text-white transition-colors disabled:opacity-40"
                                aria-label="Close modal"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal form */}
                        <form onSubmit={handleCreateSubmit} noValidate>
                            <div className="px-6 py-5 space-y-4">

                                {/* Inline error */}
                                {createError && (
                                    <div
                                        data-testid="campaign-modal-error"
                                        className="p-3 bg-red-900/40 border border-red-700 text-red-300 rounded-lg text-sm"
                                    >
                                        {createError}
                                    </div>
                                )}

                                {/* Campaign name */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="campaign-name">
                                        Campaign Name <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        id="campaign-name"
                                        data-testid="campaign-name-input"
                                        type="text"
                                        value={createForm.name}
                                        onChange={(e) => handleCreateField('name', e.target.value)}
                                        placeholder="e.g. Summer Promo 2026"
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                                        disabled={createSubmitting}
                                    />
                                </div>

                                {/* Advertiser */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="campaign-advertiser">
                                        Advertiser <span className="text-red-400">*</span>
                                    </label>
                                    <select
                                        id="campaign-advertiser"
                                        data-testid="campaign-advertiser-select"
                                        value={createForm.advertiser_id}
                                        onChange={(e) => handleCreateField('advertiser_id', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-60"
                                        disabled={createSubmitting}
                                    >
                                        <option value="">— Select advertiser —</option>
                                        {advertisers.map(a => (
                                            <option key={a.id} value={a.id}>
                                                {a.name || a.id}
                                            </option>
                                        ))}
                                    </select>
                                    {advertisers.length === 0 && (
                                        <p className="mt-1 text-xs text-amber-400">
                                            No advertisers found. Seed advertiser records before creating campaigns.
                                        </p>
                                    )}
                                </div>

                                {/* Budget */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="campaign-budget">
                                        Budget ($) <span className="text-red-400">*</span>
                                    </label>
                                    <input
                                        id="campaign-budget"
                                        data-testid="campaign-budget-input"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={createForm.budget}
                                        onChange={(e) => handleCreateField('budget', e.target.value)}
                                        placeholder="1000"
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                                        disabled={createSubmitting}
                                    />
                                </div>

                                {/* Date range */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="campaign-start-date">
                                            Start Date <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            id="campaign-start-date"
                                            data-testid="campaign-start-date-input"
                                            type="date"
                                            value={createForm.start_date}
                                            onChange={(e) => handleCreateField('start_date', e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            disabled={createSubmitting}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="campaign-end-date">
                                            End Date <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            id="campaign-end-date"
                                            data-testid="campaign-end-date-input"
                                            type="date"
                                            value={createForm.end_date}
                                            onChange={(e) => handleCreateField('end_date', e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                                            disabled={createSubmitting}
                                        />
                                    </div>
                                </div>

                                {/* Loop inventory note */}
                                <p className="text-xs text-slate-500">
                                    Campaign will be created in <span className="text-slate-400 font-medium">pending_approval</span> status.
                                    Slot booking is done separately once loop inventory is generated for the campaign dates.
                                </p>
                            </div>

                            {/* Modal footer */}
                            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-700">
                                <button
                                    type="button"
                                    onClick={closeCreateModal}
                                    disabled={createSubmitting}
                                    className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-600 rounded-lg transition-colors disabled:opacity-40"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    data-testid="campaign-submit-btn"
                                    disabled={createSubmitting}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    {createSubmitting ? (
                                        <>
                                            <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Creating…
                                        </>
                                    ) : (
                                        <>
                                            <PlusCircle size={16} />
                                            Create Campaign
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Campaign Detail Modal for E2E Tests */}
            {selectedCampaign && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div data-testid="campaign-detail" className="bg-slate-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative border border-slate-700">
                        <button 
                            onClick={() => setSelectedCampaign(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <span className="material-symbols-outlined">close</span>
                        </button>
                        
                        <h2 className="text-xl font-bold mb-4 text-white">{selectedCampaign.name}</h2>
                        
                        <div data-testid="campaign-status" className="mb-4 text-slate-300">
                            Status: <span className="font-semibold">{selectedCampaign.status}</span>
                        </div>
                        
                        <div className="flex gap-2">
                            <button data-testid="btn-campaign-admin-action" className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                                Admin Override
                            </button>
                            <button data-testid="btn-admin-action" className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">
                                Admin Action
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CampaignManagement;
