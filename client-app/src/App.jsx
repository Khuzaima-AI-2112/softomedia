import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

const Player = lazy(() => import('./pages/Player'));
const LoopDemoPlayer = lazy(() => import('./pages/LoopDemoPlayer'));
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const ScreenManagement = lazy(() => import('./pages/admin/ScreenManagement'));
const PlaylistManagement = lazy(() => import('./pages/admin/PlaylistManagement'));
const PlaylistEditor = lazy(() => import('./pages/admin/PlaylistEditor'));
const LoopManagement = lazy(() => import('./pages/admin/LoopManagement'));
const LoopBuilder = lazy(() => import('./pages/admin/LoopBuilder'));
const LoopAnalytics = lazy(() => import('./pages/admin/LoopAnalytics'));
const NetworkMap = lazy(() => import('./pages/admin/NetworkMap'));
const CPMCalendar = lazy(() => import('./pages/admin/CPMCalendar'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const RetailerManagement = lazy(() => import('./pages/admin/RetailerManagement'));
const AdvertiserManagement = lazy(() => import('./pages/admin/AdvertiserManagement'));
const BusinessHoursManagement = lazy(() => import('./pages/admin/BusinessHoursManagement'));
const BrandDashboard = lazy(() => import('./pages/brand/BrandDashboard'));
const BrandCampaignWizard = lazy(() => import('./pages/brand/BrandCampaignWizard'));
const RetailerDashboard = lazy(() => import('./pages/retailer/RetailerDashboard'));
const ScheduleManager = lazy(() => import('./pages/retailer/ScheduleManager'));
const ScheduleCalendar = lazy(() => import('./pages/retailer/ScheduleCalendar'));
const ScheduleHistory = lazy(() => import('./pages/retailer/ScheduleHistory'));
const TechOpsDashboard = lazy(() => import('./pages/tech/TechOpsDashboard'));
const Health = lazy(() => import('./pages/Health'));
const TicketDashboard = lazy(() => import('./components/TicketDashboard'));
const TicketDetail = lazy(() => import('./components/TicketDetail'));
const AILog = lazy(() => import('./pages/admin/AILog'));


function App() {
    return (
        <Router>
            <AuthProvider>
                <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
                    <Routes>
                        <Route path="/player" element={<Player />} />
                        <Route path="/player/demo" element={<LoopDemoPlayer />} />
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
                            <Route path="admin/map" element={<NetworkMap />} />
                            <Route path="admin/pricing" element={<CPMCalendar />} />
                            <Route path="admin/users" element={<UserManagement />} />
                            <Route path="admin/retailers" element={<RetailerManagement />} />
                            <Route path="admin/hours" element={<BusinessHoursManagement />} />
                            <Route path="admin/advertisers" element={<AdvertiserManagement />} />
                            <Route path="admin/ai-log" element={<AILog />} />
                            <Route path="brand" element={<BrandDashboard />} />
                            <Route path="brand/campaign/new" element={<BrandCampaignWizard />} />
                            <Route path="retailer" element={<RetailerDashboard />} />
                            <Route path="retailer/schedule" element={<ScheduleManager />} />
                            <Route path="retailer/schedule/calendar" element={<ScheduleCalendar />} />
                            <Route path="retailer/history" element={<ScheduleHistory />} />
                            <Route path="tech" element={<TechOpsDashboard />} />
                            <Route path="health" element={<Health />} />
                            <Route path="tickets" element={<TicketDashboard />} />
                            <Route path="tickets/:id" element={<TicketDetail />} />
                        </Route>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </Suspense>
            </AuthProvider>
        </Router>
    );
}

export default App;
