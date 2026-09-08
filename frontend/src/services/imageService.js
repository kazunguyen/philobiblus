import { API_URL } from '../config';

const UPLOAD_URL = `${API_URL}/uploads/cover`;

export const imageService = {
    async uploadCover(file) {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: formData,
        });

        if (!response.ok) {
            let detail = 'Image upload failed';
            try {
                const errorData = await response.json();
                detail = errorData.detail || detail;
            } catch {
                // Keep the default error when the response is not JSON.
            }
            throw new Error(detail);
        }

        return response.json();
    },
};
