import React, { useState } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  Volume1,
  Mic2,
  ListMusic,
  Heart,
  Music2,
  Loader2,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { LyricsView } from './LyricsView';
import { QueueView } from './QueueView';
import { formatTime } from './BottomPlayer';

interface NowPlayingModalProps {
  onNavigateArtist?: (artistId: string) => void;
}

export const NowPlayingModal: React.FC<NowPlayingModalProps> = ({ onNavigateArtist }) => {
  const {
    currentSong,
    isPlaying,
    isLoading,
    currentTime,
    duration,
    volume,
    isMuted,
    shuffle,
    repeat,
    isNowPlayingOpen,
    setIsNowPlayingOpen,
    isLyricsOpen,
    setIsLyricsOpen,
    isQueueOpen,
    setIsQueueOpen,
    togglePlay,
    next,
    previous,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    toggleFavorite,
    isFavorite,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState<'player' | 'lyrics' | 'queue'>('player');

  // Synchronize modal tab with context toggles
  React.useEffect(() => {
    if (isLyricsOpen) setActiveTab('lyrics');
    else if (isQueueOpen) setActiveTab('queue');
    else setActiveTab('player');
  }, [isLyricsOpen, isQueueOpen]);

  if (!isNowPlayingOpen || !currentSong) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isFav = isFavorite(currentSong.videoId);

  const handleTabChange = (tab: 'player' | 'lyrics' | 'queue') => {
    setActiveTab(tab);
    if (tab === 'lyrics') {
      setIsLyricsOpen(true);
      setIsQueueOpen(false);
    } else if (tab === 'queue') {
      setIsQueueOpen(true);
      setIsLyricsOpen(false);
    } else {
      setIsLyricsOpen(false);
      setIsQueueOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/95 backdrop-blur-3xl animate-in fade-in duration-300 overflow-hidden select-none">
      {/* Dynamic Ambient Background Blur */}
      <div
        className="absolute inset-0 opacity-25 filter blur-3xl pointer-events-none scale-125 transition-all duration-700"
        style={{
          backgroundImage: `url(${currentSong.thumbnail})`,
          backgroundPosition: 'center',
          backgroundSize: 'cover',
        }}
      />
      <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-2xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-white/5">
        <button
          onClick={() => setIsNowPlayingOpen(false)}
          className="p-2 -ml-2 rounded-full text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Dismiss"
        >
          <ChevronDown className="w-6 h-6" />
        </button>

        {/* Tab switchers in header */}
        <div className="flex items-center gap-1 p-1 bg-white/10 backdrop-blur-xl rounded-full border border-white/10">
          <button
            onClick={() => handleTabChange('player')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeTab === 'player'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            Track
          </button>
          <button
            onClick={() => handleTabChange('lyrics')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'lyrics'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            Lyrics
          </button>
          <button
            onClick={() => handleTabChange('queue')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'queue'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <ListMusic className="w-3.5 h-3.5" />
            Queue
          </button>
        </div>

        <button
          onClick={() => toggleFavorite(currentSong)}
          className={`p-2 -mr-2 rounded-full transition-colors ${
            isFav ? 'text-pink-500' : 'text-neutral-400 hover:text-white'
          }`}
          title={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart className={`w-5 h-5 ${isFav ? 'fill-pink-500' : ''}`} />
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="relative z-10 flex-1 overflow-hidden flex flex-col justify-center max-w-4xl w-full mx-auto p-4 md:p-8">
        {activeTab === 'lyrics' ? (
          <LyricsView
            videoId={currentSong.videoId}
            title={currentSong.title}
            artist={currentSong.artist}
          />
        ) : activeTab === 'queue' ? (
          <QueueView />
        ) : (
          /* Main Now Playing View */
          <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full py-4 space-y-8">
            {/* Large Album Artwork */}
            <div className="relative w-64 h-64 md:w-80 md:h-80 rounded-3xl overflow-hidden shadow-2xl shadow-black/80 border border-white/15 transition-transform duration-500 group">
              <img
                src={currentSong.thumbnail}
                alt={currentSong.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            {/* Song Information */}
            <div className="w-full text-left space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight truncate pr-2">
                  {currentSong.title}
                </h2>
              </div>
              <p
                onClick={() => {
                  const firstArtistId = currentSong.artists?.[0]?.id;
                  if (firstArtistId && onNavigateArtist) {
                    setIsNowPlayingOpen(false);
                    onNavigateArtist(firstArtistId);
                  }
                }}
                className="text-base text-neutral-400 font-medium truncate cursor-pointer hover:text-white hover:underline transition-colors"
              >
                {currentSong.artist}
              </p>
              {currentSong.album && (
                <p className="text-xs text-neutral-400 truncate">
                  {currentSong.album}
                </p>
              )}
            </div>

            {/* Progress Scrubber */}
            <div className="w-full space-y-2">
              <div className="relative flex items-center">
                <input
                  type="range"
                  min="0"
                  max={duration > 0 ? duration : 100}
                  step="0.5"
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.9) ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%, rgba(255,255,255,0.15) 100%)`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-neutral-400 font-medium tabular-nums px-0.5">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Main Transport Controls */}
            <div className="w-full flex items-center justify-between px-2 pt-2">
              <button
                onClick={toggleShuffle}
                className={`p-3 rounded-full transition-colors ${
                  shuffle ? 'text-purple-400 bg-white/10' : 'text-neutral-400 hover:text-white'
                }`}
                title="Shuffle"
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button
                onClick={previous}
                className="p-3 text-neutral-200 hover:text-white active:scale-95 transition-transform"
                title="Previous track"
              >
                <SkipBack className="w-7 h-7" />
              </button>

              <button
                onClick={togglePlay}
                disabled={isLoading && !isPlaying}
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl shadow-white/20 active:scale-95 transition-all hover:scale-105"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoading ? (
                  <Loader2 className="w-7 h-7 animate-spin text-black" />
                ) : isPlaying ? (
                  <Pause className="w-7 h-7 fill-black" />
                ) : (
                  <Play className="w-7 h-7 fill-black translate-x-0.5" />
                )}
              </button>

              <button
                onClick={next}
                className="p-3 text-neutral-200 hover:text-white active:scale-95 transition-transform"
                title="Next track"
              >
                <SkipForward className="w-7 h-7" />
              </button>

              <button
                onClick={toggleRepeat}
                className={`p-3 rounded-full transition-colors ${
                  repeat !== 'off' ? 'text-purple-400 bg-white/10' : 'text-neutral-400 hover:text-white'
                }`}
                title={`Repeat: ${repeat}`}
              >
                {repeat === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
              </button>
            </div>

            {/* Volume Bar inside modal */}
            <div className="w-full flex items-center gap-3 pt-4 px-4 text-neutral-400">
              <button onClick={toggleMute} className="hover:text-white p-1">
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={isMuted ? 0 : volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
