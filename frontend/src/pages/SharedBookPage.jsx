import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { bookService } from '../services/bookServices';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getBookStatusLabel } from '@/lib/bookStatus';
import { getPublicationStatusLabel } from '@/lib/publicationStatus';

const ReadOnlyBookDetail = () => {
  const { id, shareToken } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadBook = async () => {
      try {
        setError(null);
        const data = shareToken
          ? await bookService.getSharedBook(shareToken)
          : await bookService.getPublicBookById(id);
        setBook(data);
      } catch (loadError) {
        setError(loadError.message);
      }
    };

    loadBook();
  }, [id, shareToken]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="mb-5 text-destructive">{error}</p>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          Back to public dashboard
        </Button>
      </div>
    );
  }

  if (!book) {
    return <p className="py-16 text-center text-muted-foreground">Loading book...</p>;
  }

  const tags = Array.isArray(book.tags) && book.tags.length > 0
    ? book.tags
    : book.genre
      ? [book.genre]
      : [];
  const hasVolume = book.volume >= 0;
  const hasPagesRead = book.pages_read >= 0;
  const hasPagesTotal = book.pages_total >= 0;
  const hasChaptersRead = book.chapters_read >= 0;
  const progress = book.pages_total > 0 && hasPagesRead
    ? Math.min(book.pages_read / book.pages_total, 1) * 100
    : 0;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
        <ArrowLeft />
        Back
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">{book.title}</CardTitle>
              <p className="mt-1 text-muted-foreground">by {book.author}</p>
              {book.owner?.username && (
                <button
                  type="button"
                  className="mt-2 text-sm text-primary hover:underline"
                  onClick={() => navigate(`/users/${book.owner.username}`)}
                >
                  Shared by {book.owner.username}
                </button>
              )}
            </div>
            {book.cover_url ? (
              <img
                src={book.cover_url}
                alt={`${book.title} cover`}
                className="h-24 w-16 rounded object-cover"
              />
            ) : (
              <BookOpen className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Reading status</p>
              <p className="font-medium">{getBookStatusLabel(book.status)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Publication</p>
              <p className="font-medium">{getPublicationStatusLabel(book.publication_status)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rating</p>
              <p className="font-medium text-amber-500">
                {book.rating ? `${'★'.repeat(book.rating)}${'☆'.repeat(5 - book.rating)}` : 'Not rated'}
              </p>
            </div>
            {hasVolume && (
              <div>
                <p className="text-sm text-muted-foreground">Volume</p>
                <p className="font-medium">{book.volume}</p>
              </div>
            )}
            {hasChaptersRead && (
            <div>
              <p className="text-sm text-muted-foreground">Chapters read</p>
              <p className="font-medium">{book.chapters_read}</p>
            </div>
            )}
            {book.date_started && (
              <div>
                <p className="text-sm text-muted-foreground">Started reading</p>
                <p className="font-medium">{new Date(`${book.date_started}T00:00:00`).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {book.pages_total > 0 && hasPagesRead ? (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Reading progress</span>
                <span>{book.pages_read} / {book.pages_total} pages</span>
              </div>
              <Progress
                value={progress}
                indicatorClassName={progress >= 100 ? 'bg-emerald-500' : progress > 0 ? 'bg-blue-500' : 'bg-muted-foreground'}
              />
            </div>
          ) : null}

          {book.notes && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">Notes</p>
              <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm">{book.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ReadOnlyBookDetail;
