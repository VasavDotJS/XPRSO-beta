'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/src/ui/components/Card';
import { Button } from '@/src/ui/components/Button';
import { Chip } from '@/src/ui/components/Chip';
import { formatINR } from '@/src/domain/money';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingBag,
  Percent,
  Receipt,
  FileSpreadsheet,
  FileDown,
  Calendar,
  Sparkles,
  AlertTriangle,
  Clock,
  Layers,
} from 'lucide-react';

export default function AdminAnalyticsPage() {
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  // Analytics data
  const [kpis, setKpis] = useState<any>(null);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [bottomProducts, setBottomProducts] = useState<any[]>([]);
  const [productsTable, setProductsTable] = useState<any[]>([]);
  const [ordersTable, setOrdersTable] = useState<any[]>([]);

  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders'>('overview');

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [kpiRes, highRes, topRes, botRes, prodRes, ordRes] = await Promise.all([
        fetch(`/api/admin/analytics/kpis?preset=${preset}`),
        fetch(`/api/admin/analytics/highlights?preset=${preset}`),
        fetch(`/api/admin/analytics/top?preset=${preset}&by=qty&limit=5`),
        fetch(`/api/admin/analytics/bottom?preset=${preset}&limit=5`),
        fetch(`/api/admin/analytics/products?preset=${preset}`),
        fetch(`/api/admin/analytics/orders?preset=${preset}&limit=20`),
      ]);

      if (kpiRes.status === 403) {
        window.location.href = '/admin';
        return;
      }

      const kpisData = await kpiRes.json();
      const highData = await highRes.json();
      const topData = await topRes.json();
      const botData = await botRes.json();
      const prodData = await prodRes.json();
      const ordData = await ordRes.json();

      setKpis(kpisData.kpis);
      setHighlights(highData.highlights || []);
      setTopProducts(topData.top || []);
      setBottomProducts(botData.bottom || []);
      setProductsTable(prodData.products || []);
      setOrdersTable(ordData.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [preset]);

  return (
    <div className="space-y-6">
      {/* Top Header & Range Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Sales & Gross Profit Analytics
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Deterministic figures computed from settled order lines. GST is excluded from revenue.
          </p>
        </div>

        {/* Date presets & Export */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 rounded-full bg-white dark:bg-[#1A1A22] border border-black/[0.06] dark:border-white/[0.08]">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'Last 30 Days' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPreset(p.id as any)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                  preset === p.id
                    ? 'bg-obsidian text-white dark:bg-white dark:text-obsidian shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <a
            href={`/api/reports/export?format=xlsx&preset=${preset}`}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </a>
        </div>
      </div>

      {/* Highlights Card (Fixed Plain English Templates from SQL) */}
      {highlights.length > 0 && (
        <Card
          variant="elevated"
          padding="md"
          className="bg-gradient-to-r from-blue-500/10 via-purple-500/5 to-transparent border border-brand/20 shadow-soft-md"
        >
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="w-4 h-4 text-brand" />
            <span className="text-xs font-black uppercase tracking-wider text-brand">
              Executive Highlights
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {highlights.map((h, i) => (
              <div
                key={i}
                className="p-3 rounded-2xl bg-white/80 dark:bg-[#16161C]/80 border border-black/[0.04] dark:border-white/[0.04] text-xs font-medium text-gray-800 dark:text-gray-200 flex items-start gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 flex-shrink-0" />
                <span>{h.text}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <Card variant="default" padding="sm" className="space-y-1">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />
            <span>Settled Orders</span>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white tabular-nums tracking-tight">
            {kpis?.ordersCount ?? 0}
          </div>
          <div className="text-[11px] text-gray-500">
            {kpis?.itemsSoldCount ?? 0} total items sold
          </div>
        </Card>

        <Card variant="default" padding="sm" className="space-y-1">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-emerald-500" />
            <span>Net Revenue</span>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
            {formatINR(kpis?.revenuePaise ?? 0)}
          </div>
          <div className="text-[11px] text-gray-500">Taxable (excl. GST)</div>
        </Card>

        <Card variant="default" padding="sm" className="space-y-1">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Receipt className="w-3.5 h-3.5 text-purple-500" />
            <span>GST Collected</span>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 tabular-nums tracking-tight">
            {formatINR(kpis?.gstCollectedPaise ?? 0)}
          </div>
          <div className="text-[11px] text-gray-500">Pass-through tax</div>
        </Card>

        <Card variant="default" padding="sm" className="space-y-1">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-brand" />
            <span>Gross Profit</span>
          </div>
          <div className="text-2xl font-black text-brand tabular-nums tracking-tight">
            {formatINR(kpis?.grossProfitPaise ?? 0)}
          </div>
          <div className="text-[11px] text-gray-500">
            {kpis?.revenuePaise > 0
              ? `${Math.round(((kpis.grossProfitPaise / kpis.revenuePaise) * 100))}% overall margin`
              : '0% margin'}
          </div>
        </Card>

        <Card variant="default" padding="sm" className="space-y-1">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-amber-500" />
            <span>Avg Order Value</span>
          </div>
          <div className="text-2xl font-black text-gray-900 dark:text-white tabular-nums tracking-tight">
            {formatINR(kpis?.averageOrderValuePaise ?? 0)}
          </div>
          <div className="text-[11px] text-gray-500">Revenue per order</div>
        </Card>
      </div>

      {/* Missing Cost Notice Banner */}
      {kpis?.linesWithMissingCostCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span>
            {kpis.linesWithMissingCostCount} sold order lines have no cost price entered. Their gross profit is excluded from totals to avoid inaccurate 100% margin calculations.
          </span>
        </div>
      )}

      {/* Top vs Least Sold Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Most Sold Products */}
        <Card variant="default" padding="md">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span>Top 5 Best-Selling Products (by Volume)</span>
          </h3>

          <div className="space-y-2.5">
            {topProducts.map((p, idx) => (
              <div
                key={p.productId}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-[#EAEBED]/50 dark:bg-[#101014]/50 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-brand/10 text-brand font-bold text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-gray-900 dark:text-white">{p.productName}</div>
                    <div className="text-[10px] text-gray-400">{p.categoryName}</div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-extrabold text-gray-900 dark:text-white tabular-nums">
                    {p.qtySold} sold
                  </span>
                  <div className="text-[10px] text-gray-500">{formatINR(p.revenuePaise)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Least Sold Products (Includes Zero Sales!) */}
        <Card variant="default" padding="md">
          <h3 className="font-extrabold text-sm text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-amber-500" />
            <span>Least Sold Products (incl. Zero Sales)</span>
          </h3>

          <div className="space-y-2.5">
            {bottomProducts.map((p) => (
              <div
                key={p.productId}
                className="flex items-center justify-between p-2.5 rounded-2xl bg-[#EAEBED]/50 dark:bg-[#101014]/50 text-xs"
              >
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">{p.productName}</div>
                  <div className="text-[10px] text-gray-400">{p.categoryName}</div>
                </div>

                <div className="text-right">
                  <span
                    className={`font-extrabold tabular-nums px-2 py-0.5 rounded-full text-[10px] ${
                      p.qtySold === 0
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400 font-black'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {p.qtySold === 0 ? '0 SALES' : `${p.qtySold} sold`}
                  </span>
                  <div className="text-[10px] text-gray-500">{formatINR(p.revenuePaise)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Tabs Switcher: Products Table vs Orders Profit Table */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 border-b border-black/[0.06] dark:border-white/[0.06] pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-obsidian text-white dark:bg-white dark:text-obsidian shadow-sm'
                : 'text-gray-500'
            }`}
          >
            All Products Sales & Margins ({productsTable.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
              activeTab === 'orders'
                ? 'bg-obsidian text-white dark:bg-white dark:text-obsidian shadow-sm'
                : 'text-gray-500'
            }`}
          >
            Gross Profit per Order ({ordersTable.length})
          </button>
        </div>

        {/* Tab 1: Products Sales & Profit Breakdown */}
        {activeTab === 'overview' && (
          <Card variant="default" padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 dark:bg-[#121216]/80 font-semibold text-gray-500 dark:text-gray-400 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <tr>
                    <th className="py-3.5 px-6">Product</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4 text-center">Qty Sold</th>
                    <th className="py-3.5 px-4 text-right">Revenue (Taxable)</th>
                    <th className="py-3.5 px-4 text-right">Item Cost</th>
                    <th className="py-3.5 px-4 text-right">Gross Profit</th>
                    <th className="py-3.5 px-6 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {productsTable.map((prod) => (
                    <tr
                      key={prod.productId}
                      className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors"
                    >
                      <td className="py-3.5 px-6 font-bold text-gray-900 dark:text-white">
                        {prod.productName}
                      </td>
                      <td className="py-3.5 px-4 text-gray-500">{prod.categoryName}</td>
                      <td className="py-3.5 px-4 text-center font-semibold tabular-nums">
                        {prod.qtySold}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium tabular-nums">
                        {formatINR(prod.revenuePaise)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-gray-500">
                        {prod.totalCostPaise != null ? formatINR(prod.totalCostPaise) : 'Missing'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-brand tabular-nums">
                        {prod.grossProfitPaise != null ? formatINR(prod.grossProfitPaise) : 'Unknown'}
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold tabular-nums">
                        {prod.marginPct != null ? `${prod.marginPct}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Tab 2: Profit per Order */}
        {activeTab === 'orders' && (
          <Card variant="default" padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 dark:bg-[#121216]/80 font-semibold text-gray-500 dark:text-gray-400 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <tr>
                    <th className="py-3.5 px-6">Invoice #</th>
                    <th className="py-3.5 px-4">Type / Table</th>
                    <th className="py-3.5 px-4">Date Time</th>
                    <th className="py-3.5 px-4 text-right">Revenue (Taxable)</th>
                    <th className="py-3.5 px-4 text-right">Order Cost</th>
                    <th className="py-3.5 px-4 text-right">Gross Profit</th>
                    <th className="py-3.5 px-6 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                  {ordersTable.map((ord) => (
                    <tr
                      key={ord.id}
                      className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors"
                    >
                      <td className="py-3.5 px-6 font-mono font-bold text-gray-900 dark:text-white">
                        {ord.invoiceNo}
                      </td>
                      <td className="py-3.5 px-4 text-gray-600 dark:text-gray-300">
                        {ord.orderType === 'DINE_IN' ? `Table ${ord.tableLabel || ''}` : 'Takeaway'}
                      </td>
                      <td className="py-3.5 px-4 text-gray-400">
                        {new Date(ord.settledAt).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium tabular-nums">
                        {formatINR(ord.taxablePaise)}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-nums text-gray-500">
                        {formatINR(ord.totalCostPaise)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-brand tabular-nums">
                        {formatINR(ord.grossProfitPaise)}
                      </td>
                      <td className="py-3.5 px-6 text-right font-bold tabular-nums">
                        {ord.marginPct != null ? `${ord.marginPct}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
