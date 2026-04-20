import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { 
  Users, LayoutDashboard, Trash2, UserPlus, ShieldAlert, UserCheck,
  Search, Filter, Eye, Mail, Phone, Calendar, Activity,
  TrendingUp, Clock, LogOut,
  Download, RefreshCw, AlertCircle
} from 'lucide-react';
import './Styles/AdminDashboard.css';

const AdminDashboard = () => {
  const { user } = useSelector((state) => state.user);
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    admins: 0,
    newThisMonth: 0,
    activeUsers: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Charger les utilisateurs au montage du composant
  useEffect(() => {
    fetchUsers();
    fetchStats();
    fetchRecentActivity();
  }, []);

  // Filtrer les utilisateurs quand searchTerm ou roleFilter change
  useEffect(() => {
    let filtered = [...allUsers];
    
    if (searchTerm) {
      filtered = filtered.filter(u => 
        u.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => 
        roleFilter === 'admin' ? u.isAdmin : !u.isAdmin
      );
    }
    
    setFilteredUsers(filtered);
  }, [searchTerm, roleFilter, allUsers]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('http://localhost:5000/user/');
      setAllUsers(res.data.users);
      setFilteredUsers(res.data.users);
      setLoading(false);
    } catch (err) {
      console.error("Erreur lors de la récupération des utilisateurs", err);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get('http://localhost:5000/user/stats');
      setStats(res.data);
    } catch (err) {
      console.error("Erreur lors de la récupération des statistiques", err);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      const res = await axios.get('http://localhost:5000/user/activity');
      setRecentActivity(res.data.activities);
    } catch (err) {
      console.error("Erreur lors de la récupération des activités", err);
    }
  };

  const handleDelete = async (id) => {
    setUserToDelete(id);
    setShowConfirmDialog(true);
  };

  const confirmDelete = async () => {
    if (userToDelete) {
      try {
        await axios.delete(`http://localhost:5000/user/${userToDelete}`);
        setAllUsers(allUsers.filter(u => u._id !== userToDelete));
        setShowConfirmDialog(false);
        setUserToDelete(null);
        // Log activity
        await logActivity('delete_user', `Utilisateur supprimé`);
      } catch (err) {
        alert("Erreur lors de la suppression");
      }
    }
  };

  const toggleAdminStatus = async (id, currentStatus) => {
    try {
      await axios.put(`http://localhost:5000/user/${id}`, { 
        isAdmin: !currentStatus 
      });
      fetchUsers();
      await logActivity('toggle_admin', `Statut admin modifié pour l'utilisateur ${id}`);
    } catch (err) {
      alert("Erreur lors de la mise à jour du rôle");
    }
  };

  const logActivity = async (action, details) => {
    try {
      await axios.post('http://localhost:5000/user/log-activity', {
        userId: user._id,
        action,
        details,
        timestamp: new Date()
      });
    } catch (err) {
      console.error("Erreur lors du logging", err);
    }
  };

  const exportUsersData = () => {
    const data = filteredUsers.map(u => ({
      'Nom complet': `${u.firstName} ${u.lastName}`,
      'Email': u.email,
      'Téléphone': u.phoneNumber || 'N/A',
      'Rôle': u.isAdmin ? 'Administrateur' : 'Membre',
      'Date d\'inscription': new Date(u.createdAt).toLocaleDateString()
    }));
    
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'utilisateurs.csv';
    a.click();
  };

  const convertToCSV = (data) => {
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(header => JSON.stringify(row[header])).join(','))
    ];
    return csvRows.join('\n');
  };

  const viewUserDetails = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return (
    <div className="admin-loader">
      <div className="loader-spinner"></div>
      <p>Chargement du panneau de contrôle...</p>
    </div>
  );

  return (
    <div className="admin-wrapper">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <ShieldAlert size={24} color="#3b82f6" />
          <span>Admin Space</span>
        </div>
        
        <nav>
          <button 
            className={`admin-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button 
            className={`admin-nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={20} /> Utilisateurs
          </button>
          <button 
            className={`admin-nav-item ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            <Activity size={20} /> Activités
          </button>
        </nav>

        <div className="admin-sidebar-footer">
          <button className="admin-nav-item" onClick={() => {/* Logout logic */}}>
            <LogOut size={20} /> Déconnexion
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div>
            <h2>{activeTab === 'overview' ? 'Tableau de Bord' : activeTab === 'users' ? 'Gestion des Utilisateurs' : 'Activités Récentes'}</h2>
            <p className="admin-subtitle">Bienvenue {user?.firstName} {user?.lastName}</p>
          </div>
          <div className="admin-profile-info">
            <img 
              src={user?.profilePic 
                                ? `https://backpfe-production.up.railway.app${user.profilePic}` 
                                : "/default-avatar.png"} 
              alt="profile" 
              className="admin-avatar"
            />
            <div className="admin-profile-text">
              <span>{user?.firstName} {user?.lastName}</span>
              <span className="admin-role">Administrateur</span>
            </div>
            <div className="status-dot online"></div>
          </div>
        </header>

        <section className="admin-content">
          {activeTab === 'overview' ? (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon blue">
                    <Users size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Total Utilisateurs</span>
                    <span className="stat-value">{stats.totalUsers}</span>
                    <span className="stat-change positive">
                      <TrendingUp size={14} /> +12% ce mois
                    </span>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon purple">
                    <ShieldAlert size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Administrateurs</span>
                    <span className="stat-value">{stats.admins}</span>
                    <span className="stat-change">Sur {stats.totalUsers} utilisateurs</span>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon green">
                    <UserPlus size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Nouveaux ce mois</span>
                    <span className="stat-value">{stats.newThisMonth}</span>
                    <span className="stat-change positive">
                      <Calendar size={14} /> Ce mois
                    </span>
                  </div>
                </div>
                
                <div className="stat-card">
                  <div className="stat-icon orange">
                    <Activity size={24} />
                  </div>
                  <div className="stat-info">
                    <span className="stat-label">Utilisateurs Actifs</span>
                    <span className="stat-value">{stats.activeUsers}</span>
                    <span className="stat-change">Connectés aujourd'hui</span>
                  </div>
                </div>
              </div>

              <div className="recent-section">
                <div className="section-header">
                  <h3>Activités Récentes</h3>
                  <button className="refresh-btn" onClick={fetchRecentActivity}>
                    <RefreshCw size={16} /> Rafraîchir
                  </button>
                </div>
                <div className="activity-timeline">
                  {recentActivity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="activity-item">
                      <div className="activity-icon">
                        <Clock size={16} />
                      </div>
                      <div className="activity-details">
                        <p className="activity-action">{activity.action}</p>
                        <p className="activity-meta">
                          {activity.details} • {formatDate(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : activeTab === 'users' ? (
            <>
              <div className="users-controls">
                <div className="search-bar">
                  <Search size={18} />
                  <input 
                    type="text" 
                    placeholder="Rechercher un utilisateur..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                
                <div className="filter-group">
                  <Filter size={18} />
                  <select 
                    value={roleFilter} 
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="all">Tous les utilisateurs</option>
                    <option value="admin">Administrateurs</option>
                    <option value="user">Membres</option>
                  </select>
                </div>
                
                <button className="export-btn" onClick={exportUsersData}>
                  <Download size={18} /> Exporter
                </button>
              </div>

              <div className="table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>Email</th>
                      <th>Téléphone</th>
                      <th>Rôle</th>
                      <th>Date d'inscription</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="no-data">
                          <AlertCircle size={48} />
                          <p>Aucun utilisateur trouvé</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u._id}>
                          <td className="user-cell">
                            <img 
                              src={`http://localhost:5000${u.profilePic}` || '/default-avatar.png'} 
                              alt="profile" 
                              className="mini-avatar" 
                            />
                            <div>
                              <span className="user-name">{u.firstName} {u.lastName}</span>
                              <span className="user-username">@{u.username || 'utilisateur'}</span>
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
                          <td className="date-cell">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                          <td className="actions-cell">
                            <button 
                              className="action-btn view"
                              onClick={() => viewUserDetails(u)}
                              title="Voir détails"
                            >
                              <Eye size={18} />
                            </button>
                            <button 
                              className="action-btn promote"
                              onClick={() => toggleAdminStatus(u._id, u.isAdmin)}
                              title={u.isAdmin ? "Retirer Admin" : "Rendre Admin"}
                            >
                              {u.isAdmin ? <UserPlus size={18} /> : <UserCheck size={18} />}
                            </button>
                            {!u.isAdmin && (
                              <button 
                                className="action-btn delete"
                                onClick={() => handleDelete(u._id)}
                                title="Supprimer"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="activity-full-list">
              {recentActivity.map((activity, index) => (
                <div key={index} className="activity-card">
                  <div className="activity-icon-large">
                    <Activity size={24} />
                  </div>
                  <div className="activity-content">
                    <h4>{activity.action}</h4>
                    <p>{activity.details}</p>
                    <span className="activity-time">{formatDate(activity.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Détails de l'utilisateur</h3>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="user-detail-avatar">
                <img 
                  src={selectedUser?.profilePic 
                                ? `https://backpfe-production.up.railway.app${selectedUser.profilePic}` 
                                : "/default-avatar.png"} 
                  alt="profile" 
                />
              </div>
              <div className="user-detail-info">
                <p><strong>Nom complet:</strong> {selectedUser.firstName} {selectedUser.lastName}</p>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Téléphone:</strong> {selectedUser.phoneNumber || 'Non renseigné'}</p>
                <p><strong>Rôle:</strong> {selectedUser.isAdmin ? 'Administrateur' : 'Membre'}</p>
                <p><strong>Date d'inscription:</strong> {new Date(selectedUser.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {showConfirmDialog && (
        <div className="modal-overlay" onClick={() => setShowConfirmDialog(false)}>
          <div className="modal-content confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Confirmer la suppression</h3>
              <button className="modal-close" onClick={() => setShowConfirmDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              <AlertCircle size={48} color="#ef4444" />
              <p>Êtes-vous sûr de vouloir supprimer cet utilisateur ?</p>
              <p className="text-muted">Cette action est irréversible.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowConfirmDialog(false)}>Annuler</button>
              <button className="btn-confirm" onClick={confirmDelete}>Confirmer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;