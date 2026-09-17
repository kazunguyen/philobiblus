import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AdminRoute = ({ children }) => {
  const { currentUser, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!currentUser) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        Checking administrator access...
      </p>
    );
  }

  if (!currentUser.is_admin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default AdminRoute;
