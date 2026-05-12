import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

// Pages — top level
import Login from './pages/Login';
import Player from './pages/Player';
import LoopDemoPlayer from './pages/LoopDemoPlayer';
import Health from './pages/Health';
import CampaignReport from './pages/CampaignReport';

// Pages — admin (all verified present on disk)
import Overview from './pages/admin/Overview';
import UserManagement from './pages/admin/UserManagement';
import ScreenManagement from './pages/admin/ScreenManagement';
import RetailerManagement from './pages/admin/RetailerManagement';
import AdvertiserManagement from './pages/admin/AdvertiserManagement';
import BusinessHoursManagement from './pages/admin/BusinessHoursManagement';
import PlaylistManagement from './pages/admin/PlaylistManagement';
import PlaylistEditor from './pages/admin/PlaylistEditor';
import LoopManagement from './pages/admin/LoopManagement';
import LoopBuilder from './pages/admin/LoopBuilder';
import LoopAnalytics from './pages/admin/LoopAnalytics';
import NetworkMap from './pages/admin/NetworkMap';
import CPMCalendar from './pages/admin/CPMCalendar';
import AILog from './pages/admin/AILog';

// Pages — brand
import BrandDashboard from './pages/brand/BrandDashboard';
import BrandCampaignWizard from './pages/brand/BrandCampaignWizard';

// Pages — retailer
import RetailerDashboard from './pages/retailer/RetailerDashboard';
import ScheduleManager from './pages/retailer/ScheduleManager';
import ScheduleCalendar from './pages/retailer/ScheduleCalendar';
import ScheduleHistory from './pages/retailer/ScheduleHistory';

// Pages — tech
import TechOpsDashboard from './pages/tech/TechOpsDashboard';

import DashboardLayout from './layouts/DashboardLayout';

// Protected Route wrapper
function ProtectedRoute({ children, allowedRoles = [] }) {
    const { user, isAuthenticated, loading } = useAuth();

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                fontSize: '1.2rem',
                color: '#666',
            }}>
                Loading...
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

function App() {
    return (
        <Router>
            <ToastProvider>
                <AuthProvider>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/screen/:screenId" element={<Player />} />
                        <Route path="/player" element={<Player />} />
                        <Route path="/player/demo" element={<LoopDemoPlayer />} />

                        {/* Dashboard shell — all persona sub-routes nest here */}
                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <DashboardLayout />
                                </ProtectedRoute>
                            }
                        >
                            {/* Admin routes */}
                            <Route index element={<Navigate to="/dashboard/admin" replace />} />
                            <Route path="admin" element={<ProtectedRoute allowedRoles={['admin']}><Overview /></ProtectedRoute>} />
                            <Route path="admin/screens" element={<ProtectedRoute allowedRoles={['admin']}><ScreenManagement /></ProtectedRoute>} />
                            <Route path="admin/playlists" element={<ProtectedRoute allowedRoles={['admin']}><PlaylistManagement /></ProtectedRoute>} />
                            <Route path="admin/playlists/new" element={<ProtectedRoute allowedRoles={['admin']}><PlaylistEditor /></ProtectedRoute>} />
                            <Route path="admin/playlists/:id" element={<ProtectedRoute allowedRoles={['admin']}><PlaylistEditor /></ProtectedRoute>} />
                            <Route path="admin/loops" element={<ProtectedRoute allowedRoles={['admin']}><LoopManagement /></ProtectedRoute>} />
                            <Route path="admin/loops/:id" element={<ProtectedRoute allowedRoles={['admin']}><LoopBuilder /></ProtectedRoute>} />
                            <Route path="admin/analytics" element={<ProtectedRoute allowedRoles={['admin']}><LoopAnalytics /></ProtectedRoute>} />
                            <Route path="admin/map" element={<ProtectedRoute allowedRoles={['admin']}><NetworkMap /></ProtectedRoute>} />
                            <Route path="admin/pricing" element={<ProtectedRoute allowedRoles={['admin']}><CPMCalendar /></ProtectedRoute>} />
                            <Route path="admin/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
                            <Route path="admin/retailers" element={<ProtectedRoute allowedRoles={['admin']}><RetailerManagement /></ProtectedRoute>} />
                            <Route path="admin/hours" element={<ProtectedRoute allowedRoles={['admin']}><BusinessHoursManagement /></ProtectedRoute>} />
                            <Route path="admin/advertisers" element={<ProtectedRoute allowedRoles={['admin']}><AdvertiserManagement /></ProtectedRoute>} />
                            <Route path="admin/ai-log" element={<ProtectedRoute allowedRoles={['admin']}><AILog /></ProtectedRoute>} />

                            {/* Brand routes */}
                            <Route path="brand" element={<ProtectedRoute allowedRoles={['brand', 'admin']}><BrandDashboard /></ProtectedRoute>} />
                            <Route path="brand/campaign/new" element={<ProtectedRoute allowedRoles={['brand', 'admin']}><BrandCampaignWizard /></ProtectedRoute>} />

                            {/* Retailer routes */}
                            <Route path="retailer" element={<ProtectedRoute allowedRoles={['retailer', 'admin']}><RetailerDashboard /></ProtectedRoute>} />
                            <Route path="retailer/schedule" element={<ProtectedRoute allowedRoles={['retailer', 'admin']}><ScheduleManager /></ProtectedRoute>} />
                            <Route path="retailer/schedule/calendar" element={<ProtectedRoute allowedRoles={['retailer', 'admin']}><ScheduleCalendar /></ProtectedRoute>} />
                            <Route path="retailer/history" element={<ProtectedRoute allowedRoles={['retailer', 'admin']}><ScheduleHistory /></ProtectedRoute>} />

                            {/* Tech ops */}
                            <Route path="tech" element={<ProtectedRoute allowedRoles={['tech', 'admin']}><TechOpsDashboard /></ProtectedRoute>} />

                            {/* Shared */}
                            <Route path="health" element={<Health />} />
                        </Route>

                        {/* Campaign report — accessible to brand + admin */}
                        <Route
                            path="/campaigns/:id/report"
                            element={
                                <ProtectedRoute allowedRoles={['brand', 'admin']}>
                                    <CampaignReport />
                                </ProtectedRoute>
                            }
                        />

                        {/* Redirect root to login */}
                        <Route path="/" element={<Navigate to="/login" replace />} />

                        {/* 404 — redirect to dashboard */}
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </AuthProvider>
            </ToastProvider>
        </Router>
    );
}

export default App;
