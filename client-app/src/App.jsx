import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

// Pages
import Login from './pages/Login';
import Player from './pages/Player';
import Overview from './pages/admin/Overview';
import UserManagement from './pages/admin/UserManagement';
import ScreenManagement from './pages/admin/ScreenManagement';
import RetailerDashboard from './pages/retailer/RetailerDashboard';
import BrandDashboard from './pages/brand/BrandDashboard';
import BrandCampaignWizard from './pages/brand/BrandCampaignWizard';
import CampaignReport from './pages/CampaignReport';
import ScheduleCalendar from './pages/retailer/ScheduleCalendar';
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

    // Check role if specified
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

                        {/* Protected Routes - Admin */}
                        <Route
                            path="/dashboard"
                            element={
                                <ProtectedRoute>
                                    <DashboardLayout />
                                </ProtectedRoute>
                            }
                        >
                            <Route index element={<Overview />} />
                            <Route
                                path="users"
                                element={
                                    <ProtectedRoute allowedRoles={['admin']}>
                                        <UserManagement />
                                    </ProtectedRoute>
                                }
                            />
                            <Route
                                path="screens"
                                element={
                                    <ProtectedRoute allowedRoles={['admin', 'location']}>
                                        <ScreenManagement />
                                    </ProtectedRoute>
                                }
                            />
                        </Route>

                        {/* Protected Routes - Retailer */}
                        <Route
                            path="/retailer/dashboard"
                            element={
                                <ProtectedRoute allowedRoles={['retailer', 'admin']}>
                                    <RetailerDashboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/retailer/dashboard/schedule"
                            element={
                                <ProtectedRoute allowedRoles={['retailer', 'admin']}>
                                    <DashboardLayout />
                                </ProtectedRoute>
                            }
                        >
                            <Route index element={<ScheduleCalendar />} />
                        </Route>

                        {/* Protected Routes - Brand */}
                        <Route
                            path="/brand/dashboard"
                            element={
                                <ProtectedRoute allowedRoles={['brand', 'admin']}>
                                    <BrandDashboard />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/brand/campaign/:id/edit"
                            element={
                                <ProtectedRoute allowedRoles={['brand', 'admin']}>
                                    <BrandCampaignWizard />
                                </ProtectedRoute>
                            }
                        />
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

                        {/* 404 - redirect to dashboard */}
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </AuthProvider>
            </ToastProvider>
        </Router>
    );
}

export default App;
