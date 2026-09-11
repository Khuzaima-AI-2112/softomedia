import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import apiService from '../../services/ApiService';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../constants/roles';

export default function OrganizationManagement() {
    const { user, loading } = useAuth();
    const [organizations, setOrganizations] = useState([]);
    const [form, setForm] = useState({ name: '', type: 'retailer' });
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(null);

    const isSuperAdmin = user?.role === ROLES.SUPERADMIN;

    useEffect(() => {
        if (!isSuperAdmin) return;
        apiService.getDemoOrganizations()
            .then(setOrganizations)
            .catch((requestError) => setError(requestError.message || 'Failed to load demo organizations.'));
    }, [isSuperAdmin]);

    if (loading) return null;
    if (!isSuperAdmin) return <Navigate to="/dashboard/admin" replace />;

    const createOrganization = async (event) => {
        event.preventDefault();
        setSaving(true);
        setError('');
        try {
            const created = await apiService.createDemoOrganization(form);
            setOrganizations((current) => [...current, created]);
            setForm({ name: '', type: 'retailer' });
        } catch (requestError) {
            setError(requestError.message || 'Failed to create demo organization.');
        } finally {
            setSaving(false);
        }
    };

    const changeOrganizationStatus = async (organization, status) => {
        setError('');
        try {
            const updated = await apiService.updateDemoOrganization(organization.id, { status });
            setOrganizations((current) => current.map((item) => item.id === updated.id ? updated : item));
        } catch (requestError) {
            setError(requestError.message || 'Failed to update demo organization.');
        }
    };

    const saveOrganizationChanges = async (event) => {
        event.preventDefault();
        setError('');
        try {
            const updated = await apiService.updateDemoOrganization(editing.id, {
                name: editing.name,
                type: editing.type,
            });
            setOrganizations((current) => current.map((item) => item.id === updated.id ? updated : item));
            setEditing(null);
        } catch (requestError) {
            setError(requestError.message || 'Failed to update demo organization.');
        }
    };

    return (
        <div className="space-y-6" data-testid="organization-management">
            <div>
                <h1 className="text-2xl font-bold">Demo Organizations</h1>
                <p className="text-sm text-slate-500">These organizations are stored separately from live data.</p>
            </div>

            <form onSubmit={createOrganization} className="flex flex-wrap gap-3 items-end">
                <label className="flex flex-col gap-1 text-sm">
                    Organization name
                    <input
                        value={form.name}
                        onChange={(event) => setForm({ ...form, name: event.target.value })}
                        required
                        className="rounded border px-3 py-2"
                    />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    Organization type
                    <select
                        value={form.type}
                        onChange={(event) => setForm({ ...form, type: event.target.value })}
                        className="rounded border px-3 py-2"
                    >
                        <option value="retailer">Retailer</option>
                        <option value="brand">Brand</option>
                        <option value="platform">Softomedia</option>
                    </select>
                </label>
                <button type="submit" disabled={saving} className="rounded bg-primary px-4 py-2 text-white disabled:opacity-50">
                    {saving ? 'Creating…' : 'Create organization'}
                </button>
            </form>

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            {editing && (
                <form onSubmit={saveOrganizationChanges} className="flex flex-wrap items-end gap-3 rounded border p-3">
                    <label className="flex flex-col gap-1 text-sm">
                        Edit organization name
                        <input
                            value={editing.name}
                            onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                            required
                            className="rounded border px-3 py-2"
                        />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                        Edit organization type
                        <select
                            value={editing.type}
                            onChange={(event) => setEditing({ ...editing, type: event.target.value })}
                            className="rounded border px-3 py-2"
                        >
                            <option value="retailer">Retailer</option>
                            <option value="brand">Brand</option>
                            <option value="platform">Softomedia</option>
                        </select>
                    </label>
                    <button type="submit" className="rounded bg-primary px-4 py-2 text-white">Save organization changes</button>
                    <button type="button" onClick={() => setEditing(null)} className="px-2 py-2 text-sm underline">Cancel</button>
                </form>
            )}

            <DataTable
                data={organizations}
                emptyMessage="No demo organizations yet."
                columns={[
                    { key: 'name', label: 'Name' },
                    { key: 'type', label: 'Type' },
                    { key: 'status', label: 'Status' },
                    {
                        key: 'actions',
                        label: 'Actions',
                        render: (_value, organization) => {
                            const deactivating = organization.status !== 'inactive';
                            const nextStatus = deactivating ? 'inactive' : 'active';
                            const label = `${deactivating ? 'Deactivate' : 'Reactivate'} ${organization.name}`;
                            return (<div className="flex gap-3">
                                <button
                                    type="button"
                                    aria-label={`Edit ${organization.name}`}
                                    onClick={() => setEditing({ ...organization })}
                                    className="text-sm text-primary underline"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    aria-label={label}
                                    onClick={() => changeOrganizationStatus(organization, nextStatus)}
                                    className="text-sm text-primary underline"
                                >
                                    {deactivating ? 'Deactivate' : 'Reactivate'}
                                </button>
                            </div>);
                        },
                    },
                ]}
            />
        </div>
    );
}
