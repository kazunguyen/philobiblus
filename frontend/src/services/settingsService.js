import { API_URL } from '../config';

const SETTINGS_URL = `${API_URL}/settings`;

const requestSettings = async (token, options = {}) => {
    const response = await fetch(SETTINGS_URL, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...options.headers,
        },
    });

    if (!response.ok) {
        let detail = 'Settings request failed';
        try {
            const errorData = await response.json();
            detail = errorData.detail || detail;
        } catch {
            // Keep the default error when the response is not JSON.
        }
        throw new Error(detail);
    }

    return response.json();
};

export const settingsService = {
    getSettings(token) {
        return requestSettings(token);
    },

    updateSettings(token, settings) {
        return requestSettings(token, {
            method: 'PUT',
            body: JSON.stringify(settings),
        });
    },
};
