import React from 'react';
import { clsx } from 'clsx';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'inset' | 'glass';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant = 'default',
      padding = 'md',
      children,
      ...props
    },
    ref
  ) => {
    const paddingStyles = {
      none: 'p-0',
      sm: 'p-3.5',
      md: 'p-5',
      lg: 'p-7',
    };

    const variantStyles = {
      default:
        'bg-white dark:bg-[#16161A] border border-black/[0.06] dark:border-white/[0.08] shadow-soft-md rounded-card',
      elevated:
        'bg-white dark:bg-[#1E1E24] border border-black/[0.08] dark:border-white/[0.1] shadow-soft-xl rounded-card-lg',
      inset:
        'bg-surface-well-light dark:bg-surface-well-dark well-inset border border-black/[0.04] dark:border-white/[0.04] rounded-card',
      glass:
        'glass-panel shadow-soft-xl rounded-card-lg',
    };

    return (
      <div
        ref={ref}
        className={clsx(
          'transition-all duration-200',
          variantStyles[variant],
          paddingStyles[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
