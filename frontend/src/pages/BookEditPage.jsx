import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { bookService } from '../services/bookServices';
import Navbar from '../components/layout/Navbar';

const GENRES = [
    "Action", "Adventure", "Comedy", "Drama", "Fantasy",
    "Horror", "Mystery", "Romance", "Science Fiction",
    "Slice of Life", "Sports", "Supernatural", "Thriller", "Other"
];

const BookEditPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        title: '', author: '', genre: GENRES[0], status: 'want_to_read',
        rating: '', volume: '', pages_total: '', pages_read: 0, notes: '', cover_url: ''
    });

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);

    // Fetch existing book data to populate the form fields
    useEffect(() => {
        fetchBook();
    }, [id]);

    const fetchBook = async () => {
        try {
            setIsLoading(true);
            const book = await bookService.getBookById(id);
            setFormData({
                title: book.title || '',
                author: book.author || '',
                genre: book.genre || GENRES[0],
                status: book.status || 'want_to_read',
                rating: book.rating || '',
                volume: book.volume || '',
                pages_total: book.pages_total || '',
                pages_read: book.pages_read || 0,
                notes: book.notes || '',
                cover_url: book.cover_url || ''
            });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        const parsedValue = ['rating', 'volume', 'pages_total', 'pages_read'].includes(name)
            ? (value === '' ? '' : parseInt(value, 10))
            : value;
        setFormData((prev) => ({ ...prev, [name]: parsedValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        const payload = { ...formData };
        if (payload.rating === '') payload.rating = null;
        if (payload.volume === '') payload.volume = null;
        if (payload.pages_total === '') payload.pages_total = null;
        if (payload.pages_read === '') payload.pages_read = 0;
        if (payload.cover_url === '') payload.cover_url = null;

        try {
            await bookService.updateBook(id, payload);
            // Navigate back to the details page after a successful update
            navigate(`/books/${id}`);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div style={{ padding: '32px', textAlign: 'center', fontFamily: 'sans-serif' }}>Loading book data...</div>;

    return (
        <div>
            <Navbar />
            <div style={styles.container}>
                {/* Navigate back to previous page in history */}
                <button onClick={() => navigate(-1)} style={styles.backBtn}>
                    &larr; Back
                </button>
                <div style={styles.card}>
                    <h2>Edit Book</h2>
                    {error && <div style={styles.error}>{error}</div>}

                    <form onSubmit={handleSubmit} style={styles.form}>
                        <input name="title" placeholder="Title *" value={formData.title} onChange={handleChange} required style={styles.input} />
                        <input name="author" placeholder="Author *" value={formData.author} onChange={handleChange} required style={styles.input} />
                        <input name="cover_url" placeholder="Cover Image URL" value={formData.cover_url} onChange={handleChange} style={styles.input} />

                        <div style={styles.row}>
                            <select name="genre" value={formData.genre} onChange={handleChange} style={styles.inputHalf}>
                                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                            </select>
                            <select name="status" value={formData.status} onChange={handleChange} style={styles.inputHalf}>
                                <option value="want_to_read">Want to Read</option>
                                <option value="reading">Reading</option>
                                <option value="completed">Completed</option>
                                <option value="dropped">Dropped</option>
                            </select>
                        </div>
                        <div style={styles.row}>
                            <input name="volume" type="number" min="1" placeholder="Volume" value={formData.volume} onChange={handleChange} style={styles.inputHalf} />
                            <input name="rating" type="number" min="1" max="5" placeholder="Rating" value={formData.rating} onChange={handleChange} style={styles.inputHalf} />
                        </div>
                        <div style={styles.row}>
                            <input name="pages_read" type="number" min="0" placeholder="Pages Read" value={formData.pages_read} onChange={handleChange} style={styles.inputHalf} />
                            <input name="pages_total" type="number" min="0" placeholder="Total Pages" value={formData.pages_total} onChange={handleChange} style={styles.inputHalf} />
                        </div>
                        <textarea name="notes" placeholder="Notes" value={formData.notes} onChange={handleChange} style={{ ...styles.input, height: '80px' }} />

                        <button type="submit" disabled={isSaving} style={styles.submitBtn}>
                            {isSaving ? 'Saving...' : 'Update Book'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const styles = {
    container: { padding: '24px 32px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' },
    card: { backgroundColor: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #dee2e6' },
    backBtn: { background: 'none', border: 'none', color: '#007bff', cursor: 'pointer', marginBottom: '16px', fontSize: '14px', padding: 0 },
    form: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' },
    input: { padding: '8px', borderRadius: '4px', border: '1px solid #ccc' },
    row: { display: 'flex', gap: '12px' },
    inputHalf: { flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' },
    submitBtn: { padding: '10px', backgroundColor: '#ffc107', color: '#212529', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
    error: { color: '#721c24', backgroundColor: '#f8d7da', padding: '8px', borderRadius: '4px' }
};

export default BookEditPage;