import { z } from 'zod';

// ─── Auth ───────────────────────────────────────────────────

export const loginSchema = z.object({
  username: z.string().min(1, 'Benutzername erforderlich'),
  password: z.string().min(1, 'Passwort erforderlich'),
});

// ─── Users ──────────────────────────────────────────────────

export const createUserSchema = z.object({
  username: z.string().min(1, 'Benutzername erforderlich'),
  displayName: z.string().min(1, 'Anzeigename erforderlich'),
  password: z.string().min(1).optional(),
  type: z.enum(['admin', 'api', 'drinker'], { message: 'Ungültiger Benutzertyp' }),
  pin: z.string().regex(/^[0-9]{4}$/, 'PIN muss genau 4 Ziffern haben').optional(),
});

export const updateUserSchema = z.object({
  displayName: z.string().min(1).optional(),
  password: z.string().min(1).optional(),
  balance: z.preprocess(v => (v !== undefined ? parseFloat(v) : undefined), z.number().optional()),
  identifiers: z.array(z.object({
    id: z.string(),
    type: z.string(),
    value: z.string(),
  }).refine(
    (ident) => ident.type !== 'pin' || /^[0-9]{4}$/.test(ident.value),
    { message: 'PIN muss genau 4 Ziffern haben' }
  )).optional(),
});

// ─── Machines ───────────────────────────────────────────────

export const createMachineSchema = z.object({
  name: z.string().min(1, 'Name erforderlich'),
  room: z.string().optional().default(''),
  pricePerCoffee: z.preprocess(v => parseFloat(v), z.number().positive('Preis muss positiv sein')),
});

export const updateMachineSchema = z.object({
  name: z.string().min(1).optional(),
  room: z.string().optional(),
  pricePerCoffee: z.preprocess(v => (v !== undefined ? parseFloat(v) : undefined), z.number().positive().optional()),
});

// ─── Terminals ──────────────────────────────────────────────

export const createTerminalSchema = z.object({
  name: z.string().min(1, 'Name erforderlich'),
  machineId: z.string().min(1, 'Maschine erforderlich'),
});

export const updateTerminalSchema = z.object({
  name: z.string().min(1).optional(),
  machineId: z.string().min(1).optional(),
  quickButtons: z.object({
    enabled: z.boolean(),
    button1: z.preprocess(v => parseFloat(v), z.number().positive()),
    button2: z.preprocess(v => parseFloat(v), z.number().positive()),
  }).optional(),
  alphabetFilter: z.object({
    enabled: z.boolean(),
  }).optional(),
  pinChangeEnabled: z.boolean().optional(),
  selfRegistrationEnabled: z.boolean().optional(),
});

// ─── Terminal Actions ───────────────────────────────────────

export const changePinSchema = z.object({
  sessionToken: z.string().min(1, 'Session-Token erforderlich'),
  newPin: z.string().regex(/^[0-9]{4}$/, 'PIN muss genau 4 Ziffern haben'),
});

export const registerUserSchema = z.object({
  username: z.string()
    .min(1, 'Benutzername erforderlich')
    .max(30, 'Benutzername zu lang')
    .regex(/^[a-z0-9_.\-]+$/, 'Benutzername darf nur Kleinbuchstaben, Zahlen, Punkte, Unterstriche und Bindestriche enthalten'),
  displayName: z.string().min(1, 'Anzeigename erforderlich').max(50, 'Anzeigename zu lang'),
  pin: z.string().regex(/^[0-9]{4}$/, 'PIN muss genau 4 Ziffern haben'),
});

export const verifyPinSchema = z.object({
  userId: z.string().min(1),
  pin: z.string().min(1),
});

export const verifyNfcSchema = z.object({
  serialNumber: z.string().min(1, 'Seriennummer erforderlich'),
});

export const sessionTokenSchema = z.object({
  sessionToken: z.string().min(1, 'Session-Token erforderlich'),
});

export const updateBalanceSchema = z.object({
  sessionToken: z.string().min(1),
  amount: z.preprocess(v => (v !== undefined ? parseFloat(v) : undefined), z.number().positive().optional()),
  mode: z.enum(['add', 'reset']).optional(),
});

// ─── Cash Book ──────────────────────────────────────────────

export const cashBookEntrySchema = z.object({
  amount: z.preprocess(v => parseFloat(v), z.number().positive('Gültiger Betrag erforderlich')),
  comment: z.string().min(1, 'Kommentar erforderlich').transform(s => s.trim()),
});

// ─── Settings ───────────────────────────────────────────────

export const settingsSchema = z.object({
  language: z.enum(['de', 'en'], { message: 'Ungültige Sprache' }),
});
