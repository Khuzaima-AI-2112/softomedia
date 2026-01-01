import React from 'react';
import { useNavigate } from 'react-router-dom';
import KPICard from '../../components/KPICard';
import DataTable from '../../components/DataTable';

const BrandDashboard = () => {
    const navigate = useNavigate();

    const campaigns = [
        {
            id: '#CMP-8832',
            name: 'Summer Sale Promo 2024',
            status: 'Live',
            duration: 'Jun 1 - Jun 30',
            locations: '45 Stores',
            impressions: '1.2M',
            performance: '75%',
            image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDG_rCB3L5X7gSrtLQ05h2LUeNvPdZ8YMhESpe75ZIQMFDSbcfxBHeh2s0mCcMfXZe0-4M1j4fimOwGjy7ievPalWt-3OmQxPFRJUBMpNdGKX5SsRnDxZJMH_4KeGCpKwLX-kZd4wLhH_rQD_qvhfOuK0L_Wvy1GVmUXaN53sXdCL16_2MjF8yGwYQCKc-bzlVKV3v1ZzgDi_oXhSe-etn4ThICeRTraYQWAip0I4vGtuxmuVvVhoSBNnbHG7cqwi5b6ZDW5TtTVw'
        },
        {
            id: '#CMP-9901',
            name: 'Back to School',
            status: 'Scheduled',
            duration: 'Aug 15 - Sep 15',
            locations: '120 Stores',
            impressions: '-',
            performance: '0%',
            image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAAHB4PRFGZD2wMMTpgoytUCatr8DHwQWHRZlvqi5PwUtqiDZmPeGC0N0vYXMTIzoA0qlwwPOxzzhCutfTjNAPuDSi5OF6sdINw7YhQL2pXUMirqQ8SbO3AmhmedPSzmL8QGbKAcVPENF8dnjWWm-WZKOLPK54L3puJ7rHppaN8klgUI2q8Q-S6L-QGbSbubqJbh4c-r0KaAal9nxxKFe4X8eqxJbRg3Ybulj8jeGfc4yt6HG_Ul0jmdt7Y4W35HMezXiA6C7k_oQ'
        },
        {
            id: '#CMP-7742',
            name: 'Flash Sale Shoes',
            status: 'Ended',
            duration: 'May 20 - May 22',
            locations: '10 Stores',
            impressions: '450k',
            performance: '100%',
            image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA61lFMDMe1Po-1PDBqXdVAHEEfFUDwCEAzoDY9bCoBXahewQBbRUAAGg16paih38dKsPFlbTvlZsj3j9NMOiBx_5GMefvo_VcPlIKczrigXVZWcxrpy_6kxKx1sbnU7ioETzNuBrsi9LGuPS3tD3CstJoDvCp9r6W3JS9l8GUjwRtCVoXyLoWReDtHs-4rhKLPj7tq_trZ8gC5IU-tNQ65ailFZtGHEBWlvBiDW8hakJVHVJ6wLPg84N-h2M45zvTnlkWblP-Bfg'
        },
    ];

    const kpis = [
        { label: 'Total Active', value: '12', trend: '+2', icon: 'campaign', color: 'text-primary' },
        { label: 'Screens Live', value: '450', trend: '+15', icon: 'tv', color: 'text-blue-400' },
        { label: 'Daily Impressions', value: '1.2M', trend: '+5%', icon: 'visibility', color: 'text-indigo-400' },
    ];

    const columns = [
        {
            header: 'Campaign Name',
            render: (cmp) => (
                <div className="flex flex-col">
                    <span className="text-base font-semibold">{cmp.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">ID: {cmp.id}</span>
                </div>
            )
        },
        {
            header: 'Preview',
            render: (cmp) => (
                <div className="relative w-16 h-10 rounded-md overflow-hidden bg-slate-200 dark:bg-slate-700 ring-1 ring-slate-200 dark:ring-slate-700">
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url("${cmp.image}")` }}
                    />
                </div>
            )
        },
        {
            header: 'Status',
            render: (cmp) => (
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cmp.status === 'Live' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' :
                    cmp.status === 'Scheduled' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' :
                        'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}>
                    {cmp.status === 'Live' && <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                    {cmp.status}
                </span>
            )
        },
        { header: 'Duration', accessor: 'duration' },
        {
            header: 'Locations',
            render: (cmp) => (
                <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-slate-400 text-[18px]">storefront</span>
                    {cmp.locations}
                </div>
            )
        },
        {
            header: 'Performance',
            render: (cmp) => (
                <div className="flex flex-col gap-1 w-24">
                    <span className="text-slate-900 dark:text-white font-medium">{cmp.impressions} <span className="text-xs font-normal text-slate-500">Impr.</span></span>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                        <div
                            className={`h-1.5 rounded-full ${cmp.status === 'Ended' ? 'bg-slate-400' : 'bg-primary'}`}
                            style={{ width: cmp.performance }}
                        />
                    </div>
                </div>
            )
        },
        {
            header: 'Actions',
            className: 'text-right',
            render: () => (
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Edit">
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-orange-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Pause">
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">pause_circle</span>
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors" title="Settings">
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">more_vert</span>
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="flex flex-col gap-8">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold tracking-tight">Active Campaigns</h1>
                <button
                    onClick={() => navigate('campaign/new')}
                    className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg text-sm px-5 py-2.5 transition-colors shadow-lg shadow-primary/25"
                >
                    <span className="material-symbols-outlined text-[20px]">add</span>
                    <span>New Campaign</span>
                </button>
            </div>

            {/* KPI Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {kpis.map((kpi, i) => (
                    <KPICard
                        key={i}
                        label={kpi.label}
                        value={kpi.value}
                        trend={kpi.trend}
                        icon={kpi.icon}
                        color={kpi.color}
                        description="Running across network"
                    />
                ))}
            </div>

            {/* Main Table */}
            <DataTable
                columns={columns}
                data={campaigns}
            />
        </div>
    );
};

export default BrandDashboard;
