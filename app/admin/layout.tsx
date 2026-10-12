'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Button } from '@/src/ui/components/Button';
import {
  UtensilsCrossed,
  Receipt,
  Store,
  Users,
  BarChart3,
  History,
  LogOut,
  ShoppingBag,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isGatePage = pathname === '/admin';
  if (isGatePage) {
    return <>{children}</>;
  }

  const navItems = [
    { href: '/admin/menu', label: 'Menu & Prices', icon: UtensilsCrossed },
    { href: '/admin/tax', label: 'Tax & GST', icon: Receipt },
    { href: '/admin/cafe', label: 'Café Profile', icon: Store },
    { href: '/admin/users', label: 'Staff & Roles', icon: Users },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/admin/audit', label: 'Audit Log', icon: History },
  ];

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas-light dark:bg-canvas-dark text-gray-900 dark:text-gray-100">
      {/* Top Floating Pill Navigation */}
      <header className="sticky top-0 z-40 px-4 sm:px-8 py-3.5 backdrop-blur-xl bg-white/80 dark:bg-[#121216]/80 border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/menu"
              className="font-extrabold text-lg tracking-tight flex items-center gap-2 text-gray-900 dark:text-white"
            >
              <div className="h-8 w-8 rounded-full bg-brand text-white flex items-center justify-center font-black text-sm">
                X
              </div>
              <span>XPRSO Admin</span>
            </Link>
          </div>

          {/* Pill Segmented Nav Bar (from 03-pill-nav.jpg) */}
          <nav className="flex items-center gap-1.5 p-1 rounded-full bg-white dark:bg-[#1A1A22] border border-black/[0.06] dark:border-white/[0.08] shadow-soft-sm overflow-x-auto max-w-full">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-150',
                    isActive
                      ? 'bg-obsidian text-white shadow-obsidian dark:bg-white dark:text-obsidian'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/order')}
              leftIcon={<ShoppingBag className="w-3.5 h-3.5 text-brand" />}
            >
              Order Screen
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              leftIcon={<LogOut className="w-3.5 h-3.5 text-red-500" />}
              title="Switch user or log out"
            >
              Switch User
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
        {children}
      </main>
    </div>
  );
}
