import React, { useEffect, useState } from 'react';
import BookCard from '../components/books/BookCard';
import { bookService } from '../services/bookServices';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const PublicDashboardPage = () => {
    const [books, setBooks] = useState([]);
    const [filters, setFilters] = useState({ genre: '', search: '' });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

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
                <div className="mb-6 space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight">Public Dashboard</h1>
                    <p className="text-muted-foreground">
                        Explore books shared by readers across Philobiblus.
                    </p>
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
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {books.map((book) => (
                            <BookCard key={book.id} book={book} isReadOnly />
                        ))}
                    </div>
                )}
            </main>
        </div>

    );
};



export default PublicDashboardPage;
