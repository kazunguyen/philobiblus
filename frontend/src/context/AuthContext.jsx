import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() =>
    localStorage.getItem('token'),
  );
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(token));

  useEffect(() => {
    let isMounted = true;

    const loadCurrentUser = async () => {
      if (!token) {
        setCurrentUser(null);
        setIsAuthenticated(false);
        return;
      }

      try {
        const user = await authService.getCurrentUser(token);

        if (isMounted) {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      }
    };

    loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [token]);

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
    setCurrentUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        token,
        currentUser,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};