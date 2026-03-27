# CupTrack — Architecture Overview

> This document describes the architecture and internal structure of CupTrack for AI coding agents and new contributors. It provides enough context to navigate the codebase without reading every file.

## What is CupTrack?

CupTrack is a digital coffee fund for shared office coffee machines. It tracks which user has consumed how many coffees and deducts the corresponding price from their prepaid balance. CupTrack does **not** control the machines — it relies on user honesty, like a physical coffee fund.

**Version**: 0.3.0 "Cold Coffee" (defined in `/version.json`)

---

## Project Structure

```
cuptrack/
├── package.json              # Root: concurrently runs backend + frontend
├── version.json              # App version (major/minor/patch/codeName/schemaVersion)
├── backend/
│   ├── package.json
│   ├── data/cuptrack.db      # SQLite database (gitignored)
│   └── src/
│       ├── index.js          # Express entry point, route mounting, server start
│       ├── config.js         # Env-based configuration
│       ├── db.js             # SQLite setup, schema init, root user bootstrap, migration init
│       ├── dal.js            # Data Access Layer (prepared statements for all CRUD)
│       ├── schema.sql        # Full database schema (CREATE TABLE IF NOT EXISTS)
│       ├── middleware/
│       │   ├── auth.js           # JWT verification + admin guard
│       │   ├── maintenance.js    # Maintenance mode guard (blocks non-admin during migrations)
│       │   ├── error-handler.js  # Central error handler
│       │   └── request-logger.js # Pino request logging
│       ├── routes/
│       │   ├── auth.js           # Login, /me
│       │   ├── users.js          # CRUD users, identifiers, balance
│       │   ├── machines.js       # CRUD coffee machines
│       │   ├── terminals.js      # CRUD terminals (admin)
│       │   ├── terminalActions.js # Public terminal interactions
│       │   ├── cashBook.js       # Cash book (deposits, withdrawals)
│       │   ├── stats.js          # Dashboard analytics
│       │   ├── settings.js       # Global settings (language, log cleanup)
│       │   └── migrations.js     # Admin migration API
│       ├── validators/
│       │   └── index.js          # Zod validation schemas for all request bodies
│       └── migrations/
│           ├── runner.js         # Migration engine (auto + manual migrations)
│           ├── cli.js            # CLI tool for migration status/run/backup
│           └── scripts/
│               └── 001-baseline.js  # Baseline migration (version 1)
├── docs/
│   ├── api.md
│   ├── migration.md          # Migration system documentation
│   ├── deployment-docker.md
│   └── deployment-raspi.md
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── index.html
    └── src/
        ├── main.tsx          # React entry, theme + i18n init
        ├── App.tsx           # React Router setup
        ├── api.ts            # Typed HTTP client for all API calls
        ├── types.ts          # Shared TypeScript interfaces
        ├── theme.ts          # MUI theme (coffee-brown palette)
        ├── i18n.ts           # i18next setup (de/en)
        ├── contexts/
        │   └── AuthContext.tsx    # Auth state, JWT in localStorage
        ├── components/
        │   ├── DashboardLayout.tsx  # Admin shell (drawer, nav, toolbar)
        │   └── ProtectedRoute.tsx   # Admin route guard
        ├── pages/
        │   ├── Login.tsx         # Admin login
        │   ├── Dashboard.tsx     # Analytics overview
        │   ├── Users.tsx         # User management
        │   ├── Machines.tsx      # Machine management
        │   ├── Terminals.tsx     # Terminal management
        │   ├── CashBook.tsx      # Cash book management
        │   ├── Settings.tsx      # System settings (language, log cleanup)
        │   └── terminal/
        │       └── TerminalView.tsx  # Public-facing coffee terminal UI
        └── locales/
            ├── de.json           # German translations
            └── en.json           # English translations
```

---

## Tech Stack

