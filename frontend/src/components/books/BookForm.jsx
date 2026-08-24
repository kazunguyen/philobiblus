import React, { useState, useEffect } from 'react';
import { bookService } from '../../services/bookServices';

const BookForm = ({ isOpen, onClose, bookToEdit, onSaveSuccess }) => {
    const [formData, setFormData] = useState({
        title: '', author: '', genre: '', status: 'want_to_read',
        rating: '', pages_total: '', pages_read: 0, notes: ''
    });

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Populate form data when editing an existing book
    useEffect(() => {
        if (bookToEdit) {
            setFormData({
                title: bookToEdit.title || '',
                author: bookToEdit.author || '',
                genre: bookToEdit.genre || '',
                status: bookToEdit.status || 'want_to_read',
                rating: bookToEdit.rating || '',
                pages_total: bookToEdit.pages_total || '',
                pages_read: bookToEdit.pages_read || 0,
                notes: bookToEdit.notes || ''
            });
        } else {
            resetForm();
        }
    }, [bookToEdit, isOpen]);

    const resetForm = () => {
        setFormData({
            title: '', author: '', genre: '', status: 'want_to_read',
            rating: '', pages_total: '', pages_read: 0, notes: ''
        });
        setError(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Convert numerical inputs to integers to prevent API validation errors
        const parsedValue = ['rating', 'pages_total', 'pages_read'].includes(name)
            ? (value === '' ? '' : parseInt(value, 10))
            : value;

        setFormData((prev) => ({ ...prev, [name]: parsedValue }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        // Clean up empty optional fields to prevent sending empty strings instead of null
        const payload = { ...formData };
        if (payload.rating === '') payload.rating = null;
        if (payload.pages_total === '') payload.pages_total = null;

        try {
            if (bookToEdit) {
                await bookService.updateBook(bookToEdit.id, payload);
            } else {
                await bookService.createBook(payload);
            }
            onSaveSuccess();
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <h2>{bookToEdit ? 'Edit Book' : 'Add New Book'}</h2>

                {error && <div style={styles.error}>{error}</div>}

                <form onSubmit={handleSubmit} style={styles.form}>
                    <input name="title" placeholder="Title *" value={formData.title} onChange={handleChange} required style={styles.input} />
                    <input name="author" placeholder="Author *" value={formData.author} onChange={handleChange} required style={styles.input} />
                    <input name="genre" placeholder="Genre" value={formData.genre} onChange={handleChange} style={styles.input} />

                    <select name="status" value={formData.status} onChange={handleChange} style={styles.input}>
                        <option value="want_to_read">Want to Read</option>
                        <option value="reading">Reading</option>
                        <option value="completed">Completed</option>
                        <option value="dropped">Dropped</option>
                    </select>

                    <div style={styles.row}>
                        <input name="pages_read" type="number" min="0" placeholder="Pages Read" value={formData.pages_read} onChange={handleChange} style={styles.inputHalf} />
                        <input name="pages_total" type="number" min="0" placeholder="Total Pages" value={formData.pages_total} onChange={handleChange} style={styles.inputHalf} />
                    </div>

                    <input name="rating" type="number" min="1" max="5" placeholder="Rating (1-5)" value={formData.rating} onChange={handleChange} style={styles.input} />

                    <textarea name="notes" placeholder="Notes" value={formData.notes} onChange={handleChange} style={{ ...styles.input, height: '60px' }} />

                    <div style={styles.buttonGroup}>
                        <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
                        <button type="submit" disabled={isLoading} style={styles.submitBtn}>
                            {isLoading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const styles = {
    overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    modal: { backgroundColor: 'white', padding: '24px', borderRadius: '8px', width: '400px', maxHeight: '90vh', overflowY: 'auto', fontFamily: 'sans-serif' },
    form: { display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' },
    input: { padding: '8px', borderRadius: '4px', border: '1px solid #ccc' },
    row: { display: 'flex', gap: '12px' },
    inputHalf: { flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' },
    buttonGroup: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' },
    cancelBtn: { padding: '8px 16px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#f8f9fa' },
    submitBtn: { padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', backgroundColor: '#007bff', color: 'white' },
    error: { color: '#721c24', backgroundColor: '#f8d7da', padding: '8px', borderRadius: '4px' }
};

export default BookForm;