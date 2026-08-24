import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { bookService } from '../services/bookServices';
import BookForm from '../components/books/BookForm';
import Navbar from '../components/layout/Navbar';

const BookDetailPage = () => {
    // Extract book ID from the URL parameters
    const { id } = useParams();
    const navigate = useNavigate();

    const [book, setBook] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // State to manage the edit modal
    const [isFormOpen, setIsFormOpen] = useState(false);

    useEffect(() => {
        fetchBookDetails();
    }, [id]);

    const fetchBookDetails = async () => {
        try {
            setIsLoading(true);
            const data = await bookService.getBookById(id);
            setBook(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this book?')) return;

        try {
            await bookService.deleteBook(id);
            // Navigate back to the library after successful deletion to avoid showing a 404 page
            navigate('/dashboard');
        } catch (err) {
            alert(`Failed to delete: ${err.message}`);
        }
    };

    if (isLoading) return <div style={styles.message}>Loading book details...</div>;
    if (error) return <div style={styles.error}>Error: {error}</div>;
    if (!book) return <div style={styles.message}>Book not found.</div>;

    return (
        <div>
            <Navbar />
            <div style={styles.container}>
                <button onClick={() => navigate('/dashboard')} style={styles.backBtn}>
                    &larr; Back to Library
                </button>

                <div style={styles.header}>
                    <h2>{book.title}</h2>
                    <div style={styles.actionGroup}>
                        <button onClick={() => navigate(`/books/${id}/edit`)} style={styles.editBtn}>Edit</button>
                        <button onClick={handleDelete} style={styles.deleteBtn}>Delete</button>
                    </div>
                </div>

                <div style={styles.detailsCard}>
                    <p><strong>Author:</strong> {book.author}</p>
                    <p><strong>Genre:</strong> {book.genre || 'N/A'}</p>
                    <p><strong>Status:</strong> {book.status.replace(/_/g, ' ')}</p>
                    <p><strong>Rating:</strong> {book.rating ? '⭐'.repeat(book.rating) : 'Unrated'}</p>

                    <div style={styles.progressSection}>
                        <p><strong>Reading Progress:</strong></p>
                        <p>{book.pages_read} out of {book.pages_total || '?'} pages read</p>
                    </div>

                    <div style={styles.notesSection}>
                        <p><strong>Notes:</strong></p>
                        <p style={styles.notesText}>{book.notes || 'No notes added yet.'}</p>
                    </div>
                </div>

                {/* Reuse the BookForm for editing the current book directly from details page */}
                <BookForm
                    isOpen={isFormOpen}
                    onClose={() => setIsFormOpen(false)}
                    bookToEdit={book}
                    onSaveSuccess={fetchBookDetails}
                />
            </div>
        </div>
    );
};

const styles = {
    container: { padding: '24px 32px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto' },
    message: { padding: '32px', textAlign: 'center', fontFamily: 'sans-serif' },
    error: { color: '#721c24', padding: '32px', textAlign: 'center', fontFamily: 'sans-serif' },
    backBtn: { background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', marginBottom: '16px', fontSize: '14px', padding: 0 },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '16px', marginBottom: '24px' },
    actionGroup: { display: 'flex', gap: '8px' },
    editBtn: { padding: '8px 16px', backgroundColor: '#ffc107', color: '#212529', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    deleteBtn: { padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    detailsCard: { backgroundColor: '#f8f9fa', padding: '24px', borderRadius: '8px', border: '1px solid #dee2e6' },
    progressSection: { marginTop: '16px', padding: '12px', backgroundColor: '#e9ecef', borderRadius: '4px' },
    notesSection: { marginTop: '24px' },
    notesText: { whiteSpace: 'pre-wrap', backgroundColor: '#fff', padding: '16px', border: '1px solid #dee2e6', borderRadius: '4px', marginTop: '8px' }
};

export default BookDetailPage;