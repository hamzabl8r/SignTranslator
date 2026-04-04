import React, { useEffect, useState } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { userCurrent } from './redux/Slice/userSlice'; 
import { Toaster } from 'react-hot-toast';

// Components
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

import process from 'process';
import { Buffer } from 'buffer';

window.process = process;
window.Buffer = Buffer;

const App = () => {
  const dispatch = useDispatch();
  const { status, user } = useSelector((state) => state.user);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      dispatch(userCurrent())
        .unwrap()
        .then(() => {
          setIsLoading(false);
        })
        .catch(() => {
          // Si erreur, on supprime le token invalide
          localStorage.removeItem("token");
          setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
  }, [dispatch]);

  // Afficher loading seulement pendant le chargement initial
  if (isLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F172A',
        color: 'white'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#242731',
            color: '#fff',
            borderRadius: '10px',
          },
          success: {
            iconTheme: {
              primary: '#2ecc71',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#e74c3c',
              secondary: '#fff',
            },
          },
        }}
      />
      <BrowserRouter>
        <div className="app-container">
          <Header />
          <main className="content">
            <Routes>
              {/* Routes publiques */}
              <Route path="/" element={<Home />} />
              <Route path="/history" element={<History />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/translator" element={<Translator />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/dictionary" element={<div>Dictionary Page (Coming Soon)</div>} />
              
              {/* Routes protégées */}
              <Route element={<ProtectedRoute />}>
                <Route path="/profil" element={<Profil />} />
                <Route path="/chat" element={<Chat />} />
              </Route>
              
              <Route path="*" element={<h1>404: Page Not Found</h1>} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </>
  );
};

export default App;