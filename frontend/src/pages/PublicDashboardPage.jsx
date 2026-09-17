import React, { useEffect, useState } from 'react';
import BookCard from '../components/books/BookCard';
import BookListItem from '../components/books/BookListItem';
import BookViewToggle from '../components/books/BookViewToggle';
import { bookService } from '../services/bookServices';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSettings } from '../context/SettingsContext';

const PublicDashboardPage = () => {
    const [books, setBooks] = useState([]);
    const [filters, setFilters] = useState({ genre: '', search: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const { defaultBookView } = useSettings();
    const [bookView, setBookView] = useState(defaultBookView);
    const { isAuthenticated } = useAuth();

    const [recommendations, setRecommendations] = useState([]);
    const [isRecommendationsLoading, setIsRecommendationsLoading] = useState(false);
    const [hasRecommendationError, setHasRecommendationError] = useState(false);

    useEffect(() => {
        if (isAuthenticated) {
            fetchRecommendations();
        } else {
            setRecommendations([]);
        }
    }, [isAuthenticated]);

    const fetchRecommendations = async () => {
        try {
            setIsRecommendationsLoading(true);
            setHasRecommendationError(false);
            const data = await bookService.getRecommendationsForMe(5);
            setRecommendations(Array.isArray(data.books) ? data.books : []);
            if (import.meta.env.DEV && data.source) {
                console.debug('[PublicDashboard] Recommendation source:', data.source);
            }
        } catch (err) {
            setRecommendations([]);
            setHasRecommendationError(true);
        } finally {
            setIsRecommendationsLoading(false);
        }
    };

    useEffect(() => {
        setBookView(defaultBookView);
    }, [defaultBookView]);

    useEffect(() => {
        fetchPublicBooks();
    }, []);

    const fetchPublicBooks = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await bookService.getPublicBooks(filters);
            setBooks(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (event) => {
        const { name, value } = event.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        fetchPublicBooks();
    };

    return (
        <div className="min-h-screen bg-muted/30">
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-semibold tracking-tight">Public Dashboard</h1>
                        <p className="text-muted-foreground">
                            Explore books shared by readers across Philobiblus.
                        </p>
                    </div>
                    <BookViewToggle view={bookView} onViewChange={setBookView} />
                </div>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Find books</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="grid gap-3 md:grid-cols-[1fr_240px_auto]"
                            onSubmit={handleSubmit}
                        >
                            <Input
                                name="search"
                                placeholder="Search by title or author"
                                value={filters.search}
                                onChange={handleChange}
                            />
                            <Input
                                name="genre"
                                placeholder="Filter by genre"
                                value={filters.genre}
                                onChange={handleChange}
                            />
                            <Button type="submit">
                                <Search />
                                Search
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <div className={isAuthenticated ? 'grid gap-6 lg:grid-cols-[minmax(17.5rem,0.8fr)_minmax(0,2.4fr)] lg:items-start' : ''}>
                    {isAuthenticated && (
                        <aside className="lg:sticky lg:top-20">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Sparkles className="text-yellow-500" />
                                        For you
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {isRecommendationsLoading ? (
                                        <p className="text-muted-foreground">Loading recommendations...</p>
                                    ) : hasRecommendationError ? (
                                        <p className="text-sm text-destructive">Failed to load recommendations.</p>
                                    ) : recommendations.length === 0 ? (
                                        <p className="text-muted-foreground">Start reading to get personalized recommendations.</p>
                                    ) : (
                                        <div className={bookView === 'grid'
                                            ? 'grid justify-items-center gap-5'
                                            : 'space-y-3'}>
                                            {recommendations.map((book) => (
                                                bookView === 'grid' ? (
                                                    <BookCard key={book.id} book={book} isReadOnly />
                                                ) : (
                                                    <BookListItem key={book.id} book={book} isReadOnly />
                                                )
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </aside>
                    )}

                    <section className="min-w-0">
                        <h2 className="mb-4 text-xl font-semibold">Public books</h2>

                        {error && (
                            <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        {isLoading ? (
                            <p className="text-muted-foreground">Loading public books...</p>
                        ) : books.length === 0 ? (
                            <p className="text-muted-foreground">No public books found.</p>
                        ) : (
                            <div className={bookView === 'grid'
                                ? 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3'
                                : 'space-y-3'}>
                                {books.map((book) => (
                                    bookView === 'grid' ? (
                                        <BookCard key={book.id} book={book} isReadOnly />
                                    ) : (
                                        <BookListItem key={book.id} book={book} isReadOnly />
                                    )
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </div>

    );
};



export default PublicDashboardPage;
