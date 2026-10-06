import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Track, Album, RepeatMode } from '../types';
import { fetchRelatedSongs } from '../services/api';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface PlayerContextType {
  currentSong: Track | null;
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  playbackEngine: 'html5' | 'youtube';
  isNowPlayingOpen: boolean;
  isLyricsOpen: boolean;
  isQueueOpen: boolean;
  favorites: Track[];
  history: Track[];
  playSong: (track: Track, newQueue?: Track[]) => void;
  playAlbum: (album: Album, startIndex?: number) => void;
  togglePlay: () => void;
  pause: () => void;
  resume: () => void;
  seekTo: (seconds: number) => void;
  next: () => void;
  previous: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  addToQueue: (track: Track) => void;
  playNext: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  setIsNowPlayingOpen: (open: boolean) => void;
  setIsLyricsOpen: (open: boolean) => void;
  setIsQueueOpen: (open: boolean) => void;
  toggleFavorite: (track: Track) => void;
  isFavorite: (videoId: string) => boolean;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentSong, setCurrentSong] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolumeState] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [shuffle, setShuffle] = useState<boolean>(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [playbackEngine, setPlaybackEngine] = useState<'html5' | 'youtube'>('html5');
  
  // UI Panels
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState<boolean>(false);
  const [isLyricsOpen, setIsLyricsOpen] = useState<boolean>(false);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);

  // Favorites & History (LocalStorage)
  const [favorites, setFavorites] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('sonora_favorites');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [history, setHistory] = useState<Track[]>(() => {
    try {
      const saved = localStorage.getItem('sonora_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Audio elements & refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const [isYtReady, setIsYtReady] = useState<boolean>(false);
  const progressTimerRef = useRef<any>(null);

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sonora_favorites', JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('sonora_history', JSON.stringify(history.slice(0, 50)));
    } catch {}
  }, [history]);

  // Load YouTube Iframe API script once
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = () => {
        initYouTubePlayer();
      };
    } else if (window.YT && window.YT.Player) {
      initYouTubePlayer();
    }
  }, []);

  const initYouTubePlayer = () => {
    if (ytPlayerRef.current || !document.getElementById('sonora-yt-player')) return;
    try {
      ytPlayerRef.current = new window.YT.Player('sonora-yt-player', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            setIsYtReady(true);
            if (ytPlayerRef.current && isMuted) {
              ytPlayerRef.current.mute();
            }
          },
          onStateChange: (event: any) => {
            // YT.PlayerState: -1 (unstarted), 0 (ended), 1 (playing), 2 (paused), 3 (buffering), 5 (cued)
            if (event.data === 1) {
              setIsPlaying(true);
              setIsLoading(false);
              const dur = ytPlayerRef.current.getDuration();
              if (dur > 0) setDuration(dur);
            } else if (event.data === 2) {
              setIsPlaying(false);
            } else if (event.data === 3) {
              setIsLoading(true);
            } else if (event.data === 0) {
              handleTrackEnded();
            }
          },
          onError: () => {
            setIsLoading(false);
            handleTrackEnded();
          },
        },
      });
    } catch (e) {
      console.warn('YouTube Iframe Player init note:', e);
    }
  };

  // Periodic progress polling
  useEffect(() => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    if (isPlaying) {
      progressTimerRef.current = setInterval(() => {
        if (playbackEngine === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
          const ct = ytPlayerRef.current.getCurrentTime() || 0;
          const dur = ytPlayerRef.current.getDuration() || 0;
          setCurrentTime(ct);
          if (dur > 0 && Math.abs(duration - dur) > 1) {
            setDuration(dur);
          }
        } else if (playbackEngine === 'html5' && audioRef.current) {
          setCurrentTime(audioRef.current.currentTime || 0);
          if (audioRef.current.duration) {
            setDuration(audioRef.current.duration);
          }
        }
      }, 500);
    }

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying, playbackEngine, duration]);

  // Global HTML5 Audio listeners
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => {
      if (playbackEngine === 'html5') {
        setCurrentTime(audio.currentTime);
      }
    };

    const onLoadedMetadata = () => {
      if (playbackEngine === 'html5') {
        setDuration(audio.duration || 0);
        setIsLoading(false);
      }
    };

    const onWaiting = () => {
      if (playbackEngine === 'html5') setIsLoading(true);
    };

    const onCanPlay = () => {
      if (playbackEngine === 'html5') setIsLoading(false);
    };

    const onEnded = () => {
      if (playbackEngine === 'html5') handleTrackEnded();
    };

    const onError = () => {
      // If direct stream fails (e.g. 403 / 404 from server stream proxy), seamlessly switch to YouTube engine!
      if (currentSong && playbackEngine === 'html5') {
        console.info('Switching audio to client-side engine for', currentSong.title);
        startYouTubePlayback(currentSong.videoId, audio.currentTime || 0);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [currentSong, playbackEngine]);

  // MediaSession API Integration
  useEffect(() => {
    if ('mediaSession' in navigator && currentSong) {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentSong.title,
        artist: currentSong.artist,
        album: currentSong.album || 'Sonora Music',
        artwork: [
          { src: currentSong.thumbnail, sizes: '512x512', type: 'image/jpeg' },
        ],
      });

      navigator.mediaSession.setActionHandler('play', () => resume());
      navigator.mediaSession.setActionHandler('pause', () => pause());
      navigator.mediaSession.setActionHandler('previoustrack', () => previous());
      navigator.mediaSession.setActionHandler('nexttrack', () => next());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) seekTo(details.seekTime);
      });
    }
  }, [currentSong]);

  // Start YouTube playback
  const startYouTubePlayback = (videoId: string, startSeconds: number = 0) => {
    setPlaybackEngine('youtube');
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
      ytPlayerRef.current.loadVideoById({
        videoId,
        startSeconds: Math.floor(startSeconds),
      });
      ytPlayerRef.current.setVolume(isMuted ? 0 : Math.round(volume * 100));
      ytPlayerRef.current.playVideo();
      setIsPlaying(true);
    } else {
      // In case YT player is not yet ready, retry shortly
      setTimeout(() => {
        if (ytPlayerRef.current && ytPlayerRef.current.loadVideoById) {
          ytPlayerRef.current.loadVideoById({ videoId, startSeconds: Math.floor(startSeconds) });
          ytPlayerRef.current.playVideo();
          setIsPlaying(true);
        }
      }, 500);
    }
  };

  // Play a song
  const playSong = useCallback((track: Track, newQueue?: Track[]) => {
    setCurrentSong(track);
    setCurrentTime(0);
    setDuration(track.duration_seconds || 0);
    setIsLoading(true);

    // Update queue if provided
    if (newQueue && newQueue.length > 0) {
      setQueue(newQueue);
      const foundIdx = newQueue.findIndex((t) => t.videoId === track.videoId);
      setCurrentIndex(foundIdx >= 0 ? foundIdx : 0);
    } else {
      // If no new queue, check if track is in existing queue
      setQueue((prevQueue) => {
        const idx = prevQueue.findIndex((t) => t.videoId === track.videoId);
        if (idx >= 0) {
          setCurrentIndex(idx);
          return prevQueue;
        } else {
          const updated = [...prevQueue, track];
          setCurrentIndex(updated.length - 1);
          return updated;
        }
      });
    }

    // Add to history
    setHistory((prev) => [track, ...prev.filter((t) => t.videoId !== track.videoId)].slice(0, 50));

    // Auto-fetch related songs in background if queue is short
    fetchRelatedSongs(track.videoId).then((related) => {
      if (related && related.length > 0) {
        setQueue((currQueue) => {
          if (currQueue.length <= 3) {
            const existingIds = new Set(currQueue.map((t) => t.videoId));
            const newTracks = related.filter((t) => !existingIds.has(t.videoId));
            return [...currQueue, ...newTracks.slice(0, 10)];
          }
          return currQueue;
        });
      }
    }).catch(() => {});

    // Try HTML5 streaming first
    const streamUrl = `/api/song/${track.videoId}/stream`;
    if (audioRef.current) {
      setPlaybackEngine('html5');
      if (ytPlayerRef.current && ytPlayerRef.current.stopVideo) {
        ytPlayerRef.current.stopVideo();
      }
      audioRef.current.src = streamUrl;
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(() => {
          // If browser restricts direct play or backend stream throws, fall back to YT engine
          startYouTubePlayback(track.videoId, 0);
        });
    } else {
      startYouTubePlayback(track.videoId, 0);
    }
  }, [volume, isMuted]);

  // Play entire album
  const playAlbum = useCallback((album: Album, startIndex: number = 0) => {
    if (!album.tracks || album.tracks.length === 0) return;
    const albumTracks = album.tracks;
    const targetTrack = albumTracks[startIndex] || albumTracks[0];
    playSong(targetTrack, albumTracks);
  }, [playSong]);

  // Pause
  const pause = useCallback(() => {
    setIsPlaying(false);
    if (playbackEngine === 'html5' && audioRef.current) {
      audioRef.current.pause();
    } else if (playbackEngine === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
      ytPlayerRef.current.pauseVideo();
    }
  }, [playbackEngine]);

  // Resume
  const resume = useCallback(() => {
    if (!currentSong) return;
    setIsPlaying(true);
    if (playbackEngine === 'html5' && audioRef.current) {
      audioRef.current.play().catch(() => {
        startYouTubePlayback(currentSong.videoId, currentTime);
      });
    } else if (playbackEngine === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.playVideo) {
      ytPlayerRef.current.playVideo();
    }
  }, [currentSong, playbackEngine, currentTime]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }, [isPlaying, pause, resume]);

  // Seek
  const seekTo = useCallback((seconds: number) => {
    setCurrentTime(seconds);
    if (playbackEngine === 'html5' && audioRef.current) {
      audioRef.current.currentTime = seconds;
    } else if (playbackEngine === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.seekTo) {
      ytPlayerRef.current.seekTo(seconds, true);
    }
  }, [playbackEngine]);

  // Set volume
  const setVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    setIsMuted(clamped === 0);

    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
    if (ytPlayerRef.current && ytPlayerRef.current.setVolume) {
      ytPlayerRef.current.setVolume(Math.round(clamped * 100));
      if (clamped === 0) ytPlayerRef.current.mute();
      else ytPlayerRef.current.unMute();
    }
  }, []);

  // Toggle Mute
  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);

    if (audioRef.current) {
      audioRef.current.muted = nextMuted;
    }
    if (ytPlayerRef.current) {
      if (nextMuted) ytPlayerRef.current.mute();
      else {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.setVolume(Math.round(volume * 100));
      }
    }
  }, [isMuted, volume]);

  // Shuffle toggle
  const toggleShuffle = useCallback(() => {
    setShuffle((prev) => !prev);
  }, []);

  // Repeat toggle
  const toggleRepeat = useCallback(() => {
    setRepeat((prev) => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, []);

  // Next song
  const next = useCallback(() => {
    if (queue.length === 0) return;

    if (repeat === 'one' && currentSong) {
      seekTo(0);
      resume();
      return;
    }

    let nextIndex = currentIndex + 1;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
      if (queue.length > 1 && nextIndex === currentIndex) {
        nextIndex = (nextIndex + 1) % queue.length;
      }
    }

    if (nextIndex >= queue.length) {
      if (repeat === 'all') {
        nextIndex = 0;
      } else {
        pause();
        return;
      }
    }

    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      setCurrentIndex(nextIndex);
      playSong(nextTrack);
    }
  }, [queue, currentIndex, shuffle, repeat, currentSong, seekTo, resume, pause, playSong]);

  // Previous song
  const previous = useCallback(() => {
    if (currentTime > 3) {
      seekTo(0);
      return;
    }

    if (queue.length === 0) return;

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    const prevTrack = queue[prevIndex];
    if (prevTrack) {
      setCurrentIndex(prevIndex);
      playSong(prevTrack);
    }
  }, [currentTime, queue, currentIndex, seekTo, playSong]);

  // Track Ended Handler
  const handleTrackEnded = () => {
    if (repeat === 'one') {
      seekTo(0);
      resume();
    } else {
      next();
    }
  };

  // Add to Queue
  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  // Play Next
  const playNext = useCallback((track: Track) => {
    setQueue((prev) => {
      const copy = [...prev];
      copy.splice(currentIndex + 1, 0, track);
      return copy;
    });
  }, [currentIndex]);

  // Remove from Queue
  const removeFromQueue = useCallback((indexToRemove: number) => {
    setQueue((prev) => {
      const nextQ = prev.filter((_, idx) => idx !== indexToRemove);
      if (indexToRemove < currentIndex) {
        setCurrentIndex((prevIdx) => prevIdx - 1);
      } else if (indexToRemove === currentIndex && nextQ.length > 0) {
        // Current removed
        const newTrack = nextQ[Math.min(currentIndex, nextQ.length - 1)];
        if (newTrack) playSong(newTrack);
      }
      return nextQ;
    });
  }, [currentIndex, playSong]);

  // Clear Queue
  const clearQueue = useCallback(() => {
    if (currentSong) {
      setQueue([currentSong]);
      setCurrentIndex(0);
    } else {
      setQueue([]);
      setCurrentIndex(-1);
    }
  }, [currentSong]);

  // Favorite toggle
  const toggleFavorite = useCallback((track: Track) => {
    setFavorites((prev) => {
      const exists = prev.some((t) => t.videoId === track.videoId);
      if (exists) {
        return prev.filter((t) => t.videoId !== track.videoId);
      } else {
        return [track, ...prev];
      }
    });
  }, []);

  const isFavorite = useCallback(
    (videoId: string) => {
      return favorites.some((t) => t.videoId === videoId);
    },
    [favorites]
  );

  return (
    <PlayerContext.Provider
      value={{
        currentSong,
        queue,
        currentIndex,
        isPlaying,
        isLoading,
        currentTime,
        duration,
        volume,
        isMuted,
        shuffle,
        repeat,
        playbackEngine,
        isNowPlayingOpen,
        isLyricsOpen,
        isQueueOpen,
        favorites,
        history,
        playSong,
        playAlbum,
        togglePlay,
        pause,
        resume,
        seekTo,
        next,
        previous,
        setVolume,
        toggleMute,
        toggleShuffle,
        toggleRepeat,
        addToQueue,
        playNext,
        removeFromQueue,
        clearQueue,
        setIsNowPlayingOpen,
        setIsLyricsOpen,
        setIsQueueOpen,
        toggleFavorite,
        isFavorite,
      }}
    >
      {children}
      {/* Invisible YouTube Iframe Player container */}
      <div
        ref={ytContainerRef}
        className="fixed -left-9999px -top-9999px w-1 h-1 opacity-0 pointer-events-none"
        aria-hidden="true"
      >
        <div id="sonora-yt-player" />
      </div>
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
};
