/**
 * App.jsx — Route table
 *
 * ARCHITECTURE RULE (read before editing):
 * Every lazy import here MUST correspond to a real file on disk.
 * Before adding a route, verify the file exists in the repo.
 * See docs/SofiensBullshit.md for the full prevention plan.
 *
 * Verified file map (as of Sprint 15 — 2026-06-08):
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
 *   pages/admin/CampaignManagement.jsx   ✅  (served at /dashboard/admin/campaigns)
 *   pages/admin/ScreenManagement.jsx     ✅
 *   pages/admin/LoopManagement.jsx       ✅
 *   pages/admin/LoopBuilder.jsx          ✅  (served at /dashboard/admin/loops/:id)
 *   pages/admin/UserManagement.jsx       ✅
 *   pages/admin/BusinessHoursManagement.jsx ✅
 *   pages/admin/NetworkMap.jsx           ✅
 *   pages/admin/AILog.jsx                ✅
 *   pages/admin/CPMCalendar.jsx          ✅  (served at /dashboard/admin/pricing)
 *   pages/admin/LoopAnalytics.jsx        ✅  (served at /dashboard/admin/loop-analytics)
 *   pages/admin/PricingConfig.jsx        ✅  (served at /dashboard/admin/pricing-config) Sprint 15
 *   pages/brand/BrandDashboard.jsx       ✅
 *   pages/brand/BrandCampaignWizard.jsx  ✅
 *   pages/retailer/RetailerDashboard.jsx ✅
 *   pages/retailer/ScheduleCalendar.jsx  ✅
 *   pages/retailer/ScheduleHistory.jsx   ✅  (served at /dashboard/retailer/schedule-history)
 *   pages/retailer/ScheduleManager.jsx   ✅  (served at /dashboard/retailer/schedule-manager)
 *   pages/retailer/Loops.jsx             ✅  (served at /dashboard/retailer/loops)
 *   pages/retailer/CampaignApprovalList.jsx ✅ (served at /dashboard/retailer/campaign-approvals)
 *                                           Re-exports components/CampaignApprovalList.jsx.
 *                                           RetailerDashboard imports directly from components/.
 *                                           Single source of truth — no duplicate implementations.
 *   pages/advertiser/AdvertiserDashboard.jsx   ✅  (served at /dashboard/advertiser)          Sprint 14
 *   pages/advertiser/AdvertiserCampaigns.jsx   ✅  (served at /dashboard/advertiser/campaigns) Sprint 14
 *   pages/advertiser/AdvertiserNewCampaign.jsx ✅  (served at /dashboard/advertiser/campaigns/new) Sprint 14
 *   pages/advertiser/Invoices.jsx              ✅  (served at /dashboard/advertiser/invoices)   Sprint 15
 *   pages/tech/TechOpsDashboard.jsx      ✅  (served at /dashboard/techoperator)
 *   pages/tickets/TicketDashboard.jsx    ✅  (served at /dashboard/tickets)
 *   pages/tickets/TicketDetail.jsx       ✅  (served at /dashboard/tickets/:id)
 *
 * Deleted stale component copies (Sprint 11 cleanup):
 *   components/TicketDashboard.jsx       ❌  deleted — was hardcoding localhost:8080
 *   components/TicketDetail.jsx          ❌  deleted — superseded by pages/tickets/
 */

import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import NetworkErrorBanner from './components/NetworkErrorBanner';
import NotFound from './pages/NotFound';

// ── Layout shell ──────────────────────────────────────────────────────────────────────────
const Dashboard = lazy(() => import('./layouts/DashboardLayout'));

// ── Top-level pages ────────────────────────────────────────────────────────────────────────
const Player         = lazy(() => import('./pages/Player'));
const LoopDemoPlayer = lazy(() => import('./pages/LoopDemoPlayer'));
const Login          = lazy(() => import('./pages/Login'));
const Health         = lazy(() => import('./pages/Health'));

