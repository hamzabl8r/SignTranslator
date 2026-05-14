import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Users, LayoutDashboard, Trash2, UserPlus, ShieldAlert, UserCheck,
  Search, Filter, Eye, Mail, Phone, Calendar, Activity,
  TrendingUp, Clock, LogOut, Download, RefreshCw, AlertCircle,
  Edit2, Ban, CheckCircle, XCircle, Lock, Unlock, Bell,
  BarChart2, PieChart, Settings, ChevronDown, ChevronUp,
  UserX, MessageSquare, Shield, Star, ArrowUpRight, MoreVertical,
  Send, Image, FileText, Globe, ToggleLeft, ToggleRight,
  Database, Check, X as XIcon, Hourglass
} from 'lucide-react';
import SeoHelmet from './SeoHelmet';
import './Styles/AdminDashboard.css';

const BASE_URL = 'https://backpfe-production-789f.up.railway.app';
const AI_METRICS_URL = process.env.REACT_APP_AI_BASE_URL || 'https://modelsigntranslator.onrender.com';

// Map URL paths to tab ids
const PATH_TO_TAB = {
  '/admin':              'overview',
  '/admin/users':        'users',
  '/admin/datasets':     'datasets',
  '/admin/classification':'classification',
  '/admin/activity':     'activity',
  '/admin/notifications':'notifications',
  '/admin/settings':     'settings',
};

const TAB_TO_PATH = {
  overview:      '/admin',
  users:         '/admin/users',
  datasets:      '/admin/datasets',
  classification:'/admin/classification',
  activity:      '/admin/activity',
  notifications: '/admin/notifications',
  settings:      '/admin/settings',
};

