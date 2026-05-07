import React, { useEffect, useState, useRef } from 'react';
import './Styles/Headers.css';
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from '../redux/Slice/userSlice';

const Header = () => {
  const user = useSelector((state) => state.user.user);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
  { to: '/translator', label: 'Translator' },
  { to: '/history', label: 'History' },
  ...(user ? [
    user.isAdmin ? { to: '/admin', label: 'AdminDashboard' } : null,
    { to: '/chat', label: 'Chat' },
  ] : []),
].filter(Boolean);

  return (
    <header className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="nav-inner">
        {/* Logo */}
        <Link to="/" className="nav-logo">
          <img src="/logo.png" alt="Logo" />
        </Link>

        {windowWidth > 768 ? (
          /* ── Desktop ── */
          <nav className="nav-desktop">
            <ul className="nav-list">
              {navLinks.map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className={`nav-link ${isActive(to) ? 'nav-link--active' : ''}`}>
                    {label}
                    <span className="nav-link-underline" />
                  </Link>
                </li>
              ))}
            </ul>

            <div className="nav-actions">
              {user ? (
                <>
                  <Link to="/profil" className="nav-profile">
                    <span className="nav-profile-avatar">
                      {user.profilePic ? (
                       <img src={`https://backpfe-production-789f.up.railway.app${user.profilePic}`} alt="Profile" />
                        ) : (
                          user.firstName.charAt(0) || "?"
                        )}
                    </span>
                    <span className="nav-profile-name">{user.firstName} {user.lastName}</span>
                  </Link>
                  <button onClick={handleLogout} className="btn-logout">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Logout
                  </button>
                </>
              ) : (
                <Link to="/login" className="btn-login">Login</Link>
              )}
            </div>
          </nav>
        ) : (
          /* ── Mobile ── */
          <div className="nav-mobile" ref={menuRef}>
            <button
              className={`hamburger ${menuOpen ? 'hamburger--open' : ''}`}
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <span /><span /><span />
            </button>

            <div className={`mobile-drawer ${menuOpen ? 'mobile-drawer--open' : ''}`}>
              <ul className="mobile-nav-list">
                {navLinks.map(({ to, label }) => (
                  <li key={to}>
                    <Link to={to} className={`mobile-nav-link ${isActive(to) ? 'mobile-nav-link--active' : ''}`}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mobile-nav-footer">
                {user ? (
                  <>
                    <Link to="/profil" className="mobile-profile-link">
                      <span className="nav-profile-avatar">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </span>
                      {user.firstName} {user.lastName}
                    </Link>
                    <button onClick={handleLogout} className="btn-logout btn-logout--full">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16 17 21 12 16 7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                      </svg>
                      Logout
                    </button>
                  </>
                ) : (
                  <Link to="/login" className="btn-login btn-login--full">Login</Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
