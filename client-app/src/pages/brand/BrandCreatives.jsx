import { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import apiService from '../../services/ApiService';

// A Creative plays only once approved; the Brand sees where each one stands.
const APPROVAL = {
    pending: { label: 'Pending approval', className: 'bg-amber-100 text-amber-800' },
    approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800' },
    rejected: { label: 'Rejected', className: 'bg-rose-100 text-rose-800' },
    revoked: { label: 'Revoked', className: 'bg-slate-200 text-slate-700' },
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
            {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
            {creatives?.length === 0 && <p className="text-sm text-slate-500">No creatives uploaded yet.</p>}
            {creatives?.length > 0 && (
                <ul className="divide-y divide-slate-200 dark:divide-slate-700" data-testid="brand-creatives">
                    {creatives.map(creative => {
                        const approval = APPROVAL[creative.approval_status]
                            ?? { label: creative.approval_status, className: 'bg-slate-100 text-slate-700' };
                        return (
                            <li key={creative.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                                <span className="font-medium">
                                    {creative.files.map(file => file.title).join(' + ')}
                                </span>
                                {creative.created_at && (
                                    <span className="text-xs text-slate-500">
                                        Uploaded {new Date(creative.created_at).toLocaleDateString()}
                                    </span>
                                )}
                                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${approval.className}`}>
                                    {approval.label}
                                </span>
                                {creative.reason && (
                                    <p className="w-full text-sm text-slate-500">{creative.reason}</p>
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
