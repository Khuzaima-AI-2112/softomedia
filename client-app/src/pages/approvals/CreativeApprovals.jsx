import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/ApiService';
import apiClient from '../../services/api.js';
import { useMediaSource } from '../../hooks/useMediaSource';
import { PERMISSIONS } from '../../constants/permissions';

const loadWithSignIn = path => apiClient.get(path, { responseType: 'blob' });

/** One file of a Creative, as the Screen would show it. */
function CreativeFilePreview({ file }) {
    const source = useMediaSource(file.content_path, loadWithSignIn);
    const isVideo = file.mime_type?.startsWith('video/');
    return (
        <figure data-testid={`creative-preview-${file.id}`}
            className="w-56 aspect-video overflow-hidden rounded-lg bg-slate-900 flex items-center justify-center">
            {source && isVideo && <video src={source} controls muted playsInline className="max-h-full max-w-full" />}
            {source && !isVideo && <img src={source} alt={file.title || 'Creative file'} className="max-h-full max-w-full object-contain" />}
            {!source && <span className="text-xs text-white/60">Loading…</span>}
        </figure>
    );
}

/**
 * Creatives waiting on the signed-in approver: the Super Administrator for the
 * network, then each Retailer for its own Stores (ADR 0007). Every file is
 * previewed in play order before the approver decides, once.
 */
export default function CreativeApprovals() {
    const { user, can } = useAuth();
    const canApprove = can(PERMISSIONS.CREATIVE_APPROVAL) || can(PERMISSIONS.CREATIVE_APPROVAL_OWN);
    const [creatives, setCreatives] = useState(null);
    const [loadError, setLoadError] = useState(null);
    const [decisionError, setDecisionError] = useState(null);
    const [decided, setDecided] = useState(null);
    const [rejecting, setRejecting] = useState(null);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!user || !canApprove) return;
        apiService.getCreatives()
            .then(setCreatives)
            .catch(error => setLoadError(error.message));
    }, [user, canApprove]);

    if (user && !canApprove) return <Navigate to="/dashboard" replace />;

    const decide = async (creative, verdict, request) => {
        setBusy(true);
        setDecisionError(null);
        try {
            await request();
            setCreatives(current => current.filter(other => other.id !== creative.id));
            setDecided(`${verdict} “${creative.title || creative.id}”.`);
            setRejecting(null);
            setReason('');
        } catch (error) {
            setDecisionError(error.message);
        } finally {
            setBusy(false);
        }
    };

    const waiting = (creatives || []).filter(creative => creative.awaits_your_decision);

    return (
        <div className="space-y-6" data-testid="creative-approvals-page">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Creative Approvals</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    A Creative is approved once and plays in every Campaign and on every date that uses it.
                    Preview every file before you decide.
                </p>
            </div>

            {loadError && <p role="alert" className="text-sm text-red-600">Creatives could not be loaded: {loadError}</p>}
            {decisionError && <p role="alert" className="text-sm text-red-600">{decisionError}</p>}
            {decided && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{decided}</p>}
            {!creatives && !loadError && <p className="text-sm text-slate-500">Loading…</p>}
            {creatives && waiting.length === 0 && (
                <p data-testid="creative-approvals-empty" className="text-sm text-slate-500">
                    No Creatives are waiting for your approval.
                </p>
            )}

            {waiting.map(creative => (
                <section key={creative.id} data-testid={`creative-approval-${creative.id}`}
                    className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h2 className="font-semibold text-slate-900 dark:text-white">{creative.title || creative.id}</h2>
                    <div className="flex flex-wrap gap-3">
                        {creative.files.map(file => <CreativeFilePreview key={file.id} file={file} />)}
                    </div>
                    <div className="flex flex-wrap items-start gap-2">
                        <button type="button" data-testid={`approve-creative-${creative.id}`} disabled={busy}
                            onClick={() => decide(creative, 'Approved', () => apiService.approveCreative(creative.id))}
                            className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50">
                            Approve
                        </button>
                        {rejecting !== creative.id ? (
                            <button type="button" data-testid={`reject-creative-${creative.id}`} disabled={busy}
                                onClick={() => { setRejecting(creative.id); setReason(''); }}
                                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50">
                                Reject
                            </button>
                        ) : (
                            <div className="flex w-full flex-col gap-2 sm:w-auto">
                                <label className="text-sm text-slate-600 dark:text-slate-300" htmlFor={`reject-reason-${creative.id}`}>
                                    Why is it rejected? The Brand sees this.
                                </label>
                                <textarea id={`reject-reason-${creative.id}`} data-testid={`reject-reason-${creative.id}`}
                                    value={reason} onChange={event => setReason(event.target.value)} rows={2}
                                    className="rounded border border-slate-300 p-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
                                <button type="button" data-testid={`confirm-reject-creative-${creative.id}`}
                                    disabled={busy || !reason.trim()}
                                    onClick={() => decide(creative, 'Rejected',
                                        () => apiService.rejectCreative(creative.id, reason.trim()))}
                                    className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50">
                                    Reject Creative
                                </button>
                            </div>
                        )}
                    </div>
                </section>
            ))}
        </div>
    );
}
