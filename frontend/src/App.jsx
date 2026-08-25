import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/HomePage';
// import DashboardPage from './pages/DashboardPage';
import PublicDashboardPage from './pages/PublicDashboardPage';
import UserProfilePage from './pages/UserProfilePage';
import ProtectedRoute from './components/common/ProtectedRoute';
import BookDetailPage from './pages/BookDetailPage';
import BookListPage from './pages/BookListPage';
import BookAddPage from './pages/BookAddPage';
import BookEditPage from './pages/BookEditPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<PublicDashboardPage />} />
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
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;