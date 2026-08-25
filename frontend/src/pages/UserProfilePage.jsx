import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import BookCard from '../components/books/BookCard';
import { userService } from '../services/userServices';

const UserProfilePage = () => {
    const { username } = useParams();
    const [profile, setProfile] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchUserProfile();
    }, [username]);

    const fetchUserProfile = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const data = await userService.getUserProfile(username);
            setProfile(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div style={styles.message}>Loading user profile...</div>;
    if (error) return <div style={styles.error}>Error: {error}</div>;

    return (
        <div>
            <Navbar />
            <div style={styles.container}>
                <section style={styles.profileHeader}>
                    <h2>{profile.user.username}</h2>
                    <p>Joined: {profile.user.created_at || 'N/A'}</p>
                </section>

                <h3>Public Library</h3>
                {profile.books.length === 0 ? (
                    <p style={styles.empty}>This user has no books yet.</p>
                ) : (
                    <div style={styles.grid}>
                        {profile.books.map((book) => (
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
    message: { padding: '32px', textAlign: 'center', fontFamily: 'sans-serif' },
    error: { color: '#721c24', padding: '32px', textAlign: 'center', fontFamily: 'sans-serif' },
    profileHeader: { borderBottom: '1px solid #dee2e6', marginBottom: '24px', paddingBottom: '16px' },
    grid: { display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '16px' },
    empty: { color: '#6c757d', marginTop: '16px' }
};

export default UserProfilePage;