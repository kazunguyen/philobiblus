import React, { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, LockKeyhole, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { adminService } from '../services/adminServices';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AdminUserDetailPage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminService.getUserDetail(username)
      .then(setDetail)
      .catch((loadError) => setError(loadError.message));
  }, [username]);

  if (error) {
    return <p className="py-12 text-center text-sm text-destructive" role="alert">{error}</p>;
  }

  if (!detail) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Loading user details...</p>;
  }

  const { user, books } = detail;
  const isCurrentAdmin = currentUser?.id === user.id;

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Button variant="ghost" className="mb-4" onClick={() => navigate('/admin/users')}>
          <ArrowLeft /> Back to users
        </Button>

        <Card>
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-2xl">{user.username}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Badge variant={user.is_active ? 'secondary' : 'destructive'}>
                {user.is_active ? 'Active' : 'Locked'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-3">
            <div><p className="text-sm text-muted-foreground">Role</p><p className="font-medium">{user.is_admin ? 'Administrator' : 'User'}</p></div>
            <div><p className="text-sm text-muted-foreground">Joined</p><p className="font-medium">{user.created_at ? new Date(user.created_at).toLocaleString() : '—'}</p></div>
            <div><p className="text-sm text-muted-foreground">Owned books</p><p className="font-medium">{user.book_count}</p></div>
          </CardContent>
        </Card>

        <section className="mt-6">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button onClick={() => navigate(`/admin/users/${encodeURIComponent(user.username)}/reset-password`)}>
              <KeyRound /> Reset password
            </Button>
            <Button variant="outline" disabled={isCurrentAdmin} onClick={() => navigate(`/admin/users/${encodeURIComponent(user.username)}/account-status`)}>
              <LockKeyhole /> {user.is_active ? 'Lock account' : 'Unlock account'}
            </Button>
            <Button variant="destructive" disabled={isCurrentAdmin} onClick={() => navigate(`/admin/users/${encodeURIComponent(user.username)}/delete`)}>
              <Trash2 /> Delete account
            </Button>
          </div>
          {isCurrentAdmin && <p className="text-sm text-muted-foreground">Your own account cannot be locked or deleted.</p>}
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-xl font-semibold">Owned books</h2>
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr><th className="px-4 py-3 font-medium">Book</th><th className="px-4 py-3 font-medium">Visibility</th><th className="px-4 py-3 font-medium">Readers</th><th className="px-4 py-3 font-medium"></th></tr>
                </thead>
                <tbody>
                  {books.map((book) => (
                    <tr key={book.id} className="border-b last:border-0">
                      <td className="px-4 py-3"><p className="font-medium">{book.title}</p><p className="text-muted-foreground">{book.author}</p></td>
                      <td className="px-4 py-3"><Badge variant="outline">{book.visibility}</Badge></td>
                      <td className="px-4 py-3">{book.active_reader_count}</td>
                      <td className="px-4 py-3 text-right"><Button variant="outline" size="sm" onClick={() => navigate(`/books/${book.id}`)}>View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {books.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">This user has no books.</p>}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
};

export default AdminUserDetailPage;
