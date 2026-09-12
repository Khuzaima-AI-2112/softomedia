import { useEffect, useState } from 'react';
import GlassCard from '../../components/GlassCard';
import apiService from '../../services/ApiService';

const CATEGORY_DETAILS = {
    paid: { label: 'Paid campaign', ownerType: 'brand', needsOwner: true },
    retailer: { label: 'Retailer campaign', ownerType: 'retailer', needsOwner: true },
    internal: { label: 'Internal campaign', ownerType: 'platform', needsOwner: false },
    fallback: { label: 'Neutral fallback', ownerType: 'platform', needsOwner: false },
};

function MediaLibrary() {
    const [assets, setAssets] = useState([]);
    const [form, setForm] = useState({ title: '', category: 'paid', ownerId: '', approvalStatus: 'approved' });
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        apiService.getAssets()
            .then(result => setAssets(result || []))
            .catch(err => setError(err.message || 'Media could not be loaded'))
            .finally(() => setLoading(false));
    }, []);

    const category = CATEGORY_DETAILS[form.category];

    async function handleSubmit(event) {
        event.preventDefault();
        setError('');
        setSuccess('');
        if (!file) {
            setError('Choose a media file');
            return;
        }

        const payload = new FormData();
        payload.append('file', file);
        payload.append('title', form.title);
        payload.append('category', form.category);
        payload.append('owner_type', category.ownerType);
        payload.append('owner_id', category.needsOwner ? form.ownerId : '');
        payload.append('approval_status', form.approvalStatus);
        payload.append('duration', '5');

        setUploading(true);
        try {
            const persisted = await apiService.uploadAsset(payload);
            setAssets(current => [persisted, ...current]);
            setSuccess('Media uploaded successfully.');
            setForm(current => ({ ...current, title: '', ownerId: '' }));
            setFile(null);
        } catch (err) {
            setError(err.message || 'Media could not be saved');
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="space-y-6" data-testid="admin-media-library">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Media library</h1>
                <p className="mt-1 text-slate-500 dark:text-slate-400">
                    Upload classified assets that are ready for campaign and fallback playback.
                </p>
            </div>

            <GlassCard>
                <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Title
                        <input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800" />
                    </label>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Category
                        <select value={form.category} onChange={event => setForm({ ...form, category: event.target.value, ownerId: '' })}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                            {Object.entries(CATEGORY_DETAILS).map(([value, details]) => (
                                <option key={value} value={value}>{details.label}</option>
                            ))}
                        </select>
                    </label>
                    {category.needsOwner && (
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {category.ownerType === 'brand' ? 'Brand ID' : 'Retailer ID'}
                            <input required value={form.ownerId} onChange={event => setForm({ ...form, ownerId: event.target.value })}
                                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800" />
                        </label>
                    )}
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        Approval status
                        <select value={form.approvalStatus} onChange={event => setForm({ ...form, approvalStatus: event.target.value })}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
                            <option value="approved">Approved</option>
                            <option value="pending_approval">Pending approval</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-200 md:col-span-2">
                        Media file
                        <input type="file" accept=".png,.jpg,.jpeg,.mp4" onChange={event => setFile(event.target.files?.[0] || null)}
                            className="mt-1 block w-full rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-600" />
                    </label>
                    <div className="md:col-span-2 flex items-center gap-4">
                        <button type="submit" disabled={uploading}
                            className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-white disabled:opacity-60">
                            {uploading ? 'Uploading…' : 'Upload media'}
                        </button>
                        <span className="text-xs text-slate-500">PNG, JPG, or 5-second MP4 · maximum 5 MB</span>
                    </div>
                </form>
                {error && <p className="mt-4 text-sm text-rose-600" role="alert">{error}</p>}
                {success && <p className="mt-4 text-sm text-emerald-600" role="status">{success}</p>}
            </GlassCard>

            <GlassCard>
                <h2 className="mb-4 text-lg font-bold">Persisted media</h2>
                {loading ? <p>Loading media…</p> : assets.length === 0 ? (
                    <p className="text-sm text-slate-500">No media has been uploaded yet.</p>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {assets.map(asset => (
                            <article key={asset.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700" data-testid={`media-${asset.id}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <h3 className="font-semibold">{asset.title}</h3>
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                                        {CATEGORY_DETAILS[asset.category]?.label || asset.category}
                                    </span>
                                </div>
                                <dl className="mt-3 space-y-1 text-xs text-slate-500">
                                    <div><dt className="inline font-medium">Owner: </dt><dd className="inline">{asset.owner_id || 'Softomedia platform'}</dd></div>
                                    <div><dt className="inline font-medium">Eligibility: </dt><dd className="inline">{asset.eligible_for_playback ? 'Eligible' : asset.approval_status}</dd></div>
                                    <div><dt className="inline font-medium">Playback: </dt><dd className="inline">{asset.duration}s · {asset.filename}</dd></div>
                                </dl>
                            </article>
                        ))}
                    </div>
                )}
            </GlassCard>
        </div>
    );
}

export default MediaLibrary;
