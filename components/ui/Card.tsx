import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  onClick?: () => void;
}

export default function Card({ children, className = '', title, onClick }: CardProps) {
  return (
    <div 
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm ${className}`}
      onClick={onClick}
    >
      {title && (
        <div className="px-3 py-2.5 md:px-4 md:py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
        </div>
      )}
      <div className="p-3 md:p-4">{children}</div>
    </div>
  );
}
