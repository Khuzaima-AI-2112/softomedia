import React, { useState } from 'react';
import { API_URL } from '../../config.js';
import SlideDrawer from '../../components/SlideDrawer';
import '../../design-tokens.css';

/**
 * CampaignDrawer - State 8: Campaign Injection (Content Ingest Drawer)
 * Slide-out drawer for uploading new campaign content
 */
function CampaignDrawer({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        duration: 30,
        targetScreens: [],
    });
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile.type.startsWith('video/')) {
                setFile(droppedFile);
            } else {
                alert('Please upload a video file');
            }
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!file) {
            alert('Please select a video file');
            return;
        }

        setUploading(true);

        try {
            // TODO: Implement actual upload
            const formDataToSend = new FormData();
            formDataToSend.append('video', file);
            formDataToSend.append('name', formData.name);
            formDataToSend.append('duration', formData.duration);
            formDataToSend.append('targetScreens', JSON.stringify(formData.targetScreens));

            // Simulate upload
            await new Promise(resolve => setTimeout(resolve, 2000));

            // const response = await fetch(`${API_URL}/api/campaigns/create`, {
            //     method: 'POST',
            //     body: formDataToSend,
            // });

            alert('Campaign uploaded successfully!');

            // Reset form
            setFormData({ name: '', duration: 30, targetScreens: [] });
            setFile(null);

            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Failed to upload campaign');
        } finally {
            setUploading(false);
        }
    };

    return (
        <SlideDrawer isOpen={isOpen} onClose={onClose} title="Upload New Campaign" width="600px">
            <form onSubmit={handleSubmit}>
                {/* Campaign Name */}
                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <label
                        style={{
                            display: 'block',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)',
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-text-primary)',
                        }}
                    >
                        Campaign Name *
                    </label>
                    <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Holiday Sale 2025"
                        style={{
                            width: '100%',
                            padding: 'var(--space-3)',
                            fontSize: 'var(--text-base)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            outline: 'none',
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'var(--color-primary)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                        }}
                    />
                </div>

                {/* Duration */}
                <div style={{ marginBottom: 'var(--space-6)' }}>
                    <label
                        style={{
                            display: 'block',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)',
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-text-primary)',
                        }}
                    >
                        Duration (seconds) *
                    </label>
                    <input
                        type="number"
                        required
                        min="5"
                        max="60"
                        value={formData.duration}
                        onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                        style={{
                            width: '100%',
                            padding: 'var(--space-3)',
                            fontSize: 'var(--text-base)',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            outline: 'none',
                        }}
                        onFocus={(e) => {
                            e.currentTarget.style.borderColor = 'var(--color-primary)';
                        }}
                        onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'var(--color-border)';
                        }}
                    />
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                        Recommended: 15-30 seconds
                    </p>
                </div>

                {/* Video Upload */}
                <div style={{ marginBottom: 'var(--space-8)' }}>
                    <label
                        style={{
                            display: 'block',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 'var(--font-medium)',
                            marginBottom: 'var(--space-2)',
                            color: 'var(--color-text-primary)',
                        }}
                    >
                        Video File (1080p) *
                    </label>

                    {/* Drag & Drop Area */}
                    <div
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                        style={{
                            border: `2px dashed ${dragActive ? 'var(--color-primary)' : 'var(--color-border)'}`,
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--space-8)',
                            textAlign: 'center',
                            backgroundColor: dragActive ? 'rgba(99, 102, 241, 0.05)' : 'var(--color-bg-hover)',
                            transition: 'all var(--transition-base)',
                            cursor: 'pointer',
                        }}
                        onClick={() => document.getElementById('fileInput').click()}
                    >
                        <input
                            id="fileInput"
                            type="file"
                            accept="video/*"
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />

                        {file ? (
                            <div>
                                <p style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>🎥</p>
                                <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>
                                    {file.name}
                                </p>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                                    {(file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setFile(null);
                                    }}
                                    style={{
                                        marginTop: 'var(--space-3)',
                                        padding: 'var(--space-2) var(--space-4)',
                                        fontSize: 'var(--text-sm)',
                                        color: 'var(--color-error)',
                                        backgroundColor: 'transparent',
                                        border: '1px solid var(--color-error)',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <div>
                                <p style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-2)' }}>📁</p>
                                <p style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--font-medium)', color: 'var(--color-text-primary)' }}>
                                    Drag and drop your video here
                                </p>
                                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--space-1)' }}>
                                    or click to browse
                                </p>
                                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', marginTop: 'var(--space-2)' }}>
                                    Supported: MP4, MOV, AVI (Max 500MB)
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={uploading}
                        style={{
                            padding: 'var(--space-3) var(--space-6)',
                            fontSize: 'var(--text-base)',
                            fontWeight: 'var(--font-medium)',
                            color: 'var(--color-text-secondary)',
                            backgroundColor: 'transparent',
                            border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-md)',
                            cursor: uploading ? 'not-allowed' : 'pointer',
                            opacity: uploading ? 0.5 : 1,
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={uploading || !file}
                        style={{
                            padding: 'var(--space-3) var(--space-8)',
                            fontSize: 'var(--text-base)',
                            fontWeight: 'var(--font-semibold)',
                            color: 'white',
                            backgroundColor: uploading || !file ? 'var(--color-text-tertiary)' : 'var(--color-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: uploading || !file ? 'not-allowed' : 'pointer',
                            transition: 'all var(--transition-base)',
                        }}
                        onMouseEnter={(e) => {
                            if (!uploading && file) {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                            }
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}
                    >
                        {uploading ? 'Uploading...' : 'Publish Campaign'}
                    </button>
                </div>
            </form>
        </SlideDrawer>
    );
}

export default CampaignDrawer;
