import React, { useEffect, useState } from 'react';
import { Activity, BookOpen, LockKeyhole, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/adminServices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AdminHomePage = () => {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminService.getOverview()
      .then(setOverview)
      .catch((loadError) => setError(loadError.message));
  }, []);

  const cards = [
    { label: 'Users', value: overview?.total_users, detail: `${overview?.active_users ?? 0} active`, icon: Users, route: '/admin/users' },
    { label: 'Books', value: overview?.total_books, detail: `${overview?.private_books ?? 0} private`, icon: BookOpen, route: '/admin/books' },
    { label: 'Restricted books', value: overview?.restricted_books, detail: 'Link-only visibility', icon: LockKeyhole, route: '/admin/books' },
    { label: 'System health', value: 'Open', detail: 'Prometheus and Grafana', icon: Activity, route: '/admin/health' },
  ];

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Inspect resources and manage user accounts.
          </p>
        </div>

        {error && <p className="mb-6 text-sm text-destructive" role="alert">{error}</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map(({ label, value, detail, icon: Icon, route }) => (
            <Card key={label}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  {label}
                  <Icon className="size-5 text-primary" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{value ?? '—'}</p>
                <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
                <Button className="mt-4 w-full" variant="outline" onClick={() => navigate(route)}>
                  Open
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminHomePage;
