import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  BookOpen,
  ChevronDown,
  LayoutDashboard,
  Library,
  LogIn,
  LogOut,
  Settings as SettingsIcon,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '../../context/AuthContext';
import { useViewMode } from '../../context/ViewModeContext';

const Navbar = () => {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { viewMode } = useViewMode();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const username = currentUser?.username || 'User';
  const initials = username.slice(0, 2).toUpperCase();
  const isAdminView = Boolean(currentUser?.is_admin && viewMode === 'admin');

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const closeFromOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false);
    };
    const closeFromEscape = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', closeFromOutside);
    document.addEventListener('keydown', closeFromEscape);
    return () => {
      document.removeEventListener('mousedown', closeFromOutside);
      document.removeEventListener('keydown', closeFromEscape);
    };
  }, [isMenuOpen]);

  const isActive = (route) => (
    route === '/admin' ? pathname === route : pathname.startsWith(route)
  );

  const navigateFromMenu = (route) => {
    setIsMenuOpen(false);
    navigate(route);
  };

  const logoutAndReturnHome = () => {
    setIsMenuOpen(false);
    logout();
    navigate('/');
  };

  const userNavigation = (
    <>
      <Button variant={isActive('/dashboard') ? 'secondary' : 'ghost'} onClick={() => navigate('/dashboard')}><BookOpen />Dashboard</Button>
      <Button variant={isActive('/statistics') ? 'secondary' : 'ghost'} onClick={() => navigate('/statistics')}><LayoutDashboard />Statistics</Button>
      <Button variant={isActive('/books') ? 'secondary' : 'ghost'} onClick={() => navigate('/books')}><Library />Books</Button>
      <Button variant={isActive('/social') ? 'secondary' : 'ghost'} onClick={() => navigate('/social')}><Users />Social</Button>
    </>
  );

  const adminNavigation = (
    <>
      <Button variant={isActive('/admin') ? 'secondary' : 'ghost'} onClick={() => navigate('/admin')}><ShieldCheck />Administration</Button>
      <Button variant={isActive('/admin/books') ? 'secondary' : 'ghost'} onClick={() => navigate('/admin/books')}><Library />Resources</Button>
      <Button variant={isActive('/admin/users') ? 'secondary' : 'ghost'} onClick={() => navigate('/admin/users')}><Users />Users</Button>
      <Button variant={isActive('/admin/health') ? 'secondary' : 'ghost'} onClick={() => navigate('/admin/health')}><Activity />Health</Button>
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button type="button" onClick={() => navigate(isAdminView ? '/admin' : '/')} className="flex shrink-0 items-center gap-2 text-base font-semibold text-foreground">
          <BookOpen className="size-5 text-primary" />
          <span>Philobiblus</span>
        </button>

        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 md:flex">
              {isAdminView ? adminNavigation : userNavigation}
            </div>

            <div ref={menuRef} className="relative">
              <button type="button" aria-haspopup="menu" aria-expanded={isMenuOpen} aria-label={`Open account menu for ${username}`} onClick={() => setIsMenuOpen((open) => !open)} className="flex items-center gap-2 rounded-full border bg-background px-2 py-1.5 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{initials}</span>
                <ChevronDown className={`size-4 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isMenuOpen && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-xl border bg-background shadow-lg">
                  <div className="border-b px-4 py-3">
                    <p className="text-xs text-muted-foreground">{isAdminView ? 'Administrator view' : 'User view'}</p>
                    <p className="font-semibold">{username}</p>
                    {currentUser?.email && <p className="truncate text-sm text-muted-foreground">{currentUser.email}</p>}
                  </div>

                  <div className="p-2">
                    {currentUser?.is_admin && (
                      <>
                        <button type="button" role="menuitem" onClick={() => navigateFromMenu(isAdminView ? '/dashboard' : '/admin')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">
                          <ShieldCheck className="size-4" /> {isAdminView ? 'User View' : 'Admin View'}
                        </button>
                        <div className="my-2 border-t" />
                      </>
                    )}

                    {isAdminView ? (
                      <>
                        <button type="button" role="menuitem" onClick={() => navigateFromMenu(`/admin/users/${encodeURIComponent(username)}`)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><UserRound className="size-4" /> My account</button>
                        <button type="button" role="menuitem" onClick={() => navigateFromMenu('/admin/books')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><Library className="size-4" /> Book resources</button>
                        <button type="button" role="menuitem" onClick={() => navigateFromMenu('/admin/users')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><Users className="size-4" /> User resources</button>
                        <button type="button" role="menuitem" onClick={() => navigateFromMenu('/admin/health')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><Activity className="size-4" /> System health</button>
                      </>
                    ) : (
                      <>
                        <button type="button" role="menuitem" onClick={() => navigateFromMenu('/statistics')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><LayoutDashboard className="size-4" /> Reading statistics</button>
                        <button type="button" role="menuitem" onClick={() => navigateFromMenu('/dashboard')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><BookOpen className="size-4" /> Public dashboard</button>
                        <button type="button" role="menuitem" onClick={() => navigateFromMenu(`/users/${encodeURIComponent(username)}`)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><UserRound className="size-4" /> My profile</button>
                        <button type="button" role="menuitem" onClick={() => navigateFromMenu('/books')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><Library className="size-4" /> My library</button>
                        <button type="button" role="menuitem" onClick={() => navigateFromMenu('/social')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><Users className="size-4" /> Social connections</button>
                        <button type="button" role="menuitem" onClick={() => navigateFromMenu('/settings')} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"><SettingsIcon className="size-4" /> Settings</button>
                      </>
                    )}

                    <div className="my-2 border-t" />
                    <button type="button" role="menuitem" onClick={logoutAndReturnHome} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"><LogOut className="size-4" /> Logout</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Button onClick={() => navigate('/login')}><LogIn />Login</Button>
        )}
      </nav>
    </header>
  );
};

export default Navbar;