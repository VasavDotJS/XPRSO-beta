'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/src/ui/components/Card';
import { PinPad } from '@/src/ui/components/PinPad';
import { Button } from '@/src/ui/components/Button';
import { Fingerprint, ArrowLeft } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';

export default function AdminGatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    // Check if session is already elevated
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.authenticated) {
          router.push('/login');
          return;
        }
        if (!data.user.roles.includes('ADMIN')) {
          router.push('/order');
          return;
        }
        if (data.isElevated) {
          router.push('/admin/menu');
          return;
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));

    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    ) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setBiometricAvailable(available))
        .catch(() => setBiometricAvailable(false));
    }
  }, [router]);

  const handlePinComplete = async (pin: string) => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/admin/elevate/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Incorrect PIN');
      }

      router.push('/admin/menu');
    } catch (err: any) {
      setError(err.message || 'Incorrect PIN');
      setLoading(false);
    }
  };

  const handleBiometricStepUp = async () => {
    setError(null);
    setLoading(true);
    try {
      const optRes = await fetch('/api/admin/elevate/passkey/options', { method: 'POST' });
      const options = await optRes.json();
      if (!optRes.ok) throw new Error(options.error || 'Failed to start biometric assertion');

      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await fetch('/api/admin/elevate/passkey/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assertion),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Biometric step-up failed');

      router.push('/admin/menu');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Biometric verification cancelled or not allowed by device.');
      } else {
        setError(err.message || 'Biometric step-up failed');
      }
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-canvas-light dark:bg-canvas-dark">
      <div className="max-w-sm w-full">
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/order')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back to Orders
          </Button>
        </div>

        <Card variant="elevated" padding="md" className="backdrop-blur-sm">
          <PinPad
            onComplete={handlePinComplete}
            isLoading={loading}
            error={error}
            title="Admin Step-Up Security"
            subtitle="Enter your 4–6 digit security PIN to manage menu, tax and pricing"
          />

          {biometricAvailable && (
            <div className="mt-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.06] px-4">
              <Button
                type="button"
                variant="obsidian"
                size="md"
                className="w-full gap-2"
                onClick={handleBiometricStepUp}
                isLoading={loading}
                leftIcon={<Fingerprint className="w-4 h-4 text-brand" />}
              >
                Verify with Biometrics
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