| Layer    | Technology                                                |
|----------|-----------------------------------------------------------|
| Backend  | Node.js, Express, ESM                                     |
| Database | SQLite via better-sqlite3 (WAL mode, foreign keys enabled)|
| Auth     | JWT (jsonwebtoken), bcryptjs for password hashing          |
| Frontend | React 18, TypeScript, Vite 6                               |
| UI       | Material-UI (MUI) v5, Emotion                              |
| Charts   | Recharts                                                   |
| i18n     | i18next + react-i18next (German default, English)          |
| Validation | Zod (backend request body validation)                    |
| Logging  | Pino (structured JSON logging)                             |
| Dev      | concurrently (runs backend + frontend in parallel)         |

---

## Running the App

```bash
npm run install:all   # Install root + backend + frontend deps
npm run dev           # Start backend (port 3000) + frontend (Vite dev server) concurrently
```

Default root login in dev: `root` / `Coffee` (configured via `ROOT_USERNAME` / `ROOT_PASSWORD` env vars).

---

## Data Models

### User
```
{
  id: UUID,
  username: string,
  displayName: string,
  password: string | null,       // hashed, null for API users
  type: 'admin' | 'api' | 'drinker',
  isRoot: boolean,               // true for bootstrapped root user only
  balance: number,               // prepaid balance (drinker)
  identifiers: [                 // authentication methods for terminals
    { id: UUID, type: 'pin' | 'rfid' | 'nfc' | 'qr' | 'kaba_nfc', value: string }
  ],
  apiKey: string | null,         // only for type 'api'
  createdAt: ISO timestamp,
  updatedAt: ISO timestamp
}
```

### Machine
```
{
  id: UUID,
  name: string,
  room: string,
  pricePerCoffee: number,        // in euros
  createdAt: ISO timestamp,
  updatedAt: ISO timestamp
}
```

### Terminal
```
{
  id: UUID,
  name: string,
  slug: string,                  // auto-generated URL-safe slug
  machineId: UUID,               // references a Machine
  type: 'web' | 'api',
  quickButtons: {                // fast top-up amounts
    enabled: boolean,
    button1: number,
    button2: number
  },
  alphabetFilter: {              // A-Z filter buttons on user list
    enabled: boolean             // default: true
  },
  createdAt: ISO timestamp,
  updatedAt: ISO timestamp
}
```

### Log Entry
```
{
  id: UUID,
  type: 'coffee' | 'balance' | 'login' | 'cashbook' | 'anonymous_coffee' | 'balance_topup',
  userId: UUID | null,
  machineId: UUID | null,
  terminalId: UUID | null,
  amount: number | null,
  timestamp: ISO timestamp
}
```

### Settings
```
{
  language: 'de' | 'en'
}
```

### Archived Stats
```
{
  totalCoffees: number,          // aggregated from deleted logs
  coffeesByUser: { [userId]: number },
  coffeesByMachine: { [machineId]: number }
}
```
Preserves statistical totals when old logs are cleaned up. The dashboard stats route merges these with current log data.

### Cash Book Entry
```
{
  id: UUID,
  type: 'deposit' | 'withdrawal' | 'anonymous_coffee' | 'balance_topup',
  amount: number,              // always positive
  comment: string,             // user-provided (manual) or auto-generated
  machineId: UUID | null,      // set for anonymous_coffee / balance_topup
  terminalId: UUID | null,     // set for anonymous_coffee / balance_topup
  performedBy: string,         // admin username or 'terminal'
  createdAt: ISO timestamp
}
```

Tracks physical cash flowing in and out of the office coffee fund:
- **deposit / withdrawal** — manual entries created by an admin via the dashboard.
- **anonymous_coffee** — auto-created when a guest uses the terminal's "Guest Coffee" button (no user account required).
- **balance_topup** — auto-created when a user tops up their balance at a terminal or resets a negative balance to zero.

The running cash balance is computed as `SUM(deposits + balance_topups + anonymous_coffees) – SUM(withdrawals)`.

