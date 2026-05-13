/**
 * AdApproval.jsx — Sprint 8
 *
 * Retailer-facing page for reviewing ads pending approval.
 * Shows a pending queue, a 24-hour schedule preview per ad,
 * and approve / reject actions with a mandatory reason on rejection.
 *
 * Routes:
 *   GET  /api/schedules/pending-approval
 *   GET  /api/schedules/preview/:adId
 *   POST /api/schedules/approve/:adId
 *   POST /api/schedules/reject/:adId
 */

import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

// ── Status badge ──────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    pending_review: 'bg-amber-100 text-amber-800',
    approved:       'bg-green-100 text-green-800',
    rejected:       'bg-red-100   text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

// ── 24-hour preview bar ───────────────────────────────────────────────────
function HourlyPreviewBar({ preview }) {
  if (!preview?.hourly_preview) return null;
  return (
    <div className="mt-3">
      <p className="text-xs text-gray-500 mb-1">
        Schedule preview — {preview.total_active_hours} active hours · {preview.total_daily_plays.toLocaleString()} plays/day
      </p>
      <div className="flex gap-0.5 h-5">
        {preview.hourly_preview.map(h => (
          <div
            key={h.hour}
            title={`${h.time_label} — ${h.is_active ? `${h.plays_per_hour} plays` : 'inactive'}`}
            className={`flex-1 rounded-sm ${h.is_active ? 'bg-blue-500' : 'bg-gray-200'}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>00:00</span><span>12:00</span><span>23:00</span>
      </div>
    </div>
  );
}

// ── Reject modal ──────────────────────────────────────────────────────────
function RejectModal({ ad, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Reject Ad</h3>
        <p className="text-sm text-gray-500 mb-4">
          You are rejecting <span className="font-medium text-gray-700">{ad.name}</span>.
          Provide a reason — this will be visible to the advertiser.
        </p>
        <textarea
          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          placeholder="e.g. Content does not comply with store policy…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!reason.trim() || loading}
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Rejecting…' : 'Confirm Rejection'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ad card ───────────────────────────────────────────────────────────────
function AdCard({ ad, onApprove, onReject, approving, rejecting }) {
  const [preview, setPreview]     = useState(null);
  const [loadingPrev, setLoading] = useState(false);
  const [expanded, setExpanded]   = useState(false);

  const loadPreview = useCallback(async () => {
    if (preview) { setExpanded(e => !e); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/schedules/preview/${ad.id}`, { headers: authHeaders() });
      if (res.ok) setPreview(await res.json());
    } finally {
      setLoading(false);
      setExpanded(true);
    }
  }, [ad.id, preview]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <StatusBadge status={ad.status} />
            <span className="text-xs text-gray-400">{ad.format}</span>
            <span className="text-xs text-gray-400">{ad.duration_ms ? `${ad.duration_ms / 1000}s` : ''}</span>
          </div>
          <h4 className="text-sm font-semibold text-gray-900 truncate">{ad.name}</h4>
          <p className="text-xs text-gray-400 mt-0.5">Campaign: {ad.campaign_id} · Advertiser: {ad.advertiser_id}</p>
          <p className="text-xs text-gray-400">Submitted: {ad.created_at ? new Date(ad.created_at).toLocaleString() : '—'}</p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onApprove(ad)}
            disabled={approving === ad.id || rejecting === ad.id}
            className="px-4 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40"
          >
            {approving === ad.id ? 'Approving…' : '✓ Approve'}
          </button>
          <button
            onClick={() => onReject(ad)}
            disabled={approving === ad.id || rejecting === ad.id}
            className="px-4 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40"
          >
            {rejecting === ad.id ? 'Rejecting…' : '✕ Reject'}
          </button>
          <button onClick={loadPreview} className="px-4 py-1.5 text-xs text-blue-600 hover:underline">
            {loadingPrev ? 'Loading…' : expanded ? 'Hide preview' : 'Schedule preview'}
          </button>
        </div>
      </div>
      {expanded && <HourlyPreviewBar preview={preview} />}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function AdApproval() {
  const [ads, setAds]                   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [approving, setApproving]       = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejecting, setRejecting]       = useState(null);
  const [toast, setToast]               = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchPending = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/schedules/pending-approval`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setAds(data.ads || []);
    } catch (e) {
      setError('Failed to load pending ads. ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (ad) => {
    setApproving(ad.id);
    try {
      const res = await fetch(`${API}/api/schedules/approve/${ad.id}`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error || res.status);
      showToast(`"${ad.name}" approved successfully.`);
      setAds(prev => prev.filter(a => a.id !== ad.id));
    } catch (e) {
      showToast(`Approval failed: ${e.message}`, 'error');
    } finally {
      setApproving(null);
    }
  };

  const handleRejectConfirm = async (reason) => {
    const ad = rejectTarget;
    setRejecting(ad.id);
    try {
      const res = await fetch(`${API}/api/schedules/reject/${ad.id}`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ reason }),
      });
      if (!res.ok) throw new Error((await res.json()).error || res.status);
      showToast(`"${ad.name}" rejected.`, 'error');
      setAds(prev => prev.filter(a => a.id !== ad.id));
    } catch (e) {
      showToast(`Rejection failed: ${e.message}`, 'error');
    } finally {
      setRejecting(null); setRejectTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${
          toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
        }`}>
          {toast.msg}
        </div>
      )}

      {rejectTarget && (
        <RejectModal
          ad={rejectTarget}
          onConfirm={handleRejectConfirm}
          onCancel={() => setRejectTarget(null)}
          loading={rejecting === rejectTarget.id}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Ad Approval Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Review and approve or reject ads scheduled for your stores.</p>
        </div>

        <div className="flex items-center gap-3 mb-5">
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{ads.length}</span> ad{ads.length !== 1 ? 's' : ''} pending review
          </span>
          <button onClick={fetchPending} className="ml-auto text-xs text-blue-600 hover:underline">Refresh</button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-28 bg-white rounded-xl border border-gray-100 animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">{error}</div>
        ) : ads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">All caught up!</p>
            <p className="text-xs text-gray-400 mt-1">No ads are pending review for your stores.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ads.map(ad => (
              <AdCard
                key={ad.id}
                ad={ad}
                onApprove={handleApprove}
                onReject={setRejectTarget}
                approving={approving}
                rejecting={rejecting}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
