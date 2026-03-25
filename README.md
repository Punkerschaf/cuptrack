# CupTrack

CupTrack is a digital coffee fund for shared coffee machines, such as those in the office.
It simply tracks which user has drunk how many coffees and deducts the corresponding amounts from their account. CupTrack does not control the coffee machines. The system relies on honesty – just like a haptic coffee fund.
It is web based with a terminal view and an admin's dashboard.

## How it works

Drinking users have an account balance and a four digit PIN.
On a machine's terminal users select their user, enter their PIN and count a coffee. The predefined amount is deducted from their balance.
They also can top up their balance.

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Material-UI
- **Backend:** Express, Node.js (ESM)
- **Database:** SQLite (better-sqlite3, WAL mode)
- **Security:** Helmet, rate-limiting, Zod validation, JWT auth

## Development

```bash
# Backend
cd backend
cp .env.example .env   # adjust values
npm install
npm run dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The default root user is `root` / `Coffee`. Change credentials in `.env` before deploying.

There is a file `architecture.md` for AI coding agents to understand the architecture of the project without needing to read the entire codebase.

## Deployment

- **Docker:** See [docs/deployment-docker.md](docs/deployment-docker.md)
- **Raspberry Pi:** See [docs/deployment-raspi.md](docs/deployment-raspi.md)

Quick start with Docker:

```bash
cp backend/.env.example backend/.env
# edit backend/.env – set JWT_SECRET and ROOT_PASSWORD
docker compose up -d --build
```

## Migration from lowdb

If upgrading from a version that used `db.json`:

```bash
node backend/src/migrate-from-lowdb.js
```

> [!NOTE]
> This application is vibe coded in most parts. Documentation may be chaotic. Structure may not always make sense.
