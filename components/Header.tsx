import React from 'react';
import { AppView } from '../types';
import { Bot, Clapperboard, Mic, MessageSquare, Sparkles, Users } from 'lucide-react';

interface HeaderProps {
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, setCurrentView }) => {
  const navItems = [
    { view: AppView.Live, label: 'Live', icon: Mic },
    { view: AppView.Chat, label: 'Chat', icon: MessageSquare },
    { view: AppView.Theatre, label: 'Theatre', icon: Clapperboard },
    { view: AppView.Roundtable, label: 'Roundtable', icon: Users },
    { view: AppView.Avatar, label: 'Avatar Gen', icon: Sparkles },
    { view: AppView.Video, label: 'Video Gen', icon: Bot },
  ];

  const NavButton: React.FC<{ view: AppView; label: string; Icon: React.ElementType }> = ({ view, label, Icon }) => {
    const isActive = currentView === view;
    return (
      <button
        onClick={() => setCurrentView(view)}
        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        }`}
      >
        <Icon className="h-4 w-4" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-30 bg-slate-950 border-b border-slate-800">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Bot className="h-8 w-8 text-indigo-400" />
            <h1 className="ml-3 text-xl font-bold text-slate-100 hidden md:block">AI Companion</h1>
          </div>
          <nav className="flex items-center gap-2">
            {navItems.map(item => (
              <NavButton key={item.view} view={item.view} label={item.label} Icon={item.icon} />
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Header;