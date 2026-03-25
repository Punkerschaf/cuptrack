# Idee: Reader Agent Integration via Terminal-Pairing

> Status: Konzept / Ideensammlung  
> Datum: 2026-03-23  
> Bezug: CupTrack v0.3

## Problemstellung

Web-Terminals laufen im Browser und haben nur eingeschränkten Zugriff auf Hardware-Leser:

- **Web NFC API**: Funktioniert nur auf Android Chrome, erfordert aktiven Button-Press, kein dauerhafter Lesemodus
- **RFID / QR / andere Reader**: Kein Browser-Zugriff möglich
- Gewünscht: Dauerhaftes Lesen (z.B. NFC-Karte einfach hinhalten → sofort eingeloggt)

## Lösungsansätze im Vergleich

### Ansatz A: Reader Agent als eigenständiger Hintergrundprozess (empfohlen)

Ein externer Prozess (z.B. auf einem Raspberry Pi) liest dauerhaft vom USB-NFC-Reader und kommuniziert via REST-API mit dem CupTrack-Backend. Das gepaarte Web-Terminal wird über Server-Sent Events (SSE) in Echtzeit benachrichtigt.


**Vorteile:**
- Plattformunabhängig — Web-Terminal kann auf jedem Gerät/Browser laufen
- Dauerhafter Lesemodus möglich (Reader Agent läuft als Daemon)
- Beliebige Reader-Hardware nutzbar (NFC, RFID, Barcode/QR-Scanner)
- Entkopplung: Reader-Hardware und Display müssen nicht auf demselben Gerät sein
- Bestehende Web NFC Funktionalität bleibt parallel nutzbar

**Nachteile:**
- Zusätzliche Komponente (Reader Agent) muss deployed/gewartet werden
- Netzwerk-Abhängigkeit zwischen Reader Agent und Backend

### Ansatz B: Web-Terminal greift direkt auf Systemkomponenten zu

Das Web-Terminal nutzt Browser-APIs (Web NFC, WebUSB, WebHID) um direkt auf Reader-Hardware zuzugreifen.

**Vorteile:**
- Kein zusätzlicher Prozess nötig
- Alles in einer Anwendung

**Nachteile:**
- **Web NFC**: Nur Android Chrome, kein dauerhafter Lesemodus (erfordert User-Gesture), 30s Timeout
- **WebUSB/WebHID**: Extrem eingeschränkte Browser-Unterstützung, Treiber-Problematik
- Nicht zukunftssicher für verschiedene Reader-Typen

## Empfehlung: Ansatz A — Reader Agent via API + SSE

### Architektur-Konzept

#### 1. Terminal-Pairing (1:1)

Ein API-Terminal wird einem Web-Terminal zugeordnet:

- **API-Terminal**: Repräsentiert den Reader Agent, hat einen eigenen `apiKey`
- **Web-Terminal**: Das bestehende Browser-basierte Terminal
- Beziehung: `apiTerminal.pairedWebTerminalId → webTerminal.id`
- 1:1 Zuordnung (ein Reader pro Web-Terminal)

Neue Felder im Terminal-Modell (nur für `type: 'api'`):
- `apiKey: string` — Auto-generiert, zur Authentifizierung des Reader Agents
- `pairedWebTerminalId: UUID` — Referenz auf das gepaarte Web-Terminal

#### 2. Echtzeit-Kommunikation via SSE

**Warum SSE statt WebSocket oder Polling?**
- SSE ist ein-direktional (Backend → Browser) — genau was benötigt wird
- Kein Extra-Dependency nötig (native in Express und Browser `EventSource` API)
- Auto-Reconnect ist im Browser eingebaut
- Für CupTrack-Skala (wenige gleichzeitige Terminals) absolut ausreichend

**Backend:**
- In-Memory Event-Bus: `Map<slug, Set<Response>>`
- Endpoint: `GET /api/terminal-actions/:slug/events` (öffentlich, wie Terminal-Page)
- Events: `user_authenticated`, `identifier_unknown`, `heartbeat`
- Heartbeat alle 30s um Verbindung aufrecht zu erhalten

#### 3. Reader-Event Endpoint

User hält NFC-Karte an USB-Reader (am Raspberry Pi)
Reader Agent liest Seriennummer "04:a2:b3:c4:d5:e6:f7"
Reader Agent → POST /api/terminal-actions/kueche-reader/reader-event
Header: X-API-Key: abc123...
Body: { "type": "kaba_nfc", "value": "04:a2:b3:c4:d5:e6:f7" }
Backend findet API-Terminal "kueche-reader" → gepaart mit Web-Terminal "kueche"
Backend findet User "Max Mustermann" mit passendem kaba_nfc Identifier
Backend erstellt 5-Min Session-Token
Backend → SSE Event an alle /kueche/events Listener:
event: user_authenticated
data: {"userId":"...","displayName":"Max Mustermann","balance":12.50,"sessionToken":"jwt..."}
Web-Terminal empfängt Event → wechselt zum Menu → "Hallo Max, Kaffee zählen?"
Reader Agent erhält 200 OK → optional LED-Feedback


## Offene Fragen

1. **API-Key Rotation**: Button im Admin-Dashboard zum Neu-Generieren des API-Keys? (Empfehlung: Ja)
2. **Reader-Status Monitoring**: Soll das Backend tracken ob ein Reader Agent "online" ist (z.B. via Heartbeat)? Nice-to-have, erhöht aber Komplexität.
3. **Identifier-Typ-Filter**: Soll ein API-Terminal konfigurierbar sein welche Identifier-Typen es akzeptiert? (Empfehlung: Nein, alles akzeptieren — der Reader Agent sendet ohnehin nur was er lesen kann)

## Betroffene Dateien

| Datei | Änderung |
|-------|----------|
| `backend/src/routes/terminalActions.js` | Reader-Event Endpoint, SSE-Stream |
| `backend/src/routes/terminals.js` | Terminal CRUD: Pairing, apiKey |
| `frontend/src/pages/terminal/TerminalView.tsx` | SSE-Integration, Auto-Auth |
| `frontend/src/pages/Terminals.tsx` | Admin UI: Pairing, API-Key Anzeige |
| `frontend/src/types.ts` | Terminal Interface erweitern |
| `frontend/src/api.ts` | Typen für neue Endpoints |
| `frontend/src/locales/de.json`, `en.json` | Neue UI-Texte |
| `architecture.md` | Architektur-Doku aktualisieren |