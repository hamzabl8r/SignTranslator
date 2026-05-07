import React, { useEffect, useState } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { userCurrent } from './redux/Slice/userSlice';
import { Toaster } from 'react-hot-toast';
import Translator from './component/Translator';
import History from './component/History';
import Home from './component/Home';
import Header from './component/Header';
import Auth from './component/Auth';
import Profil from './component/Profil';
import ForgotPassword from './component/ForgotPassword';
import ResetPassword from './component/ResetPassword';
import ProtectedRoute from './component/ProtectedRoute';
import Chat from './component/Chat';
import AdminDashboard from './component/AdminDashboard';
import process from 'process';
import { Buffer } from 'buffer';

window.process = process;
window.Buffer = Buffer;

const App = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.user);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      dispatch(userCurrent())
        .unwrap()
        .then(() => setIsLoading(false))
        .catch(() => {
          localStorage.removeItem('token');
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [dispatch]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <BrowserRouter 
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}>
    
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<><Header /><Home /></>} />
        <Route path="/login" element={<><Header /><Auth /></>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/translator" element={<><Header /><Translator /></>} />
          <Route path="/history" element={<><Header /><History /></>} />
          <Route path="/profil" element={<><Header /><Profil /></>} />
          <Route path="/admin" element={<><Header /><AdminDashboard /></>} />

        
          <Route path="/chat" element={<><Header /><Chat /></>} />
          <Route path="/chat/:userId" element={<><Header /><Chat /></>} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;