### Log Cleanup Record
```
{
  deletedAt: ISO timestamp,
  deletedBy: string,             // admin username
  deletedCount: number,
  periodFrom: ISO timestamp,     // oldest deleted log
  periodTo: ISO timestamp        // newest deleted log
}
```

---

## Database Schema (SQLite)

The database file is `backend/data/cuptrack.db` (SQLite, WAL mode, foreign keys enabled). The full schema is defined in `backend/src/schema.sql` using `CREATE TABLE IF NOT EXISTS`.

### Tables

| Table               | Purpose                                                    |
|---------------------|------------------------------------------------------------|
| `users`             | Admin, API and drinker accounts (UUID PK)                  |
| `identifiers`       | PIN/RFID/NFC/QR/Kaba credentials linked to users (FK)     |
| `machines`          | Coffee machines with room + price                          |
| `terminals`         | Web/API terminals linked to a machine (FK), with settings  |
| `logs`              | Audit log (coffee, balance, login, cashbook, etc.)         |
| `cash_book`         | Cash flow tracking (deposits, withdrawals, auto entries)   |
| `settings`          | Global settings (key/value, e.g. `language`)               |
| `archived_stats`    | Preserved statistics after log cleanup                     |
| `log_cleanups`      | History of admin-triggered log cleanup operations          |
| `schema_migrations` | Migration tracking (version, name, type, executedAt)       |

### Key Constraints
- Foreign keys: `identifiers.userId → users.id`, `terminals.machineId → machines.id`, etc.
- `users.type` CHECK: `'admin'`, `'api'`, `'drinker'`
- `identifiers.type` CHECK: `'pin'`, `'rfid'`, `'nfc'`, `'qr'`, `'kaba_nfc'`
- Terminal settings (`quickButtons*`, `alphabetFilter`) stored as columns with defaults

On first start, the backend executes `schema.sql`, then bootstraps a root admin user from env vars (`ROOT_USERNAME` / `ROOT_PASSWORD`, defaults: `root` / `Coffee`).

---

## Database Migrations

CupTrack uses a custom migration system (no external package). See [`docs/migration.md`](docs/migration.md) for full details.

### Key Concepts
- **Migration scripts** live in `backend/src/migrations/scripts/NNN-name.js` (linear integer versioning)
- **Auto migrations**: Backward-compatible changes, run automatically on server start
- **Manual migrations**: Breaking changes requiring admin confirmation via the dashboard
- **Maintenance mode**: When manual migrations are pending, only auth and migration API routes are accessible
- **Backups**: Created automatically before each migration via `better-sqlite3`'s native `backup()` API (max 5 kept)
- **Schema version**: Tracked in `version.json` (`schemaVersion` field) and in the `schema_migrations` table
- **CLI**: `node backend/src/migrations/cli.js status|run|backup` for headless deployments (e.g. Raspberry Pi)

---

## API Endpoints

All routes are mounted under `/api`.

### Auth — `/api/auth`
| Method | Path     | Auth      | Purpose                          |
|--------|----------|-----------|----------------------------------|
| POST   | `/login` | None      | Admin login → JWT (24h expiry)   |
| GET    | `/me`    | JWT       | Get current authenticated user   |

### Users — `/api/users` (JWT + Admin)
| Method | Path        | Purpose                          |
|--------|-------------|----------------------------------|
| GET    | `/`         | List all users (no passwords)    |
| GET    | `/:id`      | Get single user                  |
| GET    | `/:id/log`  | Get activity log for user        |
| POST   | `/`         | Create user (PIN auto-gen for drinker, API key for api type) |
| PUT    | `/:id`      | Update user (balance, identifiers, password) |
| DELETE | `/:id`      | Delete user (protects root + self) |

