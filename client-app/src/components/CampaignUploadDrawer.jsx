import React, { useState } from 'react';
import { campaignsAPI } from '../services/api';
import { useToast } from '../contexts/ToastContext';
import AdSchedule from './AdSchedule';

function CampaignUploadDrawer({ isOpen, onClose, onSuccess }) {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        title: '',
        duration_seconds: 5,
        start_date: '',
        end_date: '',
        schedule: {
            enabled: false,
            rules: []
        }
    });
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!file) {
            showToast('Please select a file', 'error');
            return;
        }

        if (!formData.title) {
            showToast('Please enter a campaign title', 'error');
            return;
        }

        try {
            setUploading(true);
            const data = new FormData();
            data.append('video', file);
            data.append('title', formData.title);
            data.append('duration_seconds', formData.duration_seconds);
            data.append('start_date', formData.start_date);
            data.append('end_date', formData.end_date);
            data.append('schedule', JSON.stringify(formData.schedule));

            await campaignsAPI.upload(data);
            showToast('Campaign uploaded successfully!', 'success');

            // Reset form
            setFormData({
                title: '',
                duration_seconds: 5,
                start_date: '',
                end_date: '',
                schedule: { enabled: false, rules: [] }
            });
            setFile(null);

            if (onSuccess) onSuccess();
            if (onClose) onClose();
        } catch (err) {
            showToast(`Upload failed: ${err.message}`, 'error');
        } finally {
            setUploading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Overlay */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 40
                }}
            />

            {/* Drawer */}
            <div style={{
                position: 'fixed',
                right: 0,
                top: 0,
                bottom: 0,
                width: '500px',
                maxWidth: '100%',
                backgroundColor: '#fff',
                boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.1)',
                zIndex: 50,
                overflowY: 'auto',
                fontFamily: 'Inter, sans-serif'
            }}>
                {/* Header */}
                <div style={{
                    padding: '1.5rem',
                    borderBottom: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Upload Campaign</h2>
                    <button
                        onClick={onClose}
                        style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            color: '#6b7280'
                        }}
                    >×</button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
                    {/* Campaign Title */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                            Campaign Title *
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.5rem',
                                fontSize: '1rem'
                            }}
                            placeholder="Enter campaign name"
                        />
                    </div>

                    {/* File Upload */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                            Video File *
                        </label>
                        <input
                            type="file"
                            onChange={handleFileChange}
                            accept="video/*,image/*"
                            required
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.5rem',
                                fontSize: '1rem'
                            }}
                        />
                        {file && (
                            <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#10b981' }}>
                                Selected: {file.name}
                            </p>
                        )}
                    </div>

                    {/* Duration */}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                            Duration (seconds)
                        </label>
                        <input
                            type="number"
                            name="duration_seconds"
                            value={formData.duration_seconds}
                            onChange={handleChange}
                            min="1"
                            max="60"
                            style={{
                                width: '100%',
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '0.5rem',
                                fontSize: '1rem'
                            }}
                        />
                    </div>

                    {/* Date Range */}
                    <div style={{ marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                                Start Date
                            </label>
                            <input
                                type="date"
                                name="start_date"
                                value={formData.start_date}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                                End Date
                            </label>
                            <input
                                type="date"
                                name="end_date"
                                value={formData.end_date}
                                onChange={handleChange}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem'
                                }}
                            />
                        </div>
                    </div>

                    {/* Ad Scheduling Section */}
                    <div style={{ marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                        <AdSchedule
                            schedule={formData.schedule}
                            onChange={(newSchedule) => setFormData({ ...formData, schedule: newSchedule })}
                        />
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={uploading}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            backgroundColor: uploading ? '#9ca3af' : '#6366f1',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontSize: '1rem',
                            fontWeight: '500',
                            cursor: uploading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {uploading ? 'Uploading...' : 'Upload Campaign'}
                    </button>
                </form>
            </div>
        </>
    );
}

export default CampaignUploadDrawer;
