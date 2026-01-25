import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import apiService from '../../services/ApiService';

function PlaylistEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = !id;

    const [details, setDetails] = useState({ name: '', description: '', status: 'ACTIVE', assignments: ['ALL'], is_global: false });
    const [uploading, setUploading] = useState(false);
    const [availableAssets, setAvailableAssets] = useState([]);
    const [availableScreens, setAvailableScreens] = useState([]);
    const [locations, setLocations] = useState([]);
    const [selectedLocation, setSelectedLocation] = useState('ALL');
    const [playlistItems, setPlaylistItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch Assets, Screens, Locations in parallel
                const [assetsData, screensData, locationsData] = await Promise.all([
                    apiService.getAssets(),
                    apiService.getScreens(),
                    apiService.getLocations()
                ]);
                setAvailableAssets(assetsData || []);
                setAvailableScreens(screensData || []);
                setLocations(locationsData || []);

                // Fetch Playlist if Editing
                if (!isNew) {
                    const playlistData = await apiService.getPlaylist(id);
                    setDetails({
                        name: playlistData.name,
                        description: playlistData.description,
                        status: playlistData.status || 'ACTIVE',
                        assignments: playlistData.assignments || ['ALL'],
                        is_global: playlistData.is_global || false
                    });

                    // Map items to include details from assets if needed
                    const hydratedItems = playlistData.items.map(item => {
                        const asset = (assetsData || []).find(a => a.id === item.media_id);
                        return {
                            ...item,
                            filename: asset?.filename || 'Unknown Asset',
                            duration: item.duration || 10
                        };
                    });
                    setPlaylistItems(hydratedItems);
                }
            } catch (error) {
                console.error('Failed to load data', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, isNew]);

    const handleAddItem = (asset) => {
        setPlaylistItems([
            ...playlistItems,
            {
                media_id: asset.id,
                filename: asset.filename,
                duration: details.is_global ? 5 : (asset.duration || 10),
                order: playlistItems.length + 1,
                uniqueId: Date.now() // For React keys in list
            }
        ]);
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('filename', file.name);
            formData.append('file_type', file.type);
            formData.append('duration', details.is_global ? 5 : 10);

            const asset = await apiService.uploadAsset(formData);
            if (asset) {
                handleAddItem(asset);
                // Refresh assets list
                const assetsData = await apiService.getAssets();
                setAvailableAssets(assetsData || []);
            }
        } catch (error) {
            console.error('Upload error', error);
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveItem = (index) => {
        const newItems = [...playlistItems];
        newItems.splice(index, 1);
        setPlaylistItems(newItems);
    };

    const handleMoveItem = (index, direction) => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === playlistItems.length - 1) return;

        const newItems = [...playlistItems];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const temp = newItems[targetIndex];
        newItems[targetIndex] = newItems[index];
        newItems[index] = temp;
        setPlaylistItems(newItems);
    };

    const handleDurationChange = (index, value) => {
        const newItems = [...playlistItems];
        newItems[index].duration = parseInt(value) || 5;
        setPlaylistItems(newItems);
    };

    const handleAssignmentChange = (e) => {
        const val = e.target.value;
        setDetails({ ...details, assignments: [val] });
    };

    const handleSave = async () => {
        // Prepare payload
        const payload = {
            ...details,
            is_global: details.is_global,
            items: playlistItems.map((item, idx) => ({
                media_id: item.media_id,
                duration: details.is_global ? 5 : item.duration, // Force 5s for global
                order: idx + 1
            }))
        };

        try {
            if (isNew) {
                await apiService.createPlaylist(payload);
            } else {
                await apiService.updatePlaylist(id, payload);
            }
            navigate('/admin/playlists');
        } catch (error) {
            console.error('Save failed', error);
            alert('Failed to save playlist');
        }
    };

    if (loading) return <div className="p-8 text-white">Loading Editor...</div>;

    return (
        <div className="p-6 h-screen flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">{isNew ? 'Create Playlist' : 'Edit Playlist'}</h1>
                </div>
                <div className="space-x-4">
                    <button
                        onClick={() => navigate('/admin/playlists')}
                        className="text-gray-400 hover:text-white"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg"
                    >
                        Save Playlist
                    </button>
                </div>
            </div>

            {/* Details Form */}
            <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 mb-6 flex flex-wrap gap-4">
                <input
                    type="text"
                    placeholder="Playlist Name"
                    value={details.name}
                    onChange={(e) => setDetails({ ...details, name: e.target.value })}
                    className="bg-gray-900 text-white px-4 py-2 rounded border border-gray-600 flex-1 min-w-[200px]"
                />
                <input
                    type="text"
                    placeholder="Description (Optional)"
                    value={details.description}
                    onChange={(e) => setDetails({ ...details, description: e.target.value })}
                    className="bg-gray-900 text-white px-4 py-2 rounded border border-gray-600 flex-1 min-w-[200px]"
                />

                <select
                    value={details.status}
                    onChange={(e) => setDetails({ ...details, status: e.target.value })}
                    className="bg-gray-900 text-white px-4 py-2 rounded border border-gray-600 w-[150px]"
                >
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                </select>

                {/* Global Playlist Toggle */}
                <label className="flex items-center gap-2 text-gray-300 bg-gray-900 px-4 py-2 rounded border border-gray-600 cursor-pointer hover:border-indigo-500">
                    <input
                        type="checkbox"
                        checked={details.is_global}
                        onChange={(e) => setDetails({ ...details, is_global: e.target.checked })}
                        className="rounded text-indigo-500"
                    />
                    <span>🌐 Global (5s rotation)</span>
                </label>

                {!details.is_global && (
                    <>
                        {/* Location Filter */}
                        <select
                            value={selectedLocation}
                            onChange={(e) => setSelectedLocation(e.target.value)}
                            className="bg-gray-900 text-white px-4 py-2 rounded border border-gray-600 w-[180px]"
                        >
                            <option value="ALL">All Locations</option>
                            {locations.map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                            ))}
                        </select>

                        {/* Screen Assignment */}
                        <select
                            value={details.assignments[0] || 'ALL'}
                            onChange={handleAssignmentChange}
                            className="bg-gray-900 text-white px-4 py-2 rounded border border-gray-600 w-[200px]"
                        >
                            <option value="ALL">All Screens</option>
                            {availableScreens
                                .filter(s => selectedLocation === 'ALL' || s.location_id === selectedLocation)
                                .map(screen => (
                                    <option key={screen.id} value={screen.screen_id || screen.id}>
                                        {screen.name || screen.screen_id} {screen.resolution ? `(${screen.resolution})` : ''}
                                    </option>
                                ))}
                        </select>
                    </>
                )}
            </div>

            {/* Builder Area */}
            <div className="flex-1 flex gap-6 overflow-hidden">
                {/* Left: Available Assets */}
                <div className="w-1/3 flex flex-col bg-gray-800 rounded-lg border border-gray-700">
                    <div className="p-4 border-b border-gray-700">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-gray-300">Available Media</span>
                            <label className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded cursor-pointer">
                                {uploading ? 'Uploading...' : '+ Upload'}
                                <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/gif,video/mp4"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                    className="hidden"
                                />
                            </label>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {availableAssets.map(asset => (
                            <div key={asset.id} className="bg-gray-900 p-3 rounded border border-gray-700 flex justify-between items-center group">
                                <div>
                                    <div className="text-white text-sm font-medium">{asset.filename}</div>
                                    <div className="text-gray-500 text-xs">{asset.duration}s • {asset.file_type || 'Image'}</div>
                                </div>
                                <button
                                    onClick={() => handleAddItem(asset)}
                                    className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold"
                                >
                                    + ADD
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Playlist Sequence */}
                <div className="w-2/3 flex flex-col bg-gray-800 rounded-lg border border-gray-700">
                    <div className="p-4 border-b border-gray-700 font-semibold text-gray-300 flex justify-between">
                        <span>Playlist Sequence</span>
                        <span className="text-xs text-indigo-400">{playlistItems.length} items • Total Duration: {playlistItems.reduce((acc, i) => acc + i.duration, 0)}s</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {playlistItems.map((item, index) => (
                            <div key={item.uniqueId || index} className="bg-gray-900 p-3 rounded border border-gray-600 flex items-center gap-4">
                                <div className="text-gray-500 font-mono w-6 text-center">{index + 1}</div>
                                <div className="flex-1">
                                    <div className="text-white font-medium">{item.filename}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500 text-xs">Duration (s):</span>
                                    <input
                                        type="number"
                                        value={details.is_global ? 5 : item.duration}
                                        onChange={(e) => handleDurationChange(index, e.target.value)}
                                        disabled={details.is_global}
                                        className={`w-16 text-center border rounded px-1 py-1 text-sm ${details.is_global ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gray-800 text-white border-gray-600'}`}
                                    />
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => handleMoveItem(index, 'up')} className="text-gray-400 hover:text-white p-1">▲</button>
                                    <button onClick={() => handleMoveItem(index, 'down')} className="text-gray-400 hover:text-white p-1">▼</button>
                                </div>
                                <button onClick={() => handleRemoveItem(index)} className="text-red-400 hover:text-red-300 ml-2">✕</button>
                            </div>
                        ))}
                        {playlistItems.length === 0 && (
                            <div className="text-center text-gray-600 py-12 border-2 border-dashed border-gray-700 rounded-lg">
                                Playlist is empty. Add items from the left.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PlaylistEditor;
