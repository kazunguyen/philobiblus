import React, { createContext, useState, useEffect, useContext } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!token);

  const login = async (username, password) => {
    const data = await authService.login(username, password);
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);
    setIsAuthenticated(true);
  };

  const register = async (username, email, password) => {
    await authService.register(username, email, password);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
