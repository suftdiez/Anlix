import axios from 'axios';

const DRAMABOX_API = 'https://dramabox.sansekai.my.id/api';

// In-memory cache to prevent rate limiting
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: Map<string, CacheEntry<any>> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    console.log(`[DramaBox-Sansekai] Cache HIT: ${key}`);
    return entry.data;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
  console.log(`[DramaBox-Sansekai] Cache SET: ${key}`);
}

// Transform DramaBox drama to our format
function transformDrama(drama: any) {
  // Extract tags - they can be array of strings or array of objects with tagName
  let categories: string[] = [];
  if (drama.tags && Array.isArray(drama.tags)) {
    categories = drama.tags.map((t: any) => 
      typeof t === 'string' ? t : (t.tagName || t.name || '')
    ).filter(Boolean);
  }

  return {
    id: drama.bookId || drama.id,
    title: drama.bookName || drama.title,
    poster: drama.coverWap || drama.bookCover || drama.cover || drama.poster || '',
    abstract: drama.introduction || drama.abstract || '',
    status: drama.status || 'Ongoing',
    episodeCount: drama.chapterCount || drama.episodeCount || drama.totalEpisode || 0,
    categories: categories,
    playCount: drama.rankVo?.hotCode || drama.totalViews || drama.views || '',
    source: 'dramabox-sansekai' as const,
  };
}

// Get latest dramas
export async function getLatest() {
  const cacheKey = 'latest';
  const cached = getFromCache<any[]>(cacheKey);
  
  try {
    const response = await axios.get(`${DRAMABOX_API}/dramabox/latest`, { timeout: 8000 });
    const dramas = response.data.data || response.data || [];
    const result = Array.isArray(dramas) ? dramas.map(transformDrama) : [];
    
    // Only cache if we got actual data
    if (result.length > 0) {
      setCache(cacheKey, result);
      return { success: true, data: result };
    }
    
    // If empty but we have cache, return cache
    if (cached && cached.length > 0) {
      console.log('[DramaBox-Sansekai] Empty response, using cache for latest');
      return { success: true, data: cached };
    }
    
    return { success: true, data: result };
  } catch (error) {
    console.error('DramaBox getLatest error:', error);
    // Return cache on error
    if (cached && cached.length > 0) {
      console.log('[DramaBox-Sansekai] Error, using cache for latest');
      return { success: true, data: cached };
    }
    return { success: false, data: [] };
  }
}

// Get trending dramas
export async function getTrending() {
  const cacheKey = 'trending';
  const cached = getFromCache<any[]>(cacheKey);
  
  try {
    const response = await axios.get(`${DRAMABOX_API}/dramabox/trending`, { timeout: 8000 });
    const dramas = response.data.data || response.data || [];
    const result = Array.isArray(dramas) ? dramas.map(transformDrama) : [];
    
    if (result.length > 0) {
      setCache(cacheKey, result);
      return { success: true, data: result };
    }
    
    if (cached && cached.length > 0) {
      console.log('[DramaBox-Sansekai] Empty response, using cache for trending');
      return { success: true, data: cached };
    }
    
    return { success: true, data: result };
  } catch (error) {
    console.error('DramaBox getTrending error:', error);
    if (cached && cached.length > 0) {
      console.log('[DramaBox-Sansekai] Error, using cache for trending');
      return { success: true, data: cached };
    }
    return { success: false, data: [] };
  }
}

// Get dubbed dramas (dub indo)
export async function getDubindo(classify: string = 'terpopuler', page: number = 1) {
  const cacheKey = `dubindo_${classify}_${page}`;
  const cached = getFromCache<any[]>(cacheKey);
  
  try {
    const response = await axios.get(`${DRAMABOX_API}/dramabox/dubindo`, {
      params: { classify, page },
      timeout: 8000,
    });
    const dramas = response.data.data || response.data || [];
    const result = Array.isArray(dramas) ? dramas.map(transformDrama) : [];
    
    if (result.length > 0) {
      setCache(cacheKey, result);
      return { success: true, data: result };
    }
    
    if (cached && cached.length > 0) {
      console.log('[DramaBox-Sansekai] Empty response, using cache for dubindo');
      return { success: true, data: cached };
    }
    
    return { success: true, data: result };
  } catch (error) {
    console.error('DramaBox getDubindo error:', error);
    if (cached && cached.length > 0) {
      console.log('[DramaBox-Sansekai] Error, using cache for dubindo');
      return { success: true, data: cached };
    }
    return { success: false, data: [] };
  }
}

