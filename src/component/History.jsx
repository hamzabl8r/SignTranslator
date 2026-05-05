import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHistory } from '../redux/Slice/userSlice';
import './Styles/History.css';

// Map item types to human-readable labels (extend as needed)
const TYPE_LABELS = {
  dataset: 'Dataset',
  translation: 'Traduction',
  upload: 'Fichier uploadé',
};

// Status config: color class + label + icon char
const STATUS_CONFIG = {
  pending:  { cls: 'pending',  label: 'En attente',  icon: '⏳' },
  approved: { cls: 'approved', label: 'Approuvé',    icon: '✅' },
  rejected: { cls: 'rejected', label: 'Refusé',      icon: '❌' },
  completed:{ cls: 'completed',label: 'Terminé',     icon: '✔️' },
  failed:   { cls: 'failed',   label: 'Échoué',      icon: '⚠️' },
};

const History = () => {
    const dispatch = useDispatch();
    const { history, status } = useSelector((state) => state.user);

    useEffect(() => {
        dispatch(fetchHistory());
    }, [dispatch]);

    return (
        <div className="history-container">
            <div className="history-header">
                <h2>Activity History</h2>
                <p>View your recent sign language translations and app activity.</p>
            </div>

            <div className="history-list">
                {status === 'loading' && (
                    <p style={{ textAlign: 'center' }}>Loading history...</p>
                )}

                {history && history.length > 0 ? (
                    history.map((item) => {
                        const statusKey = item.status?.toLowerCase();
                        const statusCfg = STATUS_CONFIG[statusKey] || {
                            cls: statusKey,
                            label: item.status,
                            icon: '',
                        };
                        const typeLabel = TYPE_LABELS[item.type?.toLowerCase()] || item.type;
                        const isDataset = item.type?.toLowerCase() === 'dataset';

                        return (
                            <div
                                key={item._id}
                                className={`history-card ${isDataset && statusKey === 'pending' ? 'history-card--awaiting' : ''}`}
                            >
                                <div className="card-info">
                                    <span className="item-type">{typeLabel}</span>
                                    <h3 className="item-content">{item.content}</h3>

                                    {/* Show a pending notice for datasets waiting admin review */}
                                    {isDataset && statusKey === 'pending' && (
                                        <p className="item-pending-notice">
                                            ⏳ En attente de validation par l'administrateur.
                                            Vous serez notifié une fois la décision prise.
                                        </p>
                                    )}

                                    {/* Show rejection reason if admin refused the dataset */}
                                    {isDataset && statusKey === 'rejected' && item.rejectReason && (
                                        <p className="item-reject-reason">
                                            ❌ Refusé — {item.rejectReason}
                                        </p>
                                    )}

                                    <span className="item-date">
                                        {new Date(item.createdAt).toLocaleDateString()}
                                    </span>
                                </div>

                                <div className="card-status">
                                    <span className={`status-badge ${statusCfg.cls}`}>
                                        {statusCfg.icon && (
                                            <span className="status-badge-icon">{statusCfg.icon}</span>
                                        )}
                                        {statusCfg.label}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    status !== 'loading' && (
                        <p style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
                            No history found.
                        </p>
                    )
                )}
            </div>
        </div>
    );
};

export default History;