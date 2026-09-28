import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import apiService from '../../services/ApiService';
import { PERMISSIONS } from '../../constants/permissions';
import { DAYPART_LABELS, formatHour } from '../../constants/dayparts';

const cellClass = 'px-4 py-3 text-right tabular-nums';

/**
 * Daypart delivery report (#41): Proof of Play per Campaign or Retailer
 * promotion and per Daypart. The server scopes it: a Brand sees its own
 * Campaigns, a Retailer Administrator its own Stores, Admin and Super
 * Administrator the whole network. Fallback Content is never counted.
 */
export default function DeliveryReport() {
    const { user, can } = useAuth();
    const canView = can(PERMISSIONS.DELIVERY_REPORT_VIEW_NETWORK) || can(PERMISSIONS.DELIVERY_REPORT_VIEW_OWN);
    const [report, setReport] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!user || !canView) return;
        apiService.getDeliveryReport()
            .then(setReport)
            .catch(err => setError(err.message));
    }, [user, canView]);

    if (user && !canView) return <Navigate to="/dashboard" replace />;

    // The server's columns are the Dayparts, then the hours no Daypart covers.
    const columnHeading = name => {
        const range = report.dayparts[name];
        if (!range) return 'Other hours';
        return (
            <>
                {DAYPART_LABELS[name]}{' '}
                <span className="block text-xs font-normal text-slate-400">
                    {formatHour(range.start)}–{formatHour(range.end)}
                </span>
            </>
        );
    };

    return (
        <div className="space-y-6" data-testid="delivery-report-page">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Delivery by Daypart</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Proof of Play for each Campaign and promotion, by the Store&apos;s local hour.
                    Fallback Content is not Campaign delivery and is not counted.
                </p>
            </div>

            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            {!report && !error && <p className="text-sm text-slate-500">Loading…</p>}

            {report && report.rows.length === 0 && (
                <p className="text-sm text-slate-500 dark:text-slate-400">No Campaign delivery recorded yet.</p>
            )}

            {report && report.rows.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <table className="w-full text-sm" data-testid="delivery-report-table">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold">Campaign</th>
                                {report.columns.map(name => (
                                    <th key={name} className="px-4 py-3 text-right font-semibold">{columnHeading(name)}</th>
                                ))}
                                <th className="px-4 py-3 text-right font-semibold">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {report.rows.map(row => (
                                <tr key={row.campaign_id} data-testid={`delivery-row-${row.campaign_id}`}>
                                    <td className="px-4 py-3 text-slate-900 dark:text-white">
                                        {row.campaign_name}
                                        {row.is_retailer_promotion && (
                                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Promotion</span>
                                        )}
                                    </td>
                                    {report.columns.map(name => <td key={name} className={cellClass}>{row.dayparts[name]}</td>)}
                                    <td className={`${cellClass} font-semibold`}>{row.total}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200 dark:border-slate-700 font-semibold">
                            <tr data-testid="delivery-row-total">
                                <td className="px-4 py-3">Total</td>
                                {report.columns.map(name => <td key={name} className={cellClass}>{report.totals[name]}</td>)}
                                <td className={cellClass}>{report.totals.total}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}
        </div>
    );
}
