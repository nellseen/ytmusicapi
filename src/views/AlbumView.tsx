import React, { useEffect, useState } from 'react';
import { Play, Shuffle, Plus, ArrowLeft, Disc, Clock, Loader2 } from 'lucide-react';
import { Album, ActiveView, Track } from '../types';
import { fetchAlbum } from '../services/api';
import { usePlayer } from '../context/PlayerContext';

interface AlbumViewProps {
  albumId: string;
  setActiveView: (view: ActiveView) => void;
}

export const AlbumView: React.FC<AlbumViewProps> = ({ albumId, setActiveView }) => {
  const { playAlbum, playSong, addToQueue, currentSong, isPlaying } = usePlayer();
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorInfo, setErrorInfo] = useState<{ message: string; retryable: boolean } | null>(null);

  const loadAlbumData = () => {
    setLoading(true);
    setErrorInfo(null);

    fetchAlbum(albumId)
      .then((data) => {
        setAlbum(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setLoading(false);
        const isUpstream = err?.retryable !== undefined ? err.retryable : true;
        setErrorInfo({
          message: err?.message || 'Failed to load album',
          retryable: isUpstream
        });
      });
  };

  useEffect(() => {
    loadAlbumData();
  }, [albumId]);

  if (loading) {
    return (
      <div className="py-32 flex flex-col items-center justify-center text-neutral-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        <p className="text-sm font-medium">Loading album details...</p>
      </div>
    );
  }

  if (errorInfo || !album) {
    return (
      <div className="py-24 text-center max-w-md mx-auto text-neutral-400 space-y-4">
        <p className="text-sm text-red-400">{errorInfo?.message || 'Album not found'}</p>
        <div className="flex items-center justify-center gap-3">
          {errorInfo?.retryable && (
            <button
              onClick={loadAlbumData}
              className="px-4 py-2 rounded-xl glass-button text-xs font-semibold text-white"
            >
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

  const handlePlayAlbum = (shuffleMode: boolean = false) => {
    if (!album.tracks || album.tracks.length === 0) return;
    if (shuffleMode) {
      const shuffledTracks = [...album.tracks].sort(() => Math.random() - 0.5);
      playSong(shuffledTracks[0], shuffledTracks);
    } else {
      playAlbum(album, 0);
    }
  };

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

      {/* Album Header */}
      <div className="relative rounded-3xl p-6 md:p-10 glass-panel-elevated overflow-hidden border border-white/10 shadow-2xl flex flex-col md:flex-row items-center gap-8">
        <div className="w-44 h-44 md:w-56 md:h-56 rounded-2xl overflow-hidden shrink-0 shadow-2xl border border-white/15 bg-neutral-900 group">
          <img
            src={album.thumbnail}
            alt={album.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        </div>

        <div className="flex-1 text-center md:text-left space-y-3">
          <div className="inline-block px-3 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-purple-300 uppercase tracking-wider">
            Album
          </div>
          <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">
            {album.title}
          </h1>
          <p
            onClick={() => {
              const artistId = album.artists?.[0]?.id;
              if (artistId) setActiveView({ type: 'artist', artistId });
            }}
            className="text-sm md:text-base text-neutral-300 font-semibold cursor-pointer hover:text-white hover:underline transition-colors"
          >
            {album.artist}
          </p>
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs text-neutral-400">
            {album.year && <span>{album.year}</span>}
            {album.year && <span>•</span>}
            <span>{album.trackCount} tracks</span>
            {album.duration && (
              <>
                <span>•</span>
                <span>{album.duration}</span>
              </>
            )}
          </div>

          {/* Action transport buttons */}
          <div className="flex items-center justify-center md:justify-start gap-3 pt-3">
            <button
              onClick={() => handlePlayAlbum(false)}
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-white text-black font-semibold text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/10"
            >
              <Play className="w-4 h-4 fill-black" />
              Play Album
            </button>
            <button
              onClick={() => handlePlayAlbum(true)}
              className="flex items-center gap-2 px-6 py-3 rounded-full glass-button text-white font-semibold text-sm hover:scale-105 active:scale-95 transition-all"
            >
              <Shuffle className="w-4 h-4" />
              Shuffle
            </button>
          </div>
        </div>
      </div>

      {/* Tracklist Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-white/5 text-xs font-semibold text-neutral-400 px-3">
          <div className="flex items-center gap-4">
            <span className="w-6 text-center">#</span>
            <span>Title</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
          </div>
        </div>

        <div className="space-y-1">
          {album.tracks.map((track, idx) => {
            const isCurrent = currentSong?.videoId === track.videoId;

            return (
              <div
                key={`${track.videoId}-${idx}`}
                className={`group flex items-center justify-between p-3 rounded-2xl transition-all border ${
                  isCurrent
                    ? 'bg-white/15 border-white/20'
                    : 'hover:bg-white/5 border-transparent hover:border-white/5'
                }`}
              >
                <div
                  onClick={() => playSong(track, album.tracks)}
                  className="flex items-center gap-4 overflow-hidden flex-1 cursor-pointer"
                >
                  <span className={`w-6 text-center text-xs font-semibold tabular-nums ${
                    isCurrent ? 'text-purple-400' : 'text-neutral-400'
                  }`}>
                    {isCurrent && isPlaying ? (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping" />
                    ) : (
                      idx + 1
                    )}
                  </span>

                  <div className="overflow-hidden flex-1">
                    <h4 className={`text-sm font-semibold truncate ${
                      isCurrent ? 'text-purple-300' : 'text-white group-hover:text-purple-300'
                    }`}>
                      {track.title}
                    </h4>
                    <p className="text-xs text-neutral-400 truncate mt-0.5">
                      {track.artist}
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
            );
          })}
        </div>
      </section>
    </div>
  );
};
