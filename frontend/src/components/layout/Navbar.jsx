import React from 'react';
import { BookOpen, LayoutDashboard, Library, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../context/AuthContext';

const Navbar = ({ onOpenAuth }) => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-base font-semibold text-foreground"
        >
          <BookOpen className="size-5 text-primary" />
          <span>Philobiblus</span>
        </button>

        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              <LayoutDashboard />
              Dashboard
            </Button>
            <Button variant="ghost" onClick={() => navigate('/books')}>
              <Library />
              Books
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut />
              Logout
            </Button>
          </div>
        ) : (
          <Button onClick={onOpenAuth}>Login / Register</Button>
        )}
      </nav>
    </header>
  );
};

export default Navbar;