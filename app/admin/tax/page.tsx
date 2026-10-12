'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/src/ui/components/Card';
import { Button } from '@/src/ui/components/Button';
import { Input } from '@/src/ui/components/Input';
import { computeOrderTotals, TaxConfig, TaxMode } from '@/src/domain/tax';
import { formatINR, formatBps } from '@/src/domain/money';
import { Save, HelpCircle, Check, Sparkles } from 'lucide-react';

export default function AdminTaxPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [taxConfig, setTaxConfig] = useState<TaxConfig>({
    tax_mode: 'GST_INTRA',
    tax_rate_bps: 500,
    prices_include_tax: false,
    service_charge_enabled: false,
    service_charge_bps: 500,
    round_grand_total: true,
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
          setTaxConfig({
            tax_mode: data.settings.taxMode as TaxMode,
            tax_rate_bps: data.settings.taxRateBps,
            prices_include_tax: data.settings.pricesIncludeTax,
            service_charge_enabled: data.settings.serviceChargeEnabled,
            service_charge_bps: data.settings.serviceChargeBps,
            round_grand_total: data.settings.roundGrandTotal,
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taxMode: taxConfig.tax_mode,
          taxRateBps: taxConfig.tax_rate_bps,
          pricesIncludeTax: taxConfig.prices_include_tax,
          serviceChargeEnabled: taxConfig.service_charge_enabled,
          serviceChargeBps: taxConfig.service_charge_bps,
          roundGrandTotal: taxConfig.round_grand_total,
        }),
      });

      if (res.ok) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // Sample items for live bill preview
  const sampleLines = [
    { product_id: '1', product_name: 'Espresso Tonic', unit_price_paise: 22000, qty: 1 },
    { product_id: '2', product_name: 'Almond Croissant', unit_price_paise: 18000, qty: 1 },
  ];

  const liveTotals = computeOrderTotals(sampleLines, taxConfig);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Tax & GST Configuration
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Configure how GST and service charges are calculated. Confirm your rate with your tax advisor.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          isLoading={saving}
          onClick={handleSave}
          leftIcon={savedSuccess ? <Check className="w-4 h-4 text-white" /> : <Save className="w-4 h-4" />}
        >
          {savedSuccess ? 'Settings Saved!' : 'Save Tax Settings'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card variant="default" padding="lg">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
              GST Calculation Mode
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {[
                {
                  id: 'GST_INTRA',
                  title: 'CGST + SGST (Intra-state)',
                  desc: 'Splits tax equally (e.g. 2.5% CGST + 2.5% SGST for 5%). Standard for cafés in India.',
                },
                {
                  id: 'GST_SINGLE_LINE',
                  title: 'Single GST / IGST Line',
                  desc: 'Renders a single consolidated GST line with the full configured percentage.',
                },
                {
                  id: 'COMPOSITION',
                  title: 'Composition Scheme',
                  desc: 'Bill of Supply: no tax collected from customer. Shows mandatory composition disclaimer.',
                },
                {
                  id: 'NONE',
                  title: 'No GST (0%)',
                  desc: 'No tax lines shown. Document titled simple "Bill".',
                },
              ].map((m) => (
                <div
                  key={m.id}
                  onClick={() => setTaxConfig({ ...taxConfig, tax_mode: m.id as TaxMode })}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    taxConfig.tax_mode === m.id
                      ? 'border-brand bg-brand/5 ring-1 ring-brand'
                      : 'border-black/10 dark:border-white/10 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="font-bold text-sm text-gray-900 dark:text-white mb-1">
                    {m.title}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{m.desc}</p>
                </div>
              ))}
            </div>

            {/* GST Rate Input */}
            {taxConfig.tax_mode !== 'NONE' && taxConfig.tax_mode !== 'COMPOSITION' && (
              <div className="space-y-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                    GST Rate
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {[
                      { label: '0%', bps: 0 },
                      { label: '5% (Standard Café)', bps: 500 },
                      { label: '12%', bps: 1200 },
                      { label: '18%', bps: 1800 },
                    ].map((r) => (
                      <button
                        key={r.bps}
                        type="button"
                        onClick={() => setTaxConfig({ ...taxConfig, tax_rate_bps: r.bps })}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                          taxConfig.tax_rate_bps === r.bps
                            ? 'bg-obsidian text-white dark:bg-white dark:text-obsidian shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      step="0.01"
                      label="Custom Rate %"
                      value={(taxConfig.tax_rate_bps / 100).toString()}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setTaxConfig({ ...taxConfig, tax_rate_bps: Math.round(val * 100) });
                      }}
                    />
                  </div>
                </div>

                {/* Inclusive vs Exclusive */}
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Menu Pricing Mode
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div
                      onClick={() => setTaxConfig({ ...taxConfig, prices_include_tax: false })}
                      className={`p-3.5 rounded-2xl border cursor-pointer text-center font-bold text-xs ${
                        !taxConfig.prices_include_tax
                          ? 'border-brand bg-brand/5 text-brand ring-1 ring-brand'
                          : 'border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Exclusive (GST added on bill)
                    </div>
                    <div
                      onClick={() => setTaxConfig({ ...taxConfig, prices_include_tax: true })}
                      className={`p-3.5 rounded-2xl border cursor-pointer text-center font-bold text-xs ${
                        taxConfig.prices_include_tax
                          ? 'border-brand bg-brand/5 text-brand ring-1 ring-brand'
                          : 'border-black/10 dark:border-white/10 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      Inclusive (Menu price contains GST)
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Service Charge & Rounding */}
          <Card variant="default" padding="lg" className="space-y-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Service Charge & Round-Off
            </h3>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#EAEBED]/60 dark:bg-[#101014]/60">
              <div>
                <div className="font-semibold text-sm text-gray-900 dark:text-white">
                  Round Grand Total to Nearest Rupee
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Adds or subtracts a small round-off amount to eliminate paise coins
                </div>
              </div>
              <input
                type="checkbox"
                checked={taxConfig.round_grand_total}
                onChange={(e) => setTaxConfig({ ...taxConfig, round_grand_total: e.target.checked })}
                className="w-5 h-5 rounded text-brand focus:ring-brand"
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#EAEBED]/60 dark:bg-[#101014]/60">
              <div>
                <div className="font-semibold text-sm text-gray-900 dark:text-white">
                  Enable Service Charge
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Voluntary customer service fee (can be removed by waiter on customer request)
                </div>
              </div>
              <input
                type="checkbox"
                checked={taxConfig.service_charge_enabled}
                onChange={(e) =>
                  setTaxConfig({ ...taxConfig, service_charge_enabled: e.target.checked })
                }
                className="w-5 h-5 rounded text-brand focus:ring-brand"
              />
            </div>

            {taxConfig.service_charge_enabled && (
              <Input
                type="number"
                step="0.5"
                label="Service Charge Rate %"
                value={(taxConfig.service_charge_bps / 100).toString()}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 0;
                  setTaxConfig({ ...taxConfig, service_charge_bps: Math.round(val * 100) });
                }}
              />
            )}
          </Card>
        </div>

        {/* Right Live Preview Bill (5 cols) */}
        <div className="lg:col-span-5">
          <div className="sticky top-24">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-brand" />
              <h3 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white uppercase tracking-wider">
                Live Receipt Preview
              </h3>
            </div>

            <Card
              variant="elevated"
              padding="lg"
              className="bg-white dark:bg-[#16161C] border border-black/10 dark:border-white/10 shadow-soft-xl font-mono text-xs"
            >
              <div className="text-center pb-4 border-b border-dashed border-gray-300 dark:border-gray-700">
                <div className="font-sans font-extrabold text-base text-gray-900 dark:text-white">
                  XPRSO ARTISAN CAFÉ
                </div>
                <div className="text-gray-500 mt-1">
                  {taxConfig.tax_mode === 'COMPOSITION'
                    ? 'BILL OF SUPPLY'
                    : taxConfig.tax_mode === 'NONE'
                    ? 'BILL'
                    : 'TAX INVOICE'}
                </div>
                {taxConfig.tax_mode === 'COMPOSITION' && (
                  <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    Composition taxable person, not eligible to collect tax on supplies.
                  </div>
                )}
              </div>

              {/* Sample Items */}
              <div className="py-4 space-y-2 border-b border-dashed border-gray-300 dark:border-gray-700">
                {sampleLines.map((item) => (
                  <div key={item.product_id} className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold">{item.product_name}</span>
                      <span className="text-gray-400 ml-2">× {item.qty}</span>
                    </div>
                    <span className="tabular-nums font-bold">
                      {formatINR(item.unit_price_paise * item.qty)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Totals Breakdown */}
              <div className="py-3 space-y-1.5 border-b border-dashed border-gray-300 dark:border-gray-700">
                <div className="flex justify-between text-gray-600 dark:text-gray-400">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatINR(liveTotals.subtotal_paise)}</span>
                </div>

                {liveTotals.service_charge_paise > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Service Charge ({formatBps(taxConfig.service_charge_bps)})</span>
                    <span className="tabular-nums">
                      {formatINR(liveTotals.service_charge_paise)}
                    </span>
                  </div>
                )}

                {/* GST Lines */}
                {liveTotals.tax_mode === 'GST_INTRA' && liveTotals.cgst_paise > 0 && (
                  <>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>CGST ({formatBps(taxConfig.tax_rate_bps / 2)})</span>
                      <span className="tabular-nums">{formatINR(liveTotals.cgst_paise)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>SGST ({formatBps(taxConfig.tax_rate_bps / 2)})</span>
                      <span className="tabular-nums">{formatINR(liveTotals.sgst_paise)}</span>
                    </div>
                  </>
                )}

                {liveTotals.tax_mode === 'GST_SINGLE_LINE' && liveTotals.total_tax_paise > 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>GST ({formatBps(taxConfig.tax_rate_bps)})</span>
                    <span className="tabular-nums">{formatINR(liveTotals.total_tax_paise)}</span>
                  </div>
                )}

                {liveTotals.round_off_paise !== 0 && (
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Round off</span>
                    <span className="tabular-nums">
                      {liveTotals.round_off_paise > 0 ? '+' : ''}
                      {formatINR(liveTotals.round_off_paise)}
                    </span>
                  </div>
                )}
              </div>

              {/* Grand Total */}
              <div className="pt-4 flex justify-between items-baseline font-sans">
                <span className="text-sm font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">
                  Grand Total
                </span>
                <span className="text-xl font-black text-brand tracking-tight tabular-nums">
                  {formatINR(liveTotals.grand_total_paise)}
                </span>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
