import axios from 'axios';

const MELOLO_BASE_URL = 'https://melolo-api-azure.vercel.app/api/melolo';

// Create axios instance with timeout
const api = axios.create({
  baseURL: MELOLO_BASE_URL,
  timeout: 15000,
  headers: {
    'Accept': 'application/json',
  }
});

export interface DramaItem {
  id: string;
  title: string;
  poster: string;
  abstract: string;
  status: string;
  episodeCount: number;
  categories: string[];
}

export interface DramaEpisode {
  vid: string;
  index: number;
  cover: string;
  duration: number;
}

export interface DramaDetail {
  id: string;
  title: string;
  poster: string;
  abstract: string;
  status: string;
  episodeCount: number;
  categories: string[];
  episodes: DramaEpisode[];
}

/**
 * Convert image URL to use our proxy endpoint
 * This bypasses CDN hotlinking protection (403 errors)
 */
function convertImageUrl(url: string): string {
  if (!url) return '';
  // Use proxy endpoint to bypass hotlinking protection
  // The frontend will call /api/drama/image?url=<encoded_url>
  return `/api/drama/image?url=${encodeURIComponent(url)}`;
}

// Transform API response to our format
function transformDrama(book: any): DramaItem {
  const categories: string[] = [];
  try {
    if (book.category_info) {
      const parsed = JSON.parse(book.category_info);
      parsed.forEach((cat: any) => {
        if (cat.Name) categories.push(cat.Name);
      });
    }
  } catch (e) {
    // Ignore parse errors
  }

  const posterUrl = book.thumb_url || book.series_cover || '';

  return {
    id: book.book_id || book.series_id_str,
    title: book.book_name || book.series_title,
    poster: convertImageUrl(posterUrl),
    abstract: book.abstract || book.series_intro || '',
    status: book.show_creation_status || 'Unknown',
    episodeCount: parseInt(book.serial_count || book.episode_cnt || '0'),
    categories: categories.slice(0, 3), // Max 3 categories
  };
}

/**
 * Get latest dramas 
 * Note: Melolo API only returns 6 dramas per endpoint
 */
export async function getLatest(): Promise<DramaItem[]> {
  try {
    const { data } = await api.get('/latest');
    if (data.books && Array.isArray(data.books)) {
      return data.books.map(transformDrama);
    }
    return [];
  } catch (error) {
    console.error('Error fetching latest dramas:', error);
    return [];
  }
}

/**
 * Get trending dramas
 * Note: Melolo API only returns 6 dramas per endpoint
 */
export async function getTrending(): Promise<DramaItem[]> {
  try {
    const { data } = await api.get('/trending');
    if (data.books && Array.isArray(data.books)) {
      return data.books.map(transformDrama);
    }
    return [];
  } catch (error) {
    console.error('Error fetching trending dramas:', error);
    return [];
  }
}

/**
 * Search dramas
 */
export async function search(query: string, limit: number = 20): Promise<DramaItem[]> {
  try {
    const { data } = await api.get('/search', {
      params: { query, limit }
    });
    if (data.books && Array.isArray(data.books)) {
      return data.books.map(transformDrama);
    }
    return [];
  } catch (error) {
    console.error('Error searching dramas:', error);
    return [];
  }
}

/**
 * Get drama detail with episodes
 */
export async function getDetail(bookId: string): Promise<DramaDetail | null> {
  try {
    const { data } = await api.get(`/detail/${bookId}`);
    
    if (data.code !== 0 || !data.data?.video_data) {
      return null;
    }

    const video = data.data.video_data;
    const categories: string[] = [];
    
    try {
      if (video.category_schema) {
        const parsed = JSON.parse(video.category_schema);
        parsed.forEach((cat: any) => {
          if (cat.name) categories.push(cat.name);
        });
      }
    } catch (e) {
      // Ignore parse errors
    }

    const episodes: DramaEpisode[] = (video.video_list || []).map((ep: any) => ({
      vid: ep.vid,
      index: ep.vid_index,
      cover: convertImageUrl(ep.episode_cover || ep.cover),
      duration: ep.duration || 0,
    }));

    return {
      id: video.series_id_str,
      title: video.series_title,
      poster: convertImageUrl(video.series_cover),
      abstract: video.series_intro,
      status: video.series_status === 1 ? 'Selesai' : 'Ongoing',
      episodeCount: video.episode_cnt,
      categories: categories.slice(0, 5),
      episodes,
    };
  } catch (error) {
    console.error('Error fetching drama detail:', error);
    return null;
  }
}

/**
 * Get video stream URL
 */
export async function getStream(vidId: string): Promise<string | null> {
  try {
    const { data } = await api.get(`/stream/${vidId}`);
    
    // Melolo API returns main_url in data.data
    if (data.data?.main_url) {
      return data.data.main_url;
    }
    
    // Fallback: try backup_url
    if (data.data?.backup_url) {
      return data.data.backup_url;
    }
    
    // Legacy fallbacks
    if (data.url) {
      return data.url;
    }
    
    if (data.stream_url) {
      return data.stream_url;
    }

    console.error('Stream response format unknown:', JSON.stringify(data).slice(0, 200));
    return null;
  } catch (error) {
    console.error('Error fetching stream:', error);
    return null;
  }
}

export default {
  getLatest,
  getTrending,
  search,
  getDetail,
  getStream,
};
