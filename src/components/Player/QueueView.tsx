import React from 'react';
import { ListMusic, Trash2, X, Play, Music } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { Track } from '../../types';

export const QueueView: React.FC = () => {
  const {
    currentSong,
    queue,
    currentIndex,
    playSong,
    removeFromQueue,
    clearQueue,
    isPlaying,
  } = usePlayer();

  return (
    <div className="h-full overflow-y-auto px-4 md:px-8 py-6 space-y-6 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ListMusic className="w-5 h-5 text-purple-400" />
            Playing Queue
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            {queue.length} {queue.length === 1 ? 'song' : 'songs'} in queue
          </p>
        </div>

        {queue.length > 1 && (
          <button
            onClick={clearQueue}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/20 text-neutral-400 hover:text-red-300 text-xs font-medium transition-colors border border-white/5 hover:border-red-500/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear
          </button>
        )}
      </div>

      {/* Currently Playing Section */}
      {currentSong && (
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-purple-400">
            Now Playing
          </div>
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xl shadow-lg">
            <div className="flex items-center gap-3 overflow-hidden">
              <img
                src={currentSong.thumbnail}
                alt={currentSong.title}
                className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md"
              />
              <div className="overflow-hidden">
                <h4 className="text-sm font-semibold text-white truncate">{currentSong.title}</h4>
                <p className="text-xs text-neutral-300 truncate">{currentSong.artist}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 pr-2 shrink-0">
              {isPlaying ? (
                <div className="flex items-center gap-0.5">
                  <span className="w-1 h-4 bg-purple-400 rounded-full animate-pulse" />
                  <span className="w-1 h-3 bg-purple-400 rounded-full animate-pulse delay-75" />
                  <span className="w-1 h-5 bg-purple-400 rounded-full animate-pulse delay-150" />
                </div>
              ) : (
                <Music className="w-4 h-4 text-neutral-400" />
              )}
              <span className="text-xs text-neutral-400 tabular-nums">
                {currentSong.duration || '3:00'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Up Next List */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Up Next
        </div>

        {queue.length <= 1 ? (
          <div className="py-12 text-center text-neutral-400 glass-panel rounded-2xl p-6">
            <Music className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">Queue is empty</p>
            <p className="text-xs text-neutral-400 mt-1">
              Add songs from search or playlists to build your queue.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {queue.map((track: Track, idx: number) => {
              if (idx === currentIndex) return null; // Already shown in Now Playing
              return (
                <div
                  key={`${track.videoId}-${idx}`}
                  className="group flex items-center justify-between p-2.5 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5"
                >
                  <div
                    onClick={() => playSong(track)}
                    className="flex items-center gap-3 overflow-hidden flex-1 cursor-pointer"
                  >
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 fill-white text-white" />
                      </div>
                    </div>

                    <div className="overflow-hidden flex-1">
                      <h4 className="text-xs font-medium text-neutral-200 group-hover:text-white truncate">
                        {track.title}
                      </h4>
                      <p className="text-[11px] text-neutral-400 truncate">{track.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-2 shrink-0">
                    <span className="text-xs text-neutral-400 tabular-nums">
                      {track.duration || ''}
                    </span>
                    <button
                      onClick={() => removeFromQueue(idx)}
                      className="p-1.5 text-neutral-400 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove from queue"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
