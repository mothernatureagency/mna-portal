'use client';
import React from 'react';
import { clsx } from 'clsx';
import { useClient } from '@/context/ClientContext';

type ButtonProps = {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
};

export default function Button({ children, variant = 'primary', size = 'md', className, onClick, disabled, icon }: ButtonProps) {
  const { activeClient } = useClient();
  const { gradientFrom, gradientTo } = activeClient.branding;

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-[11px] rounded-lg gap-1.5',
    sm: 'px-3.5 py-1.5 text-[12px] rounded-xl gap-1.5',
    md: 'px-4 py-2 text-[13px] rounded-xl gap-2',
    lg: 'px-5 py-2.5 text-[14px] rounded-xl gap-2',
  };

  const base = clsx(
    'inline-flex items-center font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed select-none',
    sizeClasses[size],
  );

  if (variant === 'primary') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={clsx(base, 'text-white hover:scale-[1.02] active:scale-[0.98]', className)}
        style={{
          background: `linear-gradient(135deg, ${gradientFrom} 0%, ${gradientTo} 100%)`,
          boxShadow: `0 2px 8px ${gradientFrom}40, 0 1px 2px rgba(0,0,0,0.1)`,
        }}
      >
        {icon && <span className="opacity-90">{icon}</span>}
        {children}
      </button>
    );
  }

  if (variant === 'secondary') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={clsx(base, 'bg-white hover:bg-gray-50 active:scale-[0.98]', className)}
        style={{
          border: `1.5px solid ${gradientFrom}40`,
          color: gradientFrom,
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        {icon && <span>{icon}</span>}
        {children}
      </button>
    );
  }

  if (variant === 'outline') {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={clsx(base, 'bg-white hover:bg-gray-50 text-gray-600 active:scale-[0.98]', className)}
        style={{ border: '1px solid rgba(0,0,0,0.1)' }}
      >
        {icon && <span>{icon}</span>}
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(base, 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 active:scale-[0.98]', className)}
    >
      {icon && <span>{icon}</span>}
      {children}
    </button>
  );
}
