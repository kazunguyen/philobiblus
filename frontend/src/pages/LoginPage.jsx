import React, { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login } = useAuth();

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(formData.username, formData.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <BookOpen className="size-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Login to Philobiblus</CardTitle>
              <CardDescription>
                Continue tracking your library and reading progress.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {location.state?.message && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {location.state.message}
              </div>
            )}

            {error && (
              <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Enter your username"
                  autoComplete="username"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
              </div>

              <Button className="w-full" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Do not have an account?{' '}
              <Link className="font-medium text-primary hover:underline" to="/register">
                Create one
              </Link>
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default LoginPage;
