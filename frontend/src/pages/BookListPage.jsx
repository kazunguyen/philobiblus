import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookService } from '../services/bookServices';
import BookCard from '../components/books/BookCard';
import BookForm from '../components/books/BookForm';
import Navbar from '../components/layout/Navbar';

const BookListPage = () => {
    const navigate = useNavigate();
    const [books, setBooks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Retain modal for quick edits without breaking the user's scroll position on the list
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBook, setEditingBook] = useState(null);

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
        // Prevent accidental permanent data loss
        if (!window.confirm('Are you sure you want to delete this book?')) return;
        try {
            await bookService.deleteBook(id);
            setBooks((prev) => prev.filter((book) => book.id !== id));
        } catch (err) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    const handleEdit = (book) => {
        navigate(`/books/${book.id}/edit`);
    };

    return (
        <div>
            <Navbar />
            <div style={{ padding: '24px 32px', fontFamily: 'sans-serif' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2>All Books</h2>
                    <button onClick={() => navigate('/books/add')} style={styles.addBtn}>+ Add Book</button>
                </div>

                {error && <div style={styles.error}>{error}</div>}

                {isLoading ? (
                    <p>Loading books...</p>
                ) : books.length === 0 ? (
                    <p style={styles.empty}>No books found. Click "+ Add Book" to get started.</p>
                ) : (
                    <div style={styles.grid}>
                        {books.map((book) => (
                            <BookCard
                                key={book.id}
                                book={book}
                                onDelete={() => handleDelete(book.id)}
                                onEdit={() => handleEdit(book)}
                            />
                        ))}
                    </div>
                )}

                <BookForm
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    bookToEdit={editingBook}
                    onSaveSuccess={fetchBooks}
                />
            </div>
        </div>
    );
};

const styles = {
    addBtn: { padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    grid: { display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '16px' },
    error: { color: '#721c24', backgroundColor: '#f8d7da', padding: '10px 16px', borderRadius: '4px', marginBottom: '16px' },
    empty: { color: '#6c757d', marginTop: '32px' }
};

export default BookListPage;