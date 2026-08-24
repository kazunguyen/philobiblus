import React from 'react';
import { useNavigate } from 'react-router-dom';

const BookCard = ({ book, onDelete, onEdit }) => {
    const navigate = useNavigate();
    // Calculate completion percentage for visual tracking
    const progressPercent = book.pages_total
        ? Math.round((book.pages_read / book.pages_total) * 100)
        : 0;

    return (
        <div style={styles.card}>
            <h3 style={styles.title}>{book.title}</h3>
            <p><strong>Author:</strong> {book.author}</p>
            <p><strong>Status:</strong> {book.status.replace(/_/g, ' ')}</p>
            {book.genre && <p><strong>Genre:</strong> {book.genre}</p>}
            {book.rating && <p><strong>Rating:</strong> {'⭐'.repeat(book.rating)}</p>}

            {book.pages_total > 0 && (
                <>
                    <div style={styles.progressContainer}>
                        <div style={{ ...styles.progressBar, width: `${progressPercent}%` }} />
                    </div>
                    <p style={styles.progressText}>{book.pages_read} / {book.pages_total} pages ({progressPercent}%)</p>
                </>
            )}

            <div style={styles.actionRow}>
                <button onClick={() => navigate(`/books/${book.id}`)} style={styles.viewBtn}>View</button>
                <button onClick={onEdit} style={styles.editBtn}>Edit</button>
                <button onClick={onDelete} style={styles.deleteBtn}>Delete</button>
            </div>
        </div>
    );
};

const styles = {
    card: {
        border: '1px solid #dee2e6', borderRadius: '8px', padding: '16px',
        width: '260px', backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
        fontFamily: 'sans-serif', display: 'flex', flexDirection: 'column', gap: '4px'
    },
    title: { margin: '0 0 8px', fontSize: '16px', color: '#212529' },
    progressContainer: {
        height: '8px', width: '100%', backgroundColor: '#e9ecef',
        borderRadius: '4px', marginTop: '8px'
    },
    progressBar: { height: '100%', backgroundColor: '#28a745', borderRadius: '4px' },
    progressText: { fontSize: '12px', color: '#6c757d', margin: '4px 0 0' },
    deleteBtn: {
        marginTop: '12px', padding: '6px 12px', backgroundColor: '#dc3545',
        color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer',
        alignSelf: 'flex-start'
    },
    actionRow: { display: 'flex', gap: '8px', marginTop: '12px' },
    editBtn: {
        padding: '6px 12px', backgroundColor: '#ffc107', color: '#212529',
        border: 'none', borderRadius: '4px', cursor: 'pointer'
    },
    viewBtn: {
        padding: '6px 12px', backgroundColor: '#17a2b8', color: 'white',
        border: 'none', borderRadius: '4px', cursor: 'pointer'
    },
};

export default BookCard;