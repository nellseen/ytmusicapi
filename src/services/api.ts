import { Track, Artist, Album, LyricsData, HomeSection, ArtistCard } from '../types';

const API_BASE = '/api';

export async function fetchHome(): Promise<HomeSection[]> {
  const res = await fetch(`${API_BASE}/home`);
  if (!res.ok) throw new Error('Failed to load home music feed');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load home feed');
  return json.data || [];
}

export async function fetchTrending(): Promise<{ tracks: Track[]; artists: ArtistCard[] }> {
  const res = await fetch(`${API_BASE}/trending`);
  if (!res.ok) throw new Error('Failed to load trending music');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load trending');
  return json.data || { tracks: [], artists: [] };
}

export interface SearchResults {
  query: string;
  filter: string | null;
  songs: Track[];
  artists: ArtistCard[];
  albums: any[];
  videos: Track[];
}

export async function searchMusic(query: string, filter?: string): Promise<SearchResults> {
  const params = new URLSearchParams({ q: query });
  if (filter && filter !== 'all') {
    params.set('filter', filter);
  }
  const res = await fetch(`${API_BASE}/search?${params.toString()}`);
  if (!res.ok) throw new Error('Search failed');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Search failed');
  return json.data;
}

export async function fetchSongDetail(videoId: string): Promise<{ song: Track; lyricsId?: string; related: Track[] }> {
  const res = await fetch(`${API_BASE}/song/${videoId}`);
  if (!res.ok) throw new Error('Failed to load song details');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load song details');
  return json.data;
}

export async function fetchLyrics(videoId: string, title?: string, artist?: string): Promise<LyricsData> {
  const params = new URLSearchParams();
  if (title) params.set('title', title);
  if (artist) params.set('artist', artist);
  const url = `${API_BASE}/song/${videoId}/lyrics${params.toString() ? '?' + params.toString() : ''}`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load lyrics');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load lyrics');
  return json.data;
}

export async function fetchArtist(artistId: string): Promise<Artist> {
  const res = await fetch(`${API_BASE}/artist/${artistId}`);
  if (!res.ok) throw new Error('Failed to load artist details');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load artist details');
  return json.data;
}

export async function fetchArtistSongs(artistId: string): Promise<Track[]> {
  const res = await fetch(`${API_BASE}/artist/${artistId}/songs`);
  if (!res.ok) throw new Error('Failed to load artist songs');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load artist songs');
  return json.data || [];
}

export async function fetchAlbum(albumId: string): Promise<Album> {
  const res = await fetch(`${API_BASE}/album/${albumId}`);
  if (!res.ok) throw new Error('Failed to load album details');
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load album details');
  return json.data;
}

export async function fetchRelatedSongs(videoId: string): Promise<Track[]> {
  const res = await fetch(`${API_BASE}/related/${videoId}`);
  if (!res.ok) return [];
  const json = await res.json();
  return json.data || [];
}
