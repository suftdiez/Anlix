import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Create axios instance
export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token on unauthorized
      Cookies.remove('token');
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth')) {
        window.location.href = '/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

// ============ AUTH API ============
export const authApi = {
  register: async (data: { email: string; password: string; username: string }) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  },

  login: async (data: { email: string; password: string }) => {
    const res = await api.post('/auth/login', data);
    return res.data;
  },

  getProfile: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },

  updateProfile: async (data: { username?: string; avatar?: string }) => {
    const res = await api.put('/auth/profile', data);
    return res.data;
  },
};

// ============ ANIME API ============
export const animeApi = {
  getLatest: async (page = 1) => {
    const res = await api.get(`/anime/latest?page=${page}`);
    return res.data;
  },

  getOngoing: async (page = 1) => {
    const res = await api.get(`/anime/ongoing?page=${page}`);
    return res.data;
  },

  search: async (query: string, page = 1) => {
    const res = await api.get(`/anime/search?q=${encodeURIComponent(query)}&page=${page}`);
    return res.data;
  },

  getByGenre: async (genre: string, page = 1) => {
    const res = await api.get(`/anime/genre/${genre}?page=${page}`);
    return res.data;
  },

  getDetail: async (slug: string) => {
    const res = await api.get(`/anime/detail/${slug}`);
    return res.data;
  },

  getEpisode: async (slug: string) => {
    const res = await api.get(`/anime/episode/${slug}`);
    return res.data;
  },
};

// ============ DONGHUA API ============
export const donghuaApi = {
  getLatest: async (page = 1) => {
    const res = await api.get(`/donghua/latest?page=${page}`);
    return res.data;
  },

  getOngoing: async (page = 1) => {
    const res = await api.get(`/donghua/ongoing?page=${page}`);
    return res.data;
  },

  getPopular: async () => {
    const res = await api.get('/donghua/popular');
    return res.data;
  },

  search: async (query: string, page = 1) => {
    const res = await api.get(`/donghua/search?q=${encodeURIComponent(query)}&page=${page}`);
    return res.data;
  },

  getByGenre: async (genre: string, page = 1) => {
    const res = await api.get(`/donghua/genre/${genre}?page=${page}`);
    return res.data;
  },

  getDetail: async (slug: string) => {
    const res = await api.get(`/donghua/detail/${slug}`);
    return res.data;
  },

  getEpisode: async (slug: string) => {
    const res = await api.get(`/donghua/episode/${slug}`);
    return res.data;
  },
};

// ============ USER API ============
export const userApi = {
  // Bookmarks
  getBookmarks: async (page = 1, type?: 'anime' | 'donghua') => {
    const params = new URLSearchParams({ page: page.toString() });
    if (type) params.append('type', type);
    const res = await api.get(`/user/bookmarks?${params}`);
    return res.data;
  },

  addBookmark: async (data: {
    contentId: string;
    contentType: 'anime' | 'donghua';
    title: string;
    poster?: string;
    slug: string;
  }) => {
    const res = await api.post('/user/bookmarks', data);
    return res.data;
  },

  removeBookmark: async (id: string) => {
    const res = await api.delete(`/user/bookmarks/${id}`);
    return res.data;
  },

  checkBookmark: async (contentId: string, type: 'anime' | 'donghua') => {
    const res = await api.get(`/user/bookmarks/check/${contentId}?type=${type}`);
    return res.data;
  },

  // History
  getHistory: async (page = 1) => {
    const res = await api.get(`/user/history?page=${page}`);
    return res.data;
  },

  addHistory: async (data: {
    contentId: string;
    contentType: 'anime' | 'donghua';
    episodeId: string;
    episodeNumber: number;
    title: string;
    episodeTitle?: string;
    poster?: string;
    slug: string;
    progress?: number;
  }) => {
    const res = await api.post('/user/history', data);
    return res.data;
  },

  removeHistory: async (id: string) => {
    const res = await api.delete(`/user/history/${id}`);
    return res.data;
  },

  clearHistory: async () => {
    const res = await api.delete('/user/history');
    return res.data;
  },

  // Comments
  getComments: async (contentId: string, page = 1, episodeId?: string) => {
    const params = new URLSearchParams({ page: page.toString() });
    if (episodeId) params.append('episodeId', episodeId);
    const res = await api.get(`/user/comments/${contentId}?${params}`);
    return res.data;
  },

  addComment: async (data: {
    contentId: string;
    contentType: 'anime' | 'donghua';
    episodeId?: string;
    content: string;
    parentId?: string;
  }) => {
    const res = await api.post('/user/comments', data);
    return res.data;
  },

  likeComment: async (id: string) => {
    const res = await api.put(`/user/comments/${id}/like`);
    return res.data;
  },

  deleteComment: async (id: string) => {
    const res = await api.delete(`/user/comments/${id}`);
    return res.data;
  },
};

export default api;
