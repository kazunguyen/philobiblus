import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Play, Save, Sparkles, UsersRound } from 'lucide-react';
import BookCard from '../components/books/BookCard';
import { bookService } from '../services/bookServices';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { getBookStatusLabel } from '@/lib/bookStatus';
import { getPublicationStatusLabel } from '@/lib/publicationStatus';

const ReadOnlyBookDetail = () => {
  const { id, shareToken } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAuthenticated } = useAuth();
  const [book, setBook] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationSource, setRecommendationSource] = useState(null);
  const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false);
  const [hasRecommendationError, setHasRecommendationError] = useState(false);
  const [error, setError] = useState(null);
  const [progressDraft, setProgressDraft] = useState(null);
  const [progressError, setProgressError] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isSavingProgress, setIsSavingProgress] = useState(false);

  const toProgressDraft = (progressData) => ({
    status: progressData.status,
    pages_read: progressData.pages_read >= 0 ? String(progressData.pages_read) : '',
    chapters_read: progressData.chapters_read >= 0 ? String(progressData.chapters_read) : '',
    volume: progressData.volume >= 0 ? String(progressData.volume) : '',
  });

  useEffect(() => {
    const loadBook = async () => {
      try {
        setError(null);
        const data = shareToken
          ? await bookService.getSharedBook(shareToken)
          : await bookService.getPublicBookById(id);
        setBook(data);
        setProgressDraft(
          data.my_reading_progress
            ? toProgressDraft(data.my_reading_progress)
            : null,
        );
      } catch (loadError) {
        setError(loadError.message);
      }
    };

    loadBook();
  }, [id, shareToken]);

  const handleStartReading = async () => {
    setIsStarting(true);
    setProgressError(null);
    try {
      const progressData = await bookService.startReadingPublicBook(
        book.id,
        shareToken,
      );
      setProgressDraft(toProgressDraft(progressData));
      setBook((previous) => ({
        ...previous,
        my_reading_progress: progressData,
        active_reader_count: previous.active_reader_count + 1,
      }));
    } catch (startError) {
      setProgressError(startError.message);
    } finally {
      setIsStarting(false);
    }
  };

  const handleProgressChange = (event) => {
    const { name, value } = event.target;
    setProgressDraft((previous) => ({ ...previous, [name]: value }));
  };

  const handleProgressSubmit = async (event) => {
    event.preventDefault();
    setIsSavingProgress(true);
    setProgressError(null);
    const payload = {
      status: progressDraft.status,
      pages_read: progressDraft.pages_read === '' ? -1 : Number(progressDraft.pages_read),
      chapters_read: progressDraft.chapters_read === '' ? -1 : Number(progressDraft.chapters_read),
      volume: progressDraft.volume === '' ? -1 : Number(progressDraft.volume),
    };

    try {
      const wasReading = book.my_reading_progress?.status === 'reading';
      const progressData = await bookService.updatePublicBookProgress(
        book.id,
        payload,
        shareToken,
      );
      const isReading = progressData.status === 'reading';
      setProgressDraft(toProgressDraft(progressData));
      setBook((previous) => ({
        ...previous,
        my_reading_progress: progressData,
        active_reader_count: Math.max(
          0,
          previous.active_reader_count + Number(isReading) - Number(wasReading),
        ),
      }));
    } catch (saveError) {
      setProgressError(saveError.message);
    } finally {
      setIsSavingProgress(false);
    }
  };

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
            <div>
              <p className="text-sm text-muted-foreground">Currently reading</p>
              <p className="flex items-center gap-1.5 font-medium">
                <UsersRound className="size-4" />
                {book.active_reader_count} {book.active_reader_count === 1 ? 'person' : 'people'}
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

      {currentUser?.id !== book.user_id && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Your reading progress</CardTitle>
          </CardHeader>
          <CardContent>
            {progressError && (
              <p className="mb-4 text-sm text-destructive" role="alert">
                {progressError}
              </p>
            )}

            {!isAuthenticated ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Sign in to start reading and track your own progress.
                </p>
                <Button onClick={() => navigate('/login')}>
                  Sign in to start reading
                </Button>
              </div>
            ) : !progressDraft ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  This creates progress for your account without changing the owner's data.
                </p>
                <Button onClick={handleStartReading} disabled={isStarting}>
                  <Play />
                  {isStarting ? 'Starting...' : 'Start reading'}
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleProgressSubmit}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="reader-status">Status</Label>
                    <select
                      id="reader-status"
                      name="status"
                      value={progressDraft.status}
                      onChange={handleProgressChange}
                      className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
                    >
                      <option value="reading">Reading</option>
                      <option value="completed">Completed</option>
                      <option value="dropped">Dropped</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reader-pages">Pages read</Label>
                    <Input
                      id="reader-pages"
                      name="pages_read"
                      type="number"
                      min="0"
                      max={book.pages_total >= 0 ? book.pages_total : undefined}
                      value={progressDraft.pages_read}
                      onChange={handleProgressChange}
                      placeholder="Not set"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reader-chapters">Chapters read</Label>
                    <Input
                      id="reader-chapters"
                      name="chapters_read"
                      type="number"
                      min="0"
                      step="0.5"
                      value={progressDraft.chapters_read}
                      onChange={handleProgressChange}
                      placeholder="Not set"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reader-volume">Volume</Label>
                    <Input
                      id="reader-volume"
                      name="volume"
                      type="number"
                      min="0"
                      value={progressDraft.volume}
                      onChange={handleProgressChange}
                      placeholder="Not set"
                    />
                  </div>
                </div>
                <Button type="submit" disabled={isSavingProgress}>
                  <Save />
                  {isSavingProgress ? 'Saving...' : 'Save my progress'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

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
