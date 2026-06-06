import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import apiService from '../../services/ApiService';
import { useAuth } from '../../contexts/AuthContext';
import { Trash2 } from 'lucide-react';

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

    const [campaigns,    setCampaigns]    = useState([]);
    const [advertisers,  setAdvertisers]  = useState([]);
    const [dataLoading,  setDataLoading]  = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [pageError,    setPageError]    = useState('');
    const [successMsg,   setSuccessMsg]   = useState('');

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
            render: (value) => (
                <span className="font-medium text-white">{value || '—'}</span>
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
                                data-testid={`approve-btn-${row.id}`}
                                onClick={() => handleStatusChange(row.id, 'approved')}
                                className="px-2 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors"
                            >
                                Approve
                            </button>
                            <button
                                data-testid={`reject-btn-${row.id}`}
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Campaign Management</h1>
                <span className="text-sm text-slate-400">
                    {filtered.length} campaign{filtered.length !== 1 ? 's' : ''}
                </span>
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
        </div>
    );
}

export default CampaignManagement;
