import React, { useState } from 'react';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { Sidebar } from './components/Navigation/Sidebar';
import { MobileNav } from './components/Navigation/MobileNav';
import { BottomPlayer } from './components/Player/BottomPlayer';
import { NowPlayingModal } from './components/Player/NowPlayingModal';
import { HomeView } from './views/HomeView';
import { SearchView } from './views/SearchView';
import { ArtistView } from './views/ArtistView';
import { AlbumView } from './views/AlbumView';
import { LibraryView } from './views/LibraryView';
import { QueueView } from './components/Player/QueueView';
import { ActiveView } from './types';
import { Search, Disc3, Sparkles } from 'lucide-react';

const MainLayout: React.FC = () => {
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'home' });
  const { favorites, setIsNowPlayingOpen } = usePlayer();

  const renderActiveView = () => {
    switch (activeView.type) {
      case 'home':
        return <HomeView setActiveView={setActiveView} />;
      case 'search':
        return <SearchView setActiveView={setActiveView} />;
      case 'artist':
        return <ArtistView artistId={activeView.artistId} setActiveView={setActiveView} />;
      case 'album':
        return <AlbumView albumId={activeView.albumId} setActiveView={setActiveView} />;
      case 'library':
        return <LibraryView setActiveView={setActiveView} />;
      case 'queue':
        return (
          <div className="pt-4 max-w-2xl mx-auto pb-36">
            <QueueView />
          </div>
        );
      default:
        return <HomeView setActiveView={setActiveView} />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-950 text-neutral-100 select-none">
      {/* Background ambient glass gradients */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-purple-900/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] bg-indigo-900/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Desktop Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        favoritesCount={favorites.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-white/5 bg-neutral-950/60 backdrop-blur-xl flex items-center justify-between px-6 shrink-0 z-20">
          <div className="flex items-center gap-4">
            {/* Mobile Brand Logo */}
            <div
              onClick={() => setActiveView({ type: 'home' })}
              className="flex md:hidden items-center gap-2 cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center">
                <Disc3 className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-base tracking-tight text-white">Sonora</span>
            </div>

            {/* Quick search input trigger for desktop */}
            {activeView.type !== 'search' && (
              <button
                onClick={() => setActiveView({ type: 'search' })}
                className="hidden sm:flex items-center gap-2.5 px-4 py-1.5 rounded-xl glass-button text-xs text-neutral-400 hover:text-white transition-all w-64"
              >
                <Search className="w-4 h-4 text-neutral-400" />
                <span>Search music or artists...</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-neutral-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Lossless Audio</span>
            </div>

            <button
              onClick={() => setActiveView({ type: 'search' })}
              className="sm:hidden p-2 rounded-xl glass-button text-neutral-300"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-10 py-6 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {renderActiveView()}
          </div>
        </main>
      </div>

      {/* Global Bottom Player */}
      <BottomPlayer />

      {/* Mobile Bottom Navigation */}
      <MobileNav
        activeView={activeView}
        setActiveView={setActiveView}
        favoritesCount={favorites.length}
      />

      {/* Fullscreen Now Playing Modal */}
      <NowPlayingModal
        onNavigateArtist={(artistId) => setActiveView({ type: 'artist', artistId })}
      />
    </div>
  );
};

export default function App() {
  return (
    <PlayerProvider>
      <MainLayout />
    </PlayerProvider>
  );
}
