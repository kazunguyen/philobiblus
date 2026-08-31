import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { bookService } from '../services/bookServices';
import BookCard from '../components/books/BookCard';
import Navbar from '../components/layout/Navbar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const DashboardPage = () => {
    const navigate = useNavigate();

    const [books, setBooks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchBooks = async () => {
            try {
                setIsLoading(true);
                setError(null);
                const data = await bookService.getBooks();
                setBooks(data);
            } catch (fetchError) {
                setError(fetchError.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBooks();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this book?')) {
            return;
        }

        try {
            await bookService.deleteBook(id);
            setBooks((previous) =>
                previous.filter((book) => book.id !== id)
            );
        } catch (deleteError) {
            window.alert(`Failed to delete: ${deleteError.message}`);
        }
    };

    return (
        <div className="min-h-screen bg-muted/30">
            <Navbar />

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-semibold">
                            My Library
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Manage your personal reading collection.
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
                        Loading books...
                    </p>
                ) : books.length === 0 ? (
                    <Card>
                        <CardContent className="py-10 text-center text-sm text-muted-foreground">
                            No books found. Add your first book to start your
                            library.
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {books.map((book) => (
                            <BookCard
                                key={book.id}
                                book={book}
                                onDelete={() => handleDelete(book.id)}
                                onEdit={() =>
                                    navigate(`/books/${book.id}/edit`)
                                }
                            />
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default DashboardPage;