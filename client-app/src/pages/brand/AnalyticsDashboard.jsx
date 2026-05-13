/**
 * AnalyticsDashboard.jsx — Sprint 9
 *
 * Analytics & reporting page for brand and admin roles.
 * Shows KPI summary cards, a daily impression trend sparkline,
 * per-campaign breakdown table, and per-location breakdown table.
 *
 * Routes consumed:
 *   GET /api/analytics/summary?period=&brand_id=
 *   GET /api/analytics/campaigns?period=&brand_id=
 *   GET /api/analytics/locations?period=&brand_id=
 */

import { useState, useEffect, useCallback } from 'react';

const API = import.meta.env.VITE_API_URL || '';

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

const PERIODS = [
  { label: '7 days',  value: '7d'  },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
];

// ── Tiny inline sparkline using SVG ──────────────────────────────────────────
function Sparkline({ data, color = '#3b82f6' }) {
  if (!data || data.length < 2) return <div className="h-10 flex items-center text-xs text-gray-400">No data</div>;

  const W = 200, H = 40, pad = 2;
  const vals = data.map(d => d.impressions);
  const max  = Math.max(...vals) || 1;
  const min  = Math.min(...vals);
  const range = max - min || 1;

  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Period toggle ─────────────────────────────────────────────────────────────
function PeriodToggle({ period, onChange }) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {PERIODS.map(p => (
        <button
          key={p.value}
          onClick={() => onChange(p.value)}
          className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
            period === p.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── Campaign table ────────────────────────────────────────────────────────────
function CampaignTable({ campaigns, loading }) {
  if (loading) return <TableSkeleton rows={4} cols={5} />;
  if (!campaigns?.length) return <EmptyState label="No campaign data for this period." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Campaign', 'Impressions', 'Clicks', 'CTR', 'Spend'].map(h => (
              <th key={h} className="text-left text-xs font-medium text-gray-500 pb-2 pr-4 last:pr-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {campaigns.map(c => (
            <tr key={c.campaign_id} className="hover:bg-gray-50">
              <td className="py-2 pr-4 font-medium text-gray-900 truncate max-w-[200px]">{c.campaign_name}</td>
              <td className="py-2 pr-4 tabular-nums text-gray-700">{c.impressions.toLocaleString()}</td>
              <td className="py-2 pr-4 tabular-nums text-gray-700">{c.clicks.toLocaleString()}</td>
              <td className="py-2 pr-4 tabular-nums">
                <span className={`font-medium ${c.ctr >= 2 ? 'text-green-600' : c.ctr >= 0.5 ? 'text-amber-600' : 'text-gray-500'}`}>
                  {c.ctr}%
                </span>
              </td>
              <td className="py-2 tabular-nums text-gray-700">${c.spend.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Location table ────────────────────────────────────────────────────────────
function LocationTable({ locations, loading }) {
  if (loading) return <TableSkeleton rows={4} cols={4} />;
  if (!locations?.length) return <EmptyState label="No location data for this period." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            {['Location', 'Impressions', 'Clicks', 'Spend'].map(h => (
              <th key={h} className="text-left text-xs font-medium text-gray-500 pb-2 pr-4 last:pr-0">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {locations.map(l => (
            <tr key={l.location_id} className="hover:bg-gray-50">
              <td className="py-2 pr-4 font-medium text-gray-900">{l.location_name}</td>
              <td className="py-2 pr-4 tabular-nums text-gray-700">{l.impressions.toLocaleString()}</td>
              <td className="py-2 pr-4 tabular-nums text-gray-700">{l.clicks.toLocaleString()}</td>
              <td className="py-2 tabular-nums text-gray-700">${l.spend.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Shared micro-components ───────────────────────────────────────────────────
function TableSkeleton({ rows = 4, cols = 4 }) {
  return (
    <div className="space-y-2 mt-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 bg-gray-100 rounded animate-pulse flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="py-10 text-center">
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">{title}</h2>
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [period, setPeriod]         = useState('30d');
  const [summary, setSummary]       = useState(null);
  const [campaigns, setCampaigns]   = useState([]);
  const [locations, setLocations]   = useState([]);
  const [loadingKpi, setLoadingKpi] = useState(true);
  const [loadingCamp, setLoadingCamp] = useState(true);
  const [loadingLoc, setLoadingLoc]   = useState(true);
  const [error, setError]           = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoadingKpi(true);
    try {
      const res = await fetch(`${API}/api/analytics/summary?period=${period}`, { headers: authHeaders() });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setSummary(data);
    } catch (e) {
      setError('Failed to load analytics: ' + e.message);
    } finally {
      setLoadingKpi(false);
    }
  }, [period]);

  const fetchCampaigns = useCallback(async () => {
    setLoadingCamp(true);
    try {
      const res = await fetch(`${API}/api/analytics/campaigns?period=${period}`, { headers: authHeaders() });
      if (res.ok) setCampaigns((await res.json()).campaigns || []);
    } finally {
      setLoadingCamp(false);
    }
  }, [period]);

  const fetchLocations = useCallback(async () => {
    setLoadingLoc(true);
    try {
      const res = await fetch(`${API}/api/analytics/locations?period=${period}`, { headers: authHeaders() });
      if (res.ok) setLocations((await res.json()).locations || []);
      // 403 for retailer is expected — swallow silently
    } finally {
      setLoadingLoc(false);
    }
  }, [period]);

  useEffect(() => {
    fetchSummary();
    fetchCampaigns();
    fetchLocations();
  }, [fetchSummary, fetchCampaigns, fetchLocations]);

  const fmt = (n) => n === undefined || n === null ? '—' : n.toLocaleString();
  const fmtUsd = (n) => n === undefined || n === null ? '—' : `$${n.toFixed(2)}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
            <p className="text-sm text-gray-500 mt-0.5">Impressions, clicks, CTR and spend across your campaigns.</p>
          </div>
          <PeriodToggle period={period} onChange={setPeriod} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">{error}</div>
        )}

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {loadingKpi ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-xl border border-gray-100 animate-pulse" />
            ))
          ) : (
            <>
              <KpiCard
                label="Impressions"
                value={fmt(summary?.summary?.impressions)}
                sub={`${PERIODS.find(p => p.value === period)?.label}`}
              />
              <KpiCard
                label="Clicks"
                value={fmt(summary?.summary?.clicks)}
              />
              <KpiCard
                label="CTR"
                value={summary?.summary?.ctr !== undefined ? `${summary.summary.ctr}%` : '—'}
                color={summary?.summary?.ctr >= 2 ? 'text-green-600' : summary?.summary?.ctr >= 0.5 ? 'text-amber-600' : 'text-gray-900'}
              />
              <KpiCard
                label="Spend"
                value={fmtUsd(summary?.summary?.spend)}
              />
            </>
          )}
        </div>

        {/* Trend chart */}
        <SectionCard title="Daily Impressions">
          {loadingKpi ? (
            <div className="h-10 bg-gray-100 rounded animate-pulse" />
          ) : (
            <Sparkline data={summary?.trend || []} />
          )}
          {!loadingKpi && summary?.trend?.length > 0 && (
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{summary.trend[0]?.date}</span>
              <span>{summary.trend[summary.trend.length - 1]?.date}</span>
            </div>
          )}
        </SectionCard>

        {/* Campaign breakdown */}
        <div className="mt-4">
          <SectionCard title="Campaign Breakdown">
            <CampaignTable campaigns={campaigns} loading={loadingCamp} />
          </SectionCard>
        </div>

        {/* Location breakdown (admin/brand only — 403 silently suppressed for retailer) */}
        <div className="mt-4">
          <SectionCard title="Location Breakdown">
            <LocationTable locations={locations} loading={loadingLoc} />
          </SectionCard>
        </div>

      </div>
    </div>
  );
}
