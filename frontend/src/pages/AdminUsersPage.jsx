import React, { useEffect, useMemo, useState } from 'react';
import { Eye, Search, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/adminServices';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const AdminUsersPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    adminService.getUsers()
      .then(setUsers)
      .catch((loadError) => setError(loadError.message));
  }, []);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => (
      [user.username, user.email].some((value) => value.toLowerCase().includes(term))
    ));
  }, [query, users]);

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">User resources</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Inspect accounts and open their dedicated management pages.
            </p>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search username or email..." />
          </div>
        </div>

        {error && <p className="mb-6 text-sm text-destructive" role="alert">{error}</p>}

        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Books</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">View</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-2 font-medium">
                        {user.username}
                        {user.is_admin && <ShieldCheck className="size-4 text-primary" aria-label="Administrator" />}
                      </p>
                      <p className="text-muted-foreground">{user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={user.is_active ? 'secondary' : 'destructive'}>{user.is_active ? 'Active' : 'Locked'}</Badge>
                    </td>
                    <td className="px-4 py-3">{user.book_count}</td>
                    <td className="px-4 py-3">{user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/admin/users/${encodeURIComponent(user.username)}`)}>
                        <Eye /> Manage
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No users found.</p>}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminUsersPage;
