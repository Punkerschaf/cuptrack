# CupTrack – Docker Deployment

## Voraussetzungen

- Docker ≥ 24 & Docker Compose ≥ 2
- Funktioniert auf x86_64, ARM64 (Raspberry Pi 4/5 mit 64-bit OS)

## 1. Umgebungsvariablen konfigurieren

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Pflicht-Anpassungen:
- `JWT_SECRET` – langer zufälliger String (≥ 32 Zeichen):
  ```bash
  openssl rand -base64 48
  ```
- `ROOT_PASSWORD` – sicheres Admin-Passwort
- `CORS_ORIGIN` – z.B. `https://cuptrack.example.com`

## 2. Container bauen und starten

```bash
docker compose up -d --build
```

Prüfen:

```bash
docker compose ps
curl http://localhost:3000/api/health
```

## 3. Migration (nur bei Update von lowdb)

Falls zuvor eine Version mit `db.json` genutzt wurde, die Datei nach `backend/data/db.json` kopieren und dann:

```bash
docker compose exec cuptrack node backend/src/migrate-from-lowdb.js
```

## 4. nginx Reverse Proxy (HTTPS)

Beispiel-Konfiguration für einen externen nginx:

```nginx
server {
    listen 80;
    server_name cuptrack.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cuptrack.example.com;

    ssl_certificate     /etc/letsencrypt/live/cuptrack.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cuptrack.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 5. Backup

Die SQLite-Datenbank wird im Volume unter `./backend/data/` gespeichert.

```bash
# Manuelles Backup
cp backend/data/cuptrack.db backend/data/backup-$(date +%Y%m%d).db

# Oder per Cronjob (auf dem Host):
0 3 * * * cp /path/to/cuptrack/backend/data/cuptrack.db /path/to/cuptrack/backend/data/backup-$(date +\%Y\%m\%d).db
```

## 6. Updates

```bash
git pull
docker compose up -d --build
```

## 7. Logs einsehen

```bash
docker compose logs -f cuptrack
```

## 8. Container stoppen

```bash
docker compose down
```

> **Hinweis:** Die Datenbank bleibt in `backend/data/` erhalten, da sie als Volume gemountet ist.
