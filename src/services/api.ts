import { Track, Artist, Album, LyricsData, HomeSection, ArtistCard } from '../types';

const API_BASE = '/api';

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  status: number;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', retryable: boolean = false, status: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // Non-JSON response
  }

  if (!res.ok || (json && json.success === false)) {
    const errorMsg = json?.error || (res.status === 503 ? 'YouTube Music is temporarily unavailable' : `Request failed with status ${res.status}`);
    const code = json?.code || (res.status === 503 ? 'UPSTREAM_UNAVAILABLE' : (res.status === 429 ? 'UPSTREAM_RATE_LIMIT' : 'HTTP_ERROR'));
    const retryable = json?.retryable !== undefined ? json.retryable : (res.status >= 500 || res.status === 429);
    throw new ApiError(errorMsg, code, retryable, res.status);
  }

  return json?.data !== undefined ? json.data : (json as T);
}

export async function fetchHealth(): Promise<{ success: boolean; backend: string; ytmusic: { status: string; error?: string } }> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function fetchHome(): Promise<HomeSection[]> {
  const res = await fetch(`${API_BASE}/home`);
  return handleResponse<HomeSection[]>(res);
}

export async function fetchTrending(): Promise<{ tracks: Track[]; artists: ArtistCard[] }> {
  const res = await fetch(`${API_BASE}/trending`);
  return handleResponse<{ tracks: Track[]; artists: ArtistCard[] }>(res);
}

export interface SearchResults {
  query: string;
  filter: string | null;
  songs: Track[];
  artists: ArtistCard[];
  albums: any[];
  videos: Track[];
}

export async function searchMusic(query: string, filter?: string, signal?: AbortSignal): Promise<SearchResults> {
  const params = new URLSearchParams({ q: query });
  if (filter && filter !== 'all') {
    params.set('filter', filter);
  }
  const res = await fetch(`${API_BASE}/search?${params.toString()}`, { signal });
  return handleResponse<SearchResults>(res);
}

export async function fetchSongDetail(videoId: string): Promise<{ song: Track; lyricsId?: string; related: Track[] }> {
  const res = await fetch(`${API_BASE}/song/${videoId}`);
  return handleResponse<{ song: Track; lyricsId?: string; related: Track[] }>(res);
}

export async function fetchLyrics(videoId: string, title?: string, artist?: string): Promise<LyricsData> {
  const params = new URLSearchParams();
  if (title) params.set('title', title);
  if (artist) params.set('artist', artist);
  const url = `${API_BASE}/song/${videoId}/lyrics${params.toString() ? '?' + params.toString() : ''}`;
  
  const res = await fetch(url);
  return handleResponse<LyricsData>(res);
}

export async function fetchArtist(artistId: string): Promise<Artist> {
  const res = await fetch(`${API_BASE}/artist/${artistId}`);
  return handleResponse<Artist>(res);
}

export interface PaginatedArtistSongs {
  tracks: Track[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export async function fetchArtistSongs(
  artistId: string,
  page?: number,
  limit?: number
): Promise<Track[] | PaginatedArtistSongs> {
  const params = new URLSearchParams();
  if (page) params.set('page', String(page));
  if (limit) params.set('limit', String(limit));
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/artist/${artistId}/songs${query}`);
  return handleResponse<Track[] | PaginatedArtistSongs>(res);
}

export async function fetchAlbum(albumId: string): Promise<Album> {
  const res = await fetch(`${API_BASE}/album/${albumId}`);
  return handleResponse<Album>(res);
}

export async function fetchRelatedSongs(videoId: string): Promise<Track[]> {
  try {
    const res = await fetch(`${API_BASE}/related/${videoId}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.data || [];
  } catch {
    return [];
  }
}
