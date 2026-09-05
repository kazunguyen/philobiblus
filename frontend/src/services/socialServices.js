const API_URL = import.meta.env.VITE_API_URL || '/api';

const request = async (url, token, options = {}) => {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    });

    if (!response.ok) {
        let errorData = null;

        try {
            errorData = await response.json();
        } catch {
            throw new Error(`Request failed with status ${response.status}`);
        }

        throw new Error(errorData.detail || 'API request failed');
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
};

export const socialService = {
    async getRelationship(username, token) {
        return request(
            `${API_URL}/users/${username}/relationship`,
            token,
        );
    },

    async followUser(username, token) {
        return request(`${API_URL}/users/${username}/follow`, token, {
            method: 'POST',
        });
    },

    async unfollowUser(username, token) {
        return request(`${API_URL}/users/${username}/follow`, token, {
            method: 'DELETE',
        });
    },

    async createFriendRequest(username, token) {
        return request(
            `${API_URL}/users/${username}/friend-requests`,
            token,
            { method: 'POST' },
        );
    },

    async acceptFriendRequest(friendshipId, token) {
        return request(
            `${API_URL}/friendships/${friendshipId}/accept`,
            token,
            { method: 'PUT' },
        );
    },

    async removeFriendship(friendshipId, token) {
        return request(
            `${API_URL}/friendships/${friendshipId}`,
            token,
            { method: 'DELETE' },
        );
    },

    async getFollowers(username, token, skip = 0, limit = 20) {
        const encodedUsername = encodeURIComponent(username);

        return request(
            `${API_URL}/users/${encodedUsername}/followers?skip=${skip}&limit=${limit}`,
            token,
        );
    },

    async getFollowing(username, token, skip = 0, limit = 20) {
        const encodedUsername = encodeURIComponent(username);

        return request(
            `${API_URL}/users/${encodedUsername}/following?skip=${skip}&limit=${limit}`,
            token,
        );
    },

    async getFriendRequests(token, direction = 'incoming') {
        return request(
            `${API_URL}/users/me/friend-requests?direction=${direction}`,
            token,
        );
    },
};