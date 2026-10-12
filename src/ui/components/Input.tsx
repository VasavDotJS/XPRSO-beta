import React from 'react';
import { clsx } from 'clsx';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, leftIcon, rightIcon, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-gray-700 dark:text-gray-300 tracking-tight"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-4 pointer-events-none text-gray-500 dark:text-gray-400">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={clsx(
              'w-full h-12 px-4 rounded-2xl text-sm font-medium transition-all duration-150',
              'bg-[#EAEBED] dark:bg-[#101014] text-gray-900 dark:text-white',
              'well-inset border border-black/5 dark:border-white/5',
              'placeholder:text-gray-500 dark:placeholder:text-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-brand/70 dark:focus:ring-brand/80',
              leftIcon && 'pl-11',
              rightIcon && 'pr-11',
              error && 'ring-2 ring-red-500 border-red-500',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-4 text-gray-500 dark:text-gray-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-xs font-medium text-red-500 pl-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
