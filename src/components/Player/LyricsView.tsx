import React, { useEffect, useState, useRef } from 'react';
import { Mic2, Loader2, AlertCircle } from 'lucide-react';
import { LyricsData } from '../../types';
import { fetchLyrics } from '../../services/api';
import { usePlayer } from '../../context/PlayerContext';

interface LyricsViewProps {
  videoId: string;
  title: string;
  artist: string;
}

export const LyricsView: React.FC<LyricsViewProps> = ({ videoId, title, artist }) => {
  const { currentTime, seekTo } = usePlayer();
  const [lyricsData, setLyricsData] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchLyrics(videoId, title, artist)
      .then((data) => {
        if (isMounted) {
          setLyricsData(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to load lyrics');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [videoId, title, artist]);

  // Find active line index based on currentTime
  let activeIndex = -1;
  if (lyricsData?.synced && lyricsData.synced.length > 0) {
    for (let i = 0; i < lyricsData.synced.length; i++) {
      if (currentTime >= lyricsData.synced[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }
  }

  // Auto-scroll to active line
  useEffect(() => {
    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-20 text-neutral-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        <p className="text-sm font-medium">Fetching real lyrics...</p>
      </div>
    );
  }

  if (error || !lyricsData || (!lyricsData.synced && !lyricsData.plain)) {
    return (
      <div className="h-full flex flex-col items-center justify-center py-20 text-neutral-400 gap-4 text-center px-6">
        <div className="w-14 h-14 rounded-2xl glass-panel flex items-center justify-center text-neutral-400">
          <Mic2 className="w-7 h-7" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-neutral-200">Lyrics unavailable</h4>
          <p className="text-xs text-neutral-400 mt-1 max-w-sm">
            Lyrics are not available for this track right now. Enjoy the music!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-auto px-4 md:px-8 py-8 space-y-6 text-center select-none"
    >
      {lyricsData.source && (
        <div className="text-[11px] uppercase tracking-wider text-neutral-400 mb-6 font-semibold">
          {lyricsData.source}
        </div>
      )}

      {/* SYNCED LYRICS */}
      {lyricsData.synced && lyricsData.synced.length > 0 ? (
        <div className="space-y-4 max-w-xl mx-auto pb-24">
          {lyricsData.synced.map((line, idx) => {
            const isActive = idx === activeIndex;
            const isPassed = idx < activeIndex;

            return (
              <div
                key={idx}
                ref={isActive ? activeLineRef : null}
                onClick={() => seekTo(line.time)}
                className={`py-2 px-4 rounded-xl cursor-pointer transition-all duration-300 font-semibold text-lg md:text-2xl leading-relaxed ${
                  isActive
                    ? 'text-white scale-105 bg-white/10 backdrop-blur-md shadow-lg shadow-black/20'
                    : isPassed
                    ? 'text-neutral-400 hover:text-neutral-200 opacity-60'
                    : 'text-neutral-400 hover:text-neutral-200 opacity-80'
                }`}
              >
                {line.text}
              </div>
            );
          })}
        </div>
      ) : (
        /* PLAIN LYRICS */
        <div className="max-w-xl mx-auto pb-24 text-left whitespace-pre-line text-neutral-300 text-base md:text-lg leading-relaxed font-normal glass-panel p-6 rounded-3xl">
          {lyricsData.plain}
        </div>
      )}
    </div>
  );
};
