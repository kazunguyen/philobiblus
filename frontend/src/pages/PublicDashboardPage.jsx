import React, { useEffect, useState } from 'react';
import Navbar from '../components/layout/Navbar';
import BookCard from '../components/books/BookCard';
import { bookService } from '../services/bookServices';

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
        <div>
            <Navbar />
            <div style={styles.container}>
                <h2>Public Dashboard</h2>

                <form onSubmit={handleSubmit} style={styles.filters}>
                    <input
                        name="search"
                        placeholder="Search by title or author"
                        value={filters.search}
                        onChange={handleChange}
                        style={styles.input}
                    />
                    <input
                        name="genre"
                        placeholder="Filter by genre"
                        value={filters.genre}
                        onChange={handleChange}
                        style={styles.input}
                    />
                    <button type="submit" style={styles.searchBtn}>Search</button>
                </form>

                {error && <div style={styles.error}>{error}</div>}

                {isLoading ? (
                    <p>Loading public books...</p>
                ) : books.length === 0 ? (
                    <p style={styles.empty}>No public books found.</p>
                ) : (
                    <div style={styles.grid}>
                        {books.map((book) => (
                            <BookCard key={book.id} book={book} isReadOnly />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    container: { padding: '24px 32px', fontFamily: 'sans-serif' },
    filters: { display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' },
    input: { padding: '8px', borderRadius: '4px', border: '1px solid #ccc' },
    searchBtn: { padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
    grid: { display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '16px' },
    error: { color: '#721c24', backgroundColor: '#f8d7da', padding: '10px 16px', borderRadius: '4px', marginBottom: '16px' },
    empty: { color: '#6c757d', marginTop: '32px' }
};

export default PublicDashboardPage;