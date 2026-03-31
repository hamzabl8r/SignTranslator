import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { userCurrent, logout } from '../redux/Slice/userSlice';
import './Styles/Translator.css';

const Translator = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, token, status } = useSelector((state) => state.user);

  // Vérifier l'authentification
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem("token");
      
      if (!storedToken) {
        console.log("No token found, redirecting to login");
        navigate('/');
        return;
      }
      
      // Si pas d'utilisateur mais token existe, charger les données
      if (!user && storedToken) {
        try {
          await dispatch(userCurrent()).unwrap();
        } catch (error) {
          console.log("Session expired, redirecting to login");
          localStorage.removeItem("token");
          navigate('/');
        }
      }
    };
    
    checkAuth();
  }, [dispatch, navigate, user]);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  // Afficher un loader pendant le chargement
  if (status === 'loading') {
    return (
      <div className="loading-container">
        <div className="loader">Loading...</div>
      </div>
    );
  }

  // Si pas d'utilisateur, ne pas afficher le contenu
  if (!user) {
    return null;
  }

  return (
    <div className='translator-container'>
      {/* Header avec informations utilisateur et logout */}
      <div className="header">
        <div className="user-info">
          <img 
            src={user?.profilePic ? `https://backpfe-production.up.railway.app${user.profilePic}` : "/default-avatar.png"} 
            alt="profile" 
            className="profile-avatar"
          />
          <span className="user-name">Welcome, {user.firstName} {user.lastName}!</span>
        </div>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>

      {/* Box 1 - Translator History */}
      <div className="box">
        <h1>Translator History</h1>
        <div className="box1">
          {/* Ici tu peux ajouter l'historique des traductions */}
          <div className="history-list">
            <p>No translation history yet.</p>
          </div>
        </div>
      </div>

      {/* Box 2 - Search Box */}
      <div className="box">
        <div className="search-box">
          <input 
            type="text" 
            placeholder='Enter text to translate...' 
            className="search-input"
          />
          <button className="translate-btn">Translate</button>
        </div>
      </div>

      {/* Box 3 - Translator Dictionary */}
      <div className="box">
        <h1>Translator Dictionary</h1>
        <div className="dictionary-content">
          {/* Ici tu peux ajouter le dictionnaire */}
          <div className="dictionary-list">
            <p>Dictionary content will appear here.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Translator;