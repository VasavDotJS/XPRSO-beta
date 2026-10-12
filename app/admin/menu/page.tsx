'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/src/ui/components/Card';
import { Button } from '@/src/ui/components/Button';
import { Input } from '@/src/ui/components/Input';
import { Chip } from '@/src/ui/components/Chip';
import { Sheet } from '@/src/ui/components/Sheet';
import { formatINR, paiseToRupees, rupeesToPaise } from '@/src/domain/money';
import {
  Plus,
  Edit2,
  Trash2,
  Save,
  Check,
  X,
  Layers,
  Sparkles,
  AlertTriangle,
  FolderPlus,
} from 'lucide-react';

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  isArchived: boolean;
}

interface Product {
  id: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  description?: string;
  dietTag?: string;
  pricePaise: number;
  costPaise?: number | null;
  taxRateBpsOverride?: number | null;
  isAvailable: boolean;
  isArchived: boolean;
  sortOrder: number;
}

export default function AdminMenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Modals & Drawers
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isBulkEditMode, setIsBulkEditMode] = useState(false);
  const [bulkChanges, setBulkChanges] = useState<{ [id: string]: { pricePaise?: number; costPaise?: number } }>({});
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // New Category Form
  const [newCatName, setNewCatName] = useState('');

  // New Product Form
  const [newProd, setNewProd] = useState({
    name: '',
    categoryId: '',
    priceRupees: '',
    costRupees: '',
    dietTag: 'VEG',
    description: '',
    isAvailable: true,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [catsRes, prodsRes] = await Promise.all([
        fetch('/api/admin/categories'),
        fetch('/api/admin/products'),
      ]);

      if (catsRes.status === 403 || prodsRes.status === 403) {
        window.location.href = '/admin';
        return;
      }

      const catsData = await catsRes.json();
      const prodsData = await prodsRes.json();

      setCategories(catsData.categories || []);
      setProducts(prodsData.products || []);
      if (catsData.categories?.length > 0 && !newProd.categoryId) {
        setNewProd((p) => ({ ...p, categoryId: catsData.categories[0].id }));
      }
    } catch (err) {
      console.error('Failed to load menu data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      if (res.ok) {
        setNewCatName('');
        setIsAddCategoryOpen(false);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pricePaise = rupeesToPaise(newProd.priceRupees);
      const costPaise = newProd.costRupees ? rupeesToPaise(newProd.costRupees) : null;

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProd.name.trim(),
          categoryId: newProd.categoryId,
          pricePaise,
          costPaise,
          dietTag: newProd.dietTag,
          description: newProd.description.trim() || undefined,
          isAvailable: newProd.isAvailable,
        }),
      });

      if (res.ok) {
        setIsAddProductOpen(false);
        setNewProd({
          name: '',
          categoryId: categories[0]?.id || '',
          priceRupees: '',
          costRupees: '',
          dietTag: 'VEG',
          description: '',
          isAvailable: true,
        });
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAvailability = async (product: Product) => {
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !product.isAvailable }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchiveProduct = async (id: string) => {
    if (!confirm('Are you sure you want to archive this product?')) return;
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
      if (res.ok) loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleBulkChange = (id: string, field: 'price' | 'cost', valueStr: string) => {
    const valPaise = rupeesToPaise(valueStr);
    setBulkChanges((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field === 'price' ? 'pricePaise' : 'costPaise']: valPaise,
      },
    }));
  };

  const handleSaveBulkChanges = async () => {
    const items = Object.entries(bulkChanges).map(([id, changes]) => ({
      id,
      ...changes,
    }));

    if (items.length === 0) {
      setIsBulkEditMode(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });

      if (res.ok) {
        setBulkChanges({});
        setIsBulkEditMode(false);
        setShowBulkConfirm(false);
        loadData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (p.isArchived) return false;
    if (selectedCategory === 'all') return true;
    return p.categoryId === selectedCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Menu, Prices & Costs
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Prices update immediately for new order lines; settled orders remain permanently untouched.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsAddCategoryOpen(true)}
            leftIcon={<FolderPlus className="w-4 h-4" />}
          >
            Add Category
          </Button>

          {!isBulkEditMode ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsBulkEditMode(true)}
              leftIcon={<Layers className="w-4 h-4" />}
            >
              Bulk Price Edit
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setBulkChanges({});
                  setIsBulkEditMode(false);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={Object.keys(bulkChanges).length === 0}
                onClick={() => setShowBulkConfirm(true)}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save {Object.keys(bulkChanges).length} Changes
              </Button>
            </div>
          )}

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddProductOpen(true)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            New Product
          </Button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Chip
          active={selectedCategory === 'all'}
          onClick={() => setSelectedCategory('all')}
          count={products.filter((p) => !p.isArchived).length}
        >
          All Items
        </Chip>
        {categories
          .filter((c) => !c.isArchived)
          .map((cat) => {
            const count = products.filter((p) => p.categoryId === cat.id && !p.isArchived).length;
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
      </div>

      {/* Products Table / Grid View */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card variant="default" padding="lg" className="text-center py-16">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No products found in this category. Click &quot;New Product&quot; to add one.
          </p>
        </Card>
      ) : (
        <Card variant="default" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 dark:bg-[#121216]/80 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-black/[0.06] dark:border-white/[0.06]">
                <tr>
                  <th className="py-3.5 px-6">Product Name</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4 text-right">Selling Price</th>
                  <th className="py-3.5 px-4 text-right">Cost Price (for Profit)</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {filteredProducts.map((prod) => {
                  const currentBulk = bulkChanges[prod.id];
                  const displayPricePaise = currentBulk?.pricePaise ?? prod.pricePaise;
                  const displayCostPaise = currentBulk?.costPaise ?? prod.costPaise;

                  return (
                    <tr
                      key={prod.id}
                      className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors"
                    >
                      <td className="py-4 px-6 font-semibold text-gray-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          {prod.dietTag === 'VEG' && (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Veg" />
                          )}
                          {prod.dietTag === 'NON_VEG' && (
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500" title="Non-Veg" />
                          )}
                          <span>{prod.name}</span>
                        </div>
                        {prod.description && (
                          <p className="text-xs font-normal text-gray-500 dark:text-gray-400 truncate max-w-xs mt-0.5">
                            {prod.description}
                          </p>
                        )}
                      </td>

                      <td className="py-4 px-4 text-gray-600 dark:text-gray-300">
                        {prod.categoryName || 'General'}
                      </td>

                      <td className="py-4 px-4 text-right font-medium tabular-nums">
                        {isBulkEditMode ? (
                          <input
                            type="number"
                            step="0.01"
                            className="w-24 text-right px-2 py-1 rounded-xl bg-[#EAEBED] dark:bg-[#101014] well-inset text-sm font-semibold border border-black/5 dark:border-white/5"
                            defaultValue={paiseToRupees(displayPricePaise)}
                            onChange={(e) => handleBulkChange(prod.id, 'price', e.target.value)}
                          />
                        ) : (
                          <span className="font-bold text-gray-900 dark:text-white">
                            {formatINR(prod.pricePaise)}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-right font-medium tabular-nums">
                        {isBulkEditMode ? (
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Optional"
                            className="w-24 text-right px-2 py-1 rounded-xl bg-[#EAEBED] dark:bg-[#101014] well-inset text-sm font-semibold border border-black/5 dark:border-white/5"
                            defaultValue={displayCostPaise != null ? paiseToRupees(displayCostPaise) : ''}
                            onChange={(e) => handleBulkChange(prod.id, 'cost', e.target.value)}
                          />
                        ) : prod.costPaise != null ? (
                          <span className="text-gray-600 dark:text-gray-400">
                            {formatINR(prod.costPaise)}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-500 font-medium">Missing</span>
                        )}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(prod)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                            prod.isAvailable
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                          }`}
                        >
                          {prod.isAvailable ? 'Available' : 'Sold Out'}
                        </button>
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleArchiveProduct(prod.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            title="Archive product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Category Sheet */}
      <Sheet
        open={isAddCategoryOpen}
        onOpenChange={setIsAddCategoryOpen}
        title="Add New Category"
        description="Organize your menu into easy-to-browse sections"
      >
        <form onSubmit={handleCreateCategory} className="space-y-4 pt-2">
          <Input
            label="Category Name"
            placeholder="e.g. Hot Coffee, Artisanal Teas, Breakfast..."
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            required
            autoFocus
          />
          <div className="pt-2">
            <Button type="submit" variant="primary" size="lg" className="w-full">
              Create Category
            </Button>
          </div>
        </form>
      </Sheet>

      {/* Add Product Sheet */}
      <Sheet
        open={isAddProductOpen}
        onOpenChange={setIsAddProductOpen}
        title="Create New Product"
        description="Add a new dish or drink with price and cost details"
        side="right"
      >
        <form onSubmit={handleCreateProduct} className="space-y-4 pt-2">
          <Input
            label="Product Name"
            placeholder="e.g. Vanilla Flat White"
            value={newProd.name}
            onChange={(e) => setNewProd({ ...newProd, name: e.target.value })}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Category
            </label>
            <select
              className="w-full h-12 px-4 rounded-2xl bg-[#EAEBED] dark:bg-[#101014] well-inset text-sm font-medium border border-black/5 dark:border-white/5 focus:outline-none focus:ring-2 focus:ring-brand"
              value={newProd.categoryId}
              onChange={(e) => setNewProd({ ...newProd, categoryId: e.target.value })}
              required
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="number"
              step="0.01"
              label="Selling Price (₹)"
              placeholder="e.g. 250"
              value={newProd.priceRupees}
              onChange={(e) => setNewProd({ ...newProd, priceRupees: e.target.value })}
              required
            />
            <Input
              type="number"
              step="0.01"
              label="Cost Price (₹) — for profit"
              placeholder="e.g. 80"
              value={newProd.costRupees}
              onChange={(e) => setNewProd({ ...newProd, costRupees: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Dietary Tag
            </label>
            <div className="flex gap-2">
              {['VEG', 'NON_VEG', 'VEGAN'].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setNewProd({ ...newProd, dietTag: tag })}
                  className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${
                    newProd.dietTag === tag
                      ? 'bg-obsidian text-white dark:bg-white dark:text-obsidian shadow-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Short Description (Optional)"
            placeholder="e.g. Double shot espresso with textured oat milk"
            value={newProd.description}
            onChange={(e) => setNewProd({ ...newProd, description: e.target.value })}
          />

          <div className="pt-4">
            <Button type="submit" variant="primary" size="lg" className="w-full">
              Add to Menu
            </Button>
          </div>
        </form>
      </Sheet>

      {/* Bulk Edit Confirm Dialog */}
      {showBulkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card variant="elevated" padding="lg" className="max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Confirm Bulk Price Changes
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              You are updating {Object.keys(bulkChanges).length} items. These new prices will take effect immediately for new orders and write to the audit trail.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="md" onClick={() => setShowBulkConfirm(false)}>
                Cancel
              </Button>
              <Button variant="primary" size="md" onClick={handleSaveBulkChanges}>
                Confirm & Save
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
