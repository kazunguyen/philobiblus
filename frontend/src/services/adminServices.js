import { API_URL } from '../config';

const ADMIN_URL = `${API_URL}/admin`;

const request = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = 'Admin request failed';
    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // A non-JSON error response still gets a useful generic message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const adminService = {
  getOverview: () => request(`${ADMIN_URL}/overview`),
  getBooks: () => request(`${ADMIN_URL}/books`),
  getBookDetail: (bookId) => request(`${ADMIN_URL}/books/${bookId}`),
  getUsers: () => request(`${ADMIN_URL}/users`),
  getUserDetail: (username) => request(
    `${ADMIN_URL}/users/${encodeURIComponent(username)}`,
  ),
  resetPassword: (username, password) => request(
    `${ADMIN_URL}/users/${encodeURIComponent(username)}/password`,
    { method: 'PUT', body: JSON.stringify({ password }) },
  ),
  setAccountStatus: (username, isActive) => request(
    `${ADMIN_URL}/users/${encodeURIComponent(username)}/status`,
    { method: 'PUT', body: JSON.stringify({ is_active: isActive }) },
  ),
  deleteUser: (username) => request(
    `${ADMIN_URL}/users/${encodeURIComponent(username)}`,
    { method: 'DELETE' },
  ),
};
