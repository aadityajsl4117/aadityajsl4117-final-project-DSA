import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (arg1: string, arg2?: ToastType | string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((arg1: string, arg2?: ToastType | string) => {
    let message = arg1;
    let type: ToastType = 'info';

    const validTypes: ToastType[] = ['success', 'error', 'warning', 'info'];

    if (validTypes.includes(arg1 as ToastType) && arg2) {
      type = arg1 as ToastType;
      message = arg2;
    } else if (arg2 && validTypes.includes(arg2 as ToastType)) {
      type = arg2 as ToastType;
      message = arg1;
    } else if (arg2) {
      message = `${arg1} ${arg2}`;
    }

    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const icons = {
    success: <CheckCircle className="text-success-500" size={20} />,
    error: <XCircle className="text-danger-500" size={20} />,
    warning: <AlertTriangle className="text-warning-500" size={20} />,
    info: <Info className="text-primary-500" size={20} />
  };

  const bgs = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    warning: 'bg-yellow-50 border-yellow-200',
    info: 'bg-indigo-50 border-indigo-200'
  };

  return (
    <div className={`flex items-start gap-3 p-4 bg-white border rounded-lg shadow-lg pointer-events-auto min-w-[300px] animate-in slide-in-from-right-8 duration-300 ${bgs[toast.type]}`}>
      <div className="flex-shrink-0 mt-0.5">{icons[toast.type]}</div>
      <div className="flex-1 text-sm font-medium text-gray-800">{toast.message}</div>
      <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
        <X size={16} />
      </button>
    </div>
  );
};