// Get for you recommendations
export async function getForYou() {
  try {
    const response = await axios.get(`${DRAMABOX_API}/dramabox/foryou`);
    const dramas = response.data.data || response.data || [];
    return {
      success: true,
      data: Array.isArray(dramas) ? dramas.map(transformDrama) : [],
    };
  } catch (error) {
    console.error('DramaBox getForYou error:', error);
    return { success: false, data: [] };
  }
}

// Get VIP dramas
export async function getVip() {
  try {
    const response = await axios.get(`${DRAMABOX_API}/dramabox/vip`);
    const dramas = response.data.data || response.data || [];
    return {
      success: true,
      data: Array.isArray(dramas) ? dramas.map(transformDrama) : [],
    };
  } catch (error) {
    console.error('DramaBox getVip error:', error);
    return { success: false, data: [] };
  }
}

// Search dramas
export async function search(query: string) {
  try {
    const response = await axios.get(`${DRAMABOX_API}/dramabox/search`, {
      params: { query },
    });
    const dramas = response.data.data || response.data || [];
    return {
      success: true,
      data: Array.isArray(dramas) ? dramas.map(transformDrama) : [],
    };
  } catch (error) {
    console.error('DramaBox search error:', error);
    return { success: false, data: [] };
  }
}

// Get drama detail
export async function getDetail(bookId: string) {
  try {
    const response = await axios.get(`${DRAMABOX_API}/dramabox/detail`, {
      params: { bookId },
    });
    const drama = response.data.data || response.data;
    return {
      success: true,
      data: drama ? transformDrama(drama) : null,
    };
  } catch (error) {
    console.error('DramaBox getDetail error:', error);
    return { success: false, data: null };
  }
}

// Get all episodes
export async function getEpisodes(bookId: string) {
  try {
    const response = await axios.get(`${DRAMABOX_API}/dramabox/allepisode`, {
      params: { bookId },
    });
    const episodes = response.data.data || response.data || [];
    
    // Transform episodes - video URL is in cdnList[0].videoPathList
    const transformedEpisodes = Array.isArray(episodes) ? episodes.map((ep: any, index: number) => {
      // Extract video URL from cdnList structure
      let videoUrl = '';
      let quality = 720;
      
      if (ep.cdnList && Array.isArray(ep.cdnList) && ep.cdnList.length > 0) {
        const defaultCdn = ep.cdnList.find((cdn: any) => cdn.isDefault === 1) || ep.cdnList[0];
        if (defaultCdn.videoPathList && Array.isArray(defaultCdn.videoPathList)) {
          // Find 720p quality (default for good balance), fall back to first available
          const video720 = defaultCdn.videoPathList.find((v: any) => v.quality === 720 && v.isDefault === 1);
          const videoDefault = defaultCdn.videoPathList.find((v: any) => v.isDefault === 1);
          const videoFirst = defaultCdn.videoPathList[0];
          
          const selectedVideo = video720 || videoDefault || videoFirst;
          if (selectedVideo) {
            videoUrl = selectedVideo.videoPath || '';
            quality = selectedVideo.quality || 720;
          }
        }
      }
      
      return {
        id: ep.chapterId || ep.itemId || ep.id || `${index + 1}`,
        index: (ep.chapterIndex ?? index) + 1, // chapterIndex is 0-based, display as 1-based
        name: ep.chapterName || ep.title || `EP ${index + 1}`,
        cover: ep.chapterImg || ep.chapterCover || ep.cover || '',
        videoUrl: videoUrl,
        quality: quality,
      };
    }) : [];

    return {
      success: true,
      data: transformedEpisodes,
    };
  } catch (error) {
    console.error('DramaBox getEpisodes error:', error);
    return { success: false, data: [] };
  }
}

export default {
  getLatest,
  getTrending,
  getDubindo,
  getForYou,
  getVip,
  search,
  getDetail,
  getEpisodes,
};
