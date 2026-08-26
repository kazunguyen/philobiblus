import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/layout/Navbar';
import BookCard from '../components/books/BookCard';
import { userService } from '../services/userServices';
import { CalendarDays, UserRound } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
        <div className="min-h-screen bg-muted/30">
            <Navbar />
            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                                <UserRound className="size-6 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-2xl">{profile.user.username}</CardTitle>
                                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <CalendarDays className="size-4" />
                                    Joined: {profile.user.created_at || 'N/A'}
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                <section className="space-y-4">
                    <h2 className="text-xl font-semibold">Public Library</h2>
                    {profile.books.length > 0 ? (
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {profile.books.map((book) => (
                                <BookCard
                                    key={book.id}
                                    book={book}
                                    isReadOnly
                                />
                            ))}
                        </div>
                    ) : (
                        <Card>
                            <CardContent className="py-10 text-center text-sm text-muted-foreground">
                                This user has not added any books yet.
                            </CardContent>
                        </Card>
                    )}
                </section>
            </main>
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