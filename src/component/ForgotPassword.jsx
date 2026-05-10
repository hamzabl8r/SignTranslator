import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { forgotPassword, clearAuthFeedback, clearMessage } from '../redux/Slice/userSlice';
import './Styles/ForgotAndResetPass.css';
import SeoHelmet from './SeoHelmet';

const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const dispatch = useDispatch();
    
    const { status, message, error } = useSelector((state) => state.user);

    // Fonction pour extraire le texte correctement
    const getMessageText = (msg) => {
        if (!msg) return '';
        if (typeof msg === 'string') return msg;
        if (msg?.msg) return msg.msg;           
        if (msg?.message) return msg.message;   
        return JSON.stringify(msg);            
    };

    useEffect(() => {
        return () => {
            dispatch(clearMessage());
        };
    }, [dispatch]);

    const handleSubmit = (e) => {
    e.preventDefault();
    if (email) {
        dispatch(forgotPassword(email));  
    }
};

    return (
        <div className="auth-container">
            <SeoHelmet title="Forgot Password - MediSign" />
            <div className="auth-card">
                <h2>Forgot Password</h2>
                <p>Enter your email, and we'll send you a link to reset your password.</p>
                
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <input
                            type="email"
                            id="email"
                            placeholder="Email Address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="auth-btn" 
                        disabled={status === 'loading'}
                    >
                        {status === 'loading' ? 'Sending...' : 'Send Reset Link'}
                    </button>

                    {message && (
                        <p className="success-message">
                            {getMessageText(message)}
                        </p>
                    )}

                    {error && (
                        <p className="error-message">
                            {getMessageText(error)}
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
};

export default ForgotPassword;
