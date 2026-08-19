import React, { useState } from 'react';
import Navbar from '../components/layout/Navbar';
import AuthModal from '../components/auth/AuthModal';

const HomePage = () => {
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);

  return (
    <div style={{ margin: 0, padding: 0 }}>
      {/* Thanh điều hướng */}
      <Navbar onOpenAuth={() => setAuthModalOpen(true)} />
      
      {/* Nội dung chính của trang */}
      <div style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
        <h1 style={{ fontSize: '36px', marginBottom: '10px' }}>Welcome to Philobiblus</h1>
        <p style={{ fontSize: '18px', color: '#666' }}>
          Your personal book tracking application
        </p>
      </div>

      {/* Modal đăng nhập ẩn/hiện */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
      />
    </div>
  );
};

export default HomePage;
