import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ViewModeProvider, useViewMode } from './context/ViewModeContext';
import { SettingsProvider } from './context/SettingsContext';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import PublicDashboardPage from './pages/PublicDashboardPage';
import NotFoundPage from './pages/NotFoundPage';
import UserProfilePage from './pages/UserProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import BookDetailPage from './pages/BookDetailPage';
import BookListPage from './pages/BookListPage';
import BookAddPage from './pages/BookAddPage';
import BookEditPage from './pages/BookEditPage';
import SocialPage from './pages/SocialPage';
import SharedBookPage from './pages/SharedBookPage';
import SettingsPage from './pages/SettingsPage';
import AppearanceSettingsPage from './pages/AppearanceSettingsPage';
import PreferencesSettingsPage from './pages/PreferencesSettingsPage';
import AdminHomePage from './pages/AdminHomePage';
import AdminBooksPage from './pages/AdminBooksPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminUserDetailPage from './pages/AdminUserDetailPage';
import AdminUserActionPage from './pages/AdminUserActionPage';
import AdminHealthPage from './pages/AdminHealthPage';
import Navbar from './components/layout/Navbar';
import ProtectedRoute from './components/common/ProtectedRoute';
import AdminRoute from './components/common/AdminRoute';

const ViewModeRouteSynchronizer = () => {
  const { pathname } = useLocation();
  const { currentUser } = useAuth();
  const { setViewMode } = useViewMode();

  useEffect(() => {
    if (!currentUser?.is_admin) {
      setViewMode('user');
      return;
    }

    const isSharedDetail = /^\/(?:books\/[^/]+|users\/[^/]+)$/.test(pathname);
    if (pathname.startsWith('/admin')) {
      setViewMode('admin');
    } else if (!isSharedDetail) {
      setViewMode('user');
    }
  }, [currentUser?.is_admin, pathname, setViewMode]);

  return null;
};

const AdminPage = ({ children }) => <AdminRoute>{children}</AdminRoute>;

function App() {
  return (
    <AuthProvider>
      <ViewModeProvider>
        <SettingsProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <ViewModeRouteSynchronizer />
            <Navbar />
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/dashboard" element={<PublicDashboardPage />} />
              <Route path="/public/books/:id" element={<SharedBookPage />} />
              <Route path="/shared/books/:shareToken" element={<SharedBookPage />} />
              <Route path="/users/:username" element={<UserProfilePage />} />

              <Route path="/statistics" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/books/:id" element={<ProtectedRoute><BookDetailPage /></ProtectedRoute>} />
              <Route path="/books" element={<ProtectedRoute><BookListPage /></ProtectedRoute>} />
              <Route path="/books/add" element={<ProtectedRoute><BookAddPage /></ProtectedRoute>} />
              <Route path="/books/:id/edit" element={<ProtectedRoute><BookEditPage /></ProtectedRoute>} />
              <Route path="/social" element={<ProtectedRoute><SocialPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}>
                <Route index element={<Navigate to="appearance" replace />} />
                <Route path="appearance" element={<AppearanceSettingsPage />} />
                <Route path="preferences" element={<PreferencesSettingsPage />} />
              </Route>

              <Route path="/admin" element={<AdminPage><AdminHomePage /></AdminPage>} />
              <Route path="/admin/books" element={<AdminPage><AdminBooksPage /></AdminPage>} />
              <Route path="/admin/users" element={<AdminPage><AdminUsersPage /></AdminPage>} />
              <Route path="/admin/users/:username" element={<AdminPage><AdminUserDetailPage /></AdminPage>} />
              <Route path="/admin/users/:username/:action" element={<AdminPage><AdminUserActionPage /></AdminPage>} />
              <Route path="/admin/health" element={<AdminPage><AdminHealthPage /></AdminPage>} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </BrowserRouter>
        </SettingsProvider>
      </ViewModeProvider>
    </AuthProvider>
  );
}

export default App;
