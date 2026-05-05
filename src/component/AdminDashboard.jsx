import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
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
import './Styles/AdminDashboard.css';

const BASE_URL = 'https://backpfe-production.up.railway.app';

const AdminDashboard = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.user);

  // ── State ────────────────────────────────────────────────────────────────
  const [allUsers, setAllUsers]               = useState([]);
  const [filteredUsers, setFilteredUsers]     = useState([]);
  const [activeTab, setActiveTab]             = useState('overview');
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
  const [toast, setToast]                     = useState(null);
  const [stats, setStats]                     = useState({
    totalUsers: 0, admins: 0, newThisMonth: 0, activeUsers: 0,
    bannedUsers: 0, totalMessages: 0
  });
  const [recentActivity, setRecentActivity]   = useState([]);
  const [selectedRows, setSelectedRows]       = useState(new Set());
  const [showBulkMenu, setShowBulkMenu]       = useState(false);
  const [statsChart, setStatsChart]           = useState('users');

  // ── Dataset State ─────────────────────────────────────────────────────────
  const [pendingDatasets, setPendingDatasets]       = useState([]);
  const [datasetsLoading, setDatasetsLoading]       = useState(false);
  const [datasetFilter, setDatasetFilter]           = useState('pending'); // 'pending' | 'approved' | 'rejected' | 'all'
  const [datasetActionLoading, setDatasetActionLoading] = useState(null);
  const [selectedDataset, setSelectedDataset]       = useState(null);
  const [showDatasetModal, setShowDatasetModal]     = useState(false);
  const [rejectReason, setRejectReason]             = useState('');
  const [showRejectModal, setShowRejectModal]       = useState(false);
  const [datasetToReject, setDatasetToReject]       = useState(null);

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

  // ── Data fetching ─────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/user/`);
      const users = res.data.users || [];
      setAllUsers(users);
      setFilteredUsers(users);
    } catch {
      showToast('Erreur lors du chargement des utilisateurs', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/user/stats`);
      setStats(prev => ({ ...prev, ...res.data }));
    } catch {}
  }, []);

  const fetchRecentActivity = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/user/activity`);
      setRecentActivity(res.data.activities || []);
    } catch {
      setRecentActivity([]);
    }
  }, []);

  const logActivity = useCallback(async (action, details) => {
    try {
      await axios.post(`${BASE_URL}/user/log-activity`, {
        userId: user._id, action, details, timestamp: new Date()
      });
      fetchRecentActivity();
    } catch {}
  }, [user._id, fetchRecentActivity]);

  // ── Dataset fetching ──────────────────────────────────────────────────────
  const fetchDatasets = useCallback(async () => {
    setDatasetsLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/dataset/all`);
      setPendingDatasets(res.data.datasets || []);
    } catch {
      showToast('Erreur lors du chargement des datasets', 'error');
    } finally {
      setDatasetsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchUsers();
    fetchStats();
    fetchRecentActivity();
  }, [fetchUsers, fetchStats, fetchRecentActivity]);

  useEffect(() => {
    if (activeTab === 'datasets') {
      fetchDatasets();
    }
  }, [activeTab, fetchDatasets]);

  // ── Dataset actions ───────────────────────────────────────────────────────
  const approveDataset = async (datasetId) => {
    setDatasetActionLoading(datasetId);
    try {
      await axios.put(`${BASE_URL}/dataset/${datasetId}/approve`, { status: 'approved' });
      setPendingDatasets(prev =>
        prev.map(d => d._id === datasetId ? { ...d, status: 'approved' } : d)
      );
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
        status: 'rejected',
        reason: rejectReason
      });
      setPendingDatasets(prev =>
        prev.map(d => d._id === datasetToReject._id
          ? { ...d, status: 'rejected', rejectReason }
          : d
        )
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
    setSortConfig(prev =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  // ── Filtered datasets ─────────────────────────────────────────────────────
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
      await axios.delete(`${BASE_URL}/user/${userToDelete}`);
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
      await axios.put(`${BASE_URL}/user/${id}`, { isAdmin: !currentStatus });
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
      await axios.put(`${BASE_URL}/user/${u._id}`, { isBanned: !u.isBanned });
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
    setEditForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phoneNumber: u.phoneNumber || '',
      isAdmin: u.isAdmin,
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    setActionLoading(selectedUser._id);
    try {
      await axios.put(`${BASE_URL}/user/${selectedUser._id}`, editForm);
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
      await axios.post(`${BASE_URL}/user/${id}/reset-password`);
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
      try { await axios.delete(`${BASE_URL}/user/${id}`); } catch {}
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
    const csv = [
      headers.join(','),
      ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
    ].join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }));
    Object.assign(document.createElement('a'), { href: url, download: 'utilisateurs.csv' }).click();
  };

  // ── Notifications ─────────────────────────────────────────────────────────
  const sendNotification = async () => {
    try {
      await axios.post(`${BASE_URL}/notifications/send`, {
        ...notifForm,
        fromAdmin: user._id
      });
      showToast('Notification envoyée !');
      setShowNotifModal(false);
      setNotifForm({ title: '', message: '', target: 'all' });
      await logActivity('send_notification', `Notification "${notifForm.title}" envoyée`);
    } catch {
      showToast('Erreur lors de l\'envoi', 'error');
    }
  };

  // ── Compute derived stats ─────────────────────────────────────────────────
  useEffect(() => {
    if (!allUsers.length) return;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    setStats(prev => ({
      ...prev,
      totalUsers:    allUsers.length,
      admins:        allUsers.filter(u => u.isAdmin).length,
      newThisMonth:  allUsers.filter(u => new Date(u.createdAt) >= monthStart).length,
      bannedUsers:   allUsers.filter(u => u.isBanned).length,
    }));
  }, [allUsers]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="admin-loader">
      <div className="loader-spinner" />
      <p>Chargement du panneau de contrôle...</p>
    </div>
  );

  const SortIcon = ({ col }) => (
    sortConfig.key === col
      ? (sortConfig.dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)
      : <ChevronDown size={14} style={{ opacity: 0.3 }} />
  );

  return (
    <div className="admin-wrapper">
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
            { id: 'users',         icon: <Users size={20}/>,          label: 'Utilisateurs' },
            { id: 'datasets',      icon: <Database size={20}/>,       label: 'Datasets', badge: datasetCounts.pending || null },
            { id: 'activity',      icon: <Activity size={20}/>,       label: 'Activités' },
            { id: 'notifications', icon: <Bell size={20}/>,           label: 'Notifications' },
            { id: 'settings',      icon: <Settings size={20}/>,       label: 'Paramètres' },
          ].map(({ id, icon, label, badge }) => (
            <button
              key={id}
              className={`admin-nav-item ${activeTab === id ? 'active' : ''}`}
              onClick={() => setActiveTab(id)}
              style={{ position: 'relative' }}
            >
              {icon} {label}
              {badge > 0 && (
                <span style={{
                  marginLeft: 'auto',
                  background: '#ef4444',
                  color: '#fff',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '1px 7px',
                  minWidth: 20,
                  textAlign: 'center',
                }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-nav-item" onClick={() => {}}>
            <LogOut size={20} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="admin-main">
        {/* Header */}
        <header className="admin-header">
          <div>
            <h2>
              {{ overview: 'Tableau de Bord', users: 'Gestion des Utilisateurs',
                 datasets: 'Validation des Datasets',
                 activity: 'Activités Récentes', notifications: 'Notifications',
                 settings: 'Paramètres' }[activeTab]}
            </h2>
            <p className="admin-subtitle">
              Bienvenue {user?.firstName} {user?.lastName}
            </p>
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
                  { label: 'Total Utilisateurs', value: stats.totalUsers,   icon: <Users size={24}/>,       color: 'blue',   sub: `+${stats.newThisMonth} ce mois` },
                  { label: 'Administrateurs',    value: stats.admins,       icon: <ShieldAlert size={24}/>, color: 'purple', sub: `sur ${stats.totalUsers}` },
                  { label: 'Nouveaux ce mois',   value: stats.newThisMonth, icon: <UserPlus size={24}/>,    color: 'green',  sub: 'inscriptions récentes' },
                  { label: 'Utilisateurs actifs',value: stats.activeUsers,  icon: <Activity size={24}/>,    color: 'orange', sub: "connectés aujourd'hui" },
                  { label: 'Bannis',             value: stats.bannedUsers,  icon: <Ban size={24}/>,         color: 'red',    sub: 'comptes suspendus' },
                  { label: 'Datasets en attente',value: datasetCounts.pending, icon: <Database size={24}/>, color: 'teal', sub: 'à valider' },
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
                    {recentActivity.length === 0 && (
                      <p className="no-data">Aucune activité récente</p>
                    )}
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
                    <button className="quick-action-btn" onClick={() => setActiveTab('users')}>
                      <Users size={18} /> Gérer les utilisateurs
                      <ArrowUpRight size={14} style={{ marginLeft: 'auto' }} />
                    </button>
                    <button className="quick-action-btn" onClick={() => setActiveTab('datasets')}>
                      <Database size={18} /> Valider les datasets
                      {datasetCounts.pending > 0 && (
                        <span style={{ marginLeft: 'auto', background: '#ef4444', color: '#fff', borderRadius: '999px', fontSize: '11px', padding: '1px 7px' }}>
                          {datasetCounts.pending}
                        </span>
                      )}
                    </button>
                    <button className="quick-action-btn" onClick={() => setShowNotifModal(true)}>
                      <Bell size={18} /> Envoyer une notification
                      <ArrowUpRight size={14} style={{ marginLeft: 'auto' }} />
                    </button>
                    <button className="quick-action-btn" onClick={() => exportToCSV()}>
                      <Download size={18} /> Exporter tous les utilisateurs
                      <ArrowUpRight size={14} style={{ marginLeft: 'auto' }} />
                    </button>
                    <button className="quick-action-btn" onClick={fetchUsers}>
                      <RefreshCw size={18} /> Rafraîchir les données
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

                <button className="export-btn" onClick={() => setShowNotifModal(true)} style={{ background: '#8b5cf6' }}>
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
                      <th onClick={() => toggleSort('firstName')} style={{ cursor: 'pointer' }}>
                        Utilisateur <SortIcon col="firstName" />
                      </th>
                      <th onClick={() => toggleSort('email')} style={{ cursor: 'pointer' }}>
                        Email <SortIcon col="email" />
                      </th>
                      <th>Téléphone</th>
                      <th onClick={() => toggleSort('isAdmin')} style={{ cursor: 'pointer' }}>
                        Rôle <SortIcon col="isAdmin" />
                      </th>
                      <th>Statut</th>
                      <th onClick={() => toggleSort('createdAt')} style={{ cursor: 'pointer' }}>
                        Inscription <SortIcon col="createdAt" />
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="no-data">
                          <AlertCircle size={48} />
                          <p>Aucun utilisateur trouvé</p>
                        </td>
                      </tr>
                    ) : (
                      paginated.map(u => (
                        <tr key={u._id} className={selectedRows.has(u._id) ? 'row-selected' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedRows.has(u._id)}
                              onChange={() => toggleRow(u._id)}
                            />
                          </td>
                          <td>
                            <div className="user-cell">
                              <div style={{ position: 'relative' }}>
                                <img
                                  src={avatarSrc(u.profilePic)}
                                  alt="profile"
                                  className="mini-avatar"
                                  onError={e => { e.target.src = '/default-avatar.png'; }}
                                />
                                {u.isBanned && (
                                  <span className="banned-badge" title="Banni">🚫</span>
                                )}
                              </div>
                              <div>
                                <span className="user-name">{u.firstName} {u.lastName}</span>
                                <span className="user-username">@{u.username || 'utilisateur'}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="email-cell">
                              <Mail size={14} />
                              <span>{u.email}</span>
                            </div>
                          </td>
                          <td>
                            <div className="phone-cell">
                              <Phone size={14} />
                              <span>{u.phoneNumber || 'Non renseigné'}</span>
                            </div>
                          </td>
                          <td>
                            <span className={`role-pill ${u.isAdmin ? 'admin' : 'user'}`}>
                              {u.isAdmin ? 'Administrateur' : 'Membre'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-pill ${u.isBanned ? 'banned' : 'active'}`}>
                              {u.isBanned ? 'Banni' : 'Actif'}
                            </span>
                          </td>
                          <td className="date-cell">
                            <Calendar size={13} style={{ marginRight: 4 }} />
                            {new Date(u.createdAt).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="actions-cell">
                            <button
                              className="action-btn view"
                              onClick={() => { setSelectedUser(u); setShowUserModal(true); }}
                              title="Voir détails"
                              disabled={actionLoading === u._id}
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              className="action-btn edit"
                              onClick={() => openEditModal(u)}
                              title="Modifier"
                              disabled={actionLoading === u._id}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              className="action-btn promote"
                              onClick={() => toggleAdminStatus(u._id, u.isAdmin)}
                              title={u.isAdmin ? 'Retirer Admin' : 'Rendre Admin'}
                              disabled={actionLoading === u._id || u._id === user._id}
                            >
                              {u.isAdmin ? <UserX size={16} /> : <Shield size={16} />}
                            </button>
                            <button
                              className={`action-btn ${u.isBanned ? 'unban' : 'ban'}`}
                              onClick={() => { setUserToBan(u); setShowBanConfirm(true); }}
                              title={u.isBanned ? 'Débannir' : 'Bannir'}
                              disabled={actionLoading === u._id || u._id === user._id}
                            >
                              {u.isBanned ? <Unlock size={16} /> : <Lock size={16} />}
                            </button>
                            <button
                              className="action-btn reset"
                              onClick={() => resetPassword(u._id)}
                              title="Réinitialiser mdp"
                              disabled={actionLoading === u._id}
                            >
                              <Lock size={16} />
                            </button>
                            <button
                              className="action-btn delete"
                              onClick={() => handleDelete(u._id)}
                              title="Supprimer"
                              disabled={actionLoading === u._id || u._id === user._id}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="page-btn"
                  >
                    ← Précédent
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                    <button
                      key={n}
                      onClick={() => setCurrentPage(n)}
                      className={`page-btn ${currentPage === n ? 'active' : ''}`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="page-btn"
                  >
                    Suivant →
                  </button>
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
                  { key: 'all',      label: 'Tous',      count: pendingDatasets.length, color: '#64748b' },
                  { key: 'pending',  label: 'En attente', count: datasetCounts.pending,  color: '#f59e0b' },
                  { key: 'approved', label: 'Approuvés', count: datasetCounts.approved, color: '#22c55e' },
                  { key: 'rejected', label: 'Refusés',   count: datasetCounts.rejected, color: '#ef4444' },
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

                <button
                  className="refresh-btn"
                  onClick={fetchDatasets}
                  style={{ marginLeft: 'auto' }}
                >
                  <RefreshCw size={16} /> Rafraîchir
                </button>
              </div>

              {/* Dataset list */}
              {datasetsLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
                  <div className="loader-spinner" style={{ margin: '0 auto 12px' }} />
                  <p>Chargement des datasets...</p>
                </div>
              ) : filteredDatasets.length === 0 ? (
                <div className="no-data">
                  <Database size={48} />
                  <p>Aucun dataset {datasetFilter !== 'all' ? `"${datasetFilter}"` : ''} trouvé</p>
                </div>
              ) : (
                <div className="dataset-list">
                  {filteredDatasets.map(dataset => (
                    <div key={dataset._id} className={`dataset-card dataset-card--${dataset.status}`}>
                      <div className="dataset-card-header">
                        <div className="dataset-card-title">
                          <Database size={18} />
                          <div>
                            <h4>{dataset.name || dataset.title || 'Dataset sans nom'}</h4>
                            <span className="dataset-submitter">
                              Soumis par&nbsp;
                              <strong>
                                {dataset.user?.firstName} {dataset.user?.lastName}
                              </strong>
                              &nbsp;·&nbsp;{formatDate(dataset.createdAt)}
                            </span>
                          </div>
                        </div>

                        <span className={`dataset-status-badge dataset-status-badge--${dataset.status}`}>
                          {dataset.status === 'pending'  && <><Hourglass size={13} /> En attente</>}
                          {dataset.status === 'approved' && <><Check size={13} /> Approuvé</>}
                          {dataset.status === 'rejected' && <><XIcon size={13} /> Refusé</>}
                        </span>
                      </div>

                      {dataset.description && (
                        <p className="dataset-description">{dataset.description}</p>
                      )}

                      {dataset.rejectReason && dataset.status === 'rejected' && (
                        <div className="dataset-reject-reason">
                          <strong>Raison du refus :</strong> {dataset.rejectReason}
                        </div>
                      )}

                      <div className="dataset-meta">
                        {dataset.fileUrl && (
                          <a
                            href={`${BASE_URL}${dataset.fileUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dataset-file-link"
                          >
                            <FileText size={14} /> Voir le fichier
                          </a>
                        )}
                        {dataset.type && <span className="dataset-tag">{dataset.type}</span>}
                        {dataset.size && <span className="dataset-tag">{dataset.size}</span>}
                      </div>

                      {dataset.status === 'pending' && (
                        <div className="dataset-actions">
                          <button
                            className="btn-approve"
                            onClick={() => approveDataset(dataset._id)}
                            disabled={datasetActionLoading === dataset._id}
                          >
                            <Check size={15} />
                            {datasetActionLoading === dataset._id ? 'Traitement...' : 'Approuver'}
                          </button>
                          <button
                            className="btn-reject"
                            onClick={() => openRejectModal(dataset)}
                            disabled={datasetActionLoading === dataset._id}
                          >
                            <XIcon size={15} /> Refuser
                          </button>
                          <button
                            className="action-btn view"
                            onClick={() => { setSelectedDataset(dataset); setShowDatasetModal(true); }}
                            title="Voir détails"
                            style={{ marginLeft: 'auto' }}
                          >
                            <Eye size={16} />
                          </button>
                        </div>
                      )}

                      {dataset.status !== 'pending' && (
                        <div className="dataset-actions">
                          <button
                            className="action-btn view"
                            onClick={() => { setSelectedDataset(dataset); setShowDatasetModal(true); }}
                            title="Voir détails"
                          >
                            <Eye size={16} /> Voir détails
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
                  disabled={!notifForm.title || !notifForm.message}
                  style={{ width: '100%', justifyContent: 'center', display: 'flex', gap: 8 }}
                >
                  <Send size={18} /> Envoyer la notification
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
              <p><strong>Soumis par :</strong> {selectedDataset.user?.firstName} {selectedDataset.user?.lastName} ({selectedDataset.user?.email})</p>
              <p><strong>Date de soumission :</strong> {formatDate(selectedDataset.createdAt)}</p>
              <p><strong>Statut :</strong>
                <span className={`dataset-status-badge dataset-status-badge--${selectedDataset.status}`} style={{ marginLeft: 8 }}>
                  {selectedDataset.status}
                </span>
              </p>
              {selectedDataset.rejectReason && (
                <p><strong>Raison du refus :</strong> {selectedDataset.rejectReason}</p>
              )}
              {selectedDataset.fileUrl && (
                <p>
                  <strong>Fichier :</strong>&nbsp;
                  <a href={`${BASE_URL}${selectedDataset.fileUrl}`} target="_blank" rel="noopener noreferrer">
                    Télécharger / Voir
                  </a>
                </p>
              )}
            </div>
            <div className="modal-footer" style={{ gap: 8 }}>
              <button className="btn-cancel" onClick={() => setShowDatasetModal(false)}>Fermer</button>
              {selectedDataset.status === 'pending' && (
                <>
                  <button className="btn-approve" onClick={() => { approveDataset(selectedDataset._id); setShowDatasetModal(false); }}>
                    <Check size={14} /> Approuver
                  </button>
                  <button className="btn-reject" onClick={() => { setShowDatasetModal(false); openRejectModal(selectedDataset); }}>
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
                <textarea
                  rows={3}
                  className="form-input"
                  placeholder="Ex: données insuffisantes, format incorrect..."
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowRejectModal(false)}>Annuler</button>
              <button
                className="btn-reject"
                onClick={confirmReject}
                disabled={datasetActionLoading === datasetToReject._id}
              >
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
                <img
                  src={avatarSrc(selectedUser.profilePic)}
                  alt="profile"
                  onError={e => { e.target.src = '/default-avatar.png'; }}
                />
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
                {selectedUser.lastLogin && (
                  <p><strong>Dernière connexion :</strong> {formatDate(selectedUser.lastLogin)}</p>
                )}
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
                  <input
                    type={type}
                    className="form-input"
                    value={editForm[key] || ''}
                    onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="form-group">
                <label>Rôle</label>
                <select
                  className="form-input"
                  value={editForm.isAdmin ? 'admin' : 'user'}
                  onChange={e => setEditForm(p => ({ ...p, isAdmin: e.target.value === 'admin' }))}
                >
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
                  : `Bannir ${userToBan.firstName} ${userToBan.lastName} ? L'utilisateur ne pourra plus se connecter.`
                }
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowBanConfirm(false)}>Annuler</button>
              <button
                className="btn-confirm"
                style={{ background: userToBan.isBanned ? '#22c55e' : '#f59e0b' }}
                onClick={() => toggleBan(userToBan)}
              >
                {userToBan.isBanned ? 'Débannir' : 'Bannir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL: Send Notification ════════ */}
      {showNotifModal && (
        <div className="modal-overlay" onClick={() => setShowNotifModal(false)}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Envoyer une notification</h3>
              <button className="modal-close" onClick={() => setShowNotifModal(false)}>×</button>
            </div>
            <div className="modal-body edit-form-body">
              <div className="form-group">
                <label>Titre</label>
                <input
                  type="text"
                  className="form-input"
                  value={notifForm.title}
                  onChange={e => setNotifForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ex: Maintenance programmée"
                />
              </div>
              <div className="form-group">
                <label>Message</label>
                <textarea
                  rows={3}
                  className="form-input"
                  value={notifForm.message}
                  onChange={e => setNotifForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Contenu du message..."
                />
              </div>
              <div className="form-group">
                <label>Destinataire</label>
                <select className="form-input" value={notifForm.target} onChange={e => setNotifForm(p => ({ ...p, target: e.target.value }))}>
                  <option value="all">Tous les utilisateurs</option>
                  <option value="admins">Administrateurs</option>
                  <option value="users">Membres</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowNotifModal(false)}>Annuler</button>
              <button className="export-btn" onClick={sendNotification} disabled={!notifForm.title || !notifForm.message}>
                <Send size={14} /> Envoyer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;