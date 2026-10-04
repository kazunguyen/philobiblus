import React from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const NotFoundPage = () => {
  const navigate = useNavigate();

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
      <section className="mx-auto flex min-h-[calc(100vh-9.5rem)] max-w-5xl flex-col justify-between border-y border-border py-6 sm:py-8">
        <div className="flex items-center justify-between text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
          <span className="flex items-center gap-2 tracking-normal normal-case">
            <BookOpen className="size-4" aria-hidden="true" />
            Philobiblus
          </span>
          <span>Page not found</span>
        </div>

        <div className="py-14 sm:py-20">
          <p className="mb-3 text-sm font-medium text-muted-foreground">Error 404</p>
          <p className="-ml-1 text-[clamp(8rem,27vw,17rem)] leading-[0.72] font-semibold tracking-[-0.1em] text-foreground" aria-hidden="true">
            404
          </p>
        </div>

        <Button size="lg" className="w-fit" onClick={() => navigate('/dashboard')}>
          Go to public dashboard
          <ArrowUpRight aria-hidden="true" />
        </Button>
      </section>
    </main>
  );
};

export default NotFoundPage;
