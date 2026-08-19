import React, { useState } from 'react';

const AuthModal = ({ isOpen, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2>{isLogin ? 'Login' : 'Register'}</h2>
        <form onSubmit={(e) => e.preventDefault()} style={styles.form}>
          <input type="text" placeholder="Username" style={styles.input} />
          
          {!isLogin && (
            <input type="email" placeholder="Email" style={styles.input} />
          )}
          
          <input type="password" placeholder="Password" style={styles.input} />
          
          <button type="submit" style={styles.button}>
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
        
        <p style={styles.toggleText}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span
            style={styles.toggleLink}
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? 'Register here' : 'Login here'}
          </span>
        </p>
        
        <button onClick={onClose} style={styles.closeButton}>Close</button>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'white', padding: '30px', borderRadius: '8px',
    width: '320px', textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  },
  form: {
    display: 'flex', flexDirection: 'column', gap: '15px', margin: '20px 0'
  },
  input: {
    padding: '10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '14px'
  },
  button: {
    padding: '10px', backgroundColor: '#007BFF', color: 'white',
    border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold'
  },
  toggleText: { 
    fontSize: '14px', margin: '10px 0' 
  },
  toggleLink: { 
    color: '#007BFF', cursor: 'pointer', textDecoration: 'underline' 
  },
  closeButton: {
    marginTop: '15px', padding: '8px 16px', cursor: 'pointer', 
    border: '1px solid #ccc', backgroundColor: '#f9f9f9', borderRadius: '4px'
  }
};

export default AuthModal;
