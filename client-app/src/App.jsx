import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import NetworkErrorBanner from './components/NetworkErrorBanner';
import NotFound from './pages/NotFound';

// ─── Layout shell ────────────────────────────────────────────────────────────
const Dashboard = lazy(() => import('./layouts/DashboardLayout'));

// ─── Top-level pages ─────────────────────────────────────────────────────────
const Login          = lazy(() => import('./pages/Login'));
const Player         = lazy(() => import('./pages/Player'));
const LoopDemoPlayer = lazy(() => import('./pages/LoopDemoPlayer'));
const Health         = lazy(() => import('./pages/Health'));

// ─── Admin pages ─────────────────────────────────────────────────────────────
const AdminOverview          = lazy(() => import('./pages/admin/Overview'));
const RetailerManagement     = lazy(() => import('./pages/admin/RetailerManagement'));
const AdvertiserManagement   = lazy(() => import('./pages/admin/AdvertiserManagement'));
const ScreenManagement       = lazy(() => import('./pages/admin/ScreenManagement'));
const LoopManagement         = lazy(() => import('./pages/admin/LoopManagement'));
const UserManagement         = lazy(() => import('./pages/admin/UserManagement'));
const BusinessHoursManagement = lazy(() => import('./pages/admin/BusinessHoursManagement'));
const NetworkMap             = lazy(() => import('./pages/admin/NetworkMap'));
const AILog                  = lazy(() => import('./pages/admin/AILog'));

// ─── Brand pages ─────────────────────────────────────────────────────────────
const BrandOverview   = lazy(() => import('./pages/brand/BrandDashboard'));
const CampaignWizard  = lazy(() => import('./pages/brand/BrandCampaignWizard'));

// ─── Retailer pages ──────────────────────────────────────────────────────────
const RetailerOverview = lazy(() => import('./pages/retailer/RetailerDashboard'));
const RetailerSchedule = lazy(() => import('./pages/retailer/ScheduleCalendar'));

function App() {
    return (
        <Router>
            <AuthProvider>
                {/* Global network-error banner — outside <Suspense> so it stays
                    visible even while a lazy page chunk is loading. */}
                <NetworkErrorBanner />
                <Suspense fallback={
                    <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                    </div>
                }>
                    <Routes>
                        {/* Public / standalone routes */}
                        <Route path="/player"      element={<Player />} />
                        <Route path="/player/demo" element={<LoopDemoPlayer />} />
                        <Route path="/login"       element={<Login />} />

                        {/* Dashboard shell — all sub-routes rendered into its <Outlet> */}
                        <Route path="/dashboard" element={<Dashboard />}>
                            <Route index element={<Navigate to="admin" replace />} />

                            {/* Admin */}
                            <Route path="admin"              element={<AdminOverview />} />
                            <Route path="admin/retailers"    element={<RetailerManagement />} />
                            <Route path="admin/advertisers"  element={<AdvertiserManagement />} />
                            <Route path="admin/screens"      element={<ScreenManagement />} />
                            <Route path="admin/loops"        element={<LoopManagement />} />
                            <Route path="admin/users"        element={<UserManagement />} />
                            <Route path="admin/hours"        element={<BusinessHoursManagement />} />
                            <Route path="admin/map"          element={<NetworkMap />} />
                            <Route path="admin/ai-log"       element={<AILog />} />

                            {/* Brand */}
                            <Route path="brand"                element={<BrandOverview />} />
                            <Route path="brand/campaign/new"   element={<CampaignWizard />} />

                            {/* Retailer */}
                            <Route path="retailer"             element={<RetailerOverview />} />
                            <Route path="retailer/schedule"    element={<RetailerSchedule />} />

                            {/* Health (page-level, lives outside /admin prefix) */}
                            <Route path="health" element={<Health />} />

                            {/* Catch-all for unknown /dashboard/* paths */}
                            <Route path="*" element={<NotFound />} />
                        </Route>

                        {/* Root redirect */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />

                        {/* Catch-all for completely unknown top-level paths */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </AuthProvider>
        </Router>
    );
}

export default App;
