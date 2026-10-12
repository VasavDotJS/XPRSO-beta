'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/src/ui/components/Card';
import { Input } from '@/src/ui/components/Input';
import { Button } from '@/src/ui/components/Button';
import { Coffee, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';

export default function SetupPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [alreadyConfigured, setAlreadyConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    cafeName: 'XPRSO Artisan Café',
    displayName: 'Café Owner',
    username: 'admin',
    password: '',
    confirmPassword: '',
    adminPin: '',
  });

  useEffect(() => {
    fetch('/api/setup/status')
      .then((res) => res.json())
      .then((data) => {
        if (!data.needsSetup) {
          setAlreadyConfigured(true);
        }
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!/^\d{4,6}$/.test(formData.adminPin)) {
      setError('Admin PIN must be between 4 and 6 digits');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cafeName: formData.cafeName,
          displayName: formData.displayName,
          username: formData.username,
          password: formData.password,
          adminPin: formData.adminPin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to complete setup');
      }

      router.push('/order');
    } catch (err: any) {
      setError(err.message || 'Setup failed');
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

  if (alreadyConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-canvas-light dark:bg-canvas-dark">
        <Card variant="elevated" padding="lg" className="max-w-md w-full text-center">
          <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            Business Already Enrolled
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6 leading-relaxed">
            An active business profile and master administrator are already enrolled for this café deployment. You can sign in to take orders or manage settings.
          </p>
          <div className="space-y-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full font-bold"
              onClick={() => router.push('/login')}
            >
              Sign In to Existing Business
            </Button>
            <Button
              variant="secondary"
              size="md"
              className="w-full font-semibold"
              onClick={() => router.push('/admin/cafe')}
            >
              Manage Café Profile in Admin
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-canvas-light dark:bg-canvas-dark">
      <div className="max-w-lg w-full">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-3xl bg-brand text-white shadow-brand-glow mb-4">
            <Coffee className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Enroll Your Business
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            First-run initialization: set up your café profile and master administrator
          </p>
        </div>

        {/* Setup Card */}
        <Card variant="elevated" padding="lg" className="backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="Café Name"
                placeholder="e.g. Blue Tokai, Third Wave..."
                value={formData.cafeName}
                onChange={(e) => setFormData({ ...formData, cafeName: e.target.value })}
                required
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Admin Name"
                  placeholder="e.g. Alex Sharma"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                />
                <Input
                  label="Username"
                  placeholder="e.g. admin"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  type="password"
                  label="Master Password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
                <Input
                  type="password"
                  label="Confirm Password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <div className="pt-1">
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  label="Admin Security PIN (4–6 digits)"
                  placeholder="e.g. 1234"
                  value={formData.adminPin}
                  onChange={(e) => setFormData({ ...formData, adminPin: e.target.value })}
                  leftIcon={<ShieldCheck className="w-4 h-4" />}
                  required
                />
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 pl-1">
                  Required as a 2nd-factor step-up to change prices and manage sensitive tax settings.
                </p>
              </div>
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={loading}
                className="w-full"
                rightIcon={<Sparkles className="w-4 h-4 ml-1" />}
              >
                Enroll Business & Launch
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
