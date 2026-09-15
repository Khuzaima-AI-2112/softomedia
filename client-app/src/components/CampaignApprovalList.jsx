import { useState, useEffect } from 'react';
import apiService from '../services/ApiService.js';
import StatusBadge from './StatusBadge.jsx';
import GlassCard from './GlassCard.jsx';
import ProtectedImage from './ProtectedImage.jsx';
import { assetContentPath } from '../hooks/useMediaSource.js';

const CREATIVE_PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3C/svg%3E';

/**
 * CampaignApprovalList
 *
 * Sprint 8: updateCampaignStatus, StatusBadge, optimistic UI (S8-5).
 * Sprint 9 — Task 9.1: data-testid attributes added to:
 *   - container                   → data-testid="campaign-approval-list"
 *   - each campaign row           → data-testid="campaign-row-{id}"
 *   - approve button per row      → data-testid="approve-btn-{id}"
 *   - reject button per row       → data-testid="reject-btn-{id}"
 *   - empty-state paragraph       → data-testid="no-campaigns-msg"
 *   - loading spinner             → data-testid="loading-spinner"
 *   - error message               → data-testid="error-msg"
 *
 * Canonical path: client-app/src/components/CampaignApprovalList.jsx
 * Imported by: RetailerDashboard.jsx (../../components/CampaignApprovalList)
 */
export default function CampaignApprovalList() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [updating, setUpdating]   = useState({});
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);

  useEffect(() => {
    apiService.getCampaigns()
      .then(data => {
        setCampaigns(Array.isArray(data) ? data : (data.campaigns || []));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleStatus = async (id, newStatus) => {
    setUpdating(prev => ({ ...prev, [id]: true }));
    // Optimistic update
    setCampaigns(prev =>
      prev.map(c => c.id === id ? { ...c, status: newStatus } : c)
    );
    try {
      await apiService.updateCampaignStatus(id, newStatus);
    } catch (err) {
      // Rollback on failure
      setCampaigns(prev =>
        prev.map(c => c.id === id ? { ...c, status: 'pending_approval' } : c)
      );
      console.error('[CampaignApprovalList] status update failed', err);
    } finally {
      setUpdating(prev => ({ ...prev, [id]: false }));
    }
  };

  const toggleExpand = (id) => {
    setExpandedCampaignId(prev => prev === id ? null : id);
  };

  if (loading) {
    return (
      <div data-testid="loading-spinner" className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <p data-testid="error-msg" className="text-red-500 p-4">
        Failed to load campaigns: {error}
      </p>
    );
  }

  const pending = campaigns.filter(c => c.status === 'pending_approval');
  const history = campaigns.filter(c => c.status === 'approved' || c.status === 'rejected');

  const renderCampaignCard = (campaign, isPending) => (
    <GlassCard
      key={campaign.id}
      data-testid={`campaign-row-${campaign.id}`}
      className="flex flex-col gap-4 p-4"
    >
      <div className="flex items-center justify-between gap-4 w-full">
        <div className="flex-1 min-w-0">
          <p
            className="font-medium truncate cursor-pointer hover:text-primary transition-colors"
            onClick={() => toggleExpand(campaign.id)}
          >
            {campaign.name || campaign.id}
          </p>
          <p className="text-sm text-muted">
            {campaign.advertiser_name || campaign.advertiser_id} &bull;{' '}
            {campaign.start_date && campaign.end_date
              ? `${campaign.start_date} → ${campaign.end_date}`
              : 'No dates set'}
            {campaign.budget_total != null && (
              <span className="ml-2">
                Budget: ${Number(campaign.budget_total).toLocaleString()}
              </span>
            )}
          </p>
        </div>

        <div data-testid="campaign-status">
          <StatusBadge status={campaign.status} />
        </div>

        {isPending && campaign.status === 'pending_approval' && expandedCampaignId === campaign.id && (
          <div className="flex gap-2 shrink-0">
            <button
              data-testid="btn-approve"
              disabled={updating[campaign.id]}
              onClick={() => handleStatus(campaign.id, 'approved')}
              className="px-3 py-1.5 rounded bg-green-600 text-white text-sm
                hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Approve
            </button>
            <button
              data-testid="btn-reject"
              disabled={updating[campaign.id]}
              onClick={() => handleStatus(campaign.id, 'rejected')}
              className="px-3 py-1.5 rounded bg-red-600 text-white text-sm
                hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </div>
        )}

        {!isPending && campaign.status === 'approved' && expandedCampaignId === campaign.id && (
          <div className="flex gap-2 shrink-0">
            <button
              data-testid="btn-reject"
              disabled={updating[campaign.id]}
              onClick={() => handleStatus(campaign.id, 'rejected')}
              className="px-3 py-1.5 rounded bg-red-600 text-white text-sm
                hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
          </div>
        )}
      </div>

      {expandedCampaignId === campaign.id && (
        <div data-testid="campaign-detail" className="mt-2 pt-4 border-t border-slate-700/50 w-full space-y-4">
          <div className="flex gap-4">
            <ProtectedImage
              data-testid="campaign-creative-thumbnail"
              src={assetContentPath(campaign.media_id || campaign.asset_id) || campaign.creative_url}
              fallbackSrc={CREATIVE_PLACEHOLDER}
              alt="Creative Preview"
              className="w-32 h-24 object-cover rounded border border-slate-700"
            />
            <div data-testid="campaign-metadata" className="space-y-1 text-sm text-muted">
              <p><strong>Advertiser ID:</strong> {campaign.advertiser_id}</p>
              <p><strong>Duration:</strong> {campaign.start_date} to {campaign.end_date}</p>
              <p><strong>Total Budget:</strong> ${Number(campaign.budget_total || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  );

  return (
    <div data-testid="campaign-approval-list" className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">
          Requires Attention
          {pending.length > 0 && (
            <span className="ml-2 inline-flex items-center justify-center
              w-5 h-5 rounded-full bg-primary text-white text-xs font-bold">
              {pending.length}
            </span>
          )}
        </h2>

        <div data-testid="pending-approvals" className="space-y-3">
          {pending.length === 0 ? (
            <p data-testid="no-campaigns-msg" className="text-muted text-sm">
              No campaigns pending approval.
            </p>
          ) : (
            pending.map(campaign => renderCampaignCard(campaign, true))
          )}
        </div>
      </div>

      {history.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-800">
          <h2 className="text-lg font-semibold">Approval History</h2>
          <div className="space-y-3">
            {history.map(campaign => renderCampaignCard(campaign, false))}
          </div>
        </div>
      )}
    </div>
  );
}
