import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gradient';
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  hover = false,
}) => {
  const baseClasses = 'rounded-2xl shadow-md transition-all duration-300';

  const variantClasses = {
    default: 'bg-white',
    gradient: 'bg-gradient-to-br from-emerald-50 to-white border border-emerald-100',
  };

  const hoverClass = hover ? 'hover:shadow-lg hover:-translate-y-1' : '';

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${hoverClass} ${className}`}>
      {children}
    </div>
  );
};
