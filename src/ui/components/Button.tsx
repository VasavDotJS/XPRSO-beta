'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'obsidian' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-full transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:pointer-events-none select-none tracking-tight';

    const sizeStyles = {
      sm: 'h-9 px-4 text-xs gap-1.5 min-w-[36px]',
      md: 'h-11 px-5 text-sm gap-2 min-w-[44px]',
      lg: 'h-13 px-7 text-base font-semibold gap-2.5 min-w-[48px]',
      icon: 'h-11 w-11 p-0 rounded-full',
    };

    const variantStyles = {
      primary:
        'bg-brand text-white hover:bg-brand-hover active:bg-brand-active shadow-brand-glow font-semibold',
      obsidian:
        'bg-obsidian text-white hover:bg-obsidian-surface dark:bg-white dark:text-obsidian dark:hover:bg-gray-100 shadow-obsidian font-semibold',
      secondary:
        'bg-white dark:bg-[#1A1A20] text-gray-900 dark:text-gray-100 border border-black/10 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-[#22222A] shadow-soft-sm',
      ghost:
        'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5',
      outline:
        'bg-transparent text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-700 hover:bg-black/5 dark:hover:bg-white/5',
      danger:
        'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-sm font-semibold',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          baseStyles,
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
