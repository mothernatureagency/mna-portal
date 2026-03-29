import React from 'react';
import { clsx } from 'clsx';

type CardProps = {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  gradient?: boolean;
  hover?: boolean;
  style?: React.CSSProperties;
};

export default function Card({ children, className, glow, gradient, hover, style }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-[20px] transition-all duration-200',
        glow
          ? 'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04),0_12px_32px_rgba(12,109,164,0.08)]'
          : 'shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04),0_12px_32px_rgba(12,109,164,0.05)]',
        gradient && 'bg-gradient-to-br from-white to-blue-50/20',
        hover && 'hover:shadow-[0_2px_4px_rgba(0,0,0,0.05),0_8px_24px_rgba(0,0,0,0.06),0_20px_48px_rgba(12,109,164,0.08)] hover:-translate-y-[1px] cursor-pointer',
        className
      )}
      style={{
        border: '1px solid rgba(0,0,0,0.05)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
