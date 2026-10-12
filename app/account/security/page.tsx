'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/src/ui/components/Card';
import { Button } from '@/src/ui/components/Button';
import { Input } from '@/src/ui/components/Input';
import {
  Fingerprint,
  KeyRound,
  ShieldAlert,
  Trash2,
  Plus,
  ArrowLeft,
  CheckCircle2,
  Smartphone,
} from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

interface PasskeyItem {
  id: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt?: string;
}

export default function AccountSecurityPage() {
  const router = useRouter();
  const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Change Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const loadPasskeys = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/passkeys');
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setPasskeys(data.passkeys || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPasskeys();

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

  const handleRegisterPasskey = async () => {
    setError(null);
    setSuccess(null);
    setRegistering(true);

    try {
      // 1. Fetch options
      const optRes = await fetch('/api/auth/passkey/register/options', { method: 'POST' });
      const options = await optRes.json();
      if (!optRes.ok) throw new Error(options.error || 'Failed to start registration');

      // 2. Prompt platform authenticator (Touch ID, Face ID, Fingerprint)
      const regResponse = await startRegistration({ optionsJSON: options });

      // 3. Verify with server
      const verifyRes = await fetch('/api/auth/passkey/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...regResponse,
          deviceLabel: deviceName.trim() || 'My Biometric Device',
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Registration failed');

      setSuccess('Biometric passkey registered successfully!');
      setDeviceName('');
      loadPasskeys();
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Passkey registration was cancelled or not allowed by device settings. Ensure biometric hardware is available.');
      } else if (err.name === 'InvalidStateError') {
        setError('A passkey for this device is already enrolled for your account.');
      } else {
        setError(err.message || 'Passkey setup cancelled or failed');
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleRevokePasskey = async (id: string) => {
    if (!confirm('Revoke this biometric passkey? You will need to use your password to sign in on this device.')) return;

    try {
      const res = await fetch(`/api/auth/passkeys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        loadPasskeys();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');

      setSuccess('Password updated successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err.message || 'Password update failed');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas-light dark:bg-canvas-dark text-gray-900 dark:text-gray-100 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push('/order')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Account Security & Biometrics
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Manage your passkeys, device biometrics, and staff login password
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{success}</span>
          </div>
        )}

        {/* Biometric Passkeys Card */}
        <Card variant="default" padding="lg" className="space-y-6">
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-brand" />
              <span>Biometric Passkeys (Face ID / Fingerprint)</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Sign in instantly without typing your staff password. Biometric data never leaves your device.
            </p>
          </div>

          {/* Shared Device Warning Caveat */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-100">
              <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
              <span>Shared-Device Security Caveat</span>
            </div>
            <p className="leading-relaxed">
              On a shared tablet, the device accepts <strong>any</strong> fingerprint or face enrolled in that device&apos;s OS settings. If multiple staff members have fingerprints enrolled on the same tablet, either could unlock the other&apos;s passkey. 
            </p>
            <p className="font-semibold text-amber-900 dark:text-amber-100">
              → We strongly recommend biometric login on personal staff phones, and standard password login on shared tablets.
            </p>
          </div>

          {/* Registration Section */}
          {biometricAvailable ? (
            <div className="p-4 rounded-2xl bg-[#EAEBED]/50 dark:bg-[#101014]/50 border border-black/5 dark:border-white/5 flex flex-col sm:flex-row items-center gap-3">
              <div className="w-full flex-1">
                <Input
                  placeholder="Device label (e.g. Ramesh iPhone 14, Kitchen iPad)..."
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
              </div>
              <Button
                variant="primary"
                size="md"
                isLoading={registering}
                onClick={handleRegisterPasskey}
                leftIcon={<Plus className="w-4 h-4" />}
                className="w-full sm:w-auto whitespace-nowrap"
              >
                Register Passkey
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-gray-100 dark:bg-gray-800 text-xs text-gray-500">
              Platform authenticator is not detected on this browser or hardware. (Passkeys require HTTPS or localhost).
            </div>
          )}

          {/* Existing Passkeys List */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Enrolled Authenticators ({passkeys.length})
            </h4>

            {passkeys.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No passkeys enrolled for this account.</p>
            ) : (
              <div className="space-y-2">
                {passkeys.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white dark:bg-[#1A1A22] border border-black/[0.06] dark:border-white/[0.06]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-brand/10 text-brand flex items-center justify-center">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-gray-900 dark:text-white">
                          {p.deviceLabel}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Enrolled: {new Date(p.createdAt).toLocaleDateString()}
                          {p.lastUsedAt && ` • Last used: ${new Date(p.lastUsedAt).toLocaleDateString()}`}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevokePasskey(p.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                      leftIcon={<Trash2 className="w-4 h-4" />}
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Change Password Card */}
        <Card variant="default" padding="lg">
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
            <KeyRound className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            <span>Change Staff Password</span>
          </h3>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <Input
              type="password"
              label="Current Password"
              placeholder="••••••••"
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
              }
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="password"
                label="New Password"
                placeholder="••••••••"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                required
              />
              <Input
                type="password"
                label="Confirm New Password"
                placeholder="••••••••"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                variant="obsidian"
                size="md"
                isLoading={changingPassword}
              >
                Update Password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