const AdminDashboard = ({ initialTab }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.user);

  // Derive active tab from URL, fallback to initialTab prop or 'overview'
  const tabFromUrl = PATH_TO_TAB[location.pathname];
  const [activeTab, setActiveTab] = useState(tabFromUrl || initialTab || 'overview');

  // Sync tab when URL changes (browser back/forward)
  useEffect(() => {
    const tab = PATH_TO_TAB[location.pathname];
    if (tab) setActiveTab(tab);
  }, [location.pathname]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(TAB_TO_PATH[tab] || '/admin');
  };

  // ── State ────────────────────────────────────────────────────────────────
  const [allUsers, setAllUsers]               = useState([]);
  const [filteredUsers, setFilteredUsers]     = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [actionLoading, setActionLoading]     = useState(null);
  const [searchTerm, setSearchTerm]           = useState('');
  const [roleFilter, setRoleFilter]           = useState('all');
  const [sortConfig, setSortConfig]           = useState({ key: 'createdAt', dir: 'desc' });
  const [currentPage, setCurrentPage]         = useState(1);
  const [pageSize]                            = useState(10);
  const [selectedUser, setSelectedUser]       = useState(null);
  const [showUserModal, setShowUserModal]     = useState(false);
  const [showEditModal, setShowEditModal]     = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showBanConfirm, setShowBanConfirm]   = useState(false);
  const [showNotifModal, setShowNotifModal]   = useState(false);
  const [userToDelete, setUserToDelete]       = useState(null);
  const [userToBan, setUserToBan]             = useState(null);
  const [editForm, setEditForm]               = useState({});
  const [notifForm, setNotifForm]             = useState({ title: '', message: '', target: 'all' });
  const [notifSending, setNotifSending]       = useState(false);
  const [toast, setToast]                     = useState(null);
  const [stats, setStats]                     = useState({
    totalUsers: 0, admins: 0, newThisMonth: 0, activeUsers: 0,
    bannedUsers: 0, totalMessages: 0
  });
  const [recentActivity, setRecentActivity]   = useState([]);
  const [selectedRows, setSelectedRows]       = useState(new Set());
  const [showBulkMenu, setShowBulkMenu]       = useState(false);

  // ── Dataset State ─────────────────────────────────────────────────────────
  const [pendingDatasets, setPendingDatasets]       = useState([]);
  const [datasetsLoading, setDatasetsLoading]       = useState(false);
  const [datasetFilter, setDatasetFilter]           = useState('all');
  const [datasetActionLoading, setDatasetActionLoading] = useState(null);
  const [selectedDataset, setSelectedDataset]       = useState(null);
  const [showDatasetModal, setShowDatasetModal]     = useState(false);
  const [rejectReason, setRejectReason]             = useState('');
  const [showRejectModal, setShowRejectModal]       = useState(false);
  const [datasetToReject, setDatasetToReject]       = useState(null);

  // ── Classification State ──────────────────────────────────────────────────
  const [classificationMetrics, setClassificationMetrics] = useState(null);
  const [classificationLoading, setClassificationLoading] = useState(false);
  const [classificationError, setClassificationError] = useState('');
  const [classificationHistory, setClassificationHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [nextRefresh, setNextRefresh] = useState(86400); // 24h countdown in seconds
  const refreshTimerRef = useRef(null);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

  const avatarSrc = (pic) =>
    pic ? `${BASE_URL}${pic}` : '/default-avatar.png';

  const getAuthHeader = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) return {};
    const authHeader = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    return { Authorization: authHeader, 'Cache-Control': 'no-cache', Pragma: 'no-cache' };
  }, []);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/user/`, {
        headers: getAuthHeader(),
        params: { _t: Date.now() },
      });
      const users = res.data.users || [];
      setAllUsers(users);
      setFilteredUsers(users);
    } catch {
      showToast('Erreur lors du chargement des utilisateurs', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, getAuthHeader]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/user/stats`, {
        headers: getAuthHeader(), params: { _t: Date.now() },
      });
      setStats(prev => ({ ...prev, ...res.data }));
    } catch {}
  }, [getAuthHeader]);

  const fetchRecentActivity = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/user/activity`, {
        headers: getAuthHeader(), params: { _t: Date.now() },
      });
      setRecentActivity(res.data.activities || []);
    } catch {
      setRecentActivity([]);
    }
  }, [getAuthHeader]);

  const logActivity = useCallback(async (action, details) => {
    if (!user?._id) return;
    try {
      await axios.post(`${BASE_URL}/user/log-activity`, {
        userId: user?._id, action, details, timestamp: new Date()
      }, { headers: getAuthHeader() });
      fetchRecentActivity();
    } catch {}
  }, [user?._id, fetchRecentActivity, getAuthHeader]);

  // ── Dataset fetching ──────────────────────────────────────────────────────
  const fetchDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/dataset/all`, {
        headers: getAuthHeader(), params: { _t: Date.now() },
      });
      setPendingDatasets(res.data.datasets || []);
    } catch {
      showToast('Erreur lors du chargement des datasets', 'error');
    } finally {
      setDatasetsLoading(false);
    }
  }, [showToast, getAuthHeader]);

  const fetchClassificationMetrics = useCallback(async () => {
    setClassificationLoading(true);
    setClassificationError('');

    try {
      const res = await axios.get(`${AI_METRICS_URL}/classification`, {
        params: { _t: Date.now() },
      });
      setClassificationMetrics(res.data || null);
    } catch (error) {
      setClassificationMetrics(null);
      const status = error?.response?.status;
      const detail = error?.response?.data?.detail;

      if (status === 404) {
        setClassificationError('Route /classification introuvable sur le backend IA. Redeployez sign-language-core avec la nouvelle route et train_metrics.json.');
      } else {
        setClassificationError(detail || 'Impossible de charger les metriques de classification.');
      }
    } finally {
      setClassificationLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchStats();
    fetchRecentActivity();
  }, [fetchUsers, fetchStats, fetchRecentActivity]);

  useEffect(() => {
    if (activeTab === 'datasets') fetchDatasets();
  }, [activeTab, fetchDatasets]);

  const fetchClassificationHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${AI_METRICS_URL}/classification/history`, {
        params: { _t: Date.now() },
      });
      setClassificationHistory(res.data?.history || []);
    } catch {
      setClassificationHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'classification') {
      fetchClassificationMetrics();
      fetchClassificationHistory();
      setNextRefresh(86400);
    }
  }, [activeTab, fetchClassificationMetrics, fetchClassificationHistory]);

  // Auto-refresh every 24h
  useEffect(() => {
    if (activeTab !== 'classification') {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      return;
    }
    refreshTimerRef.current = setInterval(() => {
      setNextRefresh(prev => {
        if (prev <= 1) {
          fetchClassificationMetrics();
          fetchClassificationHistory();
          return 86400;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(refreshTimerRef.current);
  }, [activeTab, fetchClassificationMetrics, fetchClassificationHistory]);

  // ── Dataset actions ───────────────────────────────────────────────────────
  const approveDataset = async (datasetId) => {
    setDatasetActionLoading(datasetId);
    try {
      await axios.put(`${BASE_URL}/dataset/${datasetId}/approve`, { status: 'approved' }, { headers: getAuthHeader() });
      setPendingDatasets(prev => prev.map(d => d._id === datasetId ? { ...d, status: 'approved' } : d));
      showToast('Dataset approuvé avec succès');
      await logActivity('approve_dataset', `Dataset ${datasetId} approuvé`);
    } catch {
      showToast('Erreur lors de l\'approbation', 'error');
    } finally {
      setDatasetActionLoading(null);
    }
  };

  const openRejectModal = (dataset) => {
    setDatasetToReject(dataset);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const confirmReject = async () => {
    if (!datasetToReject) return;
    setDatasetActionLoading(datasetToReject._id);
    try {
      await axios.put(`${BASE_URL}/dataset/${datasetToReject._id}/reject`, {
        status: 'rejected', reason: rejectReason
      }, { headers: getAuthHeader() });
      setPendingDatasets(prev =>
        prev.map(d => d._id === datasetToReject._id ? { ...d, status: 'rejected', rejectReason } : d)
      );
      showToast('Dataset refusé');
      await logActivity('reject_dataset', `Dataset ${datasetToReject._id} refusé`);
    } catch {
      showToast('Erreur lors du refus', 'error');
    } finally {
      setDatasetActionLoading(null);
      setShowRejectModal(false);
      setDatasetToReject(null);
      setRejectReason('');
    }
  };

  // ── Filtering & Sorting ───────────────────────────────────────────────────
  useEffect(() => {
    let result = [...allUsers];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(u =>
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phoneNumber || '').includes(q)
      );
    }
    if (roleFilter === 'admin')  result = result.filter(u => u.isAdmin);
    if (roleFilter === 'user')   result = result.filter(u => !u.isAdmin);
    if (roleFilter === 'banned') result = result.filter(u => u.isBanned);
    result.sort((a, b) => {
      const va = a[sortConfig.key] ?? '';
      const vb = b[sortConfig.key] ?? '';
      const cmp = String(va).localeCompare(String(vb), 'fr', { numeric: true });
      return sortConfig.dir === 'asc' ? cmp : -cmp;
    });
    setFilteredUsers(result);
    setCurrentPage(1);
  }, [searchTerm, roleFilter, sortConfig, allUsers]);

  const paginated = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredUsers.length / pageSize);

  const toggleSort = (key) => {
    setSortConfig(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const filteredDatasets = pendingDatasets.filter(d => {
    if (datasetFilter === 'all') return true;
    return d.status === datasetFilter;
  });

  const datasetCounts = {
    pending:  pendingDatasets.filter(d => d.status === 'pending').length,
    approved: pendingDatasets.filter(d => d.status === 'approved').length,
    rejected: pendingDatasets.filter(d => d.status === 'rejected').length,
  };

  // ── CRUD actions ──────────────────────────────────────────────────────────
  const handleDelete = (id) => { setUserToDelete(id); setShowConfirmDialog(true); };

  const confirmDelete = async () => {
    setActionLoading(userToDelete);
    try {
      await axios.delete(`${BASE_URL}/user/${userToDelete}`, {
        headers: getAuthHeader(),
      });
      setAllUsers(prev => prev.filter(u => u._id !== userToDelete));
      showToast('Utilisateur supprimé avec succès');
      await logActivity('delete_user', `Utilisateur ${userToDelete} supprimé`);
    } catch {
      showToast('Erreur lors de la suppression', 'error');
    } finally {
      setActionLoading(null);
      setShowConfirmDialog(false);
      setUserToDelete(null);
    }
  };

  const toggleAdminStatus = async (id, currentStatus) => {
    setActionLoading(id);
    try {
      await axios.put(
        `${BASE_URL}/user/${id}`,
        { isAdmin: !currentStatus },
        { headers: getAuthHeader() }
      );
      setAllUsers(prev => prev.map(u => u._id === id ? { ...u, isAdmin: !currentStatus } : u));
      showToast(currentStatus ? 'Droits admin retirés' : 'Droits admin accordés');
      await logActivity('toggle_admin', `Rôle admin modifié pour ${id}`);
    } catch {
      showToast('Erreur lors de la mise à jour du rôle', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleBan = async (u) => {
    setActionLoading(u._id);
    try {
      await axios.put(
        `${BASE_URL}/user/${u._id}`,
        { isBanned: !u.isBanned },
        { headers: getAuthHeader() }
      );
      setAllUsers(prev => prev.map(x => x._id === u._id ? { ...x, isBanned: !u.isBanned } : x));
      showToast(u.isBanned ? 'Utilisateur débanni' : 'Utilisateur banni');
      await logActivity('toggle_ban', `Utilisateur ${u._id} ${u.isBanned ? 'débanni' : 'banni'}`);
    } catch {
      showToast('Erreur lors de la mise à jour', 'error');
    } finally {
      setActionLoading(null);
      setShowBanConfirm(false);
      setUserToBan(null);
    }
  };

  const openEditModal = (u) => {
    setSelectedUser(u);
    setEditForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, phoneNumber: u.phoneNumber || '', isAdmin: u.isAdmin });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    setActionLoading(selectedUser._id);
    try {
      await axios.put(`${BASE_URL}/user/${selectedUser._id}`, editForm, {
        headers: getAuthHeader(),
      });
      setAllUsers(prev => prev.map(u => u._id === selectedUser._id ? { ...u, ...editForm } : u));
      showToast('Utilisateur mis à jour');
      await logActivity('edit_user', `Profil de ${selectedUser._id} modifié`);
      setShowEditModal(false);
    } catch {
      showToast('Erreur lors de la mise à jour', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const resetPassword = async (id) => {
    setActionLoading(id);
    try {
      await axios.post(
        `${BASE_URL}/user/${id}/reset-password`,
        {},
        { headers: getAuthHeader() }
      );
      showToast('Email de réinitialisation envoyé');
      await logActivity('reset_password', `Mot de passe réinitialisé pour ${id}`);
    } catch {
      showToast('Erreur lors de la réinitialisation', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────
  const toggleRow = (id) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllRows = () => {
    if (selectedRows.size === paginated.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(paginated.map(u => u._id)));
    }
  };

  const bulkDelete = async () => {
    const ids = [...selectedRows];
    setShowBulkMenu(false);
    for (const id of ids) {
      try {
        await axios.delete(`${BASE_URL}/user/${id}`, {
          headers: getAuthHeader(),
        });
      } catch {}
    }
    setAllUsers(prev => prev.filter(u => !selectedRows.has(u._id)));
    setSelectedRows(new Set());
    showToast(`${ids.length} utilisateur(s) supprimé(s)`);
    await logActivity('bulk_delete', `${ids.length} utilisateurs supprimés`);
  };

  const bulkExport = () => {
    const targets = allUsers.filter(u => selectedRows.has(u._id));
    exportToCSV(targets);
    setShowBulkMenu(false);
    setSelectedRows(new Set());
  };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportToCSV = (users = filteredUsers) => {
    if (!users.length) return showToast('Aucune donnée à exporter', 'error');
    const rows = users.map(u => ({
      'Nom complet': `${u.firstName} ${u.lastName}`,
      Email: u.email,
      Téléphone: u.phoneNumber || 'N/A',
      Rôle: u.isAdmin ? 'Administrateur' : 'Membre',
      Banni: u.isBanned ? 'Oui' : 'Non',
      Inscription: new Date(u.createdAt).toLocaleDateString('fr-FR'),
    }));
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    Object.assign(document.createElement('a'), { href: url, download: 'utilisateurs.csv' }).click();
  };

  // ── Notifications ──────────────────────────────────────────────────────────
  const sendNotification = async () => {
    if (!notifForm.title.trim() || !notifForm.message.trim()) return;
    setNotifSending(true);
    try {
      await axios.post(
        `${BASE_URL}/user/notify`,
        { ...notifForm, fromAdmin: user?._id },
        { headers: getAuthHeader() }
      );
      showToast('Notification envoyée !');
      setShowNotifModal(false);
      setNotifForm({ title: '', message: '', target: 'all' });
      await logActivity('send_notification', `Notification "${notifForm.title}" envoyée`);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) {
        showToast('Endpoint notification introuvable — vérifiez la route backend /user/notify', 'error');
      } else {
        showToast('Erreur lors de l\'envoi', 'error');
      }
    } finally {
      setNotifSending(false);
    }
  };

  // ── Compute derived stats ─────────────────────────────────────────────────
  useEffect(() => {
    if (!allUsers.length) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    setStats(prev => ({
      ...prev,
      totalUsers:   allUsers.length,
      admins:       allUsers.filter(u => u.isAdmin).length,
      newThisMonth: allUsers.filter(u => new Date(u.createdAt) >= monthStart).length,
      bannedUsers:  allUsers.filter(u => u.isBanned).length,
    }));
  }, [allUsers]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <>
      <SeoHelmet title="Admin Dashboard - MediSign" />
      <div className="admin-loader">
        <div className="loader-spinner" />
        <p>Chargement du panneau de contrôle...</p>
      </div>
    </>
  );

  const SortIcon = ({ col }) => (
    sortConfig.key === col
      ? (sortConfig.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)
      : <ChevronDown size={14} style={{ opacity: 0.3 }} />
  );

  return (
    <div className="admin-wrapper">
      <SeoHelmet title="Admin Dashboard - MediSign" />
      {/* ── Toast ── */}
      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <ShieldAlert size={24} color="#3b82f6" />
          <span>Admin Space</span>
        </div>

        <nav>
          {[
            { id: 'overview',      icon: <LayoutDashboard size={20}/>, label: 'Dashboard' },
            { id: 'users',         icon: <Users size={20}/>,           label: 'Utilisateurs' },
            { id: 'datasets',      icon: <Database size={20}/>,        label: 'Datasets', badge: datasetCounts.pending || null },
            { id: 'classification',icon: <BarChart2 size={20}/>,       label: 'Classification' },
            { id: 'activity',      icon: <Activity size={20}/>,        label: 'Activités' },
            { id: 'notifications', icon: <Bell size={20}/>,            label: 'Notifications' },
            { id: 'settings',      icon: <Settings size={20}/>,        label: 'Paramètres' },
          ].map(({ id, icon, label, badge }) => (
            <button
              key={id}
              className={`admin-nav-item ${activeTab === id ? 'active' : ''}`}
              onClick={() => handleTabChange(id)}
            >
              {icon} {label}
              {badge > 0 && (
                <span className="nav-badge">{badge}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-nav-item" onClick={() => navigate('/')}>
            <LogOut size={20} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h2>
              {{ overview: 'Tableau de Bord', users: 'Gestion des Utilisateurs',
                 datasets: 'Validation des Datasets',
                 classification: 'Classification',
                 activity: 'Activités Récentes', notifications: 'Notifications',
                 settings: 'Paramètres' }[activeTab]}
            </h2>
            <p className="admin-subtitle">Bienvenue {user?.firstName} {user?.lastName}</p>
          </div>
          <div className="admin-profile-info">
            <img src={avatarSrc(user?.profilePic)} alt="profile" className="admin-avatar" />
            <div className="admin-profile-text">
              <span>{user?.firstName} {user?.lastName}</span>
              <span className="admin-role">Administrateur</span>
            </div>
            <div className="status-dot online" />
          </div>
        </header>

        <section className="admin-content">

          {/* ════════ OVERVIEW ════════ */}
          {activeTab === 'overview' && (
            <>
              <div className="stats-grid">
                {[
                  { label: 'Total Utilisateurs',  value: stats.totalUsers,      icon: <Users size={24}/>,       color: 'blue',   sub: `+${stats.newThisMonth} ce mois` },
                  { label: 'Administrateurs',      value: stats.admins,          icon: <ShieldAlert size={24}/>, color: 'purple', sub: `sur ${stats.totalUsers}` },
                  { label: 'Nouveaux ce mois',     value: stats.newThisMonth,    icon: <UserPlus size={24}/>,    color: 'green',  sub: 'inscriptions récentes' },
                  { label: 'Utilisateurs actifs',  value: stats.activeUsers,     icon: <Activity size={24}/>,    color: 'orange', sub: "connectés aujourd'hui" },
                  { label: 'Bannis',               value: stats.bannedUsers,     icon: <Ban size={24}/>,         color: 'red',    sub: 'comptes suspendus' },
                  { label: 'Datasets en attente',  value: datasetCounts.pending, icon: <Database size={24}/>,    color: 'teal',   sub: 'à valider' },
                ].map(({ label, value, icon, color, sub }) => (
                  <div className="stat-card" key={label}>
                    <div className={`stat-icon ${color}`}>{icon}</div>
                    <div className="stat-info">
                      <span className="stat-label">{label}</span>
                      <span className="stat-value">{value}</span>
                      <span className="stat-change">{sub}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="overview-grid">
                <div className="recent-section">
                  <div className="section-header">
                    <h3>Activités Récentes</h3>
                    <button className="refresh-btn" onClick={fetchRecentActivity}>
                      <RefreshCw size={16} /> Rafraîchir
                    </button>
                  </div>
                  <div className="activity-timeline">
                    {recentActivity.length === 0 && <p className="no-data">Aucune activité récente</p>}
                    {recentActivity.slice(0, 8).map((a, i) => (
                      <div key={i} className="activity-item">
                        <div className="activity-icon"><Clock size={16} /></div>
                        <div className="activity-details">
                          <p className="activity-action">{a.action}</p>
                          <p className="activity-meta">{a.details} • {formatDate(a.timestamp)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="quick-actions-card">
                  <h3>Actions Rapides</h3>
                  <div className="quick-actions-list">
                    {[
                      { icon: <Users size={18}/>, label: 'Gérer les utilisateurs', tab: 'users' },
                      { icon: <Database size={18}/>, label: 'Valider les datasets', tab: 'datasets', badge: datasetCounts.pending },
                      { icon: <Bell size={18}/>, label: 'Envoyer une notification', tab: 'notifications' },
                      { icon: <Activity size={18}/>, label: 'Voir les activités', tab: 'activity' },
                    ].map(({ icon, label, tab, badge }) => (
                      <button key={tab} className="quick-action-btn" onClick={() => handleTabChange(tab)}>
                        {icon} {label}
                        {badge > 0 && (
                          <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '11px', padding: '1px 7px' }}>
                            {badge}
                          </span>
                        )}
                        {!badge && <ArrowUpRight size={14} style={{ marginLeft: 'auto' }} />}
                      </button>
                    ))}
                    <button className="quick-action-btn" onClick={() => exportToCSV()}>
                      <Download size={18} /> Exporter les utilisateurs
                      <ArrowUpRight size={14} style={{ marginLeft: 'auto' }} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ════════ USERS ════════ */}
          {activeTab === 'users' && (
            <>
              <div className="users-controls">
                <div className="search-bar">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, email, téléphone..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                      <XCircle size={16} />
                    </button>
                  )}
                </div>
                <div className="filter-group">
                  <Filter size={18} />
                  <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                    <option value="all">Tous les utilisateurs</option>
                    <option value="admin">Administrateurs</option>
                    <option value="user">Membres</option>
                    <option value="banned">Bannis</option>
                  </select>
                </div>
                <button className="export-btn" onClick={() => exportToCSV()}>
                  <Download size={18} /> Exporter
                </button>
                <button className="export-btn" onClick={() => handleTabChange('notifications')} style={{ background: '#8b5cf6' }}>
                  <Bell size={18} /> Notifier
                </button>
                {selectedRows.size > 0 && (
                  <div style={{ position: 'relative' }}>
                    <button className="export-btn" style={{ background: '#f59e0b' }} onClick={() => setShowBulkMenu(v => !v)}>
                      <MoreVertical size={18} /> {selectedRows.size} sélectionné(s)
                    </button>
                    {showBulkMenu && (
                      <div className="bulk-menu">
                        <button onClick={bulkExport}><Download size={14} /> Exporter la sélection</button>
                        <button onClick={bulkDelete} style={{ color: '#ef4444' }}><Trash2 size={14} /> Supprimer la sélection</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="table-meta">
                <span>{filteredUsers.length} utilisateur(s) trouvé(s)</span>
                <span>Page {currentPage}/{totalPages || 1}</span>
              </div>

              <div className="table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          checked={selectedRows.size === paginated.length && paginated.length > 0}
                          onChange={toggleAllRows}
                        />
                      </th>
                      <th onClick={() => toggleSort('firstName')} style={{ cursor: 'pointer' }}>Utilisateur <SortIcon col="firstName" /></th>
                      <th onClick={() => toggleSort('email')} style={{ cursor: 'pointer' }}>Email <SortIcon col="email" /></th>
                      <th>Téléphone</th>
                      <th onClick={() => toggleSort('isAdmin')} style={{ cursor: 'pointer' }}>Rôle <SortIcon col="isAdmin" /></th>
                      <th>Statut</th>
                      <th onClick={() => toggleSort('createdAt')} style={{ cursor: 'pointer' }}>Inscription <SortIcon col="createdAt" /></th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Aucun utilisateur trouvé</td></tr>
                    ) : (
                      paginated.map(u => (
                        <tr key={u._id} className={selectedRows.has(u._id) ? 'row-selected' : ''}>
                          <td><input type="checkbox" checked={selectedRows.has(u._id)} onChange={() => toggleRow(u._id)} /></td>
                          <td>
                            <div className="user-cell">
                              <div style={{ position: 'relative' }}>
                                <img src={avatarSrc(u.profilePic)} alt="avatar" className="mini-avatar"
                                  onError={e => { e.target.src = '/default-avatar.png'; }} />
                                {u.isBanned && <span className="banned-badge">🚫</span>}
                              </div>
                              <div>
                                <span className="user-name">{u.firstName} {u.lastName}</span>
                                <span className="user-username">@{u.email?.split('@')[0]}</span>
                              </div>
                            </div>
                          </td>
                          <td><div className="email-cell"><Mail size={14} /> {u.email}</div></td>
                          <td><div className="phone-cell"><Phone size={14} /> {u.phoneNumber || '—'}</div></td>
                          <td><span className={`role-pill ${u.isAdmin ? 'admin' : 'user'}`}>{u.isAdmin ? 'Admin' : 'Membre'}</span></td>
                          <td><span className={`status-pill ${u.isBanned ? 'banned' : 'active'}`}>{u.isBanned ? '🚫 Banni' : '✅ Actif'}</span></td>
                          <td><div className="date-cell"><Calendar size={14} />{formatDate(u.createdAt)}</div></td>
                          <td>
                            <div className="actions-cell">
                              <button className="action-btn view" onClick={() => { setSelectedUser(u); setShowUserModal(true); }} title="Voir"><Eye size={16} /></button>
                              <button className="action-btn edit" onClick={() => openEditModal(u)} title="Modifier" disabled={actionLoading === u._id}><Edit2 size={16} /></button>
                              <button className="action-btn promote" onClick={() => toggleAdminStatus(u._id, u.isAdmin)} title={u.isAdmin ? 'Retirer admin' : 'Promouvoir'} disabled={actionLoading === u._id}>{u.isAdmin ? <UserX size={16} /> : <UserCheck size={16} />}</button>
                              <button className={`action-btn ${u.isBanned ? 'unban' : 'ban'}`} onClick={() => { setUserToBan(u); setShowBanConfirm(true); }} title={u.isBanned ? 'Débannir' : 'Bannir'} disabled={actionLoading === u._id}>{u.isBanned ? <Unlock size={16} /> : <Lock size={16} />}</button>
                              <button className="action-btn reset" onClick={() => resetPassword(u._id)} title="Réinitialiser mdp" disabled={actionLoading === u._id}><Lock size={16} /></button>
                              <button className="action-btn delete" onClick={() => handleDelete(u._id)} title="Supprimer" disabled={actionLoading === u._id || u._id === user._id}><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="page-btn">← Précédent</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button key={n} onClick={() => setCurrentPage(n)} className={`page-btn ${currentPage === n ? 'active' : ''}`}>{n}</button>
                  ))}
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="page-btn">Suivant →</button>
                </div>
              )}
            </>
          )}

          {/* ════════ DATASETS ════════ */}
          {activeTab === 'datasets' && (
            <div className="datasets-section">
              {/* Summary bar */}
              <div className="dataset-summary-bar">
                {[
                  { key: 'all',      label: 'Tous',       count: pendingDatasets.length, color: '#64748b' },
                  { key: 'pending',  label: 'En attente', count: datasetCounts.pending,  color: '#f59e0b' },
                  { key: 'approved', label: 'Approuvés',  count: datasetCounts.approved, color: '#22c55e' },
                  { key: 'rejected', label: 'Refusés',    count: datasetCounts.rejected, color: '#ef4444' },
                ].map(({ key, label, count, color }) => (
                  <button
                    key={key}
                    className={`dataset-filter-btn ${datasetFilter === key ? 'active' : ''}`}
                    onClick={() => setDatasetFilter(key)}
                    style={{ '--filter-color': color }}
                  >
                    <span className="filter-count" style={{ background: color }}>{count}</span>
                    {label}
                  </button>
                ))}
                <button className="refresh-btn" onClick={fetchDatasets} style={{ marginLeft: 'auto' }}>
                  <RefreshCw size={16} /> Rafraîchir
                </button>
              </div>

              {/* Dataset list */}
              {datasetsLoading ? (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--muted)' }}>
                  <div className="loader-spinner" style={{ margin: '0 auto 16px' }} />
                  <p>Chargement des datasets...</p>
                </div>
              ) : filteredDatasets.length === 0 ? (
                <div className="no-data">
                  <Database size={48} />
                  <p>Aucun dataset {datasetFilter !== 'all' ? `"${datasetFilter}"` : ''} trouvé</p>
                </div>
              ) : (
                <div className="dataset-grid">
                  {filteredDatasets.map(dataset => (
                    <div key={dataset._id} className={`dataset-card dataset-card--${dataset.status}`}>

                      {/* Card top strip */}
                      <div className={`dataset-card__strip dataset-card__strip--${dataset.status}`} />

                      <div className="dataset-card__body">
                        {/* Header row */}
                        <div className="dataset-card__header">
                          <div className="dataset-card__icon-wrap">
                            <Database size={20} />
                          </div>
                          <div className="dataset-card__title-block">
                            <h4 className="dataset-card__name">{dataset.name || dataset.title || 'Dataset sans nom'}</h4>
                            <p className="dataset-card__submitter">
                              Soumis par <strong>{dataset.user?.firstName} {dataset.user?.lastName}</strong>
                              &nbsp;·&nbsp;{formatDate(dataset.createdAt)}
                            </p>
                          </div>
                          <span className={`dataset-status-badge dataset-status-badge--${dataset.status}`}>
                            {dataset.status === 'pending'  && <><Hourglass size={12} /> En attente</>}
                            {dataset.status === 'approved' && <><Check size={12} /> Approuvé</>}
                            {dataset.status === 'rejected' && <><XIcon size={12} /> Refusé</>}
                          </span>
                        </div>

                        {/* Meta chips */}
                        <div className="dataset-card__chips">
                          {dataset.type && <span className="dataset-chip dataset-chip--type">{dataset.type}</span>}
                          {dataset.images?.length > 0 && (
                            <span className="dataset-chip dataset-chip--images">
                              <Image size={11} /> {dataset.images.length} image{dataset.images.length > 1 ? 's' : ''}
                            </span>
                          )}
                          {dataset.size && <span className="dataset-chip">{dataset.size}</span>}
                          {dataset.fileUrl && (
                            <a href={`${BASE_URL}${dataset.fileUrl}`} target="_blank" rel="noopener noreferrer" className="dataset-chip dataset-chip--file">
                              <FileText size={11} /> Fichier
                            </a>
                          )}
                        </div>

                        {/* Description */}
                        {dataset.description && (
                          <p className="dataset-card__desc">{dataset.description}</p>
                        )}

                        {/* Reject reason */}
                        {dataset.rejectReason && dataset.status === 'rejected' && (
                          <div className="dataset-reject-reason">
                            <XCircle size={13} /> <strong>Raison :</strong> {dataset.rejectReason}
                          </div>
                        )}

                        {/* Image preview strip */}
                        {dataset.images?.length > 0 && (
                          <div className="dataset-card__img-strip">
                            {dataset.images.slice(0, 4).map((img, i) => (
                              <img key={i} src={img} alt={`preview-${i}`} className="dataset-card__img-thumb"
                                onError={e => { e.target.style.display = 'none'; }} />
                            ))}
                            {dataset.images.length > 4 && (
                              <div className="dataset-card__img-more">+{dataset.images.length - 4}</div>
                            )}
                          </div>
                        )}

                        {/* Actions */}
                        <div className="dataset-card__actions">
                          <button
                            className="dataset-action-btn dataset-action-btn--view"
                            onClick={() => { setSelectedDataset(dataset); setShowDatasetModal(true); }}
                          >
                            <Eye size={14} /> Détails
                          </button>

                          {dataset.status === 'pending' && (
                            <>
                              <button
                                className="dataset-action-btn dataset-action-btn--approve"
                                onClick={() => approveDataset(dataset._id)}
                                disabled={datasetActionLoading === dataset._id}
                              >
                                <Check size={14} />
                                {datasetActionLoading === dataset._id ? 'Traitement...' : 'Approuver'}
                              </button>
                              <button
                                className="dataset-action-btn dataset-action-btn--reject"
                                onClick={() => openRejectModal(dataset)}
                                disabled={datasetActionLoading === dataset._id}
                              >
                                <XIcon size={14} /> Refuser
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════ CLASSIFICATION ════════ */}
          {activeTab === 'classification' && (
            <div className="classification-section">
              <div className="classification-card">
                <div className="classification-card__strip" />
                <div className="classification-card__body">

                  <div className="classification-card__header">
                    <h3><BarChart2 size={20} /> Résultats de classification</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span className="classification-auto-refresh">
                        <RefreshCw size={12} />
                        {nextRefresh > 0
                          ? `Prochain rafraîchissement dans ${Math.floor(nextRefresh / 3600)}h ${Math.floor((nextRefresh % 3600) / 60)}m`
                          : 'Mise à jour...'}
                      </span>
                      <button className="refresh-btn" onClick={() => { fetchClassificationMetrics(); fetchClassificationHistory(); }}>
                        <RefreshCw size={16} /> Rafraîchir
                      </button>
                    </div>
                  </div>

                  {classificationLoading && (
                    <div className="classification-loading">
                      <div className="loader-spinner" />
                      <span>Chargement des métriques...</span>
                    </div>
                  )}

                  {classificationError && (
                    <div className="classification-error">
                      <AlertCircle size={16} />
                      <span>{classificationError}</span>
                    </div>
                  )}

                  {!classificationLoading && !classificationError && classificationMetrics && (
                    <>
                      {/* ── 10-Day Histogram ── */}
                      <div className="classification-10day">
                        <div className="classification-10day-header">
                          <h4><BarChart2 size={16} /> Histogramme 10 jours</h4>
                          <div className="classification-10day-legend">
                            <span><span className="cls-legend-dot" style={{ background: '#3b82f6' }} /> Accuracy</span>
                            <span><span className="cls-legend-dot" style={{ background: '#8b5cf6' }} /> Macro F1</span>
                            <span><span className="cls-legend-dot" style={{ background: '#14b8a6' }} /> Weighted F1</span>
                          </div>
                        </div>

                        {classificationHistory.length > 0 ? (
                          <div className="cls-histogram-scroll">
                            <div className="cls-histogram">
                              {/* Y-axis labels */}
                              <div className="cls-histogram-y">
                                {[100, 80, 60, 40, 20, 0].map(v => (
                                  <span key={v} className="cls-histogram-y-label">{v}%</span>
                                ))}
                              </div>
                              {/* Bars */}
                              <div className="cls-histogram-bars">
                                {classificationHistory.slice(0, 10).map((entry, i) => {
                                  const date = new Date(entry.timestamp);
                                  const day = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
                                  const acc = (entry.accuracy || 0) * 100;
                                  const macro = (entry.macro_f1 || 0) * 100;
                                  const weighted = (entry.weighted_f1 || 0) * 100;
                                  return (
                                    <div className="cls-histogram-bar-group" key={i}>
                                      <div className="cls-histogram-bars-inner">
                                        <div className="cls-histogram-bar" style={{ height: `${acc}%`, background: '#3b82f6' }} title={`Accuracy: ${acc.toFixed(1)}%`} />
                                        <div className="cls-histogram-bar" style={{ height: `${macro}%`, background: '#8b5cf6' }} title={`Macro F1: ${macro.toFixed(1)}%`} />
                                        <div className="cls-histogram-bar" style={{ height: `${weighted}%`, background: '#14b8a6' }} title={`Weighted F1: ${weighted.toFixed(1)}%`} />
                                      </div>
                                      <span className="cls-histogram-x-label">{day}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="cls-histogram-empty">
                            <Clock size={24} />
                            <p>En attente des données d'historique...</p>
                          </div>
                        )}
                      </div>

                      {/* ── Per-class F1 bars ── */}
                      <div className="classification-classes-section">
                        <h4>
                          <BarChart2 size={16} />
                          F1-score par classe
                          <span>({classificationMetrics.per_class?.length || 0} classes)</span>
                        </h4>

                        {Array.isArray(classificationMetrics.per_class) && classificationMetrics.per_class.length > 0 ? (
                          <div>
                            {classificationMetrics.per_class.slice(0, 15).map((item) => {
                              const width = Math.max(2, Math.min(100, (item.f1_score || 0) * 100));
                              const scoreClass = item.f1_score >= 0.95 ? 'high' : item.f1_score >= 0.80 ? 'mid' : 'low';
                              const barClass = item.f1_score >= 0.95 ? 'classification-bar-fill--high'
                                            : item.f1_score >= 0.80 ? 'classification-bar-fill--mid'
                                            : 'classification-bar-fill--low';
                              const r = 11;
                              const circ = 2 * Math.PI * r;
                              const offset = circ - (item.f1_score || 0) * circ;
                              return (
                                <div className="classification-bar-row" key={item.label}>
                                  <span className="classification-bar-row__label" title={item.label}>{item.label}</span>
                                  <div className="classification-bar-track">
                                    <div className={`classification-bar-fill ${barClass}`} style={{ width: `${width}%` }} />
                                  </div>
                                  <div className="classification-bar-row__circle">
                                    <svg width="30" height="30" viewBox="0 0 30 30">
                                      <circle cx="15" cy="15" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
                                      <circle cx="15" cy="15" r={r} fill="none"
                                        stroke={item.f1_score >= 0.95 ? '#22c55e' : item.f1_score >= 0.80 ? '#f59e0b' : '#ef4444'}
                                        strokeWidth="3" strokeLinecap="round"
                                        strokeDasharray={circ} strokeDashoffset={offset}
                                        transform="rotate(-90 15 15)"
                                        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                                      <text x="15" y="15" textAnchor="middle" dominantBaseline="central"
                                        fill="var(--text-secondary)" fontSize="8" fontWeight="600">
                                        {(item.f1_score * 100).toFixed(0)}
                                      </text>
                                    </svg>
                                  </div>
                                  <span className={`classification-bar-row__score ${scoreClass}`}>
                                    {(item.f1_score * 100).toFixed(1)}%
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Aucune classe disponible.</p>
                        )}

                        {Array.isArray(classificationMetrics.per_class) && classificationMetrics.per_class.length > 15 && (
                          <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 12 }}>
                            +{classificationMetrics.per_class.length - 15} autres classes
                          </p>
                        )}
                      </div>

                      {/* ── Model Info Footer ── */}
                      <div className="classification-model-info">
                        <span className="classification-model-info__item">
                          <Database size={13} /> Échantillons : <strong>{classificationMetrics.sample_count}</strong>
                        </span>
                        <span className="classification-model-info__item">
                          <BarChart2 size={13} /> Caractéristiques : <strong>{classificationMetrics.feature_count}</strong>
                        </span>
                        <span className="classification-model-info__item">
                          <Activity size={13} /> Test : <strong>{classificationMetrics.test_sample_count}</strong>
                        </span>
                        <span className="classification-model-info__item">
                          <TrendingUp size={13} /> Dernière accuracy : <strong>{((classificationMetrics.accuracy || 0) * 100).toFixed(2)}%</strong>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════ ACTIVITY ════════ */}
          {activeTab === 'activity' && (
            <div className="activity-full-section">
              <div className="section-header">
                <h3>Historique complet des activités</h3>
                <button className="refresh-btn" onClick={fetchRecentActivity}>
                  <RefreshCw size={16} /> Rafraîchir
                </button>
              </div>
              {recentActivity.length === 0 ? (
                <div className="no-data"><AlertCircle size={48} /><p>Aucune activité enregistrée</p></div>
              ) : (
                <div className="activity-full-list">
                  {recentActivity.map((a, i) => (
                    <div key={i} className="activity-card">
                      <div className="activity-icon-large"><Activity size={22} /></div>
                      <div className="activity-content">
                        <h4>{a.action}</h4>
                        <p>{a.details}</p>
                        <span className="activity-time">{formatDate(a.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════ NOTIFICATIONS ════════ */}
          {activeTab === 'notifications' && (
            <div className="notif-section">
              <div className="section-header">
                <h3>Envoyer une notification</h3>
              </div>
              <div className="notif-form-card">
                <div className="form-group">
                  <label>Titre</label>
                  <input
                    type="text"
                    placeholder="Titre de la notification..."
                    value={notifForm.title}
                    onChange={e => setNotifForm(p => ({ ...p, title: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Message</label>
                  <textarea
                    rows={4}
                    placeholder="Contenu du message..."
                    value={notifForm.message}
                    onChange={e => setNotifForm(p => ({ ...p, message: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>Destinataire</label>
                  <select
                    value={notifForm.target}
                    onChange={e => setNotifForm(p => ({ ...p, target: e.target.value }))}
                    className="form-input"
                  >
                    <option value="all">Tous les utilisateurs</option>
                    <option value="admins">Administrateurs seulement</option>
                    <option value="users">Membres seulement</option>
                  </select>
                </div>
                <button
                  className="export-btn"
                  onClick={sendNotification}
                  disabled={!notifForm.title.trim() || !notifForm.message.trim() || notifSending}
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: 8 }}
                >
                  <Send size={18} /> {notifSending ? 'Envoi en cours...' : 'Envoyer la notification'}
                </button>
              </div>
            </div>
          )}

          {/* ════════ SETTINGS ════════ */}
          {activeTab === 'settings' && (
            <div className="settings-section">
              <div className="settings-card">
                <h3><Globe size={20} /> Paramètres généraux</h3>
                <div className="settings-row">
                  <span>Autoriser les inscriptions publiques</span>
                  <ToggleRight size={28} style={{ color: '#22c55e', cursor: 'pointer' }} />
                </div>
                <div className="settings-row">
                  <span>Mode maintenance</span>
                  <ToggleLeft size={28} style={{ color: 'var(--muted)', cursor: 'pointer' }} />
                </div>
                <div className="settings-row">
                  <span>Notifications par email</span>
                  <ToggleRight size={28} style={{ color: '#22c55e', cursor: 'pointer' }} />
                </div>
              </div>
              <div className="settings-card">
                <h3><Shield size={20} /> Sécurité</h3>
                <div className="settings-row">
                  <span>Journalisation des activités admin</span>
                  <ToggleRight size={28} style={{ color: '#22c55e', cursor: 'pointer' }} />
                </div>
                <div className="settings-row">
                  <span>Authentification 2FA obligatoire</span>
                  <ToggleLeft size={28} style={{ color: 'var(--muted)', cursor: 'pointer' }} />
                </div>
              </div>
              <div className="settings-card">
                <h3><Download size={20} /> Exports & Données</h3>
                <button className="export-btn" onClick={() => exportToCSV()}>
                  <FileText size={16} /> Exporter tous les utilisateurs (CSV)
                </button>
              </div>
            </div>
          )}

        </section>
      </main>

      {/* ════════ MODAL: Dataset Details ════════ */}
      {showDatasetModal && selectedDataset && (
        <div className="modal-overlay" onClick={() => setShowDatasetModal(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Détails du dataset</h3>
              <button className="modal-close" onClick={() => setShowDatasetModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p><strong>Nom :</strong> {selectedDataset.name || selectedDataset.title}</p>
              <p><strong>Description :</strong> {selectedDataset.description || '—'}</p>
              <p><strong>Type :</strong> {selectedDataset.type || '—'}</p>
              <p><strong>Soumis par :</strong> {selectedDataset.user?.firstName} {selectedDataset.user?.lastName} ({selectedDataset.user?.email})</p>
              <p><strong>Date :</strong> {formatDate(selectedDataset.createdAt)}</p>
              <p><strong>Statut :</strong>
                <span className={`dataset-status-badge dataset-status-badge--${selectedDataset.status}`} style={{ marginLeft: 8 }}>
                  {selectedDataset.status}
                </span>
              </p>
              {selectedDataset.rejectReason && <p><strong>Raison du refus :</strong> {selectedDataset.rejectReason}</p>}
              {selectedDataset.fileUrl && (
                <p><strong>Fichier :</strong>&nbsp;
                  <a href={`${BASE_URL}${selectedDataset.fileUrl}`} target="_blank" rel="noopener noreferrer">Télécharger / Voir</a>
                </p>
              )}
              {selectedDataset.images?.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p style={{ marginBottom: 10 }}><strong>Images ({selectedDataset.images.length}) :</strong></p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
                    {selectedDataset.images.map((img, i) => (
                      <a key={i} href={img} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'block', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <img src={img} alt={`dataset-img-${i}`}
                          style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                          onError={e => { e.target.style.display = 'none'; }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {(!selectedDataset.images || selectedDataset.images.length === 0) && (
                <p style={{ marginTop: 16, color: 'var(--muted)', fontStyle: 'italic' }}>Aucune image soumise avec ce dataset.</p>
              )}
            </div>
            <div className="modal-footer" style={{ gap: 8 }}>
              <button className="btn-cancel" onClick={() => setShowDatasetModal(false)}>Fermer</button>
              {selectedDataset.status === 'pending' && (
                <>
                  <button className="dataset-action-btn dataset-action-btn--approve"
                    onClick={() => { approveDataset(selectedDataset._id); setShowDatasetModal(false); }}>
                    <Check size={14} /> Approuver
                  </button>
                  <button className="dataset-action-btn dataset-action-btn--reject"
                    onClick={() => { setShowDatasetModal(false); openRejectModal(selectedDataset); }}>
                    <XIcon size={14} /> Refuser
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL: Reject Dataset ════════ */}
      {showRejectModal && datasetToReject && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Refuser le dataset</h3>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12, color: 'var(--muted)' }}>
                Vous êtes sur le point de refuser le dataset <strong>"{datasetToReject.name || datasetToReject.title}"</strong>.
              </p>
              <div className="form-group">
                <label>Raison du refus <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optionnel)</span></label>
                <textarea rows={3} className="form-input"
                  placeholder="Ex: données insuffisantes, format incorrect..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowRejectModal(false)}>Annuler</button>
              <button className="dataset-action-btn dataset-action-btn--reject" onClick={confirmReject}
                disabled={datasetActionLoading === datasetToReject._id}>
                <XIcon size={14} />
                {datasetActionLoading === datasetToReject._id ? 'Traitement...' : 'Confirmer le refus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL: User Details ════════ */}
      {showUserModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Détails de l'utilisateur</h3>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>×</button>
            </div>
            <div className="modal-body user-detail-body">
              <div className="user-detail-avatar">
                <img src={avatarSrc(selectedUser.profilePic)} alt="profile"
                  onError={e => { e.target.src = '/default-avatar.png'; }} />
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <span className={`role-pill ${selectedUser.isAdmin ? 'admin' : 'user'}`}>
                    {selectedUser.isAdmin ? 'Admin' : 'Membre'}
                  </span>
                  {selectedUser.isBanned && <span className="role-pill" style={{ background: '#fef2f2', color: '#ef4444', marginLeft: 6 }}>Banni</span>}
                </div>
              </div>
              <div className="user-detail-info">
                <p><strong>Nom complet :</strong> {selectedUser.firstName} {selectedUser.lastName}</p>
                <p><strong>Email :</strong> {selectedUser.email}</p>
                <p><strong>Téléphone :</strong> {selectedUser.phoneNumber || 'Non renseigné'}</p>
                <p><strong>Rôle :</strong> {selectedUser.isAdmin ? 'Administrateur' : 'Membre'}</p>
                <p><strong>Statut :</strong> {selectedUser.isBanned ? '🚫 Banni' : '✅ Actif'}</p>
                <p><strong>Inscription :</strong> {formatDate(selectedUser.createdAt)}</p>
                {selectedUser.lastLogin && <p><strong>Dernière connexion :</strong> {formatDate(selectedUser.lastLogin)}</p>}
              </div>
            </div>
            <div className="modal-footer" style={{ gap: 8 }}>
              <button className="btn-cancel" onClick={() => setShowUserModal(false)}>Fermer</button>
              <button className="export-btn" onClick={() => { setShowUserModal(false); openEditModal(selectedUser); }}>
                <Edit2 size={14} /> Modifier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL: Edit User ════════ */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Modifier l'utilisateur</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body edit-form-body">
              {[
                { label: 'Prénom',    key: 'firstName',   type: 'text' },
                { label: 'Nom',       key: 'lastName',    type: 'text' },
                { label: 'Email',     key: 'email',       type: 'email' },
                { label: 'Téléphone', key: 'phoneNumber', type: 'tel' },
              ].map(({ label, key, type }) => (
                <div className="form-group" key={key}>
                  <label>{label}</label>
                  <input type={type} className="form-input"
                    value={editForm[key] || ''}
                    onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="form-group">
                <label>Rôle</label>
                <select className="form-input"
                  value={editForm.isAdmin ? 'admin' : 'user'}
                  onChange={e => setEditForm(p => ({ ...p, isAdmin: e.target.value === 'admin' }))}>
                  <option value="user">Membre</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>Annuler</button>
              <button className="export-btn" onClick={saveEdit} disabled={actionLoading === selectedUser._id}>
                {actionLoading === selectedUser._id ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL: Confirm Delete ════════ */}
      {showConfirmDialog && (
        <div className="modal-overlay" onClick={() => setShowConfirmDialog(false)}>
          <div className="modal-content confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmer la suppression</h3>
              <button className="modal-close" onClick={() => setShowConfirmDialog(false)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <AlertCircle size={48} color="#ef4444" />
              <p style={{ marginTop: 12 }}>Êtes-vous sûr de vouloir supprimer cet utilisateur ?</p>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Cette action est irréversible.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowConfirmDialog(false)}>Annuler</button>
              <button className="btn-confirm" onClick={confirmDelete}>Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL: Confirm Ban ════════ */}
      {showBanConfirm && userToBan && (
        <div className="modal-overlay" onClick={() => setShowBanConfirm(false)}>
          <div className="modal-content confirm-dialog" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{userToBan.isBanned ? 'Débannir' : 'Bannir'} l'utilisateur</h3>
              <button className="modal-close" onClick={() => setShowBanConfirm(false)}>×</button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center' }}>
              <Ban size={48} color="#f59e0b" />
              <p style={{ marginTop: 12 }}>
                {userToBan.isBanned
                  ? `Débannir ${userToBan.firstName} ${userToBan.lastName} ?`
                  : `Bannir ${userToBan.firstName} ${userToBan.lastName} ? L'utilisateur ne pourra plus se connecter.`}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowBanConfirm(false)}>Annuler</button>
              <button className="btn-confirm"
                style={{ background: userToBan.isBanned ? '#22c55e' : '#f59e0b' }}
                onClick={() => toggleBan(userToBan)}>
                {userToBan.isBanned ? 'Débannir' : 'Bannir'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
