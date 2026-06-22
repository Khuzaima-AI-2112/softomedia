import { useState, useEffect } from 'react';
import apiService from '../services/ApiService.js';
import StatusBadge from './StatusBadge.jsx';
import GlassCard from './GlassCard.jsx';

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

  useEffect(() => {
    apiService.getCampaigns({ status: 'pending_approval' })
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

  return (
    <div data-testid="campaign-approval-list" className="space-y-3">
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
      {campaigns.length === 0 ? (
        <p data-testid="no-campaigns-msg" className="text-muted text-sm">
          No campaigns pending approval.
        </p>
      ) : (
        campaigns.map(campaign => (
          <GlassCard
            key={campaign.id}
            data-testid={`campaign-row-${campaign.id}`}
            className="flex items-center justify-between gap-4 p-4"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{campaign.name || campaign.id}</p>
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

            <StatusBadge status={campaign.status} />

            {campaign.status === 'pending_approval' && (
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
          </GlassCard>
        ))
      )}
      </div>
    </div>
  );
}
