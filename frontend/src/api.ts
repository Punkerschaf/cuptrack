import type { User, Machine, Terminal, LogEntry, DashboardStats, TerminalInfo, CashBookEntry, MigrationStatus } from './types';

const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<User>('/auth/me'),

  // Users
  getUsers: () => request<User[]>('/users'),
  getUser: (id: string) => request<User>(`/users/${encodeURIComponent(id)}`),
  getUserLog: (id: string) =>
    request<LogEntry[]>(`/users/${encodeURIComponent(id)}/log`),
  createUser: (data: Record<string, unknown>) =>
    request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Record<string, unknown>) =>
    request<User>(`/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteUser: (id: string) =>
    request<{ success: boolean }>(`/users/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Machines
  getMachines: () => request<Machine[]>('/machines'),
  getMachineLog: (id: string) =>
    request<LogEntry[]>(`/machines/${encodeURIComponent(id)}/log`),
  createMachine: (data: Record<string, unknown>) =>
    request<Machine>('/machines', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateMachine: (id: string, data: Record<string, unknown>) =>
    request<Machine>(`/machines/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteMachine: (id: string) =>
    request<{ success: boolean }>(`/machines/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Terminals
  getTerminals: () => request<Terminal[]>('/terminals'),
  getTerminalLog: (id: string) =>
    request<LogEntry[]>(`/terminals/${encodeURIComponent(id)}/log`),
  createTerminal: (data: Record<string, unknown>) =>
    request<Terminal>('/terminals', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateTerminal: (id: string, data: Record<string, unknown>) =>
    request<Terminal>(`/terminals/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteTerminal: (id: string) =>
    request<{ success: boolean }>(`/terminals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Terminal Actions
  getTerminalInfo: (slug: string) =>
    request<TerminalInfo>(`/terminal-actions/${encodeURIComponent(slug)}`),
  verifyPin: (slug: string, userId: string, pin: string) =>
    request<{
      success: boolean;
      sessionToken: string;
      user: { id: string; displayName: string; balance: number };
    }>(`/terminal-actions/${encodeURIComponent(slug)}/verify-pin`, {
      method: 'POST',
      body: JSON.stringify({ userId, pin }),
    }),
  verifyNfc: (slug: string, serialNumber: string) =>
    request<{
      success: boolean;
      sessionToken: string;
      user: { id: string; displayName: string; balance: number };
    }>(`/terminal-actions/${encodeURIComponent(slug)}/verify-nfc`, {
      method: 'POST',
      body: JSON.stringify({ serialNumber }),
    }),
  countCoffee: (slug: string, sessionToken: string) =>
    request<{ success: boolean; newBalance: number }>(
      `/terminal-actions/${encodeURIComponent(slug)}/count-coffee`,
      { method: 'POST', body: JSON.stringify({ sessionToken }) },
    ),
  updateBalance: (slug: string, sessionToken: string, amount: number, mode: 'add' | 'reset' = 'add') =>
    request<{ success: boolean; newBalance: number }>(
      `/terminal-actions/${encodeURIComponent(slug)}/update-balance`,
      { method: 'POST', body: JSON.stringify({ sessionToken, amount, mode }) },
    ),

  // Version / Health
  getVersion: () =>
    request<{ status: string; version: string; codeName: string }>('/health'),

  // Stats
  getDashboardStats: () => request<DashboardStats>('/stats/dashboard'),

  // Settings
  getSettings: () => request<{ language: string }>('/settings'),
  updateSettings: (data: { language: string }) =>
    request<{ language: string }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  cleanupLogs: () =>
    request<{ deletedCount: number; periodFrom?: string; periodTo?: string; message?: string }>(
      '/settings/cleanup-logs',
      { method: 'DELETE' },
    ),
  getLogCleanups: () =>
    request<{ deletedAt: string; deletedBy: string; deletedCount: number; periodFrom: string; periodTo: string }[]>(
      '/settings/log-cleanups',
    ),

  // Cash Book
  getCashBook: () => request<CashBookEntry[]>('/cashbook'),
  getCashBookBalance: () => request<{ balance: number }>('/cashbook/balance'),
  createCashBookDeposit: (data: { amount: number; comment: string }) =>
    request<CashBookEntry>('/cashbook/deposit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  createCashBookWithdrawal: (data: { amount: number; comment: string }) =>
    request<CashBookEntry>('/cashbook/withdrawal', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteCashBookEntry: (id: string) =>
    request<{ success: boolean }>(`/cashbook/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  // Terminal: Anonymous coffee
  recordAnonymousCoffee: (slug: string) =>
    request<{ success: boolean; price: number }>(
      `/terminal-actions/${encodeURIComponent(slug)}/anonymous-coffee`,
      { method: 'POST' },
    ),

  // Terminal: Change PIN
  changePin: (slug: string, sessionToken: string, newPin: string) =>
    request<{ success: boolean }>(
      `/terminal-actions/${encodeURIComponent(slug)}/change-pin`,
      { method: 'POST', body: JSON.stringify({ sessionToken, newPin }) },
    ),

  // Terminal: Check username/displayName availability
  checkUserAvailability: (slug: string, data: { username: string; displayName: string }) =>
    request<{ usernameAvailable: boolean; displayNameAvailable: boolean }>(
      `/terminal-actions/${encodeURIComponent(slug)}/check-user-availability`,
      { method: 'POST', body: JSON.stringify(data) },
    ),

  // Terminal: Register new user
  registerUser: (slug: string, data: { username: string; displayName: string; pin: string }) =>
    request<{ success: boolean; user: { id: string; displayName: string } }>(
      `/terminal-actions/${encodeURIComponent(slug)}/register-user`,
      { method: 'POST', body: JSON.stringify(data) },
    ),

  // Migrations
  getMigrationStatus: () => request<MigrationStatus>('/admin/migrations'),
  runMigration: (version: number, confirm: boolean, params?: Record<string, unknown>) =>
    request<{
      success: boolean;
      version: number;
      name: string;
      backupPath: string;
      maintenanceMode: boolean;
      remainingPending: MigrationStatus['pending'];
    }>('/admin/migrations/run', {
      method: 'POST',
      body: JSON.stringify({ version, confirm, params }),
    }),
};
