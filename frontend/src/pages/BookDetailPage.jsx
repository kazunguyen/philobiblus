import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { bookService } from '../services/bookServices';
import Navbar from '../components/layout/Navbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const BookDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [book, setBook] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBookDetails = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await bookService.getBookById(id);
                setBook(data);
            } catch (fetchError) {
                setError(fetchError.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBookDetails();
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

    if (isLoading) {
        return (
            <div className="min-h-screen bg-muted/30">
                <Navbar />
                <p className="py-12 text-center text-sm text-muted-foreground">
                    Loading book details...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-muted/30">
                <Navbar />
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
                <Navbar />
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
            <Navbar />

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
            </main>
        </div>
    );
};

export default BookDetailPage;