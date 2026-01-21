import axios from 'axios';

const API_BASE = 'https://dramabox.botraiki.biz/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

export interface DramaBoxItem {
  id: string;
  title: string;
  poster: string;
  abstract: string;
  status: string;
  episodeCount: number;
  categories: string[];
  playCount?: string;
  protagonist?: string;
}

export interface DramaBoxDetail {
  id: string;
  title: string;
  poster: string;
  abstract: string;
  status: string;
  episodeCount: number;
  categories: string[];
  score?: string;
  author?: string;
}

export interface DramaBoxEpisode {
  id: string;
  index: number;
  name: string;
  videoUrl: string;
  quality: number;
}

/**
 * Transform API response to DramaBoxItem
 */
function transformDrama(book: any): DramaBoxItem {
  const categories = book.tags || [];
  
  return {
    id: book.bookId,
    title: book.bookName,
    poster: book.coverWap || book.cover || book.bookCover || '',
    abstract: book.introduction || '',
    status: book.corner?.name || 'Unknown',
    episodeCount: book.chapterCount || 0,
    categories: categories.slice(0, 3),
    playCount: book.playCount,
    protagonist: book.protagonist,
  };
}

/**
 * Get latest dramas
 */
export async function getLatest(): Promise<DramaBoxItem[]> {
  try {
    const { data } = await api.get('/latest');
    if (Array.isArray(data)) {
      return data.map(transformDrama);
    }
    return [];
  } catch (error) {
    console.error('Error fetching DramaBox latest:', error);
    return [];
  }
}

/**
 * Get trending dramas
 */
export async function getTrending(): Promise<DramaBoxItem[]> {
  try {
    const { data } = await api.get('/trending');
    if (Array.isArray(data)) {
      return data.map(transformDrama);
    }
    return [];
  } catch (error) {
    console.error('Error fetching DramaBox trending:', error);
    return [];
  }
}

/**
 * Get dubbed dramas with pagination
 */
export async function getDubbed(classify: 'terpopuler' | 'terbaru' = 'terpopuler', page: number = 1): Promise<DramaBoxItem[]> {
  try {
    const { data } = await api.get('/dubbed', {
      params: { classify, page }
    });
    if (Array.isArray(data)) {
      return data.map(transformDrama);
    }
    return [];
  } catch (error) {
    console.error('Error fetching DramaBox dubbed:', error);
    return [];
  }
}

/**
 * Get for-you recommendations
 */
export async function getForYou(): Promise<DramaBoxItem[]> {
  try {
    const { data } = await api.get('/for-you');
    if (Array.isArray(data)) {
      return data.map(transformDrama);
    }
    return [];
  } catch (error) {
    console.error('Error fetching DramaBox for-you:', error);
    return [];
  }
}

/**
 * Search dramas
 */
export async function search(query: string): Promise<DramaBoxItem[]> {
  try {
    const { data } = await api.get('/search', {
      params: { query }
    });
    if (Array.isArray(data)) {
      return data.map((book: any) => ({
        id: book.bookId,
        title: book.bookName?.replace(/<\/?em>/g, '') || '', // Remove highlight tags
        poster: book.cover || '',
        abstract: book.introduction || '',
        status: 'Unknown',
        episodeCount: 0,
        categories: book.tagNames?.slice(0, 3) || [],
        protagonist: book.protagonist,
      }));
    }
    return [];
  } catch (error) {
    console.error('Error searching DramaBox:', error);
    return [];
  }
}

/**
 * Get drama detail
 */
export async function getDetail(bookId: string): Promise<DramaBoxDetail | null> {
  try {
    const { data } = await api.get('/detail', {
      params: { bookId }
    });
    
    if (data?.data) {
      const detail = data.data;
      return {
        id: detail.bookId,
        title: detail.bookName,
        poster: detail.cover || '',
        abstract: detail.introduction || '',
        status: detail.statusName || (detail.status === 1 ? 'Completed' : 'Ongoing'),
        episodeCount: detail.chapterCount || 0,
        categories: detail.tags || [],
        score: detail.score,
        author: detail.author,
      };
    }
    return null;
  } catch (error) {
    console.error('Error fetching DramaBox detail:', error);
    return null;
  }
}

/**
 * Get episodes with streaming URLs
 */
export async function getEpisodes(bookId: string): Promise<DramaBoxEpisode[]> {
  try {
    const { data } = await api.get('/episodes', {
      params: { bookId }
    });
    
     if (Array.isArray(data)) {
      return data.map((ep: any) => {
        // Get best quality video URL
        let videoUrl = '';
        let quality = 720;
        
        if (ep.cdnList && ep.cdnList.length > 0) {
          const cdn = ep.cdnList.find((c: any) => c.isDefault) || ep.cdnList[0];
          if (cdn?.videoPathList && cdn.videoPathList.length > 0) {
            // Prefer 720p, then 540p, then any available (exclude VIP-only)
            const preferred = cdn.videoPathList.find((v: any) => v.quality === 720 && !v.isVipEquity) ||
                              cdn.videoPathList.find((v: any) => v.quality === 540 && !v.isVipEquity) ||
                              cdn.videoPathList.find((v: any) => v.isDefault && !v.isVipEquity) ||
                              cdn.videoPathList.find((v: any) => !v.isVipEquity) ||
                              cdn.videoPathList[0];
            if (preferred && preferred.videoPath) {
              // Return proxy URL to bypass CORS
              videoUrl = `/api/drama/video?url=${encodeURIComponent(preferred.videoPath)}`;
              quality = preferred.quality;
            }
          }
        }
        
        return {
          id: ep.chapterId,
          index: ep.chapterIndex + 1, // 1-indexed
          name: ep.chapterName || `Episode ${ep.chapterIndex + 1}`,
          videoUrl,
          quality,
        };
      });
    }
    return [];
  } catch (error) {
    console.error('Error fetching DramaBox episodes:', error);
    return [];
  }
}

export default {
  getLatest,
  getTrending,
  getDubbed,
  getForYou,
  search,
  getDetail,
  getEpisodes,
};
