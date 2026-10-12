'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/src/ui/components/Card';
import { Button } from '@/src/ui/components/Button';
import { Input } from '@/src/ui/components/Input';
import { Chip } from '@/src/ui/components/Chip';
import { Sheet } from '@/src/ui/components/Sheet';
import { computeOrderTotals, TaxConfig, OrderTotals } from '@/src/domain/tax';
import { formatINR, formatBps } from '@/src/domain/money';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  CreditCard,
  Utensils,
  Coffee,
  Receipt,
  User,
  Shield,
  Layers,
  ArrowRight,
  Sparkles,
  AlertCircle,
  FileText,
  LogOut,
  Clock,
} from 'lucide-react';

interface Product {
  id: string;
  categoryId?: string | null;
  name: string;
  description?: string;
  dietTag?: string;
  pricePaise: number;
  taxRateBpsOverride?: number | null;
  imageUrl?: string;
  isAvailable: boolean;
  sortOrder: number;
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

interface CartItem {
  productId: string;
  name: string;
  pricePaise: number;
  qty: number;
  taxRateBpsOverride?: number | null;
  note?: string;
}

export default function OrderScreen() {
  const router = useRouter();

  // Menu Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxConfig, setTaxConfig] = useState<TaxConfig>({
    tax_mode: 'GST_INTRA',
    tax_rate_bps: 500,
    prices_include_tax: false,
    service_charge_enabled: false,
    service_charge_bps: 500,
    round_grand_total: true,
  });
  const [cafeName, setCafeName] = useState('XPRSO Cafe');

  // Filter & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Order State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [tableLabel, setTableLabel] = useState('T1');
  const [orderNote, setOrderNote] = useState('');
  const [serviceChargeOptOut, setServiceChargeOptOut] = useState(false);

  // Active Open Order tracking
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeOrderVersion, setActiveOrderVersion] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const isSettledRef = useRef(false);

  // Mobile Bottom Sheet
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [lineNoteModalItem, setLineNoteModalItem] = useState<CartItem | null>(null);
  const [lineNoteText, setLineNoteText] = useState('');

  // User state
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    // 1. Fetch current user
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      });

    // 2. Fetch menu & tax configuration
    fetch('/api/menu')
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) setCategories(data.categories);
        if (data.products) setProducts(data.products);
        if (data.taxConfig) setTaxConfig(data.taxConfig);
        if (data.cafe) setCafeName(data.cafe.name);
      })
      .catch((err) => console.error('Menu load error:', err));
  }, [router]);

  // Compute live totals instantly (< 100 ms) using shared pure tax engine
  const liveTotals: OrderTotals = useMemo(() => {
    const effectiveTaxConfig: TaxConfig = {
      ...taxConfig,
      service_charge_enabled: serviceChargeOptOut ? false : taxConfig.service_charge_enabled,
    };

    const taxInputs = cart.map((item) => ({
      product_id: item.productId,
      product_name: item.name,
      unit_price_paise: item.pricePaise,
      tax_rate_bps_override: item.taxRateBpsOverride,
      qty: item.qty,
      note: item.note,
    }));

    return computeOrderTotals(taxInputs, effectiveTaxConfig);
  }, [cart, taxConfig, serviceChargeOptOut]);

  // Add Item to Cart
  const handleAddToCart = (product: Product) => {
    if (!product.isAvailable) return;
    isSettledRef.current = false;

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(10);
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          pricePaise: product.pricePaise,
          qty: 1,
          taxRateBpsOverride: product.taxRateBpsOverride,
        },
      ];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.qty + delta;
            return newQty > 0 ? { ...item, qty: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveLine = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  // Auto-Save Draft Debounce
  useEffect(() => {
    if (cart.length === 0 || isSettledRef.current) return;

    const timer = setTimeout(async () => {
      if (isSettledRef.current) return;
      setIsSaving(true);
      try {
        if (!activeOrderId) {
          // Create new OPEN order
          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderType,
              tableLabel: orderType === 'DINE_IN' ? tableLabel : null,
              note: orderNote || null,
              lines: cart.map((i) => ({ productId: i.productId, qty: i.qty, note: i.note })),
            }),
          });
          const data = await res.json();
          if (res.ok && data.order) {
            setActiveOrderId(data.order.id);
            setActiveOrderVersion(data.order.version);
            setConflictWarning(null);
          }
        } else {
          // Update existing OPEN order with optimistic concurrency
          const res = await fetch(`/api/orders/${activeOrderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              version: activeOrderVersion,
              orderType,
              tableLabel: orderType === 'DINE_IN' ? tableLabel : null,
              note: orderNote || null,
              serviceChargeOptOut,
              lines: cart.map((i) => ({ productId: i.productId, qty: i.qty, note: i.note })),
            }),
          });

          if (res.status === 409) {
            const conflict = await res.json();
            setConflictWarning(conflict.error);
          } else if (res.ok) {
            const data = await res.json();
            setActiveOrderVersion(data.order.version);
            setConflictWarning(null);
          }
        }
      } catch (err) {
        console.error('Auto-save error:', err);
      } finally {
        setIsSaving(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [cart, orderType, tableLabel, orderNote, serviceChargeOptOut, activeOrderId, activeOrderVersion]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === 'all' ||
        (selectedCategory === 'uncategorized' ? !p.categoryId : p.categoryId === selectedCategory);
      const matchQuery =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCat && matchQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Settle Order Action
  const handleProceedToSettle = () => {
    if (cart.length === 0) return;
    setSettleModalOpen(true);
  };

  const handleSettlePayment = async (paymentMode: 'CASH' | 'UPI' | 'CARD' | 'OTHER') => {
    try {
      let orderIdToSettle = activeOrderId;
      if (!orderIdToSettle) {
        // Order hasn't finished debounced auto-save yet; save immediately
        const createRes = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderType,
            tableLabel: orderType === 'DINE_IN' ? tableLabel : null,
            note: orderNote || null,
            lines: cart.map((i) => ({ productId: i.productId, qty: i.qty, note: i.note })),
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok || !createData.order) {
          throw new Error(createData.error || 'Failed to create order');
        }
        orderIdToSettle = createData.order.id;
        setActiveOrderId(orderIdToSettle);
      }

      const res = await fetch(`/api/orders/${orderIdToSettle}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to settle order');
      }

      isSettledRef.current = true;
      setSettleModalOpen(false);
      setIsMobileCartOpen(false);
      setCart([]);
      setActiveOrderId(null);
      // Reset cart and navigate to settled invoice view or orders
      router.push(`/orders?settled=${orderIdToSettle}`);
    } catch (err: any) {
      console.error('Settlement error:', err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas-light dark:bg-canvas-dark text-gray-900 dark:text-gray-100">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 px-4 sm:px-6 py-3 bg-white/80 dark:bg-[#121216]/80 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.06]">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-brand text-white flex items-center justify-center font-black shadow-brand-glow">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-extrabold text-base tracking-tight text-gray-900 dark:text-white leading-none">
                {cafeName}
              </h1>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span>{currentUser?.displayName || 'Waiter'}</span>
                {currentUser?.roles?.includes('ADMIN') && (
                  <span className="px-1.5 py-0.2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold text-[10px]">
                    Admin
                  </span>
                )}
                {isSaving && <span className="text-brand animate-pulse">Saving...</span>}
              </div>
            </div>
          </div>

          {/* Quick Nav Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => router.push('/orders')}
              leftIcon={<Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />}
            >
              Today&apos;s Orders
            </Button>

            {currentUser?.roles?.includes('ADMIN') && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push('/admin')}
                leftIcon={<Shield className="w-4 h-4 text-purple-600" />}
              >
                Admin Panel
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.push('/login');
              }}
              leftIcon={<LogOut className="w-4 h-4 text-red-500" />}
              title="Switch user"
            >
              Switch
            </Button>
          </div>
        </div>
      </header>

      {/* Conflict Banner if optimistic locking detects parallel edit */}
      {conflictWarning && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-2.5 text-center flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{conflictWarning}</span>
          <button
            onClick={() => window.location.reload()}
            className="underline font-bold ml-2"
          >
            Reload Order
          </button>
        </div>
      )}

      {/* Main Workspace: Two Columns on Tablet / Desktop */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Menu Browsing (7 or 8 cols on tablet/desktop) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search Bar & Order Type Switcher */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full flex-1">
              <Input
                placeholder="Search coffee, drinks, snacks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>

            {/* Dine-in vs Takeaway Toggle */}
            <div className="flex items-center p-1 rounded-full bg-white dark:bg-[#1A1A22] border border-black/[0.06] dark:border-white/[0.08] shadow-soft-sm">
              <button
                type="button"
                onClick={() => setOrderType('DINE_IN')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  orderType === 'DINE_IN'
                    ? 'bg-obsidian text-white shadow-obsidian dark:bg-white dark:text-obsidian'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Dine-in
              </button>
              <button
                type="button"
                onClick={() => setOrderType('TAKEAWAY')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  orderType === 'TAKEAWAY'
                    ? 'bg-obsidian text-white shadow-obsidian dark:bg-white dark:text-obsidian'
                    : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                Takeaway
              </button>
            </div>
          </div>

          {/* Table Selector (when Dine-in) */}
          {orderType === 'DINE_IN' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-bold text-gray-500 whitespace-nowrap">Table:</span>
              {['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'Bar 1', 'Garden'].map((tbl) => (
                <button
                  key={tbl}
                  type="button"
                  onClick={() => setTableLabel(tbl)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                    tableLabel === tbl
                      ? 'bg-brand text-white shadow-brand-glow font-bold'
                      : 'bg-white dark:bg-[#1A1A22] text-gray-700 dark:text-gray-300 border border-black/5 dark:border-white/5'
                  }`}
                >
                  {tbl}
                </button>
              ))}
            </div>
          )}

          {/* Category Tabs (Pills from 03-pill-nav.jpg & 04-mono-controls.jpg) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <Chip
              active={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              count={products.length}
            >
              All
            </Chip>
            {categories.map((cat) => {
              const count = products.filter((p) => p.categoryId === cat.id).length;
              return (
                <Chip
                  key={cat.id}
                  active={selectedCategory === cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  count={count}
                >
                  {cat.name}
                </Chip>
              );
            })}
            {products.some((p) => !p.categoryId) && categories.length > 0 && (
              <Chip
                active={selectedCategory === 'uncategorized'}
                onClick={() => setSelectedCategory('uncategorized')}
                count={products.filter((p) => !p.categoryId).length}
              >
                General
              </Chip>
            )}
          </div>

          {/* Product Cards Grid */}
          {filteredProducts.length === 0 ? (
            <div className="py-20 text-center text-gray-400 text-sm">
              No menu items match your search.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredProducts.map((prod) => {
                const cartQty = cart.find((i) => i.productId === prod.id)?.qty || 0;

                return (
                  <div
                    key={prod.id}
                    onClick={() => prod.isAvailable && handleAddToCart(prod)}
                    className={`relative flex flex-col justify-between p-4 rounded-3xl transition-all duration-150 select-none ${
                      !prod.isAvailable
                        ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-900 border border-black/5 dark:border-white/5'
                        : 'bg-white dark:bg-[#16161C] border border-black/[0.06] dark:border-white/[0.08] shadow-soft-sm hover:shadow-soft-md cursor-pointer active:scale-95'
                    }`}
                  >
                    <div>
                      {/* Dietary dot & status */}
                      <div className="flex items-center justify-between mb-2">
                        {prod.dietTag === 'VEG' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Veg" />
                        )}
                        {prod.dietTag === 'NON_VEG' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-red-500" title="Non-Veg" />
                        )}
                        {prod.dietTag === 'VEGAN' && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 ring-2 ring-emerald-300" title="Vegan" />
                        )}
                        {!prod.isAvailable && (
                          <span className="text-[10px] font-bold text-amber-500 uppercase">
                            Sold Out
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-sm text-gray-900 dark:text-white line-clamp-2 leading-snug">
                        {prod.name}
                      </h4>
                      {prod.description && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-1">
                          {prod.description}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-black/[0.04] dark:border-white/[0.04] flex items-center justify-between">
                      <span className="font-extrabold text-sm text-gray-900 dark:text-white tabular-nums">
                        {formatINR(prod.pricePaise)}
                      </span>

                      {cartQty > 0 ? (
                        <div
                          className="flex items-center gap-1.5 bg-brand text-white px-2 py-1 rounded-full text-xs font-bold shadow-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(prod.id, -1)}
                            className="w-5 h-5 flex items-center justify-center hover:opacity-80"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="tabular-nums px-1">{cartQty}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(prod.id, 1)}
                            className="w-5 h-5 flex items-center justify-center hover:opacity-80"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-brand hover:text-white transition-colors">
                          <Plus className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Live Sticky Order Panel (Desktop/Tablet) */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4">
          <div className="sticky top-20">
            <Card
              variant="elevated"
              padding="md"
              className="bg-white/95 dark:bg-[#16161C]/95 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-soft-xl flex flex-col h-[calc(100vh-6rem)]"
            >
              {/* Order Header */}
              <div className="flex items-center justify-between pb-3 border-b border-black/[0.06] dark:border-white/[0.06]">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-gray-400">
                    Current Order
                  </span>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    {orderType === 'DINE_IN' ? `Table ${tableLabel}` : 'Takeaway Order'}
                  </h3>
                </div>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-semibold text-red-500 hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Line Items List */}
              <div className="flex-1 overflow-y-auto py-3 space-y-2.5 pr-1">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <ShoppingBag className="w-10 h-10 stroke-1 mb-2 opacity-50" />
                    <p className="text-sm font-semibold">Your order is empty</p>
                    <p className="text-xs mt-1">Tap dishes on the menu to add them</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.productId}
                      className="p-3 rounded-2xl bg-[#EAEBED]/50 dark:bg-[#1A1A22]/50 border border-black/[0.03] dark:border-white/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h5 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                            {item.name}
                          </h5>
                          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                            {formatINR(item.pricePaise)} each
                          </span>
                          {item.note && (
                            <p className="text-[11px] text-brand font-medium mt-0.5">
                              Note: {item.note}
                            </p>
                          )}
                        </div>

                        <span className="font-extrabold text-sm text-gray-900 dark:text-white tabular-nums">
                          {formatINR(item.pricePaise * item.qty)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-black/[0.04] dark:border-white/[0.04]">
                        <button
                          type="button"
                          onClick={() => {
                            setLineNoteModalItem(item);
                            setLineNoteText(item.note || '');
                          }}
                          className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>{item.note ? 'Edit Note' : 'Add Note'}</span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.productId, -1)}
                            className="w-7 h-7 rounded-full bg-white dark:bg-[#252530] text-gray-700 dark:text-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-100"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-bold text-xs tabular-nums w-4 text-center">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.productId, 1)}
                            className="w-7 h-7 rounded-full bg-white dark:bg-[#252530] text-gray-700 dark:text-gray-200 flex items-center justify-center shadow-sm hover:bg-gray-100"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Order Notes Field */}
              {cart.length > 0 && (
                <div className="py-2">
                  <Input
                    placeholder="Order note (e.g. serve desserts after mains)..."
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                  />
                </div>
              )}

              {/* Totals Breakdown (Pure Engine Calculated) */}
              {cart.length > 0 && (
                <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-600 dark:text-gray-400">
                    <span>Subtotal</span>
                    <span className="tabular-nums font-semibold">
                      {formatINR(liveTotals.subtotal_paise)}
                    </span>
                  </div>

                  {/* Service Charge (with one-tap opt out) */}
                  {taxConfig.service_charge_enabled && (
                    <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <span>Service Charge ({formatBps(taxConfig.service_charge_bps)})</span>
                        <button
                          type="button"
                          onClick={() => setServiceChargeOptOut(!serviceChargeOptOut)}
                          className="text-[10px] text-brand underline font-semibold"
                        >
                          {serviceChargeOptOut ? 'Include' : 'Remove'}
                        </button>
                      </div>
                      <span className="tabular-nums font-semibold">
                        {serviceChargeOptOut
                          ? '₹0'
                          : formatINR(liveTotals.service_charge_paise)}
                      </span>
                    </div>
                  )}

                  {/* GST Lines */}
                  {liveTotals.tax_mode === 'GST_INTRA' && liveTotals.cgst_paise > 0 && (
                    <>
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>CGST ({formatBps(taxConfig.tax_rate_bps / 2)})</span>
                        <span className="tabular-nums font-semibold">
                          {formatINR(liveTotals.cgst_paise)}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span>SGST ({formatBps(taxConfig.tax_rate_bps / 2)})</span>
                        <span className="tabular-nums font-semibold">
                          {formatINR(liveTotals.sgst_paise)}
                        </span>
                      </div>
                    </>
                  )}

                  {liveTotals.tax_mode === 'GST_SINGLE_LINE' && liveTotals.total_tax_paise > 0 && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>GST ({formatBps(taxConfig.tax_rate_bps)})</span>
                      <span className="tabular-nums font-semibold">
                        {formatINR(liveTotals.total_tax_paise)}
                      </span>
                    </div>
                  )}

                  {liveTotals.round_off_paise !== 0 && (
                    <div className="flex justify-between text-gray-600 dark:text-gray-400">
                      <span>Round Off</span>
                      <span className="tabular-nums font-semibold">
                        {liveTotals.round_off_paise > 0 ? '+' : ''}
                        {formatINR(liveTotals.round_off_paise)}
                      </span>
                    </div>
                  )}

                  {/* Grand Total Display */}
                  <div className="pt-3 pb-1 flex justify-between items-baseline">
                    <span className="text-sm font-extrabold tracking-tight text-gray-900 dark:text-white uppercase">
                      Grand Total
                    </span>
                    <span className="text-2xl font-black text-brand tracking-tight tabular-nums">
                      {formatINR(liveTotals.grand_total_paise)}
                    </span>
                  </div>

                  {/* Settle / Pay Action */}
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full mt-2"
                    onClick={handleProceedToSettle}
                    rightIcon={<CreditCard className="w-5 h-5 ml-1" />}
                  >
                    Settle Order ({formatINR(liveTotals.grand_total_paise)})
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Mobile Floating Sticky Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 p-4 bg-white/95 dark:bg-[#16161C]/95 backdrop-blur-2xl border-t border-black/10 dark:border-white/10 z-40">
        <div className="flex items-center justify-between gap-3">
          <div onClick={() => setIsMobileCartOpen(true)} className="cursor-pointer">
            <span className="text-xs text-gray-500 font-medium">
              {cart.reduce((s, i) => s + i.qty, 0)} items • {orderType === 'DINE_IN' ? tableLabel : 'Takeaway'}
            </span>
            <div className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
              {formatINR(liveTotals.grand_total_paise)}
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            disabled={cart.length === 0}
            onClick={() => setIsMobileCartOpen(true)}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Review & Settle
          </Button>
        </div>
      </div>

      {/* Mobile Bottom Sheet for Cart */}
      <Sheet
        open={isMobileCartOpen}
        onOpenChange={setIsMobileCartOpen}
        title={orderType === 'DINE_IN' ? `Table ${tableLabel}` : 'Takeaway Order'}
        description={`${cart.reduce((s, i) => s + i.qty, 0)} items in active order`}
        side="bottom"
      >
        <div className="space-y-4">
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {cart.map((item) => (
              <div
                key={item.productId}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#EAEBED]/60 dark:bg-[#1A1A22]/60"
              >
                <div>
                  <div className="font-bold text-sm text-gray-900 dark:text-white">{item.name}</div>
                  <div className="text-xs text-gray-500">{formatINR(item.pricePaise)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateQty(item.productId, -1)}
                    className="w-7 h-7 rounded-full bg-white dark:bg-[#252530] flex items-center justify-center font-bold"
                  >
                    -
                  </button>
                  <span className="tabular-nums font-bold text-sm w-4 text-center">{item.qty}</span>
                  <button
                    onClick={() => handleUpdateQty(item.productId, 1)}
                    className="w-7 h-7 rounded-full bg-white dark:bg-[#252530] flex items-center justify-center font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1.5 text-xs pt-3 border-t border-black/10 dark:border-white/10">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatINR(liveTotals.subtotal_paise)}</span>
            </div>
            {liveTotals.cgst_paise > 0 && (
              <>
                <div className="flex justify-between text-gray-500">
                  <span>CGST</span>
                  <span className="tabular-nums">{formatINR(liveTotals.cgst_paise)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>SGST</span>
                  <span className="tabular-nums">{formatINR(liveTotals.sgst_paise)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-extrabold text-base pt-2 text-gray-900 dark:text-white">
              <span>Grand Total</span>
              <span className="text-brand tabular-nums">
                {formatINR(liveTotals.grand_total_paise)}
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleProceedToSettle}
          >
            Choose Payment & Settle
          </Button>
        </div>
      </Sheet>

      {/* Settle Order Modal */}
      {settleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card variant="elevated" padding="lg" className="max-w-md w-full">
            <h3 className="text-xl font-black text-gray-900 dark:text-white mb-1">
              Settle & Generate Invoice
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
              Total Payable:{' '}
              <span className="font-extrabold text-brand text-sm tabular-nums">
                {formatINR(liveTotals.grand_total_paise)}
              </span>
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { mode: 'UPI', label: 'UPI / QR', desc: 'GPay, PhonePe, Paytm' },
                { mode: 'CASH', label: 'Cash', desc: 'Cash payment' },
                { mode: 'CARD', label: 'Card', desc: 'Credit / Debit POS' },
                { mode: 'OTHER', label: 'Other', desc: 'Voucher / Split' },
              ].map((p) => (
                <button
                  key={p.mode}
                  type="button"
                  onClick={() => handleSettlePayment(p.mode as any)}
                  className="p-4 rounded-2xl bg-white dark:bg-[#1A1A22] border border-black/10 dark:border-white/10 hover:border-brand hover:bg-brand/5 active:scale-95 transition-all text-left"
                >
                  <div className="font-bold text-sm text-gray-900 dark:text-white">{p.label}</div>
                  <div className="text-[11px] text-gray-500">{p.desc}</div>
                </button>
              ))}
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" size="md" onClick={() => setSettleModalOpen(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Line Note Modal */}
      {lineNoteModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card variant="elevated" padding="lg" className="max-w-sm w-full">
            <h4 className="font-bold text-base text-gray-900 dark:text-white mb-2">
              Add Note for {lineNoteModalItem.name}
            </h4>
            <Input
              placeholder="e.g. less sugar, oat milk, extra ice..."
              value={lineNoteText}
              onChange={(e) => setLineNoteText(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLineNoteModalItem(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setCart((prev) =>
                    prev.map((i) =>
                      i.productId === lineNoteModalItem.productId
                        ? { ...i, note: lineNoteText.trim() || undefined }
                        : i
                    )
                  );
                  setLineNoteModalItem(null);
                }}
              >
                Save Note
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
