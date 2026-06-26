const STATUS_STYLES = {
    // Active / healthy states — green
    active:   { backgroundColor: '#def7ec', color: '#03543f', dot: '#0e9f6e' },
    online:   { backgroundColor: '#def7ec', color: '#03543f', dot: '#0e9f6e' },
    ready:    { backgroundColor: '#def7ec', color: '#03543f', dot: '#0e9f6e' },

    // Warning / transitional states — amber
    pending:  { backgroundColor: '#fdf6b2', color: '#723b13', dot: '#e3a008' },
    warning:  { backgroundColor: '#fdf6b2', color: '#723b13', dot: '#e3a008' },
    loading:  { backgroundColor: '#fdf6b2', color: '#723b13', dot: '#e3a008' },

    // Error / stopped states — red
    offline:  { backgroundColor: '#fde8e8', color: '#9b1c1c', dot: '#f05252' },
    error:    { backgroundColor: '#fde8e8', color: '#9b1c1c', dot: '#f05252' },
    ended:    { backgroundColor: '#fde8e8', color: '#9b1c1c', dot: '#f05252' },

    // Inactive / disabled state — grey with red dot to signal deactivated (Task 2.8)
    inactive: { backgroundColor: '#f3f4f6', color: '#6b7280', dot: '#ef4444' },
};

const DEFAULT_STYLE = { backgroundColor: '#f3f4f6', color: '#374151', dot: '#9ca3af' };

const StatusBadge = ({ status }) => {
    const styles = STATUS_STYLES[status?.toLowerCase()] ?? DEFAULT_STYLE;

    return (
        <span data-testid="loop-status" style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 10px',
            borderRadius: '9999px',
            fontSize: '12px',
            fontWeight: '600',
            backgroundColor: styles.backgroundColor,
            color: styles.color
        }}>
            <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: styles.dot,
                marginRight: '6px'
            }} />
            {status}
        </span>
    );
};

export default StatusBadge;
