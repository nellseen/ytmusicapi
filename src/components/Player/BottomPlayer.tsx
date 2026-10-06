import React from 'react';
import {
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
  Maximize2,
  Loader2,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';

export const formatTime = (secs: number): string => {
  if (isNaN(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

export const BottomPlayer: React.FC = () => {
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
    togglePlay,
    next,
    previous,
    seekTo,
    setVolume,
    toggleMute,
    toggleShuffle,
    toggleRepeat,
    isNowPlayingOpen,
    setIsNowPlayingOpen,
    isLyricsOpen,
    setIsLyricsOpen,
    isQueueOpen,
    setIsQueueOpen,
    toggleFavorite,
    isFavorite,
  } = usePlayer();

  if (!currentSong) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isFav = isFavorite(currentSong.videoId);

  return (
    <>
      {/* DESKTOP PLAYER */}
      <div className="hidden md:flex fixed bottom-0 left-0 right-0 h-24 bg-neutral-950/85 backdrop-blur-3xl border-t border-white/10 z-40 px-6 items-center justify-between select-none shadow-2xl">
        {/* Left: Track Info & Favorite */}
        <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
          <div
            onClick={() => setIsNowPlayingOpen(true)}
            className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 cursor-pointer group shadow-md shadow-black/50"
          >
            <img
              src={currentSong.thumbnail}
              alt={currentSong.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="overflow-hidden">
            <h4
              onClick={() => setIsNowPlayingOpen(true)}
              className="text-sm font-semibold text-white truncate cursor-pointer hover:underline"
              title={currentSong.title}
            >
              {currentSong.title}
            </h4>
            <p className="text-xs text-neutral-400 truncate" title={currentSong.artist}>
              {currentSong.artist}
            </p>
          </div>

          <button
            onClick={() => toggleFavorite(currentSong)}
            className={`p-2 rounded-full transition-colors ${
              isFav ? 'text-pink-500' : 'text-neutral-400 hover:text-white'
            }`}
            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-pink-500' : ''}`} />
          </button>
        </div>

        {/* Center: Controls & Scrubber */}
        <div className="flex flex-col items-center gap-2 w-2/4 max-w-xl">
          {/* Action buttons */}
          <div className="flex items-center gap-5">
            <button
              onClick={toggleShuffle}
              className={`p-1.5 rounded-full transition-colors ${
                shuffle ? 'text-purple-400 bg-white/10' : 'text-neutral-400 hover:text-white'
              }`}
              title="Shuffle"
            >
              <Shuffle className="w-4 h-4" />
            </button>

            <button
              onClick={previous}
              className="p-1.5 rounded-full text-neutral-300 hover:text-white hover:scale-105 active:scale-95 transition-all"
              title="Previous"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              disabled={isLoading && !isPlaying}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10 disabled:opacity-75"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5 fill-black" />
              ) : (
                <Play className="w-5 h-5 fill-black translate-x-0.5" />
              )}
            </button>

            <button
              onClick={next}
              className="p-1.5 rounded-full text-neutral-300 hover:text-white hover:scale-105 active:scale-95 transition-all"
              title="Next"
            >
              <SkipForward className="w-5 h-5" />
            </button>

            <button
              onClick={toggleRepeat}
              className={`p-1.5 rounded-full transition-colors ${
                repeat !== 'off' ? 'text-purple-400 bg-white/10' : 'text-neutral-400 hover:text-white'
              }`}
              title={`Repeat: ${repeat}`}
            >
              {repeat === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
            </button>
          </div>

          {/* Scrubber timeline */}
          <div className="flex items-center gap-3 w-full text-xs text-neutral-400">
            <span className="w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
            <div className="relative flex-1 flex items-center">
              <input
                type="range"
                min="0"
                max={duration > 0 ? duration : 100}
                step="0.5"
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="w-full h-1 bg-white/15 rounded-lg appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.9) ${progressPercent}%, rgba(255,255,255,0.15) ${progressPercent}%, rgba(255,255,255,0.15) 100%)`,
                }}
              />
            </div>
            <span className="w-10 tabular-nums">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right: Volume & Panel Toggles */}
        <div className="flex items-center justify-end gap-3 w-1/4 min-w-[200px]">
          {/* Lyrics toggle */}
          <button
            onClick={() => {
              setIsNowPlayingOpen(true);
              setIsLyricsOpen(true);
              setIsQueueOpen(false);
            }}
            className={`p-2 rounded-xl transition-all ${
              isLyricsOpen && isNowPlayingOpen
                ? 'bg-white/20 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
            title="Lyrics"
          >
            <Mic2 className="w-4 h-4" />
          </button>

          {/* Queue toggle */}
          <button
            onClick={() => {
              setIsNowPlayingOpen(true);
              setIsQueueOpen(true);
              setIsLyricsOpen(false);
            }}
            className={`p-2 rounded-xl transition-all ${
              isQueueOpen && isNowPlayingOpen
                ? 'bg-white/20 text-white'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
            title="Queue"
          >
            <ListMusic className="w-4 h-4" />
          </button>

          {/* Volume Control */}
          <div className="flex items-center gap-2 pl-2">
            <button
              onClick={toggleMute}
              className="text-neutral-400 hover:text-white p-1 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : volume < 0.5 ? (
                <Volume1 className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Fullscreen Expand button */}
          <button
            onClick={() => setIsNowPlayingOpen(true)}
            className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors ml-1"
            title="Open Full Player"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MOBILE MINI PLAYER */}
      <div className="md:hidden fixed bottom-16 left-3 right-3 z-40">
        <div
          onClick={() => setIsNowPlayingOpen(true)}
          className="glass-panel-elevated rounded-2xl p-2.5 flex items-center justify-between gap-3 shadow-2xl active:scale-[0.99] transition-transform cursor-pointer border border-white/15"
        >
          {/* Thumbnail & Title */}
          <div className="flex items-center gap-3 overflow-hidden flex-1">
            <img
              src={currentSong.thumbnail}
              alt={currentSong.title}
              className="w-11 h-11 rounded-xl object-cover shrink-0 shadow-md"
            />
            <div className="overflow-hidden flex-1">
              <h4 className="text-xs font-semibold text-white truncate">{currentSong.title}</h4>
              <p className="text-[11px] text-neutral-400 truncate">{currentSong.artist}</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center shadow-md active:scale-95 transition-transform"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-black" />
              ) : (
                <Play className="w-4 h-4 fill-black translate-x-0.5" />
              )}
            </button>
            <button
              onClick={next}
              className="p-2 text-neutral-300 hover:text-white active:scale-90 transition-transform"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mini progress bar on bottom edge */}
        <div className="w-full h-1 bg-white/10 rounded-full mt-1 overflow-hidden px-1">
          <div
            className="h-full bg-white/80 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </>
  );
};
