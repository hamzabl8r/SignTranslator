import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchHistory } from '../redux/Slice/userSlice';
import './Styles/History.css';

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
                {status === 'loading' && <p style={{textAlign: 'center'}}>Loading history...</p>}
                
                {history && history.length > 0 ? (
                    history.map((item) => (
                        <div key={item._id} className="history-card">
                            <div className="card-info">
                                <span className="item-type">{item.type}</span>
                                <h3 className="item-content">{item.content}</h3>
                                <span className="item-date">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <div className="card-status">
                                <span className={`status-badge ${item.status.toLowerCase()}`}>
                                    {item.status}
                                </span>
                            </div>
                        </div>
                    ))
                ) : (
                    status !== 'loading' && <p style={{textAlign: 'center', color: 'var(--text-dim)'}}>No history found.</p>
                )}
            </div>
        </div>
    );
};

export default History;