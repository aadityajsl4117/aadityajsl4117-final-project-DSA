import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'sm' }) => {
  const normalized = status.toUpperCase();
  
  let colorClass = 'bg-gray-100 text-gray-700 border-gray-200';
  
  const greens = ['ACTIVE', 'AVAILABLE', 'DELIVERED', 'SUCCESS', 'VERIFIED', 'PAID', 'RECEIVED', 'NEW', 'GOOD'];
  const yellows = ['PENDING', 'WAITING', 'REQUESTED'];
  const reds = ['OVERDUE', 'FAILED', 'DAMAGED', 'BLOCKED', 'REJECTED', 'POOR'];
  const grays = ['RETURNED', 'FULFILLED', 'EXPIRED', 'INACTIVE'];
  const blues = ['ISSUED', 'RESERVED', 'APPROVED', 'ORDERED'];
  const oranges = ['SUSPENDED', 'MAINTENANCE', 'LOST'];
  const cyans = ['FAIR'];

  if (greens.includes(normalized)) colorClass = 'bg-green-50 text-success-500 border-green-200';
  else if (yellows.includes(normalized)) colorClass = 'bg-yellow-50 text-warning-500 border-yellow-200';
  else if (reds.includes(normalized)) colorClass = 'bg-red-50 text-danger-500 border-red-200';
  else if (grays.includes(normalized)) colorClass = 'bg-gray-50 text-gray-600 border-gray-200';
  else if (blues.includes(normalized)) colorClass = 'bg-blue-50 text-blue-600 border-blue-200';
  else if (oranges.includes(normalized)) colorClass = 'bg-orange-50 text-orange-600 border-orange-200';
  else if (cyans.includes(normalized)) colorClass = 'bg-cyan-50 text-cyan-600 border-cyan-200';

  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span className={`inline-flex items-center justify-center border rounded-full font-semibold ${sizeClass} ${colorClass}`}>
      {normalized}
    </span>
  );
};
