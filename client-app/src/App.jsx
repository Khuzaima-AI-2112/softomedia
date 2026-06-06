/**
 * App.jsx — Route table
 *
 * ARCHITECTURE RULE (read before editing):
 * Every lazy import here MUST correspond to a real file on disk.
 * Before adding a route, verify the file exists in the repo.
 * See docs/SofiensBullshit.md for the full prevention plan.
 *
 * Verified file map (as of Sprint 10 — 2026-06-06):
 *
 *   layouts/DashboardLayout.jsx          ✅
 *   pages/Login.jsx                      ✅
 *   pages/Player.jsx                     ✅
 *   pages/LoopDemoPlayer.jsx             ✅
 *   pages/NotFound.jsx                   ✅
 *   pages/Health.jsx                     ✅  (served at /dashboard/techoperator/health)
 *   pages/admin/Overview.jsx             ✅
 *   pages/admin/RetailerManagement.jsx   ✅
 *   pages/admin/AdvertiserManagement.jsx ✅
 *   pages/admin/ScreenManagement.jsx     ✅
 *   pages/admin/LoopManagement.jsx       ✅
 *   pages/admin/LoopBuilder.jsx          ✅  (served at /dashboard/admin/loops/:id)
 *   pages/admin/UserManagement.jsx       ✅
 *   pages/admin/BusinessHoursManagement.jsx ✅
 *   pages/admin/NetworkMap.jsx           ✅
 *   pages/admin/AILog.jsx                ✅
 *   pages/admin/CPMCalendar.jsx          ✅  (served at /dashboard/admin/pricing)
 *   pages/admin/LoopAnalytics.jsx        ✅  (served at /dashboard/admin/loop-analytics)
 *   pages/brand/BrandDashboard.jsx       ✅
 *   pages/brand/BrandCampaignWizard.jsx  ✅
 *   pages/retailer/RetailerDashboard.jsx ✅
 *   pages/retailer/ScheduleCalendar.jsx  ✅
 *   pages/retailer/ScheduleHistory.jsx   ✅  (served at /dashboard/retailer/schedule-history)
 *   pages/retailer/ScheduleManager.jsx   ✅  (served at /dashboard/retailer/schedule-manager)
 *   pages/retailer/Loops.jsx             ✅  (served at /dashboard/retailer/loops)
 *   pages/retailer/CampaignApprovalList.jsx ✅ (served at /dashboard/retailer/campaign-approvals)
 *                                           ⚠️  PENDING: resolve duplicate with
 *                                               components/CampaignApprovalList.jsx before merging —
 *                                               run: grep -r "CampaignApprovalList" client-app/src --include="*.jsx" -n
 *   pages/tech/TechOpsDashboard.jsx      ✅  (served at /dashboard/techoperator)
 *   pages/tickets/TicketDashboard.jsx    ✅  (served at /dashboard/tickets)         [Sprint 10]
 *   pages/tickets/TicketDetail.jsx       ✅  (served at /dashboard/tickets/:id)     [Sprint 10]
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import NetworkErrorBanner from './components/NetworkErrorBanner';
import NotFound from './pages/NotFound';

// ── Layout shell ─────────────────────────────────────────────────────────────────
const Dashboard = lazy(() => import('./layouts/DashboardLayout'));

// ── Top-level pages ────────────────────────────────────────────────────────────
const Player         = lazy(() => import('./pages/Player'));
const LoopDemoPlayer = lazy(() => import('./pages/LoopDemoPlayer'));
const Login          = lazy(() => import('./pages/Login'));
const Health         = lazy(() => import('./pages/Health'));

// ── Admin pages ─────────────────────────────────────────────────────────────────
const AdminOverview           = lazy(() => import('./pages/admin/Overview'));
const RetailerManagement      = lazy(() => import('./pages/admin/RetailerManagement'));
const AdvertiserManagement    = lazy(() => import('./pages/admin/AdvertiserManagement'));
const ScreenManagement        = lazy(() => import('./pages/admin/ScreenManagement'));
const LoopManagement          = lazy(() => import('./pages/admin/LoopManagement'));
const LoopBuilder             = lazy(() => import('./pages/admin/LoopBuilder'));
const UserManagement          = lazy(() => import('./pages/admin/UserManagement'));
const BusinessHoursManagement = lazy(() => import('./pages/admin/BusinessHoursManagement'));
const NetworkMap              = lazy(() => import('./pages/admin/NetworkMap'));
const AILog                   = lazy(() => import('./pages/admin/AILog'));
const CPMCalendar             = lazy(() => import('./pages/admin/CPMCalendar'));
const LoopAnalytics           = lazy(() => import('./pages/admin/LoopAnalytics'));

// ── Brand pages ─────────────────────────────────────────────────────────────────
const BrandOverview  = lazy(() => import('./pages/brand/BrandDashboard'));
const CampaignWizard = lazy(() => import('./pages/brand/BrandCampaignWizard'));

// ── Retailer pages ──────────────────────────────────────────────────────────────
const RetailerOverview  = lazy(() => import('./pages/retailer/RetailerDashboard'));
const ScheduleCalendar  = lazy(() => import('./pages/retailer/ScheduleCalendar'));
const ScheduleHistory   = lazy(() => import('./pages/retailer/ScheduleHistory'));
const ScheduleManager   = lazy(() => import('./pages/retailer/ScheduleManager'));
const RetailerLoops     = lazy(() => import('./pages/retailer/Loops'));
const CampaignApprovals = lazy(() => import('./pages/retailer/CampaignApprovalList'));

// ── Ticket pages ─────────────────────────────────────────────────────────────────
const TicketDashboard = lazy(() => import('./pages/tickets/TicketDashboard'));
const TicketDetail    = lazy(() => import('./pages/tickets/TicketDetail'));

// ── Tech Operator pages ──────────────────────────────────────────────────────────
const TechOpsDashboard = lazy(() => import('./pages/tech/TechOpsDashboard'));

function App() {
    return (
        <Router>
            <AuthProvider>
                {/* Global network-error banner — outside Suspense so it survives
                    page loading states. Listens for api:network-error events. */}
                <NetworkErrorBanner />
                <Suspense fallback={
                    <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-background-dark">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                    </div>
                }>
                    <Routes>
                        {/* ── Public / standalone ── */}
                        <Route path="/player"      element={<Player />} />
                        <Route path="/player/demo" element={<LoopDemoPlayer />} />
                        <Route path="/login"       element={<Login />} />

                        {/* ── Dashboard shell ── */}
                        <Route path="/dashboard" element={<Dashboard />}>
                            <Route index element={<Navigate to="admin" replace />} />

                            {/* Admin */}
                            <Route path="admin"                 element={<AdminOverview />} />
                            <Route path="admin/retailers"       element={<RetailerManagement />} />
                            <Route path="admin/advertisers"     element={<AdvertiserManagement />} />
                            <Route path="admin/screens"         element={<ScreenManagement />} />
                            <Route path="admin/loops"           element={<LoopManagement />} />
                            <Route path="admin/loops/:id"       element={<LoopBuilder />} />
                            <Route path="admin/users"           element={<UserManagement />} />
                            <Route path="admin/hours"           element={<BusinessHoursManagement />} />
                            <Route path="admin/map"             element={<NetworkMap />} />
                            <Route path="admin/ai-log"          element={<AILog />} />
                            <Route path="admin/pricing"         element={<CPMCalendar />} />
                            <Route path="admin/loop-analytics"  element={<LoopAnalytics />} />

                            {/* Brand */}
                            <Route path="brand"              element={<BrandOverview />} />
                            <Route path="brand/campaign/new" element={<CampaignWizard />} />

                            {/* Retailer */}
                            <Route path="retailer"                    element={<RetailerOverview />} />
                            <Route path="retailer/schedule"           element={<ScheduleCalendar />} />
                            <Route path="retailer/schedule-history"   element={<ScheduleHistory />} />
                            <Route path="retailer/schedule-manager"   element={<ScheduleManager />} />
                            <Route path="retailer/loops"              element={<RetailerLoops />} />
                            <Route path="retailer/campaign-approvals" element={<CampaignApprovals />} />

                            {/* Tickets */}
                            <Route path="tickets"     element={<TicketDashboard />} />
                            <Route path="tickets/:id" element={<TicketDetail />} />

                            {/* Tech Operator */}
                            <Route path="techoperator"        element={<TechOpsDashboard />} />
                            <Route path="techoperator/health" element={<Health />} />

                            {/* Catch-all for unknown /dashboard/* paths */}
                            <Route path="*" element={<NotFound />} />
                        </Route>

                        {/* Root redirect */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />

                        {/* Catch-all for unknown top-level paths */}
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                </Suspense>
            </AuthProvider>
        </Router>
    );
}

export default App;
