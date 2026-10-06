import React from 'react';
import { 
  BookOpen, LayoutDashboard, Users, ArrowLeftRight, Clock, 
  CreditCard, Mail, BarChart3, Bot, Shield, Package, QrCode, 
  Play, Undo2, X
} from 'lucide-react';
import { useLibrary } from '../../hooks/useLibrary';
import { useToast } from '../common/Toast';

export type ViewType = 'dashboard' | 'books' | 'members' | 'circulation' | 'reservations' | 'fines' | 'email-logs' | 'analytics' | 'ai-assistant' | 'audit' | 'restock' | 'qr-barcode';

interface SidebarProps {
  activeView: ViewType;
  onViewChange: (view: ViewType) => void;
  isCollapsed?: boolean;
  onToggle?: () => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeView, onViewChange, isCollapsed, onToggle, className = '' }) => {
  const { runAutomation, undo, undoStack } = useLibrary();
  const { showToast } = useToast();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'books', label: 'Books', icon: BookOpen },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'circulation', label: 'Issue / Return', icon: ArrowLeftRight },
    { id: 'reservations', label: 'Waiting List', icon: Clock },
    { id: 'fines', label: 'Payments', icon: CreditCard },
    { id: 'email-logs', label: 'Email & Notifications', icon: Mail },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Bot },
    { id: 'audit', label: 'Audit', icon: Shield },
    { id: 'restock', label: 'Restock', icon: Package },
    { id: 'qr-barcode', label: 'QR / Barcode', icon: QrCode },
  ];

  const handleRunAutomation = () => {
    runAutomation();
    showToast('Automation routine executed', 'success');
  };

  const handleUndo = () => {
    undo();
    showToast('Last action undone', 'info');
  };

  return (
    <aside className={`flex flex-col bg-gray-900 text-gray-300 transition-all duration-300 h-full ${isCollapsed ? 'w-20' : 'w-64'} ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-500 rounded-lg text-white">
            <BookOpen size={24} />
          </div>
          {!isCollapsed && <span className="text-xl font-bold text-white tracking-tight">Lumina</span>}
        </div>
        {onToggle && (
          <button onClick={onToggle} className="lg:hidden text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin scrollbar-thumb-gray-700">
        <ul className="space-y-1 px-3">
          {navItems.map(item => (
            <li key={item.id}>
              <button
                onClick={() => onViewChange(item.id as ViewType)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  activeView === item.id 
                    ? 'bg-primary-500 text-white' 
                    : 'hover:bg-gray-800 hover:text-white'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <item.icon size={20} className={activeView === item.id ? 'text-white' : 'text-gray-400'} />
                {!isCollapsed && <span className="font-medium text-sm">{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-800 space-y-3">
        <button
          onClick={handleRunAutomation}
          className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium border border-gray-700"
          title={isCollapsed ? "Run Automation" : undefined}
        >
          <Play size={16} className="text-success-500" />
          {!isCollapsed && <span>Run Automation</span>}
        </button>
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg transition-colors text-sm font-medium border ${
            undoStack.length === 0 
              ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed' 
              : 'bg-gray-800 border-gray-700 text-white hover:bg-gray-700'
          }`}
          title={isCollapsed ? "Undo Last Action" : undefined}
        >
          <Undo2 size={16} />
          {!isCollapsed && <span>Undo ({undoStack.length})</span>}
        </button>
      </div>
    </aside>
  );
};
