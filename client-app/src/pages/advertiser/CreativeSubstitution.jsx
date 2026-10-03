import { useEffect, useState } from 'react';
import apiService from '../../services/ApiService';

const NEVER_PLAYS = new Set(['rejected', 'revoked']);

/** Who revoked the Creative and why, or null while nobody has. */
function revocationOf(creative) {
    if (creative?.approval_status === 'revoked') {
        return { by: 'the Super Administrator', reason: creative.reason };
    }
    const retailer = creative?.retailer_approvals?.find(approval => approval.status === 'revoked');
    return retailer ? { by: retailer.retailer_name || retailer.retailer_id, reason: retailer.reason } : null;
}

/**
 * The Creative a Brand's Campaign plays. Once it is revoked, the Brand
 * substitutes another of its Creatives, of as many files, keeping the
 * Campaign's Slots; it plays once it has both approvals (#38).
 */
export default function CreativeSubstitution({ campaign, onSubstituted }) {
    const [creatives, setCreatives] = useState(null);
    const [choice, setChoice] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState(null);
    const [done, setDone] = useState(null);

    useEffect(() => {
        apiService.getCreatives()
            .then(setCreatives)
            .catch(loadError => setError(loadError.message));
    }, []);

    if (!creatives) return error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null;

    const current = creatives.find(creative => creative.id === campaign.creative_id);
    const revocation = revocationOf(current);
    const fileCount = current?.media_ids?.length ?? 1;
    const candidates = creatives.filter(creative => creative.id !== campaign.creative_id
        && !NEVER_PLAYS.has(creative.approval_status)
        && (creative.media_ids?.length ?? 1) === fileCount);

    const substitute = async () => {
        setBusy(true);
        setError(null);
        try {
            const updated = await apiService.substituteCreative(campaign.id, choice);
            const chosen = candidates.find(creative => creative.id === choice);
            setDone(`“${chosen?.title || choice}” now fills this Campaign's Slots. It plays once it has both approvals.`);
            onSubstituted(updated);
        } catch (substitutionError) {
            setError(substitutionError.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div data-testid="campaign-creative" className="mb-4 space-y-2 text-sm">
            <p>Creative: <span className="font-semibold">{current?.title || campaign.creative_id || '—'}</span></p>
            {done && <p role="status" className="text-emerald-700 dark:text-emerald-400">{done}</p>}
            {revocation && !done && (
                <>
                    <p role="alert" className="text-red-600">
                        {`Revoked by ${revocation.by}${revocation.reason ? `: ${revocation.reason}` : ''}. `}
                        Its Slots play Fallback Content until you substitute another Creative.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <label htmlFor="substitute-creative" className="sr-only">Substitute Creative</label>
                        <select id="substitute-creative" value={choice} onChange={event => setChoice(event.target.value)}
                            className="rounded border border-slate-300 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                            <option value="">Choose a Creative…</option>
                            {candidates.map(creative => (
                                <option key={creative.id} value={creative.id}>{creative.title || creative.id}</option>
                            ))}
                        </select>
                        <button type="button" disabled={busy || !choice} onClick={substitute}
                            className="rounded bg-primary px-3 py-1.5 font-semibold text-white hover:bg-primary/90 disabled:opacity-50">
                            Substitute
                        </button>
                    </div>
                    {candidates.length === 0 && (
                        <p className="text-slate-500">
                            Upload a Creative of {fileCount} file{fileCount === 1 ? '' : 's'} to substitute it.
                        </p>
                    )}
                    {error && <p className="text-red-600">{error}</p>}
                </>
            )}
        </div>
    );
}
