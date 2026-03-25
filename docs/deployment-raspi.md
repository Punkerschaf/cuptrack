# CupTrack – Raspberry Pi Deployment

Diese Anleitung beschreibt die Installation von CupTrack direkt auf einem Raspberry Pi (ohne Docker).

## Voraussetzungen

- Raspberry Pi 3B+ / 4 / 5 mit Raspberry Pi OS (64-bit empfohlen)
- Node.js 20 LTS
- Mindestens 512 MB RAM frei
- Zugang per SSH oder direkt

## 1. Node.js 20 installieren

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs
node -v  # sollte v20.x sein
```

## 2. Repository klonen & bauen

```bash
cd /opt
sudo git clone https://github.com/<user>/cuptrack.git
sudo chown -R $USER:$USER /opt/cuptrack
cd /opt/cuptrack

# Frontend bauen
cd frontend
npm ci
npm run build
cd ..

# Backend Dependencies installieren
cd backend
npm ci --omit=dev
cd ..
```

## 3. Umgebungsvariablen konfigurieren

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
- `CORS_ORIGIN` – z.B. `http://192.168.1.100:3000` oder die Domain

## 4. Migration (nur bei Update von lowdb)

Falls zuvor eine Version mit `db.json` genutzt wurde:

```bash
node backend/src/migrate-from-lowdb.js
```

Die SQLite-Datenbank wird unter `backend/data/cuptrack.db` erstellt.

## 5. systemd Service einrichten

```bash
sudo nano /etc/systemd/system/cuptrack.service
```

Inhalt:

```ini
[Unit]
Description=CupTrack Kaffee-Tracking
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/opt/cuptrack
ExecStart=/usr/bin/node backend/src/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

> **Hinweis:** `User=pi` ggf. anpassen. Der Benutzer muss Leserechte auf `/opt/cuptrack` haben.

```bash
sudo systemctl daemon-reload
sudo systemctl enable cuptrack
sudo systemctl start cuptrack
```

Status prüfen:

```bash
sudo systemctl status cuptrack
curl http://localhost:3000/api/health
```

## 6. nginx Reverse Proxy (optional, für HTTPS)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

```nginx
# /etc/nginx/sites-available/cuptrack
server {
    listen 80;
    server_name cuptrack.example.com;

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

```bash
sudo ln -s /etc/nginx/sites-available/cuptrack /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# HTTPS via Let's Encrypt
sudo certbot --nginx -d cuptrack.example.com
```

## 7. Backup (Cronjob)

Die gesamte Datenbank liegt in einer einzigen Datei:

```bash
# Tägliches Backup um 3:00 Uhr
crontab -e
```

Zeile hinzufügen:

```
0 3 * * * cp /opt/cuptrack/backend/data/cuptrack.db /opt/cuptrack/backend/data/backup-$(date +\%Y\%m\%d).db
```

Alte Backups aufräumen (älter als 30 Tage):

```
0 4 * * * find /opt/cuptrack/backend/data/ -name 'backup-*.db' -mtime +30 -delete
```

## 8. Updates einspielen

```bash
cd /opt/cuptrack
git pull
cd frontend && npm ci && npm run build && cd ..
cd backend && npm ci --omit=dev && cd ..
sudo systemctl restart cuptrack
```
