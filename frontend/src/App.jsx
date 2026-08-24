import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/HomePage';
import ProtectedRoute from './components/common/ProtectedRoute';

const DummyDashboard = () => <div style={{padding: 20}}><h2>Dashboard (Coming Soon)</h2></div>;

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Homepage for everyone */}
          <Route path="/" element={<HomePage />} />
          
	  {/* Dashboard for logged in user */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DummyDashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
