'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/src/ui/components/Card';
import { Button } from '@/src/ui/components/Button';
import { Input } from '@/src/ui/components/Input';
import { Sheet } from '@/src/ui/components/Sheet';
import { Plus, UserCheck, Shield, KeyRound, UserX, Check, Lock } from 'lucide-react';

interface StaffUser {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  mustChangePassword: boolean;
  isActive: boolean;
  hasAdminPin: boolean;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [resetUser, setResetUser] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState({
    username: '',
    displayName: '',
    password: '',
    adminPin: '',
    roles: ['WAITER'] as string[],
  });

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (res.status === 403) {
        window.location.href = '/admin';
        return;
      }
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create staff account');
      }

      setIsAddUserOpen(false);
      setNewUser({
        username: '',
        displayName: '',
        password: '',
        adminPin: '',
        roles: ['WAITER'],
      });
      loadUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleActive = async (user: StaffUser) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Action failed');
        return;
      }
      loadUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAdminRole = async (user: StaffUser) => {
    const isCurrentlyAdmin = user.roles.includes('ADMIN');
    const newRoles = isCurrentlyAdmin
      ? user.roles.filter((r) => r !== 'ADMIN')
      : [...user.roles, 'ADMIN'];

    if (newRoles.length === 0) newRoles.push('WAITER');

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roles: newRoles }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Action failed');
        return;
      }
      loadUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !newPassword) return;

    try {
      const res = await fetch(`/api/admin/users/${resetUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword, mustChangePassword: true }),
      });
      if (res.ok) {
        setResetUser(null);
        setNewPassword('');
        alert('Password has been reset. User will be forced to change it on next login.');
        loadUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Staff & Role Management
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Manage waiter and administrator accounts. At least one active admin account must always exist.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setIsAddUserOpen(true)}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Staff Member
        </Button>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        </div>
      ) : (
        <Card variant="default" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 dark:bg-[#121216]/80 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-black/[0.06] dark:border-white/[0.06]">
                <tr>
                  <th className="py-3.5 px-6">Staff Member</th>
                  <th className="py-3.5 px-4">Username</th>
                  <th className="py-3.5 px-4">Roles</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors"
                  >
                    <td className="py-4 px-6 font-semibold text-gray-900 dark:text-white">
                      <div>{u.displayName}</div>
                      {u.mustChangePassword && (
                        <span className="text-[10px] text-amber-500 font-normal">
                          Requires password reset
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-gray-600 dark:text-gray-300 font-mono text-xs">
                      @{u.username}
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5">
                        {u.roles.includes('WAITER') && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            Waiter
                          </span>
                        )}
                        {u.roles.includes('ADMIN') && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center gap-1">
                            <Shield className="w-3 h-3" /> Admin
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-4 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                          u.isActive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                        }`}
                      >
                        {u.isActive ? 'Active' : 'Deactivated'}
                      </button>
                    </td>

                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleAdminRole(u)}
                          className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 transition-colors"
                          title="Toggle Admin Role"
                        >
                          {u.roles.includes('ADMIN') ? 'Demote' : 'Make Admin'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setResetUser(u)}
                          className="p-1.5 text-gray-400 hover:text-brand transition-colors"
                          title="Reset Password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Staff Sheet */}
      <Sheet
        open={isAddUserOpen}
        onOpenChange={setIsAddUserOpen}
        title="Add Staff Member"
        description="Create credentials for a waiter or café administrator"
        side="right"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
          {error && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
              {error}
            </div>
          )}

          <Input
            label="Full Name"
            placeholder="e.g. Ramesh Kumar"
            value={newUser.displayName}
            onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
            required
          />

          <Input
            label="Staff Username"
            placeholder="e.g. ramesh"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            required
          />

          <Input
            type="password"
            label="Initial Password"
            placeholder="••••••••"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
              Role
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNewUser({ ...newUser, roles: ['WAITER'] })}
                className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  !newUser.roles.includes('ADMIN')
                    ? 'bg-obsidian text-white dark:bg-white dark:text-obsidian shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                Waiter Only
              </button>
              <button
                type="button"
                onClick={() => setNewUser({ ...newUser, roles: ['WAITER', 'ADMIN'] })}
                className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                  newUser.roles.includes('ADMIN')
                    ? 'bg-obsidian text-white dark:bg-white dark:text-obsidian shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                }`}
              >
                Waiter + Admin
              </button>
            </div>
          </div>

          {newUser.roles.includes('ADMIN') && (
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              label="Admin Security PIN (4–6 digits)"
              placeholder="e.g. 1234"
              value={newUser.adminPin}
              onChange={(e) => setNewUser({ ...newUser, adminPin: e.target.value })}
              required
            />
          )}

          <div className="pt-4">
            <Button type="submit" variant="primary" size="lg" className="w-full">
              Create Staff Account
            </Button>
          </div>
        </form>
      </Sheet>

      {/* Reset Password Modal */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card variant="elevated" padding="lg" className="max-w-md w-full">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              Reset Password for {resetUser.displayName}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              Enter a new temporary password. The staff member will be required to change it at their next login.
            </p>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <Input
                type="password"
                label="New Password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoFocus
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" size="md" onClick={() => setResetUser(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md">
                  Update Password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