### Machines — `/api/machines` (JWT + Admin)
| Method | Path        | Purpose                          |
|--------|-------------|----------------------------------|
| GET    | `/`         | List all machines                |
| GET    | `/:id`      | Get single machine               |
| GET    | `/:id/log`  | Get activity log for machine     |
| POST   | `/`         | Create machine                   |
| PUT    | `/:id`      | Update machine                   |
| DELETE | `/:id`      | Delete (fails if terminal uses it) |

### Terminals — `/api/terminals` (JWT + Admin)
| Method | Path        | Purpose                          |
|--------|-------------|----------------------------------|
| GET    | `/`         | List all terminals (with machine info) |
| GET    | `/:id`      | Get single terminal              |
| GET    | `/:id/log`  | Get activity log                 |
| POST   | `/`         | Create terminal (slug auto-generated) |
| PUT    | `/:id`      | Update terminal                  |
| DELETE | `/:id`      | Delete terminal                  |

### Terminal Actions — `/api/terminal-actions` (Public / Session Token)
| Method | Path                    | Auth          | Purpose                                              |
|--------|-------------------------|---------------|------------------------------------------------------|
| GET    | `/:slug`                | None          | Get terminal info + eligible user list                |
| POST   | `/:slug/verify-pin`     | None          | PIN verification → 5min session token                 |
| POST   | `/:slug/verify-nfc`     | None          | NFC verification → 5min session token                 |
| POST   | `/:slug/count-coffee`   | Session Token | Record coffee, deduct balance                         |
| POST   | `/:slug/update-balance` | Session Token | Top-up or reset balance (creates cash book entry)     |
| POST   | `/:slug/anonymous-coffee` | None        | Record guest coffee → cash book deposit + log         |

### Cash Book — `/api/cashbook` (JWT + Admin)
| Method | Path        | Purpose                                            |
|--------|-------------|----------------------------------------------------|
| GET    | `/`         | List all entries (newest first)                    |
| GET    | `/balance`  | Computed running balance                           |
| POST   | `/deposit`  | Create manual deposit (amount, comment)            |
| POST   | `/withdrawal` | Create manual withdrawal (amount, comment)       |
| DELETE | `/:id`      | Delete entry (only manual deposit/withdrawal)      |

### Stats — `/api/stats` (JWT + Admin)
| Method | Path         | Purpose                                        |
|--------|--------------|------------------------------------------------|
| GET    | `/dashboard` | Aggregated stats (today, 30-day trend, top 5)  |

### Settings — `/api/settings`
| Method | Path             | Auth      | Purpose                                    |
|--------|------------------|-----------|--------------------------------------------|
| GET    | `/`              | None      | Get global settings                        |
| PUT    | `/`              | JWT+Admin | Update settings (language)                 |
| DELETE | `/cleanup-logs`  | JWT+Admin | Delete logs older than 1 year, archive stats |
| GET    | `/log-cleanups`  | JWT+Admin | Get log cleanup history                    |

### Health — `/api/health`
| Method | Path | Auth | Purpose                      |
|--------|------|------|------------------------------|
| GET    | `/`  | None | Returns version info         |

### Migrations — `/api/admin/migrations` (JWT + Admin)
| Method | Path   | Auth       | Purpose                                        |
|--------|--------|------------|------------------------------------------------|
| GET    | `/`    | JWT+Admin  | Get migration status (current version, pending)|
| POST   | `/run` | JWT+Root   | Execute a single manual migration              |

---

## Authentication Flows

### Admin Authentication
1. Admin submits username + password to `POST /api/auth/login`
2. Backend validates credentials, returns JWT (24h expiry) + user object
3. Frontend stores JWT in `localStorage`
4. All subsequent API calls include `Authorization: Bearer <token>` header
5. `authenticateToken` middleware verifies JWT; `requireAdmin` checks `user.type === 'admin'`

### Terminal Session Authentication
1. Public terminal loads via `GET /api/terminal-actions/:slug` (no auth needed)
2. User identifies via PIN or NFC → `verify-pin` / `verify-nfc` returns a **short-lived token** (5 min)
3. Token has `purpose: 'terminal-session'` and is scoped to the specific user
4. Terminal uses this token for `count-coffee` / `update-balance` requests
5. TerminalView auto-returns to home after 30s inactivity

---

## Frontend Routing

```
/login                       → Login.tsx (public)
/terminals/:terminalName     → TerminalView.tsx (public, no admin auth)
/dashboard                   → DashboardLayout.tsx (protected, admin only)
  /dashboard        (index)  → Dashboard.tsx
  /dashboard/users           → Users.tsx
  /dashboard/machines        → Machines.tsx
  /dashboard/terminals       → Terminals.tsx
  /dashboard/cashbook        → CashBook.tsx
  /dashboard/settings        → Settings.tsx
/                            → Redirect to /dashboard
```

`ProtectedRoute` checks for an authenticated admin user and redirects to `/login` otherwise.

---

## Key Patterns & Conventions

- **ESM throughout** — Backend uses ES modules (`import/export`), configured via `"type": "module"` in backend/package.json.
- **Data Access Layer** — All database access goes through `backend/src/dal.js` using prepared statements (better-sqlite3). No raw SQL in route handlers.
- **UUID for IDs** — All entities use `uuid` v4 for primary keys.
- **Slug-based terminal access** — Terminals are accessed publicly by auto-generated slug (from name), not by ID.
- **Audit logging** — Coffee consumption, balance changes, and logins are logged to the `logs` collection.
- **i18n** — All UI strings go through i18next. Translation files: `frontend/src/locales/{de,en}.json`. Language is server-side configurable via settings.
- **API client** — All frontend API calls go through `frontend/src/api.ts` which auto-attaches the JWT and provides typed methods.
- **Alphabet filter** — The terminal user list can display A-Z filter buttons so users can quickly narrow down the list by first letter. Only letters with matching users are shown. Configurable per terminal via `alphabetFilter.enabled` (default: `true`).
- **Root user protection** — The bootstrapped root admin cannot be edited or deleted via the API.
- **Cash book** — Tracks physical cash in the office coffee fund. Manual deposits/withdrawals are created by admins. Automatic entries are created when users top up their balance at a terminal (`balance_topup`) or when a guest uses the anonymous coffee button (`anonymous_coffee`). Admin balance edits via the dashboard do **not** create cash book entries (they are considered error corrections). Only manual entries can be deleted.
- **Guest coffee** — Terminals offer a "Guest Coffee" button on the home screen for anonymous, account-less coffee purchases. This creates a cash book deposit entry with the machine's coffee price.
- **Log cleanup** — Admins can manually delete logs older than one year via the Settings page. Before deletion, coffee statistics are aggregated into `archived_stats` so dashboard totals (total coffees, top drinkers, popular machines) remain accurate. Each cleanup is recorded in `log_cleanups` with timestamp, admin name, count, and affected time range.
- **Maintenance mode** — When manual database migrations are pending, the `maintenance` middleware blocks all non-essential routes (only auth, migrations, and health remain accessible). The admin sees a banner in the dashboard with migration details and a confirmation dialog.

---

## Environment Variables (Backend)

| Variable         | Default                                      | Purpose              |
|------------------|----------------------------------------------|----------------------|
| `PORT`           | `3000`                                       | Server port          |
| `JWT_SECRET`     | `cuptrack-dev-secret-change-in-production`   | JWT signing key      |
| `ROOT_USERNAME`  | `root`                                       | Initial admin user   |
| `ROOT_PASSWORD`  | `Coffee`                                     | Initial admin pass   |
| `NODE_ENV`       | (unset)                                      | `production` in Docker |
| `CORS_ORIGIN`    | (unset)                                      | Allowed CORS origin  |
| `LOG_LEVEL`      | `info`                                       | Pino log level       |
