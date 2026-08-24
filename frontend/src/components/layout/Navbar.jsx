import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar = ({ onOpenAuth }) => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav style={styles.nav}>
      <h2 style={styles.brand} onClick={() => navigate('/')} role="button">
        Philobiblus
      </h2>
      <div>
        {isAuthenticated ? (
          <>
            <button onClick={() => navigate('/dashboard')} style={styles.navBtn}>
              My Library
            </button>
            <button onClick={handleLogout} style={{ ...styles.navBtn, ...styles.logoutBtn }}>
              Logout
            </button>
          </>
        ) : (
          <button onClick={onOpenAuth} style={styles.loginBtn}>
            Login / Register
          </button>
        )}
      </div>
    </nav>
  );
};

const styles = {
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '15px 30px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef',
    fontFamily: 'sans-serif'
  },
  brand: { margin: 0, color: '#333', cursor: 'pointer' },
  navBtn: {
    padding: '8px 16px', marginLeft: '8px',
    border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
  },
  loginBtn: {
    padding: '8px 16px', backgroundColor: '#28a745', color: 'white',
    border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
  },
  logoutBtn: { backgroundColor: '#dc3545', color: 'white' }
};

export default Navbar;