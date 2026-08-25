const API_URL = import.meta.env.VITE_API_URL || '/api';
const BOOKS_URL = `${API_URL}/books`;

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

const fetchWithAuth = async (url, options = {}) => {
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
    } catch (e) {
      throw new Error(`Error ${response.status}: Failed to fetch data`);
    }

    // FastAPI returns detailed error information in the 'detail' field
    throw new Error(errorData.detail || 'API request failed');
  }

  // Handle 204 No Content responses which lack a JSON body to parse
  if (response.status === 204) {
    return null;
  }

  return response.json();
};

export const bookService = {
  async getBooks(filters = {}) {
    const queryParams = new URLSearchParams();
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.search) queryParams.append('search', filters.search);

    // Append query parameters only if filters are explicitly provided
    const url = queryParams.toString() ? `${BOOKS_URL}?${queryParams.toString()}` : BOOKS_URL;
    return fetchWithAuth(url);
  },

  async createBook(bookData) {
    return fetchWithAuth(BOOKS_URL, {
      method: 'POST',
      body: JSON.stringify(bookData),
    });
  },

  async getBookById(id) {
    return fetchWithAuth(`${BOOKS_URL}/${id}`);
  },

  async updateBook(id, updateData) {
    return fetchWithAuth(`${BOOKS_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  async deleteBook(id) {
    return fetchWithAuth(`${BOOKS_URL}/${id}`, {
      method: 'DELETE',
    });
  },

  async getPublicBooks(filters = {}) {
    const queryParams = new URLSearchParams();
    if (filters.genre) queryParams.append('genre', filters.genre);
    if (filters.search) queryParams.append('search', filters.search);

    const url = queryParams.toString()
      ? `${BOOKS_URL}/public?${queryParams.toString()}`
      : `${BOOKS_URL}/public`;

    return fetchWithAuth(url);
  }
};
