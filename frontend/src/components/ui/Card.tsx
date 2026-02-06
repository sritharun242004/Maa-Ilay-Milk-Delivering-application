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
  const baseClasses = 'rounded-2xl shadow-md transition-all duration-300';

  const variantClasses = {
    default: 'bg-white',
    gradient: 'bg-gradient-to-br from-cream-100 to-white border border-brown-100',
  };

  const hoverClass = hover ? 'hover:shadow-lg hover:-translate-y-1' : '';

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${hoverClass} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};
