import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

const Player = React.lazy(() => import('./pages/Player'));
const DashboardLayout = React.lazy(() => import('./layouts/DashboardLayout'));
const AdminOverview = React.lazy(() => import('./pages/admin/Overview'));
const ScreenManagement = React.lazy(() => import('./pages/admin/ScreenManagement'));
const PlaylistManagement = React.lazy(() => import('./pages/admin/PlaylistManagement'));
const PlaylistEditor = React.lazy(() => import('./pages/admin/PlaylistEditor'));
const LoopManagement = React.lazy(() => import('./pages/admin/LoopManagement'));
const LoopBuilder = React.lazy(() => import('./pages/admin/LoopBuilder'));
const LoopAnalytics = React.lazy(() => import('./pages/admin/LoopAnalytics'));
const BrandDashboard = React.lazy(() => import('./pages/brand/BrandDashboard'));
const BrandCampaignWizard = React.lazy(() => import('./pages/brand/BrandCampaignWizard'));
const RetailerDashboard = React.lazy(() => import('./pages/retailer/RetailerDashboard'));
const ScheduleManager = React.lazy(() => import('./pages/retailer/ScheduleManager'));
const ScheduleCalendar = React.lazy(() => import('./pages/retailer/ScheduleCalendar'));
const TechOpsDashboard = React.lazy(() => import('./pages/tech/TechOpsDashboard'));
const Health = React.lazy(() => import('./pages/Health'));

import ErrorBoundary from './components/ErrorBoundary';

function App() {
    return (
        <Router>
            <AuthProvider>
                <React.Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
                    <Routes>
                        <Route path="/player" element={<Player />} />
                        <Route path="/dashboard" element={<DashboardLayout />}>
                            <Route index element={<Navigate to="admin" replace />} />
                            <Route path="admin" element={<AdminOverview />} />
                            <Route path="admin/screens" element={<ScreenManagement />} />
                            <Route path="admin/playlists" element={<PlaylistManagement />} />
                            <Route path="admin/playlists/new" element={<PlaylistEditor />} />
                            <Route path="admin/playlists/:id" element={<PlaylistEditor />} />
                            <Route path="admin/loops" element={<LoopManagement />} />
                            <Route path="admin/loops/:id" element={<LoopBuilder />} />
                            <Route path="admin/analytics" element={<LoopAnalytics />} />
                            <Route path="brand" element={<BrandDashboard />} />
                            <Route path="brand/campaign/new" element={<BrandCampaignWizard />} />
                            <Route path="retailer" element={<RetailerDashboard />} />
                            <Route path="retailer/schedule" element={<ScheduleManager />} />
                            <Route path="retailer/schedule/calendar" element={<ScheduleCalendar />} />
                            <Route path="tech" element={<TechOpsDashboard />} />
                            <Route path="health" element={<Health />} />
                        </Route>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </React.Suspense>
            </AuthProvider>
        </Router>
    );
}

export default App;
