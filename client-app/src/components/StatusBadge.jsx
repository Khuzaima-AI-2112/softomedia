
const StatusBadge = ({ status }) => {
    const getStatusStyles = () => {
        switch (status?.toLowerCase()) {
            case 'active':
            case 'online':
                return { backgroundColor: '#def7ec', color: '#03543f', dot: '#0e9f6e' };
            case 'pending':
            case 'warning':
                return { backgroundColor: '#fdf6b2', color: '#723b13', dot: '#e3a008' };
            case 'offline':
            case 'error':
            case 'ended':
                return { backgroundColor: '#fde8e8', color: '#9b1c1c', dot: '#f05252' };
            default:
                return { backgroundColor: '#f3f4f6', color: '#374151', dot: '#9ca3af' };
        }
    };

    const styles = getStatusStyles();

    return (
        <span style={{
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
