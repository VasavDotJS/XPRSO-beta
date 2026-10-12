'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/src/ui/components/Card';
import { Input } from '@/src/ui/components/Input';
import { Button } from '@/src/ui/components/Button';
import { Coffee, Fingerprint, Lock, User, ArrowRight } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if device supports platform authenticator (Face ID, Touch ID, Fingerprint)
    if (
      typeof window !== 'undefined' &&
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
    ) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((available) => setBiometricAvailable(available))
        .catch(() => setBiometricAvailable(false));
    }

    // Check if first-run setup is required
    fetch('/api/setup/status')
      .then((res) => res.json())
      .then((data) => {
        if (data.needsSetup) {
          router.push('/setup');
        }
      })
      .catch(() => {});
  }, [router]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid username or password');
      }

      router.push('/order');
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError(null);
    setBiometricLoading(true);

    try {
      // 1. Fetch passkey login options (pass username if entered, to target that user's enrolled credentials)
      const optRes = await fetch('/api/auth/passkey/login/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() || undefined }),
      });
      const options = await optRes.json();
      if (!optRes.ok) {
        throw new Error(options.error || 'Failed to initialize biometric login');
      }

      // 2. Prompt device user verification (Face ID / Touch ID / Fingerprint)
      const authResponse = await startAuthentication({ optionsJSON: options });

      // 3. Verify assertion with server
      const verifyRes = await fetch('/api/auth/passkey/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authResponse),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || 'Biometric verification failed');
      }

      router.push('/order');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Biometric authentication was cancelled or not allowed by device settings.');
      } else if (err.name === 'InvalidStateError') {
        setError('No enrolled biometric passkey was found for this device.');
      } else {
        setError(err.message || 'Biometric login failed or cancelled');
      }
      setBiometricLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-canvas-light dark:bg-canvas-dark">
      <div className="max-w-md w-full">
        {/* Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-3xl bg-brand text-white shadow-brand-glow mb-4">
            <Coffee className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            XPRSO Staff Portal
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sign in to start taking orders or manage café operations
          </p>
        </div>

        {/* Login Card */}
        <Card variant="elevated" padding="lg">
          {error && (
            <div className="p-3.5 mb-5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <Input
              label="Staff Username"
              placeholder="e.g. waiter1 or admin"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              required
            />

            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={loading}
                className="w-full"
                rightIcon={<ArrowRight className="w-4 h-4 ml-1" />}
              >
                Sign In
              </Button>
            </div>
          </form>

          {/* Biometric Passkey Divider */}
          {biometricAvailable && (
            <div className="mt-6 pt-6 border-t border-black/[0.06] dark:border-white/[0.06]">
              <Button
                type="button"
                variant="obsidian"
                size="lg"
                isLoading={biometricLoading}
                onClick={handleBiometricLogin}
                className="w-full gap-2.5"
                leftIcon={<Fingerprint className="w-5 h-5 text-brand" />}
              >
                Sign in with Biometrics
              </Button>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center mt-2">
                Face ID / Fingerprint discoverable credential
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
