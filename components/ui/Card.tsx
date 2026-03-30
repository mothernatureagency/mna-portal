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
        'glass-card',
        gradient && 'bg-gradient-to-br from-white/80 to-blue-50/30',
        hover && 'cursor-pointer',
        glow && '[box-shadow:0_1px_2px_rgba(0,0,0,0.04),0_4px_16px_rgba(0,0,0,0.05),0_16px_40px_rgba(12,109,164,0.12),inset_0_1px_0_rgba(255,255,255,0.9)]',
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
}
