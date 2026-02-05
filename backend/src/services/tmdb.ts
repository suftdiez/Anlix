import axios from 'axios';
import dotenv from 'dotenv';
import redis from '../config/redis';

// Load environment variables
dotenv.config();

// TMDB API Configuration
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const CACHE_TTL = 3600; // 1 hour

// Get API key at runtime (not at module load time)
function getTmdbApiKey(): string {
  return process.env.TMDB_API_KEY || '';
}

interface TMDBMovie {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  popularity: number;
  adult: boolean;
  original_language: string;
}

interface TMDBResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export interface UpcomingMovie {
  id: string;
  title: string;
  slug: string;
  poster: string;
  backdrop: string;
  releaseDate: string;
  overview: string;
  rating: string;
  voteCount: number;
  language: string;
}

// Helper to get cached data
async function getCached<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

// Helper to set cache
async function setCache(key: string, data: unknown): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(data), CACHE_TTL);
  } catch {
    // Ignore cache errors
  }
}

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Get poster URL
function getPosterUrl(path: string | null, size: string = 'w500'): string {
  if (!path) return '';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

// Get backdrop URL
function getBackdropUrl(path: string | null, size: string = 'w1280'): string {
  if (!path) return '';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/**
 * Get upcoming movies from TMDB
 */
export async function getUpcomingMovies(page: number = 1): Promise<{ data: UpcomingMovie[]; hasNext: boolean; totalPages: number }> {
  const cacheKey = `tmdb:upcoming:${page}`;
  const cached = await getCached<{ data: UpcomingMovie[]; hasNext: boolean; totalPages: number }>(cacheKey);
  if (cached) return cached;

  try {
    if (!getTmdbApiKey()) {
      console.warn('[TMDB] No API key configured. Set TMDB_API_KEY environment variable.');
      return { data: [], hasNext: false, totalPages: 0 };
    }

    const response = await axios.get<TMDBResponse>(`${TMDB_BASE_URL}/movie/upcoming`, {
      params: {
        api_key: getTmdbApiKey(),
        language: 'id-ID', // Indonesian language
        page,
        region: 'ID', // Indonesia region
      },
    });

    const movies: UpcomingMovie[] = response.data.results.map((movie) => ({
      id: movie.id.toString(),
      title: movie.title || movie.original_title,
      slug: generateSlug(movie.title || movie.original_title),
      poster: getPosterUrl(movie.poster_path),
      backdrop: getBackdropUrl(movie.backdrop_path),
      releaseDate: movie.release_date,
      overview: movie.overview || 'Tidak ada sinopsis.',
      rating: movie.vote_average ? movie.vote_average.toFixed(1) : '0',
      voteCount: movie.vote_count,
      language: movie.original_language.toUpperCase(),
    }));

    const result = {
      data: movies,
      hasNext: page < response.data.total_pages,
      totalPages: response.data.total_pages,
    };

    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[TMDB] Error fetching upcoming movies:', error);
    return { data: [], hasNext: false, totalPages: 0 };
  }
}

/**
 * Get now playing movies from TMDB
 */
export async function getNowPlayingMovies(page: number = 1): Promise<{ data: UpcomingMovie[]; hasNext: boolean; totalPages: number }> {
  const cacheKey = `tmdb:nowplaying:${page}`;
  const cached = await getCached<{ data: UpcomingMovie[]; hasNext: boolean; totalPages: number }>(cacheKey);
  if (cached) return cached;

  try {
    if (!getTmdbApiKey()) {
      return { data: [], hasNext: false, totalPages: 0 };
    }

    const response = await axios.get<TMDBResponse>(`${TMDB_BASE_URL}/movie/now_playing`, {
      params: {
        api_key: getTmdbApiKey(),
        language: 'id-ID',
        page,
        region: 'ID',
      },
    });

    const movies: UpcomingMovie[] = response.data.results.map((movie) => ({
      id: movie.id.toString(),
      title: movie.title || movie.original_title,
      slug: generateSlug(movie.title || movie.original_title),
      poster: getPosterUrl(movie.poster_path),
      backdrop: getBackdropUrl(movie.backdrop_path),
      releaseDate: movie.release_date,
      overview: movie.overview || 'Tidak ada sinopsis.',
      rating: movie.vote_average ? movie.vote_average.toFixed(1) : '0',
      voteCount: movie.vote_count,
      language: movie.original_language.toUpperCase(),
    }));

    const result = {
      data: movies,
      hasNext: page < response.data.total_pages,
      totalPages: response.data.total_pages,
    };

    await setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.error('[TMDB] Error fetching now playing movies:', error);
    return { data: [], hasNext: false, totalPages: 0 };
  }
}

// ============ TRAILER FUNCTIONS ============

interface TMDBVideo {
  id: string;
  key: string;        // YouTube video ID
  name: string;       // Video title
  site: string;       // "YouTube", "Vimeo", etc.
  type: string;       // "Trailer", "Teaser", "Featurette", etc.
  official: boolean;
  published_at: string;
}

interface TMDBVideosResponse {
  id: number;
  results: TMDBVideo[];
}

interface TMDBSearchResult {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  popularity: number;
}

interface TMDBSearchResponse {
  page: number;
  results: TMDBSearchResult[];
  total_results: number;
}

export interface TrailerResult {
  key: string;        // YouTube video ID
  name: string;       // Trailer title
  type: string;       // "Trailer", "Teaser", etc.
  url: string;        // Full YouTube URL
}

/**
 * Search for a movie by title and optional year
 */
export async function searchMovie(title: string, year?: string): Promise<number | null> {
  const cacheKey = `tmdb:search:${title}:${year || ''}`;
  const cached = await getCached<number>(cacheKey);
  if (cached) return cached;

  try {
    if (!getTmdbApiKey()) {
      console.warn('[TMDB] No API key configured');
      return null;
    }

    // Clean title for better search results
    const cleanTitle = title
      .replace(/\s*\(\d{4}\)\s*$/, '')  // Remove year in parentheses
      .replace(/\s*Sub.*$/i, '')         // Remove "Sub Indo" etc
      .replace(/\s*Subtitle.*$/i, '')
      .trim();

    const params: Record<string, string> = {
      api_key: getTmdbApiKey(),
      query: cleanTitle,
      language: 'en-US',
    };

    if (year) {
      params.year = year;
    }

    const response = await axios.get<TMDBSearchResponse>(`${TMDB_BASE_URL}/search/movie`, { params });

    if (response.data.results.length === 0) {
      console.log(`[TMDB] No results found for: ${cleanTitle}`);
      return null;
    }

    // Get the best match (first result with highest relevance)
    const bestMatch = response.data.results[0];
    console.log(`[TMDB] Found movie: ${bestMatch.title} (ID: ${bestMatch.id})`);

    await setCache(cacheKey, bestMatch.id);
    return bestMatch.id;
  } catch (error) {
    console.error('[TMDB] Error searching movie:', error);
    return null;
  }
}

/**
 * Get trailer for a movie by TMDB ID
 */
export async function getMovieTrailer(tmdbId: number): Promise<TrailerResult | null> {
  const cacheKey = `tmdb:trailer:${tmdbId}`;
  const cached = await getCached<TrailerResult>(cacheKey);
  if (cached) return cached;

  try {
    if (!getTmdbApiKey()) {
      return null;
    }

    const response = await axios.get<TMDBVideosResponse>(`${TMDB_BASE_URL}/movie/${tmdbId}/videos`, {
      params: {
        api_key: getTmdbApiKey(),
        language: 'en-US',
      },
    });

    const videos = response.data.results;

    // Filter for YouTube videos only
    const youtubeVideos = videos.filter(v => v.site === 'YouTube');

    if (youtubeVideos.length === 0) {
      console.log(`[TMDB] No YouTube videos found for movie ID: ${tmdbId}`);
      return null;
    }

    // Priority: Official Trailer > Trailer > Teaser > any video
    const priorities = ['Trailer', 'Teaser', 'Featurette', 'Clip'];
    let selectedVideo: TMDBVideo | undefined;

    // First try to find official trailers
    for (const type of priorities) {
      selectedVideo = youtubeVideos.find(v => v.type === type && v.official);
      if (selectedVideo) break;
    }

    // If no official video, try any trailer
    if (!selectedVideo) {
      for (const type of priorities) {
        selectedVideo = youtubeVideos.find(v => v.type === type);
        if (selectedVideo) break;
      }
    }

    // Fallback to first YouTube video
    if (!selectedVideo) {
      selectedVideo = youtubeVideos[0];
    }

    const result: TrailerResult = {
      key: selectedVideo.key,
      name: selectedVideo.name,
      type: selectedVideo.type,
      url: `https://www.youtube.com/watch?v=${selectedVideo.key}`,
    };

    await setCache(cacheKey, result);
    console.log(`[TMDB] Found trailer: ${result.name} (${result.type})`);
    return result;
  } catch (error) {
    console.error('[TMDB] Error fetching trailer:', error);
    return null;
  }
}

/**
 * Get trailer by movie title and year (combines search + trailer fetch)
 */
export async function getTrailerByTitle(title: string, year?: string): Promise<TrailerResult | null> {
  const tmdbId = await searchMovie(title, year);
  if (!tmdbId) return null;
  return getMovieTrailer(tmdbId);
}

export default {
  getUpcomingMovies,
  getNowPlayingMovies,
  searchMovie,
  getMovieTrailer,
  getTrailerByTitle,
};
