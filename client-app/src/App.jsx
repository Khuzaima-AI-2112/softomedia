import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Player from './pages/Player';
import DashboardLayout from './layouts/DashboardLayout';
import AdminOverview from './pages/admin/Overview';
import BrandDashboard from './pages/brand/BrandDashboard';
import BrandCampaignWizard from './pages/brand/BrandCampaignWizard';
import RetailerDashboard from './pages/retailer/RetailerDashboard';

function App() {
    return (
        <Router>
            <AuthProvider>
                <Routes>
                    <Route path="/player" element={<Player />} />

                    <Route path="/dashboard" element={<DashboardLayout />}>
                        <Route index element={<Navigate to="admin" replace />} />
                        <Route path="admin" element={<AdminOverview />} />
                        <Route path="brand" element={<BrandDashboard />} />
                        <Route path="brand/campaign/new" element={<BrandCampaignWizard />} />
                        <Route path="retailer" element={<RetailerDashboard />} />
                    </Route>

                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
}

export default App;
