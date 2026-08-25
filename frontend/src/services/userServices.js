const API_URL = import.meta.env.VITE_API_URL || '/api';

const fetchJson = async (url) => {
    const response = await fetch(url);

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'API request failed');
    }

    return response.json();
};

export const userService = {
    async getUserProfile(username) {
        return fetchJson(`${API_URL}/users/${username}`);
    },
};