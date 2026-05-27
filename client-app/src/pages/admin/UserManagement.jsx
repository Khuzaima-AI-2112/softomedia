import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../../components/GlassCard';
import StatusBadge from '../../components/StatusBadge';
import DataTable from '../../components/DataTable';
import apiService from '../../services/ApiService';
import { useAuth } from '../../contexts/AuthContext';
import { Trash2, Pencil } from 'lucide-react';

const ROLES = [
    { value: 'superadmin',      label: 'Super Admin',      color: 'text-purple-500', icon: 'shield_person' },
    { value: 'contentmanager',  label: 'Content Manager',  color: 'text-blue-500',   icon: 'edit_note'     },
    { value: 'techoperator',    label: 'Tech Operator',    color: 'text-amber-500',  icon: 'engineering'   },
    { value: 'retaileradmin',   label: 'Retailer Admin',   color: 'text-emerald-500',icon: 'storefront'    },
    { value: 'advertiser',      label: 'Advertiser',       color: 'text-rose-500',   icon: 'campaign'      }
];

function UserManagement() {
    const navigate  = useNavigate();
    const { user }  = useAuth();

    // Phase 3: gate entire page behind superadmin
    const isSuperAdmin = user?.role === 'superadmin';

    const [users,       setUsers]       = useState([]);
    const [retailers,   setRetailers]   = useState([]);
    const [advertisers, setAdvertisers] = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [showModal,   setShowModal]   = useState(false);
    const [formData,    setFormData]    = useState({
        name: '', email: '', role: 'advertiser', linkedentityid: ''
    });
    const [editingUserId, setEditingUserId] = useState(null);
    const [filterRole,    setFilterRole]    = useState('all');
    const [modalError,    setModalError]    = useState('');
    const [pageError,     setPageError]     = useState('');
    const [successMessage,setSuccessMessage]= useState('');

    useEffect(() => {
        if (!isSuperAdmin) {
            navigate('/dashboard/admin', { replace: true });
            return;
        }
        loadData();
    }, [isSuperAdmin]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [allUsers, allRetailers, allAdvertisers] = await Promise.all([
                apiService.getUsers(),
                apiService.getRetailers(),
                apiService.getAdvertisers()
            ]);