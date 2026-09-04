import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, UserMinus, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { socialService } from '../services/socialServices';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

const SocialPage = () => {
    const { currentUser, token } = useAuth();

    const [activeTab, setActiveTab] = useState('requests');
    const [friendRequests, setFriendRequests] = useState([]);
    const [sentFriendRequests, setSentFriendRequests] = useState([]);
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadSocialData = async () => {
        if (!currentUser || !token) {
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const [
                requests,
                sentRequests,
                followerUsers,
                followingUsers,
            ] = await Promise.all([
                socialService.getFriendRequests(token, 'incoming'),
                socialService.getFriendRequests(token, 'outgoing'),
                socialService.getFollowers(currentUser.username, token),
                socialService.getFollowing(currentUser.username, token),
            ]);

            setFriendRequests(requests);
            setSentFriendRequests(sentRequests);
            setFollowers(followerUsers);
            setFollowing(followingUsers);
        } catch (fetchError) {
            setError(fetchError.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSocialData();
    }, [currentUser, token]);

    const handleFriendshipAction = async (friendshipId, action) => {
        try {
            setIsActionLoading(true);
            setError(null);

            if (action === 'accept') {
                await socialService.acceptFriendRequest(friendshipId, token);
            } else {
                await socialService.removeFriendship(friendshipId, token);
            }

            await loadSocialData();
        } catch (actionError) {
            setError(actionError.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const renderUsers = (users, emptyMessage) => {
        if (users.length === 0) {
            return (
                <p className="text-sm text-muted-foreground">
                    {emptyMessage}
                </p>
            );
        }

        return (
            <div className="space-y-3">
                {users.map((user) => (
                    <div
                        key={user.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                    >
                        <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                                <Users className="size-4 text-primary" />
                            </div>

                            <span className="font-medium">
                                {user.username}
                            </span>
                        </div>

                        <Button asChild variant="outline" size="sm">
                            <Link to={`/users/${user.username}`}>
                                View profile
                            </Link>
                        </Button>
                    </div>
                ))}
            </div>
        );
    };

    const renderFriendRequests = (requests, isIncoming) => {
        if (requests.length === 0) {
            return (
                <p className="text-sm text-muted-foreground">
                    {isIncoming
                        ? 'No pending friend requests.'
                        : 'You have not sent any friend requests.'}
                </p>
            );
        }

        return (
            <div className="space-y-3">
                {requests.map((friendship) => {
                    const displayUser = isIncoming
                        ? friendship.requested_by
                        : friendship.user_one.id === currentUser.id
                            ? friendship.user_two
                            : friendship.user_one;

                    return (
                        <div
                            key={friendship.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                        >
                            <div>
                                <p className="font-medium">
                                    {displayUser.username}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {isIncoming
                                        ? 'Sent you a friend request.'
                                        : 'Friend request pending.'}
                                </p>
                            </div>

                            {isIncoming ? (
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        disabled={isActionLoading}
                                        onClick={() => handleFriendshipAction(
                                            friendship.id,
                                            'accept',
                                        )}
                                    >
                                        <Check />
                                        Accept
                                    </Button>

                                    <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={isActionLoading}
                                        onClick={() => handleFriendshipAction(
                                            friendship.id,
                                            'decline',
                                        )}
                                    >
                                        <UserMinus />
                                        Decline
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isActionLoading}
                                    onClick={() => handleFriendshipAction(
                                        friendship.id,
                                        'cancel',
                                    )}
                                >
                                    <UserMinus />
                                    Cancel request
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-muted/30">

            <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
                <div className="mb-6">
                    <h1 className="text-3xl font-semibold">
                        Social connections
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Manage friend requests, followers and following users.
                    </p>
                </div>

                {error && (
                    <div
                        className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                <div className="mb-6 flex flex-wrap gap-2">
                    <Button
                        variant={activeTab === 'requests' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('requests')}
                    >
                        Incoming ({friendRequests.length})
                    </Button>

                    <Button
                        variant={activeTab === 'sent' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('sent')}
                    >
                        Sent ({sentFriendRequests.length})
                    </Button>

                    <Button
                        variant={activeTab === 'followers' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('followers')}
                    >
                        Followers ({followers.length})
                    </Button>

                    <Button
                        variant={activeTab === 'following' ? 'default' : 'outline'}
                        onClick={() => setActiveTab('following')}
                    >
                        Following ({following.length})
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>
                            {activeTab === 'requests' && 'Incoming friend requests'}
                            {activeTab === 'sent' && 'Sent friend requests'}
                            {activeTab === 'followers' && 'Followers'}
                            {activeTab === 'following' && 'Following'}
                        </CardTitle>
                    </CardHeader>

                    <CardContent>
                        {isLoading ? (
                            <p className="text-sm text-muted-foreground">
                                Loading social data...
                            </p>
                        ) : activeTab === 'requests' ? (
                            renderFriendRequests(friendRequests, true)
                        ) : activeTab === 'sent' ? (
                            renderFriendRequests(sentFriendRequests, false)
                        ) : activeTab === 'followers' ? (
                            renderUsers(
                                followers,
                                'You do not have any followers yet.',
                            )
                        ) : (
                            renderUsers(
                                following,
                                'You are not following anyone yet.',
                            )
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
};

export default SocialPage;
