import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text }) => {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 48
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <Loader2 
        size={sizeMap[size]} 
        className="text-primary-500 animate-spin" 
      />
      {text && <span className="text-sm text-gray-500 font-medium">{text}</span>}
    </div>
  );
};
