'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    async function initNavigation() {
      try {
        const setupRes = await fetch('/api/setup/status');
        if (setupRes.ok) {
          const data = await setupRes.json();
          if (data.needsSetup) {
            router.replace('/setup');
            return;
          }
        }

        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData?.user) {
            router.replace('/order');
            return;
          }
        }

        router.replace('/login');
      } catch {
        router.replace('/setup');
      }
    }

    initNavigation();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0C0A09]">
      <div className="w-8 h-8 rounded-full border-2 border-[#D97706] border-t-transparent animate-spin" />
    </div>
  );
}
