import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHistory } from '../redux/Slice/userSlice';
import './Styles/History.css';

const TYPE_LABELS = {
  dataset:     'Dataset',
  translation: 'Traduction',
  upload:      'Fichier uploadé',
};

const STATUS_CONFIG = {
  pending:   { cls: 'pending',   label: 'En attente', icon: '⏳' },
  approved:  { cls: 'approved',  label: 'Approuvé',   icon: '✅' },
  rejected:  { cls: 'rejected',  label: 'Refusé',     icon: '❌' },
  completed: { cls: 'completed', label: 'Terminé',    icon: '✔️' },
  failed:    { cls: 'failed',    label: 'Échoué',     icon: '⚠️' },
};

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

const History = () => {
  const dispatch = useDispatch();
  const { history, loading, error } = useSelector((state) => state.user);

  useEffect(() => {
    dispatch(fetchHistory());

    const interval = setInterval(() => {
      dispatch(fetchHistory());
    }, 30000);

    return () => clearInterval(interval);
  }, [dispatch]);

  const handleRefresh = () => {
    dispatch(fetchHistory());
  };

  return (
    <div className="history-container">
      {/* ── Header ── */}
      <div className="history-header">
        <div>
          <h2>Activity History</h2>
          <p>View your recent sign language translations and app activity.</p>
        </div>
        <button onClick={handleRefresh} className="refresh-btn" disabled={loading}>
          🔄 {loading ? 'Chargement...' : 'Refresh'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="history-error">
          ⚠️ {typeof error === 'string' ? error : 'Erreur lors du chargement'}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="history-loading">
          <div className="history-spinner" />
          <p>Chargement de l'historique...</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !error && (!history || history.length === 0) && (
        <div className="history-empty">
          <span className="history-empty-icon">📭</span>
          <p>Aucune activité pour le moment.</p>
          <p className="history-empty-sub">
            Vos soumissions de datasets apparaîtront ici.
          </p>
        </div>
      )}

      {/* ── List ── */}
      {!loading && history && history.length > 0 && (
        <ul className="history-list">
          {history.map((item) => {
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
            const typeLabel = TYPE_LABELS[item.type] || item.type;

            return (
              <li key={item._id} className={`history-item history-item--${statusCfg.cls}`}>
                <div className="history-item-left">
                  <span className="history-item-icon">{statusCfg.icon}</span>
                  <div className="history-item-info">
                    <span className="history-item-type">{typeLabel}</span>
                    <span className="history-item-content">{item.content}</span>
                    <span className="history-item-date">{formatDate(item.createdAt)}</span>
                  </div>
                </div>
                <span className={`history-item-badge history-item-badge--${statusCfg.cls}`}>
                  {statusCfg.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default History;