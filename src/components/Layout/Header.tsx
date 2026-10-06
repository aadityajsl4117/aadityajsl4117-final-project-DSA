import React from 'react';
import { Menu, Search, Mail, Zap } from 'lucide-react';
import { useLibrary } from '../../hooks/useLibrary';

interface HeaderProps {
  title: string;
  onMenuToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ title, onMenuToggle }) => {
  const { state } = useLibrary();
  
  const sentEmails = state.emailLogs.length;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm h-16 flex items-center px-4 justify-between">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-semibold text-gray-800 capitalize">{title.replace('-', ' ')}</h1>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex relative w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-1.5 border border-gray-200 rounded-full focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-gray-50 hover:bg-white transition-colors outline-none text-sm"
            placeholder="Global search..."
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
            <Zap size={14} className="text-warning-500 fill-warning-500" />
            <span className="hidden sm:inline">System Active</span>
          </div>
          
          <div className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full cursor-pointer transition-colors">
            <Mail size={20} />
            {sentEmails > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 bg-primary-500 text-white text-[10px] font-bold rounded-full border-2 border-white">
                {sentEmails > 99 ? '99+' : sentEmails}
              </span>
            )}
          </div>
          
          <div className="w-8 h-8 rounded-full bg-primary-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
            AJ
          </div>
        </div>
      </div>
    </header>
  );
};
