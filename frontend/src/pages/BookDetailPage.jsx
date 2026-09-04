import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    MessageSquare,
    Pencil,
    Send,
    Trash2,
} from 'lucide-react';
import { bookService } from '../services/bookServices';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '../context/AuthContext';
import { reviewService } from '../services/reviewServices';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import StarRating from '../components/ui/StarRating';

const BookDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [book, setBook] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { isAuthenticated, currentUser } = useAuth();
    const [deletingReviewId, setDeletingReviewId] = useState(null);

    const [reviews, setReviews] = useState([]);
    const [reviewForm, setReviewForm] = useState({
        rating: '',
        comment: '',
    });
    const [isLoadingReviews, setIsLoadingReviews] = useState(true);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [reviewError, setReviewError] = useState(null);

    useEffect(() => {
        const loadBookPage = async () => {
            try {
                setIsLoading(true);
                setIsLoadingReviews(true);
                setError(null);
                setReviewError(null);

                const [bookData, reviewData] = await Promise.all([
                    bookService.getBookById(id),
                    reviewService.getReviews(id),
                ]);

                setBook(bookData);
                setReviews(reviewData);
            } catch (loadError) {
                setError(loadError.message);
            } finally {
                setIsLoading(false);
                setIsLoadingReviews(false);
            }
        };

        loadBookPage();
    }, [id]);

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this book?')) {
            return;
        }

        try {
            await bookService.deleteBook(id);
            navigate('/books');
        } catch (deleteError) {
            window.alert(`Failed to delete: ${deleteError.message}`);
        }
    };

    const handleReviewChange = (event) => {
        const { name, value } = event.target;

        setReviewForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    const handleReviewSubmit = async (event) => {
        event.preventDefault();
        if (!reviewForm.rating) {
            setReviewError('Please select a rating.');
            return;
        }
        setIsSubmittingReview(true);
        setReviewError(null);

        try {
            const createdReview = await reviewService.createReview(id, {
                rating: Number(reviewForm.rating),
                comment: reviewForm.comment || null,
            });

            setReviews((previous) => [createdReview, ...previous]);
            setReviewForm({
                rating: '',
                comment: '',
            });
        } catch (submitError) {
            setReviewError(submitError.message);
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const handleDeleteReview = async (reviewId) => {
        if (!window.confirm('Are you sure you want to delete this review?')) {
            return;
        }

        setDeletingReviewId(reviewId);
        setReviewError(null);

        try {
            await reviewService.deleteReview(reviewId);

            setReviews((previous) =>
                previous.filter((review) => review.id !== reviewId),
            );
        } catch (deleteError) {
            setReviewError(deleteError.message);
        } finally {
            setDeletingReviewId(null);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-muted/30">
                <p className="py-12 text-center text-sm text-muted-foreground">
                    Loading book details...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-muted/30">
                <div
                    className="mx-auto max-w-3xl px-4 py-12 text-center text-sm text-destructive"
                    role="alert"
                >
                    Error: {error}
                </div>
            </div>
        );
    }

    if (!book) {
        return (
            <div className="min-h-screen bg-muted/30">
                <p className="py-12 text-center text-sm text-muted-foreground">
                    Book not found.
                </p>
            </div>
        );
    }

    const progress =
        book.pages_total > 0
            ? Math.min((book.pages_read / book.pages_total) * 100, 100)
            : 0;

    return (
        <div className="min-h-screen bg-muted/30">

            <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
                <Button
                    variant="ghost"
                    className="mb-4"
                    onClick={() => navigate('/books')}
                >
                    <ArrowLeft />
                    Back to library
                </Button>

                <Card>
                    <CardHeader className="border-b">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <CardTitle className="text-2xl">
                                    {book.title}
                                </CardTitle>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    by {book.author}
                                </p>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        navigate(`/books/${id}/edit`)
                                    }
                                >
                                    <Pencil />
                                    Edit
                                </Button>

                                <Button
                                    variant="destructive"
                                    onClick={handleDelete}
                                >
                                    <Trash2 />
                                    Delete
                                </Button>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-6">
                        <div className="flex flex-wrap gap-2">
                            <Badge variant="secondary">
                                {book.genre || 'No genre'}
                            </Badge>
                            <Badge variant="outline">
                                {book.status.replace(/_/g, ' ')}
                            </Badge>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Volume
                                </p>
                                <p className="font-medium">
                                    {book.volume || 'N/A'}
                                </p>
                            </div>

                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Rating
                                </p>
                                <p className="font-medium">
                                    {book.rating
                                        ? '⭐'.repeat(book.rating)
                                        : 'Unrated'}
                                </p>
                            </div>
                        </div>

                        <section className="space-y-3 rounded-lg bg-muted/50 p-4">
                            <div className="flex items-center justify-between">
                                <p className="font-medium">
                                    Reading progress
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {book.pages_read} /{' '}
                                    {book.pages_total || '?'} pages
                                </p>
                            </div>
                            <Progress value={progress} />
                        </section>

                        <section className="space-y-2">
                            <h2 className="font-medium">Notes</h2>
                            <p className="whitespace-pre-wrap rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                                {book.notes || 'No notes added yet.'}
                            </p>
                        </section>
                    </CardContent>
                </Card>

                <section className="mt-6 space-y-4">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="size-5 text-primary" />
                        <h2 className="text-xl font-semibold">Reviews</h2>
                    </div>

                    {isAuthenticated && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Write a review
                                </CardTitle>
                            </CardHeader>

                            <CardContent>
                                {reviewError && (
                                    <div
                                        className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                                        role="alert"
                                    >
                                        {reviewError}
                                    </div>
                                )}

                                <form className="space-y-4" onSubmit={handleReviewSubmit}>
                                    <StarRating
                                        value={reviewForm.rating}
                                        onChange={(rating) =>
                                            setReviewForm((previous) => ({
                                                ...previous,
                                                rating,
                                            }))
                                        }
                                    />

                                    <div className="space-y-2">
                                        <Label htmlFor="review-comment">Comment</Label>
                                        <Textarea
                                            id="review-comment"
                                            name="comment"
                                            value={reviewForm.comment}
                                            onChange={handleReviewChange}
                                            placeholder="Share your thoughts about this book"
                                        />
                                    </div>

                                    <Button type="submit" disabled={isSubmittingReview}>
                                        <Send />
                                        {isSubmittingReview ? 'Submitting...' : 'Submit review'}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    )}

                    {isLoadingReviews ? (
                        <p className="py-6 text-center text-sm text-muted-foreground">
                            Loading reviews...
                        </p>
                    ) : reviews.length === 0 ? (
                        <Card>
                            <CardContent className="py-8 text-center text-sm text-muted-foreground">
                                No reviews yet.
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {reviews.map((review) => (
                                <Card key={review.id}>
                                    <CardHeader>
                                        <div className="flex items-center justify-between gap-4">
                                            <CardTitle className="text-base">
                                                {review.reviewer?.username || 'Anonymous'}
                                            </CardTitle>

                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary">
                                                    {'⭐'.repeat(review.rating)}
                                                </Badge>

                                                {currentUser?.username === review.reviewer?.username && (
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        onClick={() => handleDeleteReview(review.id)}
                                                        disabled={deletingReviewId === review.id}
                                                    >
                                                        <Trash2 />
                                                        {deletingReviewId === review.id
                                                            ? 'Deleting...'
                                                            : 'Delete'}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>

                                    <CardContent>
                                        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                                            {review.comment || 'No comment provided.'}
                                        </p>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
};

export default BookDetailPage;
