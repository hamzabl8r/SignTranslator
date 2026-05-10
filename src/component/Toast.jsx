import React, { useEffect } from 'react';
import './Styles/Toast.css';
import SeoHelmet from './SeoHelmet';

const Toast = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <>
            <SeoHelmet title="Toast - MediSign" />
            <div className={`toast toast-${type}`}>
                <div className="toast-icon">
                    {type === 'success' && '✅'}
                    {type === 'error' && '❌'}
                    {type === 'info' && 'ℹ️'}
                    {type === 'warning' && '⚠️'}
                </div>
                <div className="toast-message">{message}</div>
                <button className="toast-close" onClick={onClose}>×</button>
            </div>
        </>
    );
};

export default Toast;
