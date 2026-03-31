import React, { use } from 'react';
import './Styles/Headers.css';
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from '../redux/Slice/userSlice';

const Header = () => {
  const user = useSelector((state) => state.user.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const handleLogout = () => {
      dispatch(logout());
      navigate('/login');
    };
  return (
    <nav className="navbar">
      <div className="logo-Name">
       <Link to="/" >
        <img src="/logo.png" alt="Logo" />
      </Link> 
      </div>
      <div className="nav-Links">
        <Link to="/translator" >Translator</Link>
        <Link to="/history">History</Link>
        <Link to="/dictionary">Dictionary</Link>
        {user ? (
          <>
            <Link to="/profil" className="profile-link">
              {user.isAdmin ? `Admin. ${user.firstName} ${user.lastName}`  : `${user.firstName} ${user.lastName}`}
            </Link>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </>
        ) : (
          <>
            
          </>
        )}

      </div>
    </nav>
  );
};

export default Header;