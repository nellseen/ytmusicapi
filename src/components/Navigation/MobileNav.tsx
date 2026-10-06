import React from 'react';
import { Home, Search, Library, ListMusic } from 'lucide-react';
import { ActiveView } from '../../types';

interface MobileNavProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  favoritesCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeView,
  setActiveView,
  favoritesCount,
}) => {
  const items = [
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
      label: 'Queue',
      icon: ListMusic,
      view: { type: 'queue' } as ActiveView,
    },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-neutral-950/85 backdrop-blur-3xl border-t border-white/10 px-4 py-2 pb-safe">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeView.type === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveView(item.view)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all relative ${
                isActive ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 text-white' : ''}`} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1 -right-2.5 w-4 h-4 bg-purple-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[11px] mt-1 font-medium ${isActive ? 'text-white font-semibold' : ''}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
