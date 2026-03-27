export interface User {
  id: string;
  username: string;
  displayName: string;
  type: 'admin' | 'api' | 'drinker';
  isRoot: boolean;
  balance: number;
  identifiers: Identifier[];
  apiKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Identifier {
  id: string;
  type: 'pin' | 'rfid' | 'nfc' | 'qr' | 'kaba_nfc';
  value: string;
}

export interface Machine {
  id: string;
  name: string;
  room: string;
  pricePerCoffee: number;
  createdAt: string;
  updatedAt: string;
}

export interface Terminal {
  id: string;
  name: string;
  slug: string;
  machineId: string;
  type: 'web' | 'api';
  machine?: Machine | null;
  quickButtons?: { enabled: boolean; button1: number; button2: number };
  alphabetFilter?: { enabled: boolean };
  createdAt: string;
  updatedAt: string;
}

export interface LogEntry {
  id: string;
  type: string;
  userId: string | null;
  machineId: string | null;
  terminalId: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface DashboardStats {
  totalCoffees: number;
  coffeesToday: number;
  coffeesPerDay: { date: string; count: number }[];
  topDrinkers: { userId: string; displayName: string; count: number }[];
  popularMachines: { machineId: string; name: string; count: number }[];
  totalUsers: number;
  totalMachines: number;
  totalTerminals: number;
}

export interface TerminalInfo {
  terminal: {
    id: string;
    name: string;
    slug: string;
    quickButtons?: { enabled: boolean; button1: number; button2: number };
    alphabetFilter?: { enabled: boolean };
  };
  machine: {
    id: string;
    name: string;
    room: string;
    pricePerCoffee: number;
  } | null;
  users: { id: string; displayName: string }[];
}

export interface CashBookEntry {
  id: string;
  type: 'deposit' | 'withdrawal' | 'anonymous_coffee';
  amount: number;
  comment: string;
  machineId: string | null;
  terminalId: string | null;
  performedBy: string;
  createdAt: string;
}

export interface PendingMigration {
  version: number;
  name: string;
  type: 'auto' | 'manual';
  description: string;
  breaking: string[] | null;
  adminAction: string | null;
  params: { key: string; label: string; type: string; default?: unknown }[] | null;
}

export interface AppliedMigration {
  version: number;
  name: string;
  type: 'auto' | 'manual';
  executedAt: string;
  executedBy: string;
}

export interface MigrationStatus {
  currentVersion: number;
  maintenanceMode: boolean;
  applied: AppliedMigration[];
  pending: PendingMigration[];
}