// ── Admin pages ───────────────────────────────────────────────────────────────────────────
const AdminOverview           = lazy(() => import('./pages/admin/Overview'));
const RetailerManagement      = lazy(() => import('./pages/admin/RetailerManagement'));
const AdvertiserManagement    = lazy(() => import('./pages/admin/AdvertiserManagement'));
const CampaignManagement      = lazy(() => import('./pages/admin/CampaignManagement'));
const ScreenManagement        = lazy(() => import('./pages/admin/ScreenManagement'));
const LoopManagement          = lazy(() => import('./pages/admin/LoopManagement'));
const LoopBuilder             = lazy(() => import('./pages/admin/LoopBuilder'));
const UserManagement          = lazy(() => import('./pages/admin/UserManagement'));
const BusinessHoursManagement = lazy(() => import('./pages/admin/BusinessHoursManagement'));
const NetworkMap              = lazy(() => import('./pages/admin/NetworkMap'));
const AILog                   = lazy(() => import('./pages/admin/AILog'));
const CPMCalendar             = lazy(() => import('./pages/admin/CPMCalendar'));
const LoopAnalytics           = lazy(() => import('./pages/admin/LoopAnalytics'));
const PricingConfig           = lazy(() => import('./pages/admin/PricingConfig'));  // Sprint 15

// ── Brand pages ───────────────────────────────────────────────────────────────────────────
const BrandOverview  = lazy(() => import('./pages/brand/BrandDashboard'));
const CampaignWizard = lazy(() => import('./pages/brand/BrandCampaignWizard'));

// ── Retailer pages ─────────────────────────────────────────────────────────────────────────
const RetailerOverview  = lazy(() => import('./pages/retailer/RetailerDashboard'));
const ScheduleCalendar  = lazy(() => import('./pages/retailer/ScheduleCalendar'));
const ScheduleHistory   = lazy(() => import('./pages/retailer/ScheduleHistory'));
const ScheduleManager   = lazy(() => import('./pages/retailer/ScheduleManager'));
const RetailerLoops     = lazy(() => import('./pages/retailer/Loops'));
const CampaignApprovals = lazy(() => import('./pages/retailer/CampaignApprovalList'));

// ── Advertiser pages ──────────────────────────────────────────────────────────────────────────
const AdvertiserDashboard   = lazy(() => import('./pages/advertiser/AdvertiserDashboard'));
const AdvertiserCampaigns   = lazy(() => import('./pages/advertiser/AdvertiserCampaigns'));
const AdvertiserNewCampaign = lazy(() => import('./pages/advertiser/AdvertiserNewCampaign'));
const Invoices              = lazy(() => import('./pages/advertiser/Invoices'));             // Sprint 15

// ── Ticket pages ───────────────────────────────────────────────────────────────────────────
const TicketDashboard = lazy(() => import('./pages/tickets/TicketDashboard'));
const TicketDetail    = lazy(() => import('./pages/tickets/TicketDetail'));

// ── Tech Operator pages ────────────────────────────────────────────────────────────────────────
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
                            <Route path="admin"                  element={<AdminOverview />} />
                            <Route path="admin/retailers"        element={<RetailerManagement />} />
                            <Route path="admin/advertisers"      element={<AdvertiserManagement />} />
                            <Route path="admin/campaigns"        element={<CampaignManagement />} />
                            <Route path="admin/screens"          element={<ScreenManagement />} />
                            <Route path="admin/loops"            element={<LoopManagement />} />
                            <Route path="admin/loops/:id"        element={<LoopBuilder />} />
                            <Route path="admin/users"            element={<UserManagement />} />
                            <Route path="admin/hours"            element={<BusinessHoursManagement />} />
                            <Route path="admin/map"              element={<NetworkMap />} />
                            <Route path="admin/ai-log"           element={<AILog />} />
                            <Route path="admin/pricing"          element={<CPMCalendar />} />
                            <Route path="admin/loop-analytics"   element={<LoopAnalytics />} />
                            <Route path="admin/pricing-config"   element={<PricingConfig />} />   {/* Sprint 15 */}

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

                            {/* Advertiser — Sprint 14 + 15 */}
                            <Route path="advertiser"                    element={<AdvertiserDashboard />} />
                            <Route path="advertiser/campaigns"          element={<AdvertiserCampaigns />} />
                            <Route path="advertiser/campaigns/new"      element={<AdvertiserNewCampaign />} />
                            <Route path="advertiser/invoices"           element={<Invoices />} />           {/* Sprint 15 */}

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
