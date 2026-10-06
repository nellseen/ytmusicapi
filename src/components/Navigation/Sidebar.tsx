import React from 'react';
import { Home, Search, Library, ListMusic, Disc3, Sparkles } from 'lucide-react';
import { ActiveView } from '../../types';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  favoritesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  favoritesCount,
}) => {
  const navItems = [
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      view: { type: 'home' } as ActiveView,
    },
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      view: { type: 'search' } as ActiveView,
    },
    {
      id: 'library',
      label: 'Library',
      icon: Library,
      badge: favoritesCount > 0 ? favoritesCount : undefined,
      view: { type: 'library' } as ActiveView,
    },
    {
      id: 'queue',
      label: 'Up Next',
      icon: ListMusic,
      view: { type: 'queue' } as ActiveView,
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen border-r border-white/10 bg-neutral-950/80 backdrop-blur-2xl p-5 select-none z-30 shrink-0">
      {/* Brand Header */}
      <div 
        onClick={() => setActiveView({ type: 'home' })}
        className="flex items-center gap-3 px-2 py-3 mb-6 cursor-pointer group"
      >
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/25 group-hover:scale-105 transition-transform duration-300">
          <Disc3 className="w-6 h-6 text-white animate-spin-slow" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
            Sonora
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded-full bg-white/10 text-white/70 tracking-wider">
              Music
            </span>
          </h1>
          <p className="text-xs text-neutral-400">Pure Glass Experience</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="space-y-1.5">
        <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
          Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView.type === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.view)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 ${
                isActive
                  ? 'bg-white/15 text-white shadow-sm border border-white/10 backdrop-blur-xl'
                  : 'text-neutral-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white font-semibold">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Subtle Divider */}
      <div className="my-6 border-t border-white/5" />

      {/* Quick Playlists & Discover Banner */}
      <div className="mt-auto">
        <div className="p-4 rounded-2xl glass-panel relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-purple-500/20 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-300 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>High Fidelity</span>
          </div>
          <p className="text-xs text-neutral-400 leading-relaxed mb-3">
            Stream your favorite music with zero ads & synced lyrics.
          </p>
          <button
            onClick={() => setActiveView({ type: 'search' })}
            className="w-full py-1.5 px-3 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-medium text-white transition-colors"
          >
            Explore Catalog
          </button>
        </div>
      </div>
    </aside>
  );
};
