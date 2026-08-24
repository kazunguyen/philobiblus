import React, { useState, useEffect } from 'react';
import { bookService } from '../services/bookServices';
import BookCard from '../components/books/BookCard';

const DashboardPage = () => {
    const [books, setBooks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchBooks();
    }, []);

    const fetchBooks = async () => {
        try {
            setIsLoading(true);
            const data = await bookService.getBooks();
            setBooks(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this book?')) return;
        try {
            await bookService.deleteBook(id);
            // Remove the deleted book from local state to avoid refetching the entire list
            setBooks((prev) => prev.filter((book) => book.id !== id));
        } catch (err) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    return (
        <div style={styles.container}>
            <h2>My Library</h2>

            {error && <div style={styles.error}>{error}</div>}

            {isLoading ? (
                <p>Loading books...</p>
            ) : books.length === 0 ? (
                <p style={styles.empty}>No books yet. Start by adding one!</p>
            ) : (
                <div style={styles.grid}>
                    {books.map((book) => (
                        <BookCard
                            key={book.id}
                            book={book}
                            onDelete={() => handleDelete(book.id)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const styles = {
    container: { padding: '24px 32px', fontFamily: 'sans-serif' },
    grid: { display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '16px' },
    error: {
        color: '#721c24', backgroundColor: '#f8d7da',
        padding: '10px 16px', borderRadius: '4px', marginBottom: '16px'
    },
    empty: { color: '#6c757d', marginTop: '32px' }
};

export default DashboardPage;