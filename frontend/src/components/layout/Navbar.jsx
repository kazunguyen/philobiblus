import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  LayoutDashboard,
  Library,
  LogIn,
  LogOut,
  UserRound,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const username = currentUser?.username || 'User';
  const initials = username.slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!isMenuOpen) {
      return undefined;
    }

    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  const isActive = (route) => {
    if (route === '/books') {
      return pathname.startsWith('/books');
    }

    if (route === '/social') {
      return pathname.startsWith('/social');
    }

    return pathname === route;
  };

  const navigateFromMenu = (route) => {
    setIsMenuOpen(false);
    navigate(route);
  };

  const handleLogout = () => {
    setIsMenuOpen(false);
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
            <Button
              variant={isActive('/statistics') ? 'secondary' : 'ghost'}
              aria-current={isActive('/statistics') ? 'page' : undefined}
              onClick={() => navigate('/statistics')}
            >
              <LayoutDashboard />
              Statistics
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

            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
                aria-label={`Open account menu for ${username}`}
                onClick={() => setIsMenuOpen((open) => !open)}
                className="flex items-center gap-2 rounded-full border bg-background px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {initials}
                </span>
                <ChevronDown
                  className={`size-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {isMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border bg-background shadow-lg"
                >
                  <div className="border-b px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Signed in as
                    </p>
                    <p className="font-semibold">{username}</p>
                    {currentUser?.email && (
                      <p className="truncate text-sm text-muted-foreground">
                        {currentUser.email}
                      </p>
                    )}
                  </div>

                  <div className="p-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigateFromMenu('/statistics')}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <LayoutDashboard className="size-4" />
                      Reading statistics
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigateFromMenu(`/users/${username}`)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <UserRound className="size-4" />
                      My profile
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigateFromMenu('/books')}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <Library className="size-4" />
                      My library
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => navigateFromMenu('/social')}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <Users className="size-4" />
                      Social connections
                    </button>

                    <div className="my-2 border-t" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="size-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
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
