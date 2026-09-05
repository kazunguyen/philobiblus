import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    BookOpen,
    BookOpenCheck,
    Library,
    Plus,
    Star,
    TrendingUp,
} from 'lucide-react';
import { bookService } from '../services/bookServices';
import BookCard from '../components/books/BookCard';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

const INITIAL_STATS = {
    total_books: 0,
    want_to_read: 0,
    reading: 0,
    completed: 0,
    dropped: 0,
    total_pages: 0,
    total_pages_read: 0,
    average_rating: 0,
    reading_progress: 0,
};

const STAT_CARDS = [
    {
        key: 'total_books',
        label: 'Total books',
        icon: Library,
    },
    {
        key: 'reading',
        label: 'Currently reading',
        icon: BookOpen,
    },
    {
        key: 'completed',
        label: 'Completed',
        icon: BookOpenCheck,
    },
    {
        key: 'average_rating',
        label: 'Average rating',
        icon: Star,
    },
];

const DashboardPage = () => {
    const navigate = useNavigate();

    const [books, setBooks] = useState([]);
    const [stats, setStats] = useState(INITIAL_STATS);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadDashboard = async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [bookStats, userBooks] = await Promise.all([
                bookService.getBookStats(),
                bookService.getBooks(),
            ]);

            setStats(bookStats);
            setBooks(userBooks);
        } catch (loadError) {
            setError(loadError.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this book?')) {
            return;
        }

        try {
            await bookService.deleteBook(id);
            await loadDashboard();
        } catch (deleteError) {
            window.alert(`Failed to delete: ${deleteError.message}`);
        }
    };

    const topRatedBooks = [...books]
        .filter((book) => book.rating)
        .sort((firstBook, secondBook) => secondBook.rating - firstBook.rating)
        .slice(0, 4);

    return (
        <div className="min-h-screen bg-muted/30">
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold">
                            Statistics
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Track your reading activity and personal library.
                        </p>
                    </div>

                    <Button onClick={() => navigate('/books/add')}>
                        <Plus />
                        Add Book
                    </Button>
                </div>

                {error && (
                    <div
                        className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                        Loading statistics...
                    </p>
                ) : (
                    <>
                        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {STAT_CARDS.map(({ key, label, icon: Icon }) => (
                                <Card key={key}>
                                    <CardContent className="flex items-center justify-between p-5">
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                {label}
                                            </p>
                                            <p className="mt-1 text-2xl font-semibold">
                                                {key === 'average_rating'
                                                    ? stats[key].toFixed(1)
                                                    : stats[key]}
                                            </p>
                                        </div>
                                        <Icon className="size-7 text-primary" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <Card className="mb-8">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <TrendingUp className="size-5" />
                                    Reading progress
                                </CardTitle>
                            </CardHeader>

                            <CardContent className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span>
                                        {stats.total_pages_read} /{' '}
                                        {stats.total_pages} pages
                                    </span>
                                    <span>
                                        {Math.round(stats.reading_progress)}%
                                    </span>
                                </div>

                                <Progress value={stats.reading_progress} />

                                <div className="grid gap-3 text-sm sm:grid-cols-4">
                                    <span>
                                        Want to Read: {stats.want_to_read}
                                    </span>
                                    <span>Reading: {stats.reading}</span>
                                    <span>
                                        Completed: {stats.completed}
                                    </span>
                                    <span>Dropped: {stats.dropped}</span>
                                </div>
                            </CardContent>
                        </Card>

                        <section className="mb-8">
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-xl font-semibold">
                                    Recently added
                                </h2>

                                <Button
                                    variant="outline"
                                    onClick={() => navigate('/books')}
                                >
                                    View library
                                </Button>
                            </div>

                            {books.length === 0 ? (
                                <Card>
                                    <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                        No books found. Add your first book.
                                    </CardContent>
                                </Card>
                            ) : (
                                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {books.slice(0, 4).map((book) => (
                                        <BookCard
                                            key={book.id}
                                            book={book}
                                            onDelete={() => handleDelete(book.id)}
                                            onEdit={() =>
                                                navigate(
                                                    `/books/${book.id}/edit`,
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            )}
                        </section>

                        {topRatedBooks.length > 0 && (
                            <section>
                                <h2 className="mb-4 text-xl font-semibold">
                                    Top rated books
                                </h2>

                                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                    {topRatedBooks.map((book) => (
                                        <BookCard
                                            key={book.id}
                                            book={book}
                                            onDelete={() => handleDelete(book.id)}
                                            onEdit={() =>
                                                navigate(
                                                    `/books/${book.id}/edit`,
                                                )
                                            }
                                        />
                                    ))}
                                </div>
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default DashboardPage;
