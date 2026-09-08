import React from 'react';
import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import PublicDashboardPage from './pages/PublicDashboardPage';
import UserProfilePage from './pages/UserProfilePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './components/common/ProtectedRoute';
import BookDetailPage from './pages/BookDetailPage';
import BookListPage from './pages/BookListPage';
import BookAddPage from './pages/BookAddPage';
import BookEditPage from './pages/BookEditPage';
import SocialPage from './pages/SocialPage';
import SharedBookPage from './pages/SharedBookPage';
import Navbar from './components/layout/Navbar';
import { SettingsProvider } from './context/SettingsContext';
import SettingsPage from './pages/SettingsPage';
import AppearanceSettingsPage from './pages/AppearanceSettingsPage';
import PreferencesSettingsPage from './pages/PreferencesSettingsPage';

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/statistics"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard" element={<PublicDashboardPage />} />
          <Route path="/public/books/:id" element={<SharedBookPage />} />
          <Route path="/shared/books/:shareToken" element={<SharedBookPage />} />
          <Route path="/users/:username" element={<UserProfilePage />} />
          <Route
            path="/books/:id"
            element={
              <ProtectedRoute>
                <BookDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/books"
            element={
              <ProtectedRoute>
                <BookListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/books/add"
            element={
              <ProtectedRoute>
                <BookAddPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/books/:id/edit"
            element={
              <ProtectedRoute>
                <BookEditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/social"
            element={
              <ProtectedRoute>
                <SocialPage />
              </ProtectedRoute>
            }
          />
                  <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="appearance" replace />} />
            <Route path="appearance" element={<AppearanceSettingsPage />} />
            <Route path="preferences" element={<PreferencesSettingsPage />} />
          </Route>
        </Routes>
        </BrowserRouter>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
