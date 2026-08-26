import React from 'react';
import { ArrowRight, Library } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navbar from '../components/layout/Navbar';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted/30">
      <Navbar />
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
        <section className="max-w-2xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm text-muted-foreground">
            <Library className="size-4" />
            Personal reading tracker
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Welcome to Philobiblus
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground">
              Track books, organize reading progress, and explore public libraries from other readers.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/register')}>
              Get started
              <ArrowRight />
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard')}>
              Explore dashboard
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
};

export default HomePage;
