import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    CalendarDays,
    UserCheck,
    UserMinus,
    UserPlus,
    UserRound,
} from 'lucide-react';
import BookCard from '../components/books/BookCard';
import { useAuth } from '../context/AuthContext';
import { socialService } from '../services/socialServices';
import { userService } from '../services/userServices';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

const UserProfilePage = () => {
    const { username } = useParams();
    const { currentUser, token } = useAuth();

    const [profile, setProfile] = useState(null);
    const [relationship, setRelationship] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRelationshipLoading, setIsRelationshipLoading] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [relationshipError, setRelationshipError] = useState(null);

    const isOwnProfile = currentUser?.username === username;
    const friendship = relationship?.friendship;
    const isFriendRequestSender = friendship?.requested_by?.id === currentUser?.id;

    useEffect(() => {
        const fetchUserProfile = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const data = await userService.getUserProfile(username);
                setProfile(data);
            } catch (fetchError) {
                setError(fetchError.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserProfile();
    }, [username]);

    useEffect(() => {
        const fetchRelationship = async () => {
            if (!token || !currentUser || isOwnProfile) {
                setRelationship(null);
                setRelationshipError(null);
                return;
            }

            try {
                setIsRelationshipLoading(true);
                setRelationshipError(null);

                const data = await socialService.getRelationship(
                    username,
                    token,
                );
                setRelationship(data);
            } catch (fetchError) {
                setRelationshipError(fetchError.message);
            } finally {
                setIsRelationshipLoading(false);
            }
        };

        fetchRelationship();
    }, [currentUser, isOwnProfile, token, username]);

    const refreshRelationship = async () => {
        const data = await socialService.getRelationship(username, token);
        setRelationship(data);
    };

    const handleSocialAction = async (action) => {
        try {
            setIsActionLoading(true);
            setRelationshipError(null);

            await action();
            await refreshRelationship();
        } catch (actionError) {
            setRelationshipError(actionError.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const renderFriendshipButton = () => {
        if (!friendship) {
            return (
                <Button
                    disabled={isActionLoading}
                    onClick={() => handleSocialAction(() => (
                        socialService.createFriendRequest(username, token)
                    ))}
                >
                    <UserPlus />
                    Add friend
                </Button>
            );
        }

        if (friendship.status === 'pending' && isFriendRequestSender) {
            return (
                <Button
                    variant="outline"
                    disabled={isActionLoading}
                    onClick={() => handleSocialAction(() => (
                        socialService.removeFriendship(friendship.id, token)
                    ))}
                >
                    <UserMinus />
                    Cancel request
                </Button>
            );
        }

        if (friendship.status === 'pending') {
            return (
                <div className="flex flex-wrap gap-2">
                    <Button
                        disabled={isActionLoading}
                        onClick={() => handleSocialAction(() => (
                            socialService.acceptFriendRequest(friendship.id, token)
                        ))}
                    >
                        <UserCheck />
                        Accept request
                    </Button>

                    <Button
                        variant="outline"
                        disabled={isActionLoading}
                        onClick={() => handleSocialAction(() => (
                            socialService.removeFriendship(friendship.id, token)
                        ))}
                    >
                        Decline
                    </Button>
                </div>
            );
        }

        return (
            <Button
                variant="outline"
                disabled={isActionLoading}
                onClick={() => handleSocialAction(() => (
                    socialService.removeFriendship(friendship.id, token)
                ))}
            >
                <UserMinus />
                Remove friend
            </Button>
        );
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-muted/30">
                <p className="py-12 text-center text-sm text-muted-foreground">
                    Loading user profile...
                </p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-muted/30">
                <div
                    className="mx-auto max-w-7xl px-4 py-12 text-center text-sm text-destructive"
                    role="alert"
                >
                    Error: {error}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-muted/30">

            <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                                    <UserRound className="size-6 text-primary" />
                                </div>

                                <div>
                                    <CardTitle className="text-2xl">
                                        {profile.user.username}
                                    </CardTitle>
                                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CalendarDays className="size-4" />
                                        Joined: {profile.user.created_at || 'N/A'}
                                    </p>
                                </div>
                            </div>

                            {!isOwnProfile && token && (
                                <div className="flex flex-wrap gap-2">
                                    {isRelationshipLoading ? (
                                        <p className="text-sm text-muted-foreground">
                                            Loading relationship...
                                        </p>
                                    ) : (
                                        <>
                                            <Button
                                                variant={
                                                    relationship?.is_following
                                                        ? 'outline'
                                                        : 'default'
                                                }
                                                disabled={isActionLoading}
                                                onClick={() => handleSocialAction(() => (
                                                    relationship?.is_following
                                                        ? socialService.unfollowUser(
                                                            username,
                                                            token,
                                                        )
                                                        : socialService.followUser(
                                                            username,
                                                            token,
                                                        )
                                                ))}
                                            >
                                                {relationship?.is_following ? (
                                                    <>
                                                        <UserMinus />
                                                        Unfollow
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserPlus />
                                                        Follow
                                                    </>
                                                )}
                                            </Button>

                                            {renderFriendshipButton()}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {relationshipError && (
                            <p
                                className="pt-3 text-sm text-destructive"
                                role="alert"
                            >
                                {relationshipError}
                            </p>
                        )}
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

export default UserProfilePage;
