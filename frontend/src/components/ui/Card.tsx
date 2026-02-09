import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gradient';
  hover?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  hover = false,
  onClick,
}) => {
  const hasCustomBg = /\bbg-/.test(className);
  const hasCustomBorder = /\bborder-(?!gray-200)/.test(className);
  const bgClass = hasCustomBg ? '' : 'bg-white';
  const borderClass = hasCustomBorder ? '' : 'border border-gray-200';
  const baseClasses = `rounded-lg ${bgClass} ${borderClass} shadow-sm`;
  const hoverClass = hover ? 'hover:shadow-md transition-shadow duration-200' : '';

  return (
    <div
      className={`${baseClasses} ${hoverClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
