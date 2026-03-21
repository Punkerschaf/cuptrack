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
  type: 'pin' | 'rfid' | 'nfc' | 'qr';
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
  terminal: { id: string; name: string; slug: string };
  machine: {
    id: string;
    name: string;
    room: string;
    pricePerCoffee: number;
  } | null;
  users: { id: string; displayName: string }[];
}
