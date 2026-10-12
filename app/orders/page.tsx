'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/src/ui/components/Card';
import { Button } from '@/src/ui/components/Button';
import { Chip } from '@/src/ui/components/Chip';
import { Input } from '@/src/ui/components/Input';
import { formatINR } from '@/src/domain/money';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  CreditCard,
  Ban,
  ArrowLeft,
  RefreshCw,
  Plus,
  ShoppingBag,
} from 'lucide-react';

interface OrderItem {
  id: string;
  status: 'OPEN' | 'SETTLED' | 'VOID';
  orderType: 'DINE_IN' | 'TAKEAWAY';
  tableLabel?: string;
  invoiceNo?: string;
  subtotalPaise: number;
  grandTotalPaise: number;
  version: number;
  createdAt: string;
  settledAt?: string;
}

export default function OrdersListPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'SETTLED' | 'VOID' | 'ALL'>('OPEN');
  const [sortBy, setSortBy] = useState<'time' | 'table' | 'amount'>('time');

  // Void modal
  const [voidModalOrder, setVoidModalOrder] = useState<OrderItem | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [isVoiding, setIsVoiding] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders?status=${statusFilter}&sort=${sortBy}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter, sortBy]);

  const handleVoidOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidModalOrder || !voidReason.trim()) return;

    setIsVoiding(true);
    try {
      const res = await fetch(`/api/orders/${voidModalOrder.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to void order');
      }

      setVoidModalOrder(null);
      setVoidReason('');
      loadOrders();
    } catch (err: any) {
      alert(err.message || 'Error voiding order');
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas-light dark:bg-canvas-dark text-gray-900 dark:text-gray-100 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/order')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Order Screen
            </Button>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                Orders & Invoices
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Browse open table orders, settled tax invoices, and past bills
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadOrders}
              isLoading={loading}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => router.push('/order')}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Take New Order
            </Button>
          </div>
        </div>

        {/* Filters and Sorting Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-2">
            {[
              { id: 'OPEN', label: 'Open Orders' },
              { id: 'SETTLED', label: 'Settled' },
              { id: 'VOID', label: 'Voided' },
              { id: 'ALL', label: 'All' },
            ].map((tab) => (
              <Chip
                key={tab.id}
                active={statusFilter === tab.id}
                onClick={() => setStatusFilter(tab.id as any)}
              >
                {tab.label}
              </Chip>
            ))}
          </div>

          {/* Sort By Controls */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Sort by:</span>
            <div className="flex p-1 rounded-full bg-white dark:bg-[#1A1A22] border border-black/[0.06] dark:border-white/[0.08]">
              {[
                { id: 'time', label: 'Time' },
                { id: 'table', label: 'Table' },
                { id: 'amount', label: 'Amount' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSortBy(s.id as any)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                    sortBy === s.id
                      ? 'bg-obsidian text-white dark:bg-white dark:text-obsidian shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders Cards Grid */}
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <Card variant="default" padding="lg" className="text-center py-20">
            <ShoppingBag className="w-12 h-12 stroke-1 text-gray-400 mx-auto mb-3" />
            <h3 className="font-bold text-base text-gray-900 dark:text-white">
              No {statusFilter.toLowerCase()} orders found
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Orders created on the ordering terminal will appear here.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((ord) => (
              <Card
                key={ord.id}
                variant="default"
                padding="md"
                className="flex flex-col justify-between hover:shadow-soft-lg transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        ord.status === 'OPEN'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : ord.status === 'SETTLED'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {ord.status}
                    </span>

                    <span className="text-xs text-gray-400 tabular-nums font-mono">
                      {new Date(ord.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between mb-2">
                    <h4 className="font-extrabold text-base text-gray-900 dark:text-white">
                      {ord.orderType === 'DINE_IN'
                        ? `Table ${ord.tableLabel || 'General'}`
                        : 'Takeaway'}
                    </h4>

                    {ord.invoiceNo && (
                      <span className="font-mono text-xs font-bold text-gray-500">
                        {ord.invoiceNo}
                      </span>
                    )}
                  </div>

                  <div className="text-2xl font-black text-brand tabular-nums tracking-tight mb-4">
                    {formatINR(ord.grandTotalPaise)}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {ord.status === 'SETTLED' && (
                      <>
                        <a
                          href={`/api/orders/${ord.id}/export?format=pdf&layout=a4`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-2 rounded-xl text-gray-500 hover:text-brand hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          title="Download A4 Tax Invoice PDF"
                        >
                          <FileDown className="w-4 h-4" />
                        </a>
                        <a
                          href={`/api/orders/${ord.id}/export?format=xlsx`}
                          className="p-2 rounded-xl text-gray-500 hover:text-emerald-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                          title="Download Excel Sheet"
                        >
                          <FileDown className="w-4 h-4 text-emerald-600" />
                        </a>
                      </>
                    )}

                    {ord.status !== 'VOID' && (
                      <button
                        type="button"
                        onClick={() => setVoidModalOrder(ord)}
                        className="p-2 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Void order"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {ord.status === 'OPEN' && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => router.push(`/order?id=${ord.id}`)}
                      rightIcon={<CreditCard className="w-3.5 h-3.5" />}
                    >
                      Settle / Edit
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Void Order Dialog */}
        {voidModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <Card variant="elevated" padding="lg" className="max-w-md w-full">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Void Order {voidModalOrder.invoiceNo || voidModalOrder.tableLabel || ''}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {voidModalOrder.status === 'SETTLED'
                  ? 'Voiding a settled tax invoice requires an elevated administrator reason and remains in the permanent audit trail.'
                  : 'Enter the reason for cancelling this open order.'}
              </p>

              <form onSubmit={handleVoidOrder} className="space-y-4">
                <Input
                  label="Void Reason"
                  placeholder="e.g. Customer cancelled, duplicate punch..."
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  required
                  autoFocus
                />

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="md"
                    type="button"
                    onClick={() => setVoidModalOrder(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="md"
                    type="submit"
                    isLoading={isVoiding}
                  >
                    Confirm Void
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
