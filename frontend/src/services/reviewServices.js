const API_URL = import.meta.env.VITE_API_URL || '/api';
const REVIEWS_URL = `${API_URL}/reviews`;

const getHeaders = () => {
    const token = localStorage.getItem('token');

    return {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const request = async (url, options = {}) => {
    const response = await fetch(url, {
        ...options,
        headers: {
            ...getHeaders(),
            ...options.headers,
        },
    });

    if (!response.ok) {
        let errorData = null;

        try {
            errorData = await response.json();
        } catch {
            throw new Error(`Error ${response.status}: Request failed`);
        }

        throw new Error(errorData.detail || 'API request failed');
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
};

export const reviewService = {
    async getReviews(bookId) {
        return request(`${API_URL}/books/${bookId}/reviews`);
    },

    async createReview(bookId, reviewData) {
        return request(`${API_URL}/books/${bookId}/reviews`, {
            method: 'POST',
            body: JSON.stringify(reviewData),
        });
    },

    async deleteReview(reviewId) {
        return request(`${REVIEWS_URL}/${reviewId}`, {
            method: 'DELETE',
        });
    },
};