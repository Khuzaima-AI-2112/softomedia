const DataTable = ({ columns, data, loading, emptyMessage = 'No data available' }) => {
    if (loading) {
        return (
            <div className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-8 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    // Defensive: filter out any null/undefined entries that could crash renderers
    const safeData = Array.isArray(data) ? data.filter(row => row != null) : [];

    const renderCell = (col, row) => {
        if (col.render) {
            // Support both single-arg render(row) [RetailerManagement style]
            // and two-arg render(value, row) [UserManagement style]
            const accessor = col.accessor || col.key;
            const value = accessor ? row[accessor] : row;
            return col.render(value, row);
        }

        // No render fn — resolve value via accessor or key
        const accessor = col.accessor || col.key;
        const value = accessor ? row[accessor] : undefined;

        // Guard: never render a plain object as a React child (causes Minified Error #31)
        if (value !== null && typeof value === 'object') {
            return JSON.stringify(value);
        }

        return value ?? '';
    };

    return (
        <div data-testid="data-table" className="bg-white dark:bg-surface-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            {columns.map((col, idx) => (
                                <th key={idx} className={`px-6 py-4 font-semibold ${col.className || ''}`}>
                                    {col.header || col.label || ''}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {safeData.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-500">
                                    {emptyMessage}
                                </td>
                            </tr>
                        ) : (
                            safeData.map((row, rowIdx) => (
                                <tr key={row.id ?? rowIdx} className="bg-white dark:bg-surface-dark hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                    {columns.map((col, colIdx) => (
                                        <td key={colIdx} className={`px-6 py-4 ${col.className || ''}`}>
                                            {renderCell(col, row)}
                                        </td>
                                    ))}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default DataTable;
