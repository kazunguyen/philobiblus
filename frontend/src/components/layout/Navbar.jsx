import React from 'react';
import {
  BookOpen,
  LayoutDashboard,
  Library,
  LogIn,
  LogOut,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const { pathname } = useLocation();

  const isActive = (route) => {
    if (route === '/books') {
      return pathname.startsWith('/books');
    }

    if (route === '/social') {
      return pathname.startsWith('/social');
    }

    return pathname === route;
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
            <Button
              variant={isActive('/dashboard') ? 'secondary' : 'ghost'}
              aria-current={isActive('/dashboard') ? 'page' : undefined}
              onClick={() => navigate('/dashboard')}
            >
              <LayoutDashboard />
              Dashboard
            </Button>

            <Button
              variant={isActive('/books') ? 'secondary' : 'ghost'}
              aria-current={isActive('/books') ? 'page' : undefined}
              onClick={() => navigate('/books')}
            >
              <Library />
              Books
            </Button>

            <Button
              variant={isActive('/social') ? 'secondary' : 'ghost'}
              aria-current={isActive('/social') ? 'page' : undefined}
              onClick={() => navigate('/social')}
            >
              <Users />
              Social
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut />
              Logout
            </Button>
          </div>
        ) : (
          <Button onClick={() => navigate('/login')}>
            <LogIn />
            Login
          </Button>
        )}
      </nav>
    </header>
  );
};

export default Navbar;
