import React, { useState } from 'react';
import { Heart, History, Play, Trash2, Music } from 'lucide-react';
import { usePlayer } from '../context/PlayerContext';
import { Track, ActiveView } from '../types';

interface LibraryViewProps {
  setActiveView: (view: ActiveView) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ setActiveView }) => {
  const { favorites, history, playSong, toggleFavorite } = usePlayer();
  const [tab, setTab] = useState<'favorites' | 'history'>('favorites');

  const tracksToDisplay = tab === 'favorites' ? favorites : history;

  const handlePlayAll = () => {
    if (tracksToDisplay.length > 0) {
      playSong(tracksToDisplay[0], tracksToDisplay);
    }
  };

  return (
    <div className="space-y-8 pb-36 animate-in fade-in duration-300">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Your Library</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Locally saved favorites and listening history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 bg-white/10 rounded-2xl border border-white/10">
            <button
              onClick={() => setTab('favorites')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                tab === 'favorites'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5 fill-current" />
              Favorites ({favorites.length})
            </button>
            <button
              onClick={() => setTab('history')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                tab === 'history'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              History ({history.length})
            </button>
          </div>

          {tracksToDisplay.length > 0 && (
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black text-xs font-semibold hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              Play All
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {tracksToDisplay.length === 0 ? (
        <div className="py-24 text-center max-w-sm mx-auto text-neutral-400 space-y-3 glass-panel rounded-3xl p-8">
          <div className="w-14 h-14 rounded-2xl glass-panel flex items-center justify-center mx-auto text-neutral-400">
            {tab === 'favorites' ? <Heart className="w-7 h-7" /> : <History className="w-7 h-7" />}
          </div>
          <h3 className="text-base font-bold text-neutral-200">
            {tab === 'favorites' ? 'No favorites yet' : 'No history yet'}
          </h3>
          <p className="text-xs text-neutral-400 leading-relaxed">
            {tab === 'favorites'
              ? 'Tap the heart icon on any song to save it to your library.'
              : 'Songs you listen to will automatically appear here.'}
          </p>
          <button
            onClick={() => setActiveView({ type: 'search' })}
            className="px-4 py-2 rounded-xl glass-button text-xs font-semibold text-white mt-2"
          >
            Discover Music
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tracksToDisplay.map((track, idx) => (
            <div
              key={`${track.videoId}-${idx}`}
              className="group flex items-center justify-between p-2.5 rounded-2xl hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
            >
              <div
                onClick={() => playSong(track, tracksToDisplay)}
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
                    {track.artist}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pl-3 shrink-0">
                <span className="text-xs text-neutral-400 tabular-nums">
                  {track.duration || ''}
                </span>
                <button
                  onClick={() => toggleFavorite(track)}
                  className="p-2 rounded-xl text-pink-500 hover:text-pink-400 hover:bg-white/10 transition-colors"
                  title="Toggle favorite"
                >
                  <Heart className="w-4 h-4 fill-pink-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
