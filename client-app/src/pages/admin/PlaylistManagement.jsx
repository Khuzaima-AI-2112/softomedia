import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../../config';

function PlaylistManagement() {
    const navigate = useNavigate();
    const [playlists, setPlaylists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL', 'GLOBAL', 'ASSIGNED'

    useEffect(() => {
        fetchPlaylists();
    }, []);

    const fetchPlaylists = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/playlists`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPlaylists(data);
            }
        } catch (error) {
            console.error('Failed to fetch playlists', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this playlist?')) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_URL}/api/playlists/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            fetchPlaylists();
        } catch (error) {
            console.error('Failed to delete playlist', error);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Playlists</h1>
                    <p className="text-gray-400">Manage content schedules and rotations</p>
                </div>
                <button
                    onClick={() => navigate('/admin/playlists/new')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                    <span>+ New Playlist</span>
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setTypeFilter('ALL')}
                    className={`px-4 py-2 rounded-lg text-sm ${typeFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                    All
                </button>
                <button
                    onClick={() => setTypeFilter('GLOBAL')}
                    className={`px-4 py-2 rounded-lg text-sm ${typeFilter === 'GLOBAL' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                    🌐 Global
                </button>
                <button
                    onClick={() => setTypeFilter('ASSIGNED')}
                    className={`px-4 py-2 rounded-lg text-sm ${typeFilter === 'ASSIGNED' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
                >
                    📋 Assigned
                </button>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-900 text-gray-400 uppercase text-xs">
                        <tr>
                            <th className="px-6 py-3">Name</th>
                            <th className="px-6 py-3">Type</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3">Items</th>
                            <th className="px-6 py-3">Schedule</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {playlists
                            .filter(p => {
                                if (typeFilter === 'GLOBAL') return p.is_global;
                                if (typeFilter === 'ASSIGNED') return !p.is_global;
                                return true;
                            })
                            .map((playlist) => (
                                <tr key={playlist.id} className="hover:bg-gray-750">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-white">{playlist.name}</div>
                                        <div className="text-sm text-gray-500">{playlist.description}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {playlist.is_global ? (
                                            <span className="px-2 py-1 rounded-full text-xs bg-amber-900 text-amber-300">🌐 Global</span>
                                        ) : (
                                            <span className="px-2 py-1 rounded-full text-xs bg-blue-900 text-blue-300">
                                                📋 {playlist.assignments?.length || 0} screens
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs ${playlist.status === 'ACTIVE' ? 'bg-green-900 text-green-300' :
                                            playlist.status === 'DRAFT' ? 'bg-yellow-900 text-yellow-300' :
                                                'bg-gray-700 text-gray-300'
                                            }`}>
                                            {playlist.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-300">
                                        {playlist.items?.length || 0} ads
                                    </td>
                                    <td className="px-6 py-4 text-gray-300 text-sm">
                                        {playlist.schedule?.days_of_week ? 'Weekly Schedule' : '24/7'}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-3">
                                        <button
                                            onClick={() => navigate(`/admin/playlists/${playlist.id}`)}
                                            className="text-indigo-400 hover:text-indigo-300"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(playlist.id)}
                                            className="text-red-400 hover:text-red-300"
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        {playlists.filter(p => typeFilter === 'ALL' || (typeFilter === 'GLOBAL' ? p.is_global : !p.is_global)).length === 0 && !loading && (
                            <tr>
                                <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                                    No playlists found. Create one to get started.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default PlaylistManagement;
