'use client';

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { Delete, Lock } from 'lucide-react';

export interface PinPadProps {
  length?: number;
  onComplete: (pin: string) => void;
  isLoading?: boolean;
  error?: string | null;
  disabled?: boolean;
  title?: string;
  subtitle?: string;
}

export function PinPad({
  length = 4,
  onComplete,
  isLoading = false,
  error = null,
  disabled = false,
  title = 'Enter Admin PIN',
  subtitle = 'Security step-up required to access admin settings',
}: PinPadProps) {
  const [pin, setPin] = useState<string>('');
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (error) {
      setIsShaking(true);
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([40, 60, 40]);
      }
      const timer = setTimeout(() => {
        setIsShaking(false);
        setPin('');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleDigit = (digit: string) => {
    if (disabled || isLoading || pin.length >= length) return;

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(10);
    }

    const nextPin = pin + digit;
    setPin(nextPin);
    if (nextPin.length === length) {
      onComplete(nextPin);
    }
  };

  const handleDelete = () => {
    if (disabled || isLoading) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (disabled || isLoading) return;
    setPin('');
  };

  return (
    <div className="flex flex-col items-center w-full max-w-xs mx-auto p-4 select-none">
      <div className="h-12 w-12 rounded-full bg-brand/10 text-brand flex items-center justify-center mb-3">
        <Lock className="w-6 h-6" />
      </div>
      <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
        {title}
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1 mb-6">
        {subtitle}
      </p>

      {/* PIN Dots (Inset Debossed Wells) */}
      <div
        className={clsx(
          'flex items-center gap-4 mb-8 transition-transform',
          isShaking && 'animate-bounce'
        )}
      >
        {Array.from({ length }).map((_, idx) => {
          const isFilled = idx < pin.length;
          return (
            <div
              key={idx}
              className={clsx(
                'w-5 h-5 rounded-full flex items-center justify-center transition-all duration-200',
                'bg-[#EAEBED] dark:bg-[#101014] well-inset border border-black/5 dark:border-white/5'
              )}
            >
              {isFilled && (
                <div className="w-3 h-3 rounded-full bg-obsidian dark:bg-white shadow-sm" />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="text-xs font-semibold text-red-500 mb-4 text-center">
          {error}
        </div>
      )}

      {/* Tactile 3x4 Keypad */}
      <div className="grid grid-cols-3 gap-3.5 w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled || isLoading}
            onClick={() => handleDigit(digit)}
            className={clsx(
              'h-16 rounded-2xl text-xl font-bold tracking-tight transition-all duration-150',
              'bg-white dark:bg-[#1A1A22] text-gray-900 dark:text-gray-100',
              'border border-black/[0.08] dark:border-white/[0.08] shadow-soft-sm',
              'hover:bg-gray-50 dark:hover:bg-[#23232D] active:scale-95 active:bg-gray-100',
              'disabled:opacity-40 disabled:pointer-events-none'
            )}
          >
            {digit}
          </button>
        ))}

        {/* Clear Button */}
        <button
          type="button"
          disabled={disabled || isLoading || pin.length === 0}
          onClick={handleClear}
          className="h-16 rounded-2xl text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
        >
          CLEAR
        </button>

        {/* Zero */}
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={() => handleDigit('0')}
          className={clsx(
            'h-16 rounded-2xl text-xl font-bold tracking-tight transition-all duration-150',
            'bg-white dark:bg-[#1A1A22] text-gray-900 dark:text-gray-100',
            'border border-black/[0.08] dark:border-white/[0.08] shadow-soft-sm',
            'hover:bg-gray-50 dark:hover:bg-[#23232D] active:scale-95 active:bg-gray-100',
            'disabled:opacity-40 disabled:pointer-events-none'
          )}
        >
          0
        </button>

        {/* Delete Button */}
        <button
          type="button"
          disabled={disabled || isLoading || pin.length === 0}
          onClick={handleDelete}
          className="h-16 rounded-2xl flex items-center justify-center text-gray-700 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
