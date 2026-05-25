import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import NetworkErrorBanner from './components/NetworkErrorBanner';
import NotFound from './pages/NotFound';

const Player = lazy(() => import('./pages/Player'));
const LoopDemoPlayer = lazy(() => import('./pages/LoopDemoPlayer'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminOverview = lazy(() => import('./pages/admin/Overview'));
const RetailerManagement = lazy(() => import('./pages/admin/RetailerManagement'));
const AdvertiserManagement = lazy(() => import('./pages/admin/AdvertiserManagement'));
const ScreenManagement = lazy(() => import('./pages/admin/ScreenManagement'));
const LoopManagement = lazy(() => import('./pages/admin/LoopManagement'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement'));
const BusinessHoursManagement = lazy(() => import('./pages/admin/BusinessHoursManagement'));
const PricingManagement = lazy(() => import('./pages/admin/PricingManagement'));
const NetworkMap = lazy(() => import('./pages/admin/NetworkMap'));
const AILog = lazy(() => import('./pages/admin/AILog'));
const Health = lazy(() => import('./pages/admin/Health'));
const CampaignWizard = lazy(() => import('./pages/brand/CampaignWizard'));
const BrandOverview = lazy(() => import('./pages/brand/Overview'));
const RetailerOverview = lazy(() => import('./pages/retailer/Overview'));
const RetailerLoops = lazy(() => import('./pages/retailer/Loops'));
const Login = lazy(() => import('./pages/Login'));
const TicketDashboard = lazy(() => import('./pages/tickets/TicketDashboard'));
const TicketDetail = lazy(() => import('./pages/tickets/TicketDetail'));

function App() {
    return (
        <Router>
            <AuthProvider>
                {/* Global network-error banner — listens for api:network-error events
                    fired by api.js when all retries are exhausted (Wi-Fi off / no connection).
                    Rendered outside <Suspense> so it stays visible even while a page is loading. */}
                <NetworkErrorBanner />
                <Suspense fallback={<div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>}>
                    <Routes>
                        <Route path="/player" element={<Player />} />
                        <Route path="/player/demo" element={<LoopDemoPlayer />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/dashboard" element={<Dashboard />}>
                            <Route index element={<Navigate to="admin" replace />} />
                            <Route path="admin" element={<AdminOverview />} />
                            <Route path="admin/retailers" element={<RetailerManagement />} />
                            <Route path="admin/advertisers" element={<AdvertiserManagement />} />
                            <Route path="admin/screens" element={<ScreenManagement />} />
                            <Route path="admin/loops" element={<LoopManagement />} />
                            <Route path="admin/users" element={<UserManagement />} />
                            <Route path="admin/hours" element={<BusinessHoursManagement />} />
                            <Route path="admin/pricing" element={<PricingManagement />} />
                            <Route path="admin/map" element={<NetworkMap />} />
                            <Route path="admin/ai-log" element={<AILog />} />
                            <Route path="brand" element={<BrandOverview />} />
                            <Route path="brand/campaign/new" element={<CampaignWizard />} />
                            <Route path="retailer" element={<RetailerOverview />} />
                            <Route path="retailer/loops" element={<RetailerLoops />} />
                            <Route path="health" element={<Health />} />
                            <Route path="tickets" element={<TicketDashboard />} />
                            <Route path="tickets/:id" element={<TicketDetail />} />
                            {/* Catch-all for unknown /dashboard/* paths */}
                            <Route path="*" element={<NotFound />} />
                        </Route>
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
