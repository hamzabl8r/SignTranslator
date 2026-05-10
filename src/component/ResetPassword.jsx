import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { resetPassword, clearMessage } from '../redux/Slice/userSlice';
import './Styles/ForgotAndResetPass.css';
import SeoHelmet from './SeoHelmet';

const ResetPassword = () => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const dispatch = useDispatch();
    const { status, message, error } = useSelector((state) => state.user);
    const { token } = useParams();
    const navigate = useNavigate();

    const displayMessage = typeof message === 'string' ? message : 
                          message?.msg ? message.msg : 
                          message ? JSON.stringify(message) : null;
    
    const displayError = typeof error === 'string' ? error : 
                        error?.msg ? error.msg : 
                        error ? JSON.stringify(error) : null;

    useEffect(() => {
        if (status === 'succeeded' && displayMessage) {
            setTimeout(() => navigate('/login'), 3000); 
        }
        return () => {
            dispatch(clearMessage());
        };
    }, [status, displayMessage, navigate, dispatch]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            alert('Passwords do not match.');
            return;
        }
        dispatch(resetPassword({ token, password }));
    };

    
       return (
    <div className="auth-container">
        <SeoHelmet title="Reset Password - MediSign" />
        <div className="auth-card">
            <h2>Reset Your Password</h2>
            <p>Please enter your new password below to secure your account.</p>
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="password">New Password</label>
                    <input 
                        type="password" 
                        id="password" 
                        placeholder="••••••••"
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm New Password</label>
                    <input 
                        type="password" 
                        id="confirmPassword" 
                        placeholder="••••••••"
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        required 
                    />
                </div>
                
                <button type="submit" className="auth-btn" disabled={status === 'loading'}>
                    {status === 'loading' ? 'Resetting...' : 'Reset Password'}
                </button>
                
                {displayMessage && <p className="success-message">{displayMessage}</p>}
                {displayError && <p className="error-message">{displayError}</p>}
            </form>
        </div>
    </div>
    );
};

export default ResetPassword;
