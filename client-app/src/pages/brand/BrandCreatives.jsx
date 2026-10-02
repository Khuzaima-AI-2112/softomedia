import { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import apiService from '../../services/ApiService';

// A Creative plays in a Store once the Super Administrator and the Store's
// Retailer have both approved it (ADR 0007); the Brand sees where each stands.
const APPROVAL = {
    pending: { label: 'Awaiting Super Admin approval', className: 'bg-amber-100 text-amber-800' },
    approved: { label: 'Approved by Super Admin', className: 'bg-emerald-100 text-emerald-800' },
    rejected: { label: 'Rejected by Super Admin', className: 'bg-rose-100 text-rose-800' },
    revoked: { label: 'Revoked', className: 'bg-slate-200 text-slate-700' },
};

const RETAILER_DECISION = {
    pending: { label: 'Awaiting approval', className: 'text-amber-700' },
    approved: { label: 'Approved', className: 'text-emerald-700' },
    rejected: { label: 'Rejected', className: 'text-rose-700' },
};

function BrandCreatives() {
    const [creatives, setCreatives] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        apiService.getCreatives()
            .then(setCreatives)
            .catch(() => setError('Your creatives could not be loaded.'));
    }, []);

    return (
        <GlassCard>
            <h2 className="font-bold text-lg mb-4">Your Creatives</h2>
            {error && <p role="alert" data-testid="brand-creatives-error" className="text-sm text-rose-600">{error}</p>}
            {creatives?.length === 0 && (
                <p data-testid="brand-creatives-empty" className="text-sm text-slate-500">No creatives uploaded yet.</p>
            )}
            {creatives?.length > 0 && (
                <ul className="divide-y divide-slate-200 dark:divide-slate-700" data-testid="brand-creatives">
                    {creatives.map(creative => {
                        const approval = APPROVAL[creative.approval_status]
                            ?? { label: creative.approval_status, className: 'bg-slate-100 text-slate-700' };
                        return (
                            <li key={creative.id} data-testid={`creative-row-${creative.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3">
                                <span className="font-medium">
                                    {creative.files.map(file => file.title).join(' + ')}
                                </span>
                                {creative.created_at && (
                                    <span className="text-xs text-slate-500">
                                        Uploaded {new Date(creative.created_at).toLocaleDateString()}
                                    </span>
                                )}
                                <span data-testid={`creative-status-${creative.id}`}
                                    className={`rounded-full px-3 py-0.5 text-xs font-semibold ${approval.className}`}>
                                    {approval.label}
                                </span>
                                {creative.reason && (
                                    <p className="w-full text-sm text-slate-500">{creative.reason}</p>
                                )}
                                {creative.retailer_approvals?.length > 0 && (
                                    <ul className="w-full space-y-1 text-sm">
                                        {creative.retailer_approvals.map(approval => {
                                            const decision = RETAILER_DECISION[approval.status]
                                                ?? { label: approval.status, className: 'text-slate-600' };
                                            return (
                                                <li key={approval.retailer_id}
                                                    data-testid={`creative-retailer-${creative.id}-${approval.retailer_id}`}
                                                    className={decision.className}>
                                                    {approval.retailer_name || approval.retailer_id}: {decision.label}
                                                    {approval.reason && ` — ${approval.reason}`}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </GlassCard>
    );
}

export default BrandCreatives;
