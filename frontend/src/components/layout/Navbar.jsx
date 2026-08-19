import React from 'react';

const Navbar = ({ onOpenAuth }) => {
  return (
    <nav style={styles.nav}>
      <h2 style={styles.brand}>Philobiblus</h2>
      <button onClick={onOpenAuth} style={styles.loginBtn}>
        Login / Register
      </button>
    </nav>
  );
};

const styles = {
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '15px 30px', backgroundColor: '#f8f9fa', borderBottom: '1px solid #e9ecef',
    fontFamily: 'sans-serif'
  },
  brand: {
    margin: 0, color: '#333'
  },
  loginBtn: {
    padding: '8px 16px', backgroundColor: '#28a745', color: 'white',
    border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
  }
};

export default Navbar;
