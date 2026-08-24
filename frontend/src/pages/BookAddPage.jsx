import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookService } from '../services/bookServices';
import Navbar from '../components/layout/Navbar';

const GENRES = [
    "Action", "Adventure", "Comedy", "Drama", "Fantasy",
    "Horror", "Mystery", "Romance", "Science Fiction",
    "Slice of Life", "Sports", "Supernatural", "Thriller", "Other"
];

const BookAddPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        title: '', author: '', genre: GENRES[0], status: 'want_to_read',
        rating: '', volume: '', pages_total: '', pages_read: 0, notes: '', cover_url: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const parsedValue = ['rating', 'volume', 'pages_total', 'pages_read'].includes(name)
            ? (value === '' ? '' : parseInt(value, 10))
            : value;
        setFormData((prev) => ({ ...prev, [name]: parsedValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const payload = { ...formData };
        if (payload.rating === '') payload.rating = null;
        if (payload.volume === '') payload.volume = null;
        if (payload.pages_total === '') payload.pages_total = null;
        if (payload.pages_read === '') payload.pages_read = 0;
        if (payload.cover_url === '') payload.cover_url = null;

        try {
            await bookService.createBook(payload);
            navigate('/books');
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <Navbar />
            <div style={{ padding: '24px 32px', maxWidth: '600px', margin: '0 auto' }}>
                <button onClick={() => navigate('/books')} style={{ marginBottom: '16px', background: 'none', border: 'none', color: '#007bff', cursor: 'pointer' }}>&larr; Back</button>
                <div style={{ backgroundColor: '#fff', padding: '24px', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                    <h2>Add New Book</h2>
                    {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <input name="title" placeholder="Title *" value={formData.title} onChange={handleChange} required style={styles.input} />
                        <input name="author" placeholder="Author *" value={formData.author} onChange={handleChange} required style={styles.input} />
                        <input name="cover_url" placeholder="Cover Image URL" value={formData.cover_url} onChange={handleChange} style={styles.input} />

                        <div style={{ display: 'flex', gap: '12px' }}>
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
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <input name="volume" type="number" min="1" placeholder="Volume" value={formData.volume} onChange={handleChange} style={styles.inputHalf} />
                            <input name="rating" type="number" min="1" max="5" placeholder="Rating" value={formData.rating} onChange={handleChange} style={styles.inputHalf} />
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <input name="pages_read" type="number" min="0" placeholder="Pages Read" value={formData.pages_read} onChange={handleChange} style={styles.inputHalf} />
                            <input name="pages_total" type="number" min="0" placeholder="Total Pages" value={formData.pages_total} onChange={handleChange} style={styles.inputHalf} />
                        </div>
                        <textarea name="notes" placeholder="Notes" value={formData.notes} onChange={handleChange} style={{ ...styles.input, height: '80px' }} />
                        <button type="submit" disabled={isLoading} style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save Book</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

const styles = {
    input: { padding: '8px', borderRadius: '4px', border: '1px solid #ccc' },
    inputHalf: { flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }
};

export default BookAddPage;