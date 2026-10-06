import React, { useEffect, useState, useCallback } from 'react';
import { Play, Sparkles, TrendingUp, Music, User, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { HomeSection, Track, ActiveView } from '../types';
import { fetchHome, fetchTrending, ApiError } from '../services/api';
import { usePlayer } from '../context/PlayerContext';

interface HomeViewProps {
  setActiveView: (view: ActiveView) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ setActiveView }) => {
  const { playSong } = usePlayer();
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [trending, setTrending] = useState<{ tracks: Track[]; artists: any[] }>({ tracks: [], artists: [] });
  
  const [loadingHome, setLoadingHome] = useState<boolean>(true);
  const [loadingTrending, setLoadingTrending] = useState<boolean>(true);
  
  const [homeError, setHomeError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [trendingError, setTrendingError] = useState<{ message: string; retryable: boolean } | null>(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const loadHome = useCallback(() => {
    setLoadingHome(true);
    setHomeError(null);
    fetchHome()
      .then((data) => {
        setSections(data);
        setLoadingHome(false);
      })
      .catch((err: any) => {
        setLoadingHome(false);
        const isUpstream = err instanceof ApiError ? err.retryable : true;
        setHomeError({
          message: isUpstream ? 'YouTube Music is temporarily unavailable.' : (err.message || 'Failed to load home shelves.'),
          retryable: isUpstream,
        });
      });
  }, []);

  const loadTrending = useCallback(() => {
    setLoadingTrending(true);
    setTrendingError(null);
    fetchTrending()
      .then((data) => {
        setTrending(data);
        setLoadingTrending(false);
      })
      .catch((err: any) => {
        setLoadingTrending(false);
        const isUpstream = err instanceof ApiError ? err.retryable : true;
        setTrendingError({
          message: isUpstream ? 'Trending charts temporarily unavailable.' : (err.message || 'Failed to load trending.'),
          retryable: isUpstream,
        });
      });
  }, []);

  useEffect(() => {
    loadHome();
    loadTrending();
  }, [loadHome, loadTrending]);

  const allLoading = loadingHome && loadingTrending;
  const bothFailed = homeError && trendingError && sections.length === 0 && trending.tracks.length === 0;

  if (allLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-32 text-neutral-400 gap-3">
        <Loader2 className="w-9 h-9 animate-spin text-purple-400" />
        <p className="text-sm font-medium">Curating your music experience...</p>
      </div>
    );
  }

  if (bothFailed) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-32 text-neutral-400 gap-4 text-center px-4 max-w-lg mx-auto">
        <div className="w-14 h-14 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">YouTube Music temporarily unavailable</h3>
          <p className="text-xs text-neutral-300 mt-1.5 leading-relaxed">
            The music service could not be reached right now. Please check your internet connection or try again shortly.
          </p>
        </div>
        <button
          onClick={() => {
            loadHome();
            loadTrending();
          }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl glass-button text-xs font-semibold text-white hover:bg-white/15"
        >
          <RefreshCw className="w-4 h-4" />
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-36 animate-in fade-in duration-300">
      {/* Hero Greeting Banner */}
      <div className="relative rounded-3xl p-6 md:p-10 glass-panel-elevated overflow-hidden border border-white/10 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-gradient-to-br from-purple-600/30 via-indigo-600/20 to-pink-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-purple-300 mb-3 border border-white/10">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Discover YouTube Music</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-3">
            {getGreeting()}
          </h1>
          <p className="text-sm text-neutral-300 leading-relaxed">
            Immerse yourself in high-fidelity streaming, explore real trending charts, and sing along with real-time lyrics.
          </p>
        </div>
      </div>

      {/* Trending Section with partial failure handling */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Trending Worldwide
          </h2>
          <button
            onClick={() => setActiveView({ type: 'search' })}
            className="text-xs font-semibold text-neutral-400 hover:text-white transition-colors"
          >
            See all
          </button>
        </div>

        {loadingTrending ? (
          <div className="py-12 flex items-center justify-center text-neutral-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span className="text-xs">Loading trending songs...</span>
          </div>
        ) : trendingError ? (
          <div className="p-6 rounded-2xl glass-panel border border-red-500/20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <p className="text-xs text-neutral-300">{trendingError.message}</p>
            </div>
            {trendingError.retryable && (
              <button
                onClick={loadTrending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-button text-xs font-medium text-white"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            )}
          </div>
        ) : (
          trending.tracks.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {trending.tracks.slice(0, 12).map((track) => (
                <div
                  key={track.videoId}
                  onClick={() => playSong(track, trending.tracks)}
                  className="group p-3 rounded-2xl glass-panel hover:bg-white/10 transition-all duration-300 cursor-pointer flex flex-col justify-between border border-white/5 hover:border-white/15 hover:-translate-y-1 shadow-lg"
                >
                  <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 shadow-md bg-neutral-900">
                    <img
                      src={track.thumbnail}
                      alt={track.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                        <Play className="w-5 h-5 fill-black translate-x-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden">
                    <h3 className="text-xs font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                      {track.title}
                    </h3>
                    <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                      {track.artist}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* Top Artists Shelf */}
      {!loadingTrending && trending.artists && trending.artists.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
            <User className="w-5 h-5 text-indigo-400" />
            Popular Artists
          </h2>

          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
            {trending.artists.slice(0, 14).map((artist) => (
              <div
                key={artist.artistId || artist.name}
                onClick={() => {
                  if (artist.artistId) {
                    setActiveView({ type: 'artist', artistId: artist.artistId });
                  }
                }}
                className="flex flex-col items-center shrink-0 w-28 group cursor-pointer"
              >
                <div className="w-24 h-24 rounded-full overflow-hidden mb-2.5 border-2 border-white/10 group-hover:border-purple-400 group-hover:scale-105 transition-all shadow-xl bg-neutral-900">
                  <img
                    src={artist.thumbnail}
                    alt={artist.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <h4 className="text-xs font-semibold text-neutral-200 group-hover:text-white truncate text-center w-full">
                  {artist.name}
                </h4>
                {artist.subscribers && (
                  <span className="text-[10px] text-neutral-400 truncate text-center w-full">
                    {artist.subscribers}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Home Feed Shelves with partial failure handling */}
      {loadingHome ? (
        <div className="py-12 flex items-center justify-center text-neutral-400 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
          <span className="text-xs">Loading personalized shelves...</span>
        </div>
      ) : homeError ? (
        <div className="p-6 rounded-2xl glass-panel border border-red-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <p className="text-xs text-neutral-300">{homeError.message}</p>
          </div>
          {homeError.retryable && (
            <button
              onClick={loadHome}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-button text-xs font-medium text-white"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Shelves
            </button>
          )}
        </div>
      ) : (
        sections.map((section, sIdx) => {
          if (!section.items || section.items.length === 0) return null;

          return (
            <section key={`${section.title}-${sIdx}`} className="space-y-4">
              <h2 className="text-xl font-bold text-white">
                {section.title}
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {section.items.slice(0, 12).map((item, idx) => {
                  const isTrack = item.videoId || item.type === 'song';
                  const isAlbum = item.browseId?.startsWith('MPRE') || item.type === 'album';
                  const isArtist = item.browseId?.startsWith('UC') || item.type === 'artist';

                  const handleClick = () => {
                    if (isAlbum && item.browseId) {
                      setActiveView({ type: 'album', albumId: item.browseId });
                    } else if (isArtist && item.browseId) {
                      setActiveView({ type: 'artist', artistId: item.browseId });
                    } else if (item.videoId) {
                      playSong(item, section.items.filter((i) => i.videoId));
                    }
                  };

                  return (
                    <div
                      key={`${item.videoId || item.browseId || idx}`}
                      onClick={handleClick}
                      className="group p-3 rounded-2xl glass-panel hover:bg-white/10 transition-all duration-300 cursor-pointer flex flex-col justify-between border border-white/5 hover:border-white/15 hover:-translate-y-1 shadow-lg"
                    >
                      <div className={`relative aspect-square w-full overflow-hidden mb-3 shadow-md bg-neutral-900 ${
                        isArtist ? 'rounded-full' : 'rounded-xl'
                      }`}>
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        {isTrack && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <div className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                              <Play className="w-5 h-5 fill-black translate-x-0.5" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="overflow-hidden">
                        <h3 className="text-xs font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                          {item.title}
                        </h3>
                        {item.artist && (
                          <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                            {item.artist}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
};
