import React, { useEffect, useState } from 'react';
import { ArrowLeft, KeyRound, LockKeyhole, Trash2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminService } from '../services/adminServices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const ACTION_COPY = {
  'reset-password': { title: 'Reset password', icon: KeyRound },
  'account-status': { title: 'Account status', icon: LockKeyhole },
  delete: { title: 'Delete account', icon: Trash2 },
};

const AdminUserActionPage = () => {
  const { username, action } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const copy = ACTION_COPY[action];

  useEffect(() => {
    if (!copy) return;
    adminService.getUserDetail(username)
      .then(setDetail)
      .catch((loadError) => setError(loadError.message));
  }, [copy, username]);

  if (!copy) {
    return <p className="py-12 text-center text-sm text-destructive">Unknown account action.</p>;
  }

  const submit = async (event) => {
    event.preventDefault();
    if (action === 'delete' && confirmation !== detail.user.username) {
      setError('Type the exact username to confirm deletion.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      if (action === 'reset-password') {
        await adminService.resetPassword(username, password);
      } else if (action === 'account-status') {
        await adminService.setAccountStatus(username, !detail.user.is_active);
      } else {
        await adminService.deleteUser(username);
        navigate('/admin/users', { replace: true });
        return;
      }
      navigate(`/admin/users/${encodeURIComponent(username)}`, { replace: true });
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setIsSaving(false);
    }
  };

  const Icon = copy.icon;
  const isDelete = action === 'delete';
  const isStatus = action === 'account-status';

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <Button variant="ghost" className="mb-4" onClick={() => navigate(`/admin/users/${encodeURIComponent(username)}`)}>
          <ArrowLeft /> Back to user
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl"><Icon className="size-6 text-primary" /> {copy.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {!detail ? (
              <p className="text-sm text-muted-foreground">Loading account...</p>
            ) : (
              <form className="space-y-5" onSubmit={submit}>
                <p className="text-sm text-muted-foreground">
                  Account: <span className="font-medium text-foreground">{detail.user.username}</span>
                </p>

                {action === 'reset-password' && (
                  <div className="space-y-2">
                    <Label htmlFor="replacement-password">New password</Label>
                    <Input id="replacement-password" type="password" minLength="6" value={password} onChange={(event) => setPassword(event.target.value)} required />
                  </div>
                )}

                {isStatus && (
                  <p className="rounded-lg border bg-muted/30 p-3 text-sm">
                    This account is currently <strong>{detail.user.is_active ? 'active' : 'locked'}</strong>. Continuing will {detail.user.is_active ? 'lock' : 'unlock'} it.
                  </p>
                )}

                {isDelete && (
                  <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <Label htmlFor="delete-confirmation">Type {detail.user.username} to permanently delete this account</Label>
                    <Input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
                    <p className="text-xs text-muted-foreground">Books with another active reader are retained without the deleted owner.</p>
                  </div>
                )}

                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

                <Button type="submit" variant={isDelete ? 'destructive' : 'default'} disabled={isSaving || (action === 'reset-password' && password.length < 6)}>
                  <Icon /> {isSaving ? 'Saving...' : copy.title}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminUserActionPage;
