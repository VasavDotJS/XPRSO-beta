'use client';

import React from 'react';
import { clsx } from 'clsx';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number;
  icon?: React.ReactNode;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active = false, count, icon, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={clsx(
          'inline-flex items-center gap-2 h-10 px-4 rounded-full text-xs font-semibold tracking-tight transition-all duration-150 select-none active:scale-95',
          active
            ? 'bg-obsidian text-white shadow-obsidian border border-black/10 dark:bg-white dark:text-obsidian dark:shadow-sm'
            : 'bg-white dark:bg-[#1A1A20] text-gray-700 dark:text-gray-300 border border-black/5 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-[#25252E] shadow-soft-sm',
          className
        )}
        {...props}
      >
        {icon && <span className="opacity-90">{icon}</span>}
        <span>{children}</span>
        {typeof count === 'number' && (
          <span
            className={clsx(
              'px-2 py-0.5 rounded-full text-[10px] font-bold',
              active
                ? 'bg-white/20 text-white dark:bg-black/20 dark:text-obsidian'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200'
            )}
          >
            {count}
          </span>
        )}
      </button>
    );
  }
);

Chip.displayName = 'Chip';
