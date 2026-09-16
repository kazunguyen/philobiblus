import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Sparkles } from 'lucide-react';
import BookCard from '../components/books/BookCard';
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
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationSource, setRecommendationSource] = useState(null);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false);
  const [hasRecommendationError, setHasRecommendationError] = useState(false);
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

  useEffect(() => {
    if (!id || shareToken) {
      setRecommendations([]);
      setRecommendationSource(null);
      return undefined;
    }

    let isCurrent = true;

    const loadRecommendations = async () => {
      setIsRecommendationsLoading(true);
      setHasRecommendationError(false);

      try {
        const data = await bookService.getPublicBookRecommendations(id);

        if (!isCurrent) {
          return;
        }

        setRecommendations(Array.isArray(data.books) ? data.books : []);
        setRecommendationSource(data.source);
      } catch {
        if (isCurrent) {
          setRecommendations([]);
          setRecommendationSource(null);
          setHasRecommendationError(true);
        }
      } finally {
        if (isCurrent) {
          setIsRecommendationsLoading(false);
        }
      }
    };

    loadRecommendations();

    return () => {
      isCurrent = false;
    };
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

      {!shareToken && (
        <section
          className="mt-8 rounded-xl border bg-card p-5"
          aria-labelledby="recommendations-heading"
        >
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-amber-500" />
                <h2 id="recommendations-heading" className="font-semibold">
                  Recommended for this book
                </h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {recommendationSource === "model"
                  ? "Matched from title, author, genre, and tags."
                  : "More public books from the same genre."}
              </p>
            </div>

            {recommendationSource && (
              <Badge variant="outline">
                {recommendationSource === "model"
                  ? "Content matched"
                  : "Genre fallback"}
              </Badge>
            )}
          </div>

          {isRecommendationsLoading ? (
            <p className="text-sm text-muted-foreground">
              Finding related books...
            </p>
          ) : hasRecommendationError ? (
            <p className="text-sm text-muted-foreground">
              Recommendations are unavailable right now.
            </p>
          ) : recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No public recommendations are available yet.
            </p>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recommendations.map((recommendedBook) => (
                <div key={recommendedBook.id} className="shrink-0">
                  <BookCard book={recommendedBook} isReadOnly />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
};

export default ReadOnlyBookDetail;
