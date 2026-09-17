import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useAuth } from './AuthContext';

const ViewModeContext = createContext(null);

export const useViewMode = () => useContext(ViewModeContext);

export const ViewModeProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [viewMode, setViewModeState] = useState(() => (
    localStorage.getItem('philobiblus-view-mode') || 'user'
  ));

  const setViewMode = useCallback((mode) => {
    const nextMode = mode === 'admin' && currentUser?.is_admin ? 'admin' : 'user';
    localStorage.setItem('philobiblus-view-mode', nextMode);
    setViewModeState(nextMode);
  }, [currentUser?.is_admin]);

  useEffect(() => {
    if (!currentUser?.is_admin && viewMode === 'admin') {
      setViewMode('user');
    }
  }, [currentUser?.is_admin, setViewMode, viewMode]);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
};