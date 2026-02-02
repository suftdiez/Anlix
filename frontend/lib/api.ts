import axios from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Create axios instance
export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minutes for slow scraping operations
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

  getServerStream: async (post: string, nume: string, type: string = 'video') => {
    const res = await api.post('/anime/stream', { post, nume, type });
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

// ============ DRAMA API (Melolo) ============
export const dramaApi = {
  getLatest: async () => {
    const res = await api.get('/drama/latest');
    return res.data;
  },

  getTrending: async () => {
    const res = await api.get('/drama/trending');
    return res.data;
  },

  search: async (query: string) => {
    const res = await api.get(`/drama/search?q=${encodeURIComponent(query)}`);
    return res.data;
  },

  getDetail: async (id: string) => {
    const res = await api.get(`/drama/detail/${id}`);
    return res.data;
  },

  getStream: async (vid: string) => {
    const res = await api.get(`/drama/stream/${vid}`);
    return res.data;
  },
};

// ============ DRAMABOX API ============
export const dramaboxApi = {
  getLatest: async () => {
    const res = await api.get('/drama/dramabox/latest');
    return res.data;
  },

  getTrending: async () => {
    const res = await api.get('/drama/dramabox/trending');
    return res.data;
  },

  getDubbed: async (classify: 'terpopuler' | 'terbaru' = 'terpopuler', page = 1) => {
    const res = await api.get(`/drama/dramabox/dubbed?classify=${classify}&page=${page}`);
    return res.data;
  },

  getForYou: async () => {
    const res = await api.get('/drama/dramabox/for-you');
    return res.data;
  },

  search: async (query: string) => {
    const res = await api.get(`/drama/dramabox/search?q=${encodeURIComponent(query)}`);
    return res.data;
  },

  getDetail: async (id: string) => {
    const res = await api.get(`/drama/dramabox/detail/${id}`);
    return res.data;
  },

  getEpisodes: async (id: string) => {
    const res = await api.get(`/drama/dramabox/episodes/${id}`);
    return res.data;
  },
};

// ============ DRAMABOX SANSEKAI API (Third Source) ============
export const dramaboxSansekaiApi = {
  getLatest: async () => {
    const res = await api.get('/drama/dramabox-sansekai/latest');
    return res.data;
  },

  getTrending: async () => {
    const res = await api.get('/drama/dramabox-sansekai/trending');
    return res.data;
  },

  getDubindo: async (classify: 'terpopuler' | 'terbaru' = 'terpopuler', page = 1) => {
    const res = await api.get(`/drama/dramabox-sansekai/dubindo?classify=${classify}&page=${page}`);
    return res.data;
  },

  getVip: async () => {
    const res = await api.get('/drama/dramabox-sansekai/vip');
    return res.data;
  },

  getForYou: async () => {
    const res = await api.get('/drama/dramabox-sansekai/foryou');
    return res.data;
  },

  search: async (query: string) => {
    const res = await api.get(`/drama/dramabox-sansekai/search?q=${encodeURIComponent(query)}`);
    return res.data;
  },

  getDetail: async (id: string) => {
    const res = await api.get(`/drama/dramabox-sansekai/detail/${id}`);
    return res.data;
  },

  getEpisodes: async (id: string) => {
    const res = await api.get(`/drama/dramabox-sansekai/episodes/${id}`);
    return res.data;
  },
};

// ============ FILM API (LK21) ============
export const filmApi = {
  getLatest: async (page = 1) => {
    const res = await api.get(`/film/latest?page=${page}`);
    return res.data;
  },

  getTrending: async () => {
    const res = await api.get('/film/trending');
    return res.data;
  },

  search: async (query: string, page = 1) => {
    const res = await api.get(`/film/search?q=${encodeURIComponent(query)}&page=${page}`);
    return res.data;
  },

  getDetail: async (slug: string) => {
    const res = await api.get(`/film/detail/${slug}`);
    return res.data;
  },

  getByGenre: async (genre: string, page = 1) => {
    const res = await api.get(`/film/genre/${genre}?page=${page}`);
    return res.data;
  },

  getByCountry: async (country: string, page = 1) => {
    const res = await api.get(`/film/country/${country}?page=${page}`);
    return res.data;
  },

  // Series methods
  getSeriesDetail: async (slug: string) => {
    const res = await api.get(`/film/series/${slug}`);
    return res.data;
  },

  getEpisodeStream: async (slug: string) => {
    const res = await api.get(`/film/episode/${slug}/stream`);
    return res.data;
  },
};

// ============ KOMIK API (Komiku.cc) ============
export const komikApi = {
  getLatest: async () => {
    const res = await api.get('/komik/latest');
    return res.data;
  },

  getList: async (page = 1) => {
    const res = await api.get(`/komik/list?page=${page}`);
    return res.data;
  },

  getManga: async (page = 1) => {
    const res = await api.get(`/komik/manga?page=${page}`);
    return res.data;
  },

  getManhwa: async (page = 1) => {
    const res = await api.get(`/komik/manhwa?page=${page}`);
    return res.data;
  },

  getManhua: async (page = 1) => {
    const res = await api.get(`/komik/manhua?page=${page}`);
    return res.data;
  },

  search: async (query: string) => {
    const res = await api.get(`/komik/search?q=${encodeURIComponent(query)}`);
    return res.data;
  },

  getDetail: async (slug: string) => {
    const res = await api.get(`/komik/detail/${slug}`);
    return res.data;
  },

  getChapter: async (slug: string) => {
    const res = await api.get(`/komik/chapter/${slug}`);
    return res.data;
  },
};

// ============ NOVEL API (MeioNovels) ============
export const novelApi = {
  getLatest: async (page = 1) => {
    const res = await api.get(`/novel/latest?page=${page}`);
    return res.data;
  },

  getPopular: async (page = 1) => {
    const res = await api.get(`/novel/popular?page=${page}`);
    return res.data;
  },

  getChina: async (page = 1) => {
    const res = await api.get(`/novel/china?page=${page}`);
    return res.data;
  },

  getJepang: async (page = 1) => {
    const res = await api.get(`/novel/jepang?page=${page}`);
    return res.data;
  },

  getKorea: async (page = 1) => {
    const res = await api.get(`/novel/korea?page=${page}`);
    return res.data;
  },

  getTamat: async (page = 1) => {
    const res = await api.get(`/novel/tamat?page=${page}`);
    return res.data;
  },

  getHTL: async (page = 1) => {
    const res = await api.get(`/novel/htl?page=${page}`);
    return res.data;
  },

  getByGenre: async (genre: string, page = 1) => {
    const res = await api.get(`/novel/genre/${genre}?page=${page}`);
    return res.data;
  },

  getGenres: async () => {
    const res = await api.get('/novel/genres');
    return res.data;
  },

  getByAuthor: async (author: string, page = 1) => {
    const res = await api.get(`/novel/author/${author}?page=${page}`);
    return res.data;
  },

  getTags: async () => {
    const res = await api.get('/novel/tags');
    return res.data;
  },

  getByTag: async (tag: string, page = 1) => {
    const res = await api.get(`/novel/tag/${tag}?page=${page}`);
    return res.data;
  },

  search: async (query: string, page = 1) => {
    const res = await api.get(`/novel/search?q=${encodeURIComponent(query)}&page=${page}`);
    return res.data;
  },

  getDetail: async (slug: string) => {
    const res = await api.get(`/novel/detail/${slug}`);
    return res.data;
  },

  readChapter: async (novelSlug: string, chapterSlug: string) => {
    const res = await api.get(`/novel/read/${novelSlug}/${chapterSlug}`);
    return res.data;
  },
};

export default api;

