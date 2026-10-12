'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/src/ui/components/Card';
import { Button } from '@/src/ui/components/Button';
import { RefreshCw, History, ShieldAlert } from 'lucide-react';

interface AuditItem {
  id: string;
  actorId?: string;
  actorName?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: any;
  after?: any;
  createdAt: string;
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/audit?limit=100');
      if (res.status === 403) {
        window.location.href = '/admin';
        return;
      }
      const data = await res.json();
      setEntries(data.entries || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Security & System Audit Log
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Immutable log of logins, price and cost changes, setting adjustments, voids, and staff updates.
          </p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={loadAudit}
          isLoading={loading}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Refresh Log
        </Button>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <Card variant="default" padding="lg" className="text-center py-16">
          <p className="text-gray-500 text-sm">No audit events recorded yet.</p>
        </Card>
      ) : (
        <Card variant="default" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-gray-50/80 dark:bg-[#121216]/80 font-sans font-semibold text-gray-500 dark:text-gray-400 border-b border-black/[0.06] dark:border-white/[0.06]">
                <tr>
                  <th className="py-3 px-6">Timestamp (UTC)</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-6">Details / Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors"
                  >
                    <td className="py-3 px-6 text-gray-500 whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>

                    <td className="py-3 px-4 font-bold text-gray-900 dark:text-white">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/5 dark:bg-white/10">
                        {entry.action}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-sans text-gray-700 dark:text-gray-300">
                      {entry.actorName || (entry.actorId ? 'System' : 'Anonymous')}
                    </td>

                    <td className="py-3 px-4 text-gray-500">{entry.entity}</td>

                    <td className="py-3 px-6 text-gray-600 dark:text-gray-400 max-w-md truncate">
                      {entry.after ? JSON.stringify(entry.after) : entry.before ? JSON.stringify(entry.before) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
