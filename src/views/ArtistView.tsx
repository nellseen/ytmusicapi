import React, { useEffect, useState, useCallback } from 'react';
import { Play, Shuffle, Music, Disc, Users, Plus, Loader2, ArrowLeft, RefreshCw, AlertTriangle, ChevronDown } from 'lucide-react';
import { Artist, ActiveView, Track } from '../types';
import { fetchArtist, fetchArtistSongs, ApiError, PaginatedArtistSongs } from '../services/api';
import { usePlayer } from '../context/PlayerContext';

interface ArtistViewProps {
  artistId: string;
  setActiveView: (view: ActiveView) => void;
}

export const ArtistView: React.FC<ArtistViewProps> = ({ artistId, setActiveView }) => {
  const { playSong, addToQueue } = usePlayer();
  const [artist, setArtist] = useState<Artist | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorInfo, setErrorInfo] = useState<{ message: string; retryable: boolean } | null>(null);

  // All Songs catalogue state
  const [allSongs, setAllSongs] = useState<Track[]>([]);
  const [loadingAllSongs, setLoadingAllSongs] = useState<boolean>(false);
  const [allSongsError, setAllSongsError] = useState<string | null>(null);
  const [showAllSongs, setShowAllSongs] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(30);

  const loadArtistData = useCallback(() => {
    setLoading(true);
    setErrorInfo(null);

    fetchArtist(artistId)
      .then((data) => {
        setArtist(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setLoading(false);
        const isUpstream = err instanceof ApiError ? err.retryable : true;
        const msg = err instanceof ApiError && (err.code === 'UPSTREAM_DNS_ERROR' || err.code === 'UPSTREAM_UNAVAILABLE')
          ? 'YouTube Music is temporarily unavailable. Could not load artist details.'
          : (err.message || 'Failed to load artist');
        setErrorInfo({ message: msg, retryable: isUpstream });
      });
  }, [artistId]);

  useEffect(() => {
    loadArtistData();
  }, [loadArtistData]);

  const loadAllArtistSongs = useCallback(() => {
    if (allSongs.length > 0) {
      setShowAllSongs(true);
      return;
    }
    setLoadingAllSongs(true);
    setAllSongsError(null);
    setShowAllSongs(true);

    fetchArtistSongs(artistId)
      .then((res) => {
        const tracksList = Array.isArray(res) ? res : (res as PaginatedArtistSongs).tracks;
        setAllSongs(tracksList || []);
        setLoadingAllSongs(false);
      })
      .catch((err: any) => {
        setLoadingAllSongs(false);
        setAllSongsError(err.message || 'Failed to load full songs catalogue');
      });
  }, [artistId, allSongs.length]);

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center text-neutral-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        <p className="text-sm font-medium">Loading artist profile...</p>
      </div>
    );
  }

  if (errorInfo || !artist) {
    return (
      <div className="py-24 text-center max-w-md mx-auto text-neutral-400 space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white mb-1">Unable to Load Artist</h3>
          <p className="text-xs text-neutral-300 leading-relaxed">
            {errorInfo?.message || 'Artist not found on YouTube Music.'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          {errorInfo?.retryable && (
            <button
              onClick={loadArtistData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl glass-button text-xs font-semibold text-white"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          )}
          <button
            onClick={() => setActiveView({ type: 'home' })}
            className="px-4 py-2 rounded-xl glass-panel text-xs font-medium text-neutral-400 hover:text-white"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  const topSongs = artist.topSongs || [];

  const handlePlayTopSongs = (shuffleMode: boolean = false) => {
    if (topSongs.length === 0) return;
    if (shuffleMode) {
      const shuffled = [...topSongs].sort(() => Math.random() - 0.5);
      playSong(shuffled[0], shuffled);
    } else {
      playSong(topSongs[0], topSongs);
    }
  };

  const displayedSongs = showAllSongs && allSongs.length > 0 ? allSongs.slice(0, visibleCount) : topSongs.slice(0, 10);

  return (
    <div className="space-y-10 pb-36 animate-in fade-in duration-300">
      {/* Back button */}
      <button
        onClick={() => setActiveView({ type: 'home' })}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl glass-panel text-xs font-medium text-neutral-300 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Hero Banner */}
      <div className="relative rounded-3xl p-6 md:p-10 glass-panel-elevated overflow-hidden border border-white/10 shadow-2xl flex flex-col md:flex-row items-center gap-8">
        <div className="w-36 h-36 md:w-48 md:h-48 rounded-full overflow-hidden shrink-0 border-4 border-white/10 shadow-2xl bg-neutral-900">
          <img
            src={artist.thumbnail}
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 text-center md:text-left space-y-3">
          <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-purple-300 uppercase tracking-wider">
            Verified Artist
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight">
            {artist.name}
          </h1>
          {artist.subscribers && (
            <p className="text-xs text-neutral-400">
              {artist.subscribers} subscribers
            </p>
          )}
          {artist.description && (
            <p className="text-xs text-neutral-300 line-clamp-2 max-w-2xl leading-relaxed">
              {artist.description}
            </p>
          )}

          {/* Action transport buttons */}
          <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
            <button
              onClick={() => handlePlayTopSongs(false)}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-semibold text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
            >
              <Play className="w-4 h-4 fill-black" />
              Play
            </button>
            <button
              onClick={() => handlePlayTopSongs(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-full glass-button text-white font-semibold text-sm hover:scale-105 active:scale-95 transition-all"
            >
              <Shuffle className="w-4 h-4" />
              Shuffle
            </button>
          </div>
        </div>
      </div>

      {/* Popular Tracks & All Songs */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-purple-400" />
            {showAllSongs ? `All Songs (${allSongs.length || 'Loading...'})` : 'Popular Tracks'}
          </h2>

          {!showAllSongs && (
            <button
              onClick={loadAllArtistSongs}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              View Full Discography
            </button>
          )}
        </div>

        {loadingAllSongs && allSongs.length === 0 ? (
          <div className="py-12 flex items-center justify-center text-neutral-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span className="text-xs">Fetching all songs using continuation...</span>
          </div>
        ) : allSongsError ? (
          <div className="p-4 rounded-xl glass-panel text-xs text-red-400 flex items-center justify-between">
            <span>{allSongsError}</span>
            <button onClick={loadAllArtistSongs} className="underline ml-2">Retry</button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {displayedSongs.map((track, idx) => (
              <div
                key={`${track.videoId}-${idx}`}
                className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
              >
                <div
                  onClick={() => playSong(track, displayedSongs)}
                  className="flex items-center gap-4 overflow-hidden flex-1 cursor-pointer"
                >
                  <span className="w-6 text-center text-xs font-semibold text-neutral-400 group-hover:hidden tabular-nums">
                    {idx + 1}
                  </span>
                  <div className="hidden group-hover:flex w-6 items-center justify-center">
                    <Play className="w-4 h-4 fill-white text-white" />
                  </div>

                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-11 h-11 rounded-xl object-cover shrink-0 shadow-md bg-neutral-900"
                    loading="lazy"
                  />

                  <div className="overflow-hidden flex-1">
                    <h4 className="text-sm font-semibold text-white group-hover:text-purple-300 truncate transition-colors">
                      {track.title}
                    </h4>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">
                      {track.artist} {track.album ? `• ${track.album}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pl-3 shrink-0">
                  <span className="text-xs text-neutral-400 tabular-nums">
                    {track.duration || ''}
                  </span>
                  <button
                    onClick={() => addToQueue(track)}
                    className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                    title="Add to queue"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load more button if full catalogue exceeds visible count */}
        {showAllSongs && allSongs.length > visibleCount && (
          <div className="text-center pt-3">
            <button
              onClick={() => setVisibleCount((prev) => prev + 30)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl glass-button text-xs font-semibold text-white hover:bg-white/15"
            >
              <ChevronDown className="w-4 h-4" />
              Load More Tracks ({allSongs.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </section>

      {/* Albums Shelf */}
      {artist.albums && artist.albums.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Disc className="w-5 h-5 text-pink-400" />
            Albums
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {artist.albums.map((album) => (
              <div
                key={album.albumId || album.title}
                onClick={() => {
                  if (album.albumId) {
                    setActiveView({ type: 'album', albumId: album.albumId });
                  }
                }}
                className="p-3 rounded-2xl glass-panel hover:bg-white/10 cursor-pointer group transition-all"
              >
                <div className="aspect-square w-full rounded-xl overflow-hidden mb-3 shadow-md bg-neutral-900">
                  <img
                    src={album.thumbnail}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                </div>
                <h4 className="text-xs font-semibold text-white truncate group-hover:text-purple-300">
                  {album.title}
                </h4>
                {album.year && (
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {album.year}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Singles Shelf */}
      {artist.singles && artist.singles.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white">
            Singles & EPs
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {artist.singles.map((single) => (
              <div
                key={single.albumId || single.title}
                onClick={() => {
                  if (single.albumId) {
                    setActiveView({ type: 'album', albumId: single.albumId });
                  }
                }}
                className="p-3 rounded-2xl glass-panel hover:bg-white/10 cursor-pointer group transition-all"
              >
                <div className="aspect-square w-full rounded-xl overflow-hidden mb-3 shadow-md bg-neutral-900">
                  <img
                    src={single.thumbnail}
                    alt={single.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                </div>
                <h4 className="text-xs font-semibold text-white truncate group-hover:text-purple-300">
                  {single.title}
                </h4>
                {single.year && (
                  <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                    {single.year}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related Artists */}
      {artist.related && artist.related.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Similar Artists
          </h2>

          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
            {artist.related.map((rel) => (
              <div
                key={rel.artistId || rel.name}
                onClick={() => {
                  if (rel.artistId) {
                    setActiveView({ type: 'artist', artistId: rel.artistId });
                  }
                }}
                className="flex flex-col items-center shrink-0 w-28 group cursor-pointer"
              >
                <div className="w-24 h-24 rounded-full overflow-hidden mb-2.5 border-2 border-white/10 group-hover:border-purple-400 transition-colors shadow-xl bg-neutral-900">
                  <img
                    src={rel.thumbnail}
                    alt={rel.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                </div>
                <h4 className="text-xs font-semibold text-neutral-200 group-hover:text-white truncate text-center w-full">
                  {rel.name}
                </h4>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
