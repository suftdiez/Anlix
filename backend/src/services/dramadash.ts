import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = 'https://www.dramadash.app/api';

/**
 * DramaDash API Service
 * Based on: https://github.com/IkuzaDev/DramaDash-API
 */
class DramaDashService {
  private api: AxiosInstance;
  private deviceId: string;
  private token: string | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Generate device ID
    this.deviceId = uuidv4().replace(/-/g, '').substring(0, 16);
    console.log('[DramaDash] Generated device ID:', this.deviceId);
    
    this.api = axios.create({
      baseURL: API_BASE,
      timeout: 30000,
      headers: {
        'app-version': '70',
        'lang': 'id',
        'platform': 'android',
        'tz': 'Asia/Bangkok',
        'device-type': 'phone',
        'user-agent': 'okhttp/5.1.0',
        'content-type': 'application/json; charset=UTF-8',
      },
    });
  }

  /**
   * Initialize the service by getting auth token
   */
  async init(): Promise<void> {
    if (this.initialized && this.token) {
      return;
    }

    // Use single promise to prevent multiple init calls
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    try {
      console.log('[DramaDash] Initializing API with landing request...');
      const response = await this.api.post('/landing', {
        android_id: this.deviceId,
      });

      console.log('[DramaDash] Landing response status:', response.status);
      console.log('[DramaDash] Landing response keys:', Object.keys(response.data || {}));

      // Token is directly in response.data.token (NOT data.data.token)
      if (response.data?.token) {
        this.token = response.data.token;
        this.api.defaults.headers.common['authorization'] = `Bearer ${this.token}`;
        this.initialized = true;
        console.log('[DramaDash] API initialized successfully with token');
      } else {
        console.error('[DramaDash] No token in response:', Object.keys(response.data || {}));
        throw new Error('Failed to get token from landing endpoint');
      }
    } catch (error: any) {
      console.error('[DramaDash] Init error:', error.message);
      if (error.response) {
        console.error('[DramaDash] Response status:', error.response.status);
        console.error('[DramaDash] Response data:', JSON.stringify(error.response.data).substring(0, 500));
      }
      this.initPromise = null; // Allow retry
      throw error;
    }
  }

  /**
   * Ensure API is initialized before making requests
   */
  private async ensureInit(): Promise<void> {
    if (!this.initialized) {
      await this.init();
    }
  }

  /**
   * Get home page data (banners, trending, drama list)
   */
  async getHome(tabId?: number): Promise<any> {
    try {
      await this.ensureInit();
      const params = tabId ? { tab_id: tabId } : {};
      console.log('[DramaDash] Fetching home with params:', params);
      const response = await this.api.get('/home', { params });
      console.log('[DramaDash] Home response status:', response.status);
      return response.data;
    } catch (error: any) {
      console.error('[DramaDash] Error fetching home:', error.message);
      if (error.response) {
        console.error('[DramaDash] Response status:', error.response.status);
        console.error('[DramaDash] Response data:', JSON.stringify(error.response.data).substring(0, 500));
      }
      throw error; // Re-throw to let caller handle
    }
  }

  /**
   * Get drama details with episodes
   */
  async getDrama(dramaId: number): Promise<any> {
    try {
      await this.ensureInit();
      console.log('[DramaDash] Fetching drama:', dramaId);
      const response = await this.api.get(`/drama/${dramaId}`);
      return response.data;
    } catch (error: any) {
      console.error('[DramaDash] Error fetching drama:', error.message);
      throw error;
    }
  }

  /**
   * Search dramas
   */
  async searchDrama(query: string): Promise<any> {
    try {
      await this.ensureInit();
      console.log('[DramaDash] Searching for:', query);
      const response = await this.api.post('/search/text', {
        search: query,
      });
      return response.data;
    } catch (error: any) {
      console.error('[DramaDash] Error searching drama:', error.message);
      throw error;
    }
  }

  /**
   * Get specific episode data
   */
  async getEpisode(dramaId: number, episodeNumber: number): Promise<any> {
    try {
      await this.ensureInit();
      const dramaResponse = await this.getDrama(dramaId);
      if (dramaResponse.episodes) {
        const episode = dramaResponse.episodes.find(
          (ep: any) => ep.episodeNumber === episodeNumber
        );
        return { status: 200, data: episode || null };
      }
      return { status: 404, data: null };
    } catch (error: any) {
      console.error('[DramaDash] Error fetching episode:', error.message);
      throw error;
    }
  }
}

// Singleton instance
let dramaDashInstance: DramaDashService | null = null;

async function getDramaDashInstance(): Promise<DramaDashService> {
  if (!dramaDashInstance) {
    dramaDashInstance = new DramaDashService();
    await dramaDashInstance.init();
  }
  return dramaDashInstance;
}

// Export interface types
export interface DramaDashDrama {
  id: number;
  name: string;
  poster: string;
  desc?: string;
  viewCount?: string;
  tags?: string[];
  genres?: string[];
}

export interface DramaDashEpisode {
  id: number;
  episodeNumber: number;
  isLocked: boolean;
  videoUrl?: string;
  subtitles?: Array<{
    language: string;
    languageDisplayName: string;
    url: string;
  }>;
}

// Public API functions
export async function getHome(tabId?: number) {
  const instance = await getDramaDashInstance();
  return instance.getHome(tabId);
}

export async function getDrama(dramaId: number) {
  const instance = await getDramaDashInstance();
  return instance.getDrama(dramaId);
}

export async function searchDrama(query: string) {
  const instance = await getDramaDashInstance();
  return instance.searchDrama(query);
}

export async function getEpisode(dramaId: number, episodeNumber: number) {
  const instance = await getDramaDashInstance();
  return instance.getEpisode(dramaId, episodeNumber);
}

export default {
  getHome,
  getDrama,
  searchDrama,
  getEpisode,
};
