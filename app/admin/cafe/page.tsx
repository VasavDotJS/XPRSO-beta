'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/src/ui/components/Card';
import { Button } from '@/src/ui/components/Button';
import { Input } from '@/src/ui/components/Input';
import { Save, Check, Store } from 'lucide-react';

export default function AdminCafePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    cafeName: '',
    address: '',
    phone: '',
    gstin: '',
    fssai: '',
    invoicePrefix: 'ORD',
    receiptFooter: '',
    elevationMinutes: 10,
    sessionIdleHours: 12,
  });

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((res) => {
        if (res.status === 403) {
          window.location.href = '/admin';
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.settings) {
          setForm({
            cafeName: data.settings.cafeName || '',
            address: data.settings.address || '',
            phone: data.settings.phone || '',
            gstin: data.settings.gstin || '',
            fssai: data.settings.fssai || '',
            invoicePrefix: data.settings.invoicePrefix || 'ORD',
            receiptFooter: data.settings.receiptFooter || '',
            elevationMinutes: data.settings.elevationMinutes || 10,
            sessionIdleHours: data.settings.sessionIdleHours || 12,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update café settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Café Profile & Receipt Settings
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            These details appear on your printed receipts, PDF invoices, and Excel exports.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          isLoading={saving}
          onClick={handleSave}
          leftIcon={success ? <Check className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
        >
          {success ? 'Saved!' : 'Save Profile'}
        </Button>
      </div>

      <Card variant="default" padding="lg">
        <form onSubmit={handleSave} className="space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Café Name"
              value={form.cafeName}
              onChange={(e) => setForm({ ...form, cafeName: e.target.value })}
              required
            />
            <Input
              label="Phone Number"
              placeholder="+91 98765 43210"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <Input
            label="Street Address / Location"
            placeholder="12, Indiranagar 100ft Road, Bengaluru, Karnataka 560038"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="GSTIN (15 characters)"
              placeholder="29AAAAA0000A1Z5"
              maxLength={15}
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
            />
            <Input
              label="FSSAI License No."
              placeholder="11223344556677"
              value={form.fssai}
              onChange={(e) => setForm({ ...form, fssai: e.target.value })}
            />
            <div>
              <Input
                label="Invoice Prefix (1–3 chars)"
                placeholder="ORD"
                maxLength={3}
                value={form.invoicePrefix}
                onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value.toUpperCase() })}
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">e.g. ORD/26-27/000001</p>
            </div>
          </div>

          <Input
            label="Receipt Footer Note"
            placeholder="Thank you for dining with us! Visit again."
            value={form.receiptFooter}
            onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
          />

          <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Input
                type="number"
                min={1}
                max={120}
                label="Admin Elevation Inactivity Timeout (minutes)"
                value={form.elevationMinutes.toString()}
                onChange={(e) =>
                  setForm({ ...form, elevationMinutes: parseInt(e.target.value) || 10 })
                }
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Admin re-prompts for PIN/Biometric after this period of inactivity.
              </p>
            </div>

            <div>
              <Input
                type="number"
                min={1}
                max={72}
                label="Staff Session Idle Timeout (hours)"
                value={form.sessionIdleHours.toString()}
                onChange={(e) =>
                  setForm({ ...form, sessionIdleHours: parseInt(e.target.value) || 12 })
                }
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Staff are automatically logged out after this period of inactivity.
              </p>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}
