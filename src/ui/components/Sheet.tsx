'use client';

import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import { X } from 'lucide-react';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  side?: 'bottom' | 'right';
  className?: string;
}

export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = 'bottom',
  className,
}: SheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Content */}
        <DialogPrimitive.Content
          className={clsx(
            'fixed z-50 bg-white/95 dark:bg-[#16161C]/95 backdrop-blur-2xl shadow-2xl transition-all duration-300 focus:outline-none border border-black/10 dark:border-white/10',
            side === 'bottom' &&
              'inset-x-0 bottom-0 rounded-t-[32px] max-h-[92vh] flex flex-col data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
            side === 'right' &&
              'inset-y-0 right-0 w-full sm:max-w-lg rounded-l-[32px] flex flex-col data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
            className
          )}
        >
          {side === 'bottom' && (
            <div className="w-full flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-700" />
            </div>
          )}

          <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06] dark:border-white/[0.06]">
            <div>
              {title && (
                <DialogPrimitive.Title className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                  {title}
                </DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close className="h-9 w-9 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
              <X className="w-5 h-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
