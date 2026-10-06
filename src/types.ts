export interface ArtistRef {
  name: string;
  id?: string;
}

export interface Track {
  videoId: string;
  title: string;
  artist: string;
  artists?: ArtistRef[];
  album?: string;
  albumId?: string | null;
  duration?: string;
  duration_seconds?: number;
  thumbnail: string;
  isExplicit?: boolean;
}

export interface Artist {
  artistId: string;
  name: string;
  description?: string;
  thumbnail: string;
  subscribers?: string;
  views?: string;
  topSongs?: Track[];
  songsBrowseId?: string;
  albums?: AlbumCard[];
  singles?: AlbumCard[];
  related?: ArtistCard[];
}

export interface ArtistCard {
  artistId: string;
  name: string;
  subscribers?: string;
  thumbnail: string;
  rank?: number;
}

export interface AlbumCard {
  albumId: string;
  title: string;
  artist?: string;
  year?: string;
  thumbnail: string;
  isExplicit?: boolean;
}

export interface Album {
  albumId: string;
  title: string;
  artist: string;
  artists?: ArtistRef[];
  year?: string;
  description?: string;
  thumbnail: string;
  trackCount: number;
  duration?: string;
  tracks: (Track & { trackNumber: number })[];
}

export interface SyncedLyricLine {
  time: number;
  text: string;
}

export interface LyricsData {
  hasSynced: boolean;
  synced: SyncedLyricLine[] | null;
  plain: string | null;
  source?: string | null;
  message?: string;
}

export interface HomeSection {
  title: string;
  items: any[];
}

export type RepeatMode = 'off' | 'all' | 'one';

export type ActiveView = 
  | { type: 'home' }
  | { type: 'search' }
  | { type: 'artist'; artistId: string }
  | { type: 'album'; albumId: string }
  | { type: 'library' }
  | { type: 'queue' };
