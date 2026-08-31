const API_URL = import.meta.env.VITE_API_URL || '/api';
const AUTH_URL = `${API_URL}/auth`;

const parseFastAPIError = (errorData, defaultMessage) => {
  if (Array.isArray(errorData.detail)) {
    return errorData.detail.map(err => {
      const fieldName = err.loc[err.loc.length - 1];
      return `[${fieldName}] ${err.msg}`;
    }).join(' | ');
  }
  return errorData.detail || defaultMessage;
};

const fetchWithHandling = async (url, options, defaultErrorMsg) => {
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch (e) {
      throw new Error(`Server Error (${response.status}): Developer is fixing`);
    }
    throw new Error(parseFastAPIError(errorData, defaultErrorMsg));
  }

  return response.json();
};

export const authService = {
  async register(username, email, password) {
    return fetchWithHandling(`${AUTH_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    }, 'Registration failed');
  },

  async login(username, password) {
    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);

    return fetchWithHandling(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    }, 'Login failed');
  },

  async getCurrentUser(token) {
    return fetchWithHandling(
      `${AUTH_URL}/me`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      'Failed to fetch current user',
    );
  }
};

