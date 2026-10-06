import React, { useState, useEffect, useRef } from 'react';
import { Search as SearchIcon, Play, Plus, User, Disc, Music, Loader2, X } from 'lucide-react';
import { searchMusic, SearchResults } from '../services/api';
import { Track, ActiveView } from '../types';
import { usePlayer } from '../context/PlayerContext';

interface SearchViewProps {
  setActiveView: (view: ActiveView) => void;
}

export const SearchView: React.FC<SearchViewProps> = ({ setActiveView }) => {
  const { playSong, addToQueue, playNext } = usePlayer();
  const [query, setQuery] = useState<string>('');
  const [filter, setFilter] = useState<string>('all');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      setLoading(false);
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setLoading(true);
    setError(null);

    debounceTimerRef.current = setTimeout(() => {
      searchMusic(query.trim(), filter)
        .then((res) => {
          setResults(res);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'Search error');
          setLoading(false);
        });
    }, 350);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [query, filter]);

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'songs', label: 'Songs' },
    { id: 'artists', label: 'Artists' },
    { id: 'albums', label: 'Albums' },
    { id: 'videos', label: 'Videos' },
  ];

  return (
    <div className="space-y-8 pb-36 animate-in fade-in duration-300">
      {/* Search Header Bar */}
      <div className="space-y-4 max-w-3xl">
        <div className="relative flex items-center">
          <SearchIcon className="absolute left-4 w-5 h-5 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search songs, artists, albums, podcasts..."
            autoFocus
            className="w-full pl-12 pr-12 py-3.5 rounded-2xl glass-panel-elevated text-white placeholder-neutral-400 text-base md:text-lg focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all border border-white/10"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-4 p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border ${
                filter === cat.id
                  ? 'bg-white text-black border-white shadow-md'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white border-white/5'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-20 flex flex-col items-center justify-center text-neutral-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
          <p className="text-xs font-medium">Searching YouTube Music...</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="p-6 rounded-2xl glass-panel text-center text-red-400 text-sm max-w-lg mx-auto">
          {error}
        </div>
      )}

      {/* Empty State before search */}
      {!query && !results && (
        <div className="py-24 text-center max-w-md mx-auto text-neutral-400 space-y-3">
          <div className="w-16 h-16 rounded-3xl glass-panel flex items-center justify-center mx-auto text-purple-400">
            <SearchIcon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-neutral-200">Search Sonora</h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            Find any song, artist, album, or music video in real-time from YouTube Music.
          </p>
        </div>
      )}

      {/* Results View */}
      {results && !loading && (
        <div className="space-y-10">
          {/* Songs List */}
          {(filter === 'all' || filter === 'songs') && results.songs && results.songs.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Music className="w-5 h-5 text-purple-400" />
                Songs
              </h3>
              <div className="space-y-1.5">
                {results.songs.map((track) => (
                  <div
                    key={track.videoId}
                    className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                  >
                    <div
                      onClick={() => playSong(track, results.songs)}
                      className="flex items-center gap-3.5 overflow-hidden flex-1 cursor-pointer"
                    >
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 shadow-md bg-neutral-900">
                        <img
                          src={track.thumbnail}
                          alt={track.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Play className="w-5 h-5 fill-white text-white" />
                        </div>
                      </div>

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
            </section>
          )}

          {/* Artists Grid */}
          {(filter === 'all' || filter === 'artists') && results.artists && results.artists.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-400" />
                Artists
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {results.artists.map((artist) => (
                  <div
                    key={artist.artistId || artist.name}
                    onClick={() => {
                      if (artist.artistId) {
                        setActiveView({ type: 'artist', artistId: artist.artistId });
                      }
                    }}
                    className="p-4 rounded-2xl glass-panel hover:bg-white/10 flex flex-col items-center text-center cursor-pointer group transition-all"
                  >
                    <div className="w-24 h-24 rounded-full overflow-hidden mb-3 border-2 border-white/10 group-hover:border-purple-400 transition-colors shadow-lg bg-neutral-900">
                      <img
                        src={artist.thumbnail}
                        alt={artist.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        loading="lazy"
                      />
                    </div>
                    <h4 className="text-xs font-semibold text-white truncate w-full group-hover:text-purple-300">
                      {artist.name}
                    </h4>
                    {artist.subscribers && (
                      <span className="text-[10px] text-neutral-400 truncate w-full mt-0.5">
                        {artist.subscribers}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Albums Grid */}
          {(filter === 'all' || filter === 'albums') && results.albums && results.albums.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Disc className="w-5 h-5 text-pink-400" />
                Albums
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {results.albums.map((album) => (
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
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {album.artist} {album.year ? `• ${album.year}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
