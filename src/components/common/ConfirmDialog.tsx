import React from 'react';
import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'danger': return <AlertCircle className="text-danger-500" size={24} />;
      case 'warning': return <AlertTriangle className="text-warning-500" size={24} />;
      case 'primary': return <Info className="text-primary-500" size={24} />;
    }
  };

  const getButtonClass = () => {
    switch (variant) {
      case 'danger': return 'bg-danger-500 hover:bg-red-600 text-white';
      case 'warning': return 'bg-warning-500 hover:bg-yellow-600 text-white';
      case 'primary': return 'bg-primary-500 hover:bg-indigo-600 text-white';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <div className="flex flex-col items-center text-center pt-2 pb-4">
        <div className={`p-3 rounded-full mb-4 ${
          variant === 'danger' ? 'bg-red-50' : 
          variant === 'warning' ? 'bg-yellow-50' : 'bg-indigo-50'
        }`}>
          {getIcon()}
        </div>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3 w-full">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${getButtonClass()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
