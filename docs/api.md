# CupTrack API-Dokumentation

Base-URL: `/api`

---

## Inhaltsverzeichnis

1. [Authentifizierung](#authentifizierung)
2. [Health Check](#health-check)
3. [Auth](#auth)
4. [Users](#users)
5. [Machines](#machines)
6. [Terminals](#terminals)
7. [Terminal Actions](#terminal-actions)
8. [Cash Book](#cash-book)
9. [Settings](#settings)
10. [Stats](#stats)
11. [Datenbank-Schema](#datenbank-schema)

---

## Authentifizierung

Die API verwendet **JWT Bearer Tokens** zur Authentifizierung. Nach einem erfolgreichen Login wird ein Token zurückgegeben, das im `Authorization`-Header mitgesendet werden muss:

```
Authorization: Bearer <token>
```

Tokens sind **24 Stunden** gültig.

### Rollen

| Rolle     | Beschreibung                                      |
| --------- | ------------------------------------------------- |
| `admin`   | Voller Dashboard-Zugang, kann alle Ressourcen verwalten |
| `api`     | API-Zugang per API-Key (kein Dashboard-Login)     |
| `drinker` | Endbenutzer, kann nur über Terminals interagieren |

### Rate Limiting

| Bereich   | Fenster  | Max. Anfragen |
| --------- | -------- | ------------- |
| Global    | 15 Min.  | 300           |
| Auth      | 15 Min.  | 15            |

---

## Health Check

### `GET /api/health`

Gibt den Status und die Version der Anwendung zurück. Keine Authentifizierung erforderlich.

**Response `200`:**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "codeName": "string"
}
```

---

## Auth

### `POST /api/auth/login`

Authentifiziert einen Admin-Benutzer und gibt ein JWT-Token zurück.

> Rate-Limited: max. 15 Anfragen pro 15 Minuten.

**Request Body:**
```json
{
  "username": "string",   // Pflicht, min. 1 Zeichen
  "password": "string"    // Pflicht, min. 1 Zeichen
}
```

**Response `200`:**
```json
{
  "token": "jwt-string",
  "user": {
    "id": "uuid",
    "username": "string",
    "displayName": "string",
    "type": "admin",
    "isRoot": 0,
    "balance": 0,
    "apiKey": null,
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
}
```

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `401`  | Ungültige Anmeldedaten |
| `403`  | Benutzer ist kein Admin |

---

### `GET /api/auth/me`

Gibt den aktuell authentifizierten Benutzer zurück.

> Erfordert: `Bearer Token`

**Response `200`:**
```json
{
  "id": "uuid",
  "username": "string",
  "displayName": "string",
  "type": "admin",
  "isRoot": 0,
  "balance": 0,
  "apiKey": null,
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```

---

## Users

> Alle Endpunkte erfordern: `Bearer Token` + `admin`-Rolle.

### `GET /api/users`

Listet alle Benutzer auf.

**Response `200`:** Array von User-Objekten (ohne `password`-Feld).

```json
[
  {
    "id": "uuid",
    "username": "string",
    "displayName": "string",
    "type": "admin | api | drinker",
    "isRoot": 0,
    "balance": 0.0,
    "apiKey": "string | null",
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601",
    "identifiers": [
      { "id": "uuid", "type": "pin | nfc", "value": "string" }
    ]
  }
]
```

---

### `GET /api/users/:id`

Gibt einen einzelnen Benutzer zurück.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | User-ID (UUID) |

**Response `200`:** User-Objekt (ohne `password`).

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `404`  | Benutzer nicht gefunden |

---

### `GET /api/users/:id/log`

Gibt das Aktivitätsprotokoll eines Benutzers zurück.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | User-ID (UUID) |

**Response `200`:** Array von Log-Einträgen.

```json
[
  {
    "id": "uuid",
    "type": "string",
    "userId": "uuid",
    "machineId": "uuid | null",
    "terminalId": "uuid | null",
    "details": {},
    "createdAt": "ISO-8601"
  }
]
```

---

### `POST /api/users`

Erstellt einen neuen Benutzer.

**Request Body:**
```json
{
  "username": "string",      // Pflicht, min. 1 Zeichen
  "displayName": "string",   // Pflicht, min. 1 Zeichen
  "password": "string",      // Optional (Pflicht für admin/drinker, nicht für api)
  "type": "admin | api | drinker",  // Pflicht
  "pin": "1234"              // Optional, genau 4 Ziffern (nur für drinker)
}
```

**Verhalten:**
- Für `drinker`: Wird automatisch eine 4-stellige PIN generiert, wenn keine angegeben wird.
- Für `api`: Ein `apiKey` wird automatisch generiert; kein Passwort nötig.
- Für `admin`/`drinker`: Passwort ist Pflicht.

**Response `201`:** Erstellter User (ohne `password`).

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `400`  | Passwort erforderlich für diesen Benutzertyp |
| `409`  | Benutzername existiert bereits |
| `409`  | PIN wird bereits verwendet |

---

### `PUT /api/users/:id`

Aktualisiert einen bestehenden Benutzer.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | User-ID (UUID) |

**Request Body:**
```json
{
  "displayName": "string",   // Optional
  "password": "string",      // Optional
  "balance": 10.5,           // Optional (nur für drinker)
  "identifiers": [           // Optional (nur für drinker)
    {
      "id": "uuid",
      "type": "pin | nfc",
      "value": "string"
    }
  ]
}
```

**Einschränkungen:**
- `balance` wird nur bei `drinker`-Benutzern aktualisiert.
- `identifiers` werden nur bei `drinker`-Benutzern aktualisiert.
- Max. 1 PIN-Identifier pro Benutzer.
- PIN-Werte müssen genau 4 Ziffern haben.
- Root-Benutzer können nicht über die UI bearbeitet werden.

**Response `200`:** Aktualisierter User (ohne `password`).

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `400`  | Nur ein PIN-Identifier pro Benutzer erlaubt |
| `403`  | Root-Benutzer kann nicht über die UI bearbeitet werden |
| `404`  | Benutzer nicht gefunden |

---

### `DELETE /api/users/:id`

Löscht einen Benutzer.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | User-ID (UUID) |

**Response `200`:**
```json
{ "success": true }
```

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `403`  | Root-Benutzer kann nicht gelöscht werden |
| `403`  | Eigenen Account kann man nicht löschen |
| `404`  | Benutzer nicht gefunden |

---

## Machines

> Alle Endpunkte erfordern: `Bearer Token` + `admin`-Rolle.

### `GET /api/machines`

Listet alle Maschinen auf.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "room": "string",
    "pricePerCoffee": 0.5,
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
]
```

---

### `GET /api/machines/:id`

Gibt eine einzelne Maschine zurück.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | Machine-ID (UUID) |

**Response `200`:** Machine-Objekt.

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `404`  | Maschine nicht gefunden |

---

### `GET /api/machines/:id/log`

Gibt das Aktivitätsprotokoll einer Maschine zurück.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | Machine-ID (UUID) |

**Response `200`:** Array von Log-Einträgen.

---

### `POST /api/machines`

Erstellt eine neue Maschine.

**Request Body:**
```json
{
  "name": "string",          // Pflicht, min. 1 Zeichen
  "room": "string",          // Optional, Standard: ""
  "pricePerCoffee": 0.5      // Pflicht, muss positiv sein
}
```

**Response `201`:** Erstellte Maschine.

---

### `PUT /api/machines/:id`

Aktualisiert eine bestehende Maschine.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | Machine-ID (UUID) |

**Request Body:**
```json
{
  "name": "string",          // Optional
  "room": "string",          // Optional
  "pricePerCoffee": 0.5      // Optional, muss positiv sein
}
```

**Response `200`:** Aktualisierte Maschine.

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `404`  | Maschine nicht gefunden |

---

### `DELETE /api/machines/:id`

Löscht eine Maschine.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | Machine-ID (UUID) |

**Response `200`:**
```json
{ "success": true }
```

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `404`  | Maschine nicht gefunden |
| `409`  | Maschine wird noch von einem Terminal verwendet |

---

## Terminals

> Alle Endpunkte erfordern: `Bearer Token` + `admin`-Rolle.

### `GET /api/terminals`

Listet alle Terminals mit zugehöriger Maschinen-Info auf.

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "slug": "string",
    "machineId": "uuid",
    "type": "web",
    "quickButtonsEnabled": 0,
    "quickButton1": 5,
    "quickButton2": 10,
    "alphabetFilterEnabled": 1,
    "createdAt": "ISO-8601",
    "updatedAt": "ISO-8601"
  }
]
```

---

### `GET /api/terminals/:id`

Gibt ein einzelnes Terminal mit Maschinen-Info zurück.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | Terminal-ID (UUID) |

**Response `200`:** Terminal-Objekt mit Maschinen-Info.

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `404`  | Terminal nicht gefunden |

---

### `GET /api/terminals/:id/log`

Gibt das Aktivitätsprotokoll eines Terminals zurück.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | Terminal-ID (UUID) |

**Response `200`:** Array von Log-Einträgen.

---

### `POST /api/terminals`

Erstellt ein neues Terminal.

**Request Body:**
```json
{
  "name": "string",       // Pflicht, min. 1 Zeichen
  "machineId": "uuid"     // Pflicht, muss existierende Maschine referenzieren
}
```

**Verhalten:**
- Der `slug` wird automatisch aus dem Namen generiert (Umlaute werden konvertiert, Sonderzeichen entfernt).
- Standard-Einstellungen: `quickButtonsEnabled: false`, `alphabetFilterEnabled: true`.

**Response `201`:** Erstelltes Terminal.

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `404`  | Maschine nicht gefunden |
| `409`  | Terminal-Name existiert bereits (Slug-Kollision) |

---

### `PUT /api/terminals/:id`

Aktualisiert ein bestehendes Terminal.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | Terminal-ID (UUID) |

**Request Body:**
```json
{
  "name": "string",           // Optional
  "machineId": "uuid",        // Optional
  "quickButtons": {           // Optional
    "enabled": true,
    "button1": 5.0,           // Muss positiv sein
    "button2": 10.0           // Muss positiv sein
  },
  "alphabetFilter": {         // Optional
    "enabled": true
  }
}
```

**Response `200`:** Aktualisiertes Terminal.

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `404`  | Terminal nicht gefunden |
| `404`  | Maschine nicht gefunden (bei machineId-Änderung) |
| `409`  | Terminal-Name existiert bereits (Slug-Kollision) |

---

### `DELETE /api/terminals/:id`

Löscht ein Terminal.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | Terminal-ID (UUID) |

**Response `200`:**
```json
{ "success": true }
```

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `404`  | Terminal nicht gefunden |

---

## Terminal Actions

> Öffentliche Endpunkte — keine JWT-Authentifizierung erforderlich.  
> Terminals werden über ihren `slug` (URL-freundlicher Name) identifiziert.

### `GET /api/terminal-actions/:slug`

Gibt Terminal-Informationen, Maschinen-Daten und die Liste der berechtigten Benutzer zurück.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `slug`    | string | Terminal-Slug |

**Response `200`:**
```json
{
  "terminal": {
    "id": "uuid",
    "name": "string",
    "slug": "string",
    "quickButtons": { "enabled": false, "button1": 5, "button2": 10 },
    "alphabetFilter": { "enabled": true }
  },
  "machine": {
    "id": "uuid",
    "name": "string",
    "room": "string",
    "pricePerCoffee": 0.5
  },
  "users": [
    { "id": "uuid", "displayName": "string", "balance": 0.0 }
  ]
}
```

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `404`  | Terminal nicht gefunden |

---

### `POST /api/terminal-actions/:slug/verify-nfc`

Verifiziert eine NFC-Seriennummer und gibt ein kurzlebiges Session-Token zurück.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `slug`    | string | Terminal-Slug |

**Request Body:**
```json
{
  "serialNumber": "string"   // Pflicht, NFC-Seriennummer
}
```

**Response `200`:**
```json
{
  "success": true,
  "sessionToken": "jwt-string",
  "user": {
    "id": "uuid",
    "displayName": "string",
    "balance": 0.0
  }
}
```

**Verhalten:**
- Das Session-Token ist **5 Minuten** gültig.
- Enthält `userId`, `terminalId` und `purpose: "terminal-session"`.

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `404`  | Terminal nicht gefunden |
| `404`  | Kein Benutzer mit dieser NFC-Seriennummer gefunden |

---

### `POST /api/terminal-actions/:slug/verify-pin`

Verifiziert eine Benutzer-PIN und gibt ein kurzlebiges Session-Token zurück.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `slug`    | string | Terminal-Slug |

**Request Body:**
```json
{
  "userId": "uuid",    // Pflicht
  "pin": "1234"        // Pflicht
}
```

**Response `200`:**
```json
{
  "success": true,
  "sessionToken": "jwt-string",
  "user": {
    "id": "uuid",
    "displayName": "string",
    "balance": 0.0
  }
}
```

**Verhalten:**
- Das Session-Token ist **5 Minuten** gültig.
- Nur `drinker`-Benutzer können sich per PIN verifizieren.

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `401`  | Ungültige PIN |
| `404`  | Terminal nicht gefunden |
| `404`  | Benutzer nicht gefunden |

---

### `POST /api/terminal-actions/:slug/anonymous-coffee`

Registriert einen anonymen Kaffee (Gast, ohne Anmeldung).

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `slug`    | string | Terminal-Slug |

**Request Body:** Keiner.

**Response `200`:**
```json
{
  "success": true,
  "price": 0.5
}
```

**Verhalten:**
- Erstellt einen `anonymous_coffee`-Eintrag im Kassenbuch.
- Loggt den anonymen Kaffee.

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `404`  | Terminal nicht gefunden |
| `500`  | Maschine nicht gefunden |

---

### `POST /api/terminal-actions/:slug/count-coffee`

Bucht einen Kaffee für einen authentifizierten Benutzer.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `slug`    | string | Terminal-Slug |

**Request Body:**
```json
{
  "sessionToken": "jwt-string"   // Pflicht, gültiges Session-Token
}
```

**Response `200`:**
```json
{
  "success": true,
  "newBalance": -0.5
}
```

**Verhalten:**
- Zieht den Kaffeepreis der zugehörigen Maschine vom Guthaben ab.
- Das Guthaben kann negativ werden.

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `401`  | Session-Token erforderlich |
| `403`  | Session abgelaufen oder ungültig |
| `404`  | Benutzer nicht gefunden |
| `500`  | Maschine nicht gefunden |

---

### `POST /api/terminal-actions/:slug/update-balance`

Aktualisiert das Guthaben eines Benutzers über das Terminal.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `slug`    | string | Terminal-Slug |

**Request Body:**
```json
{
  "sessionToken": "jwt-string",   // Pflicht
  "amount": 5.0,                  // Optional (Pflicht bei mode "add"), muss positiv sein
  "mode": "add | reset"           // Optional, Standard: "add"
}
```

**Verhalten:**
- `mode: "add"` — Addiert `amount` zum aktuellen Guthaben.
- `mode: "reset"` — Setzt das Guthaben auf 0 zurück.
- Bei `reset` mit negativem Guthaben: Schuldenbetrag wird als Einzahlung ins Kassenbuch gebucht.
- Bei `add`: Der Betrag wird als Einzahlung ins Kassenbuch gebucht.

**Response `200`:**
```json
{
  "success": true,
  "newBalance": 5.0
}
```

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `400`  | Gültiger Betrag erforderlich |
| `401`  | Session-Token erforderlich |
| `403`  | Session abgelaufen oder ungültig |
| `404`  | Benutzer nicht gefunden |

---

## Cash Book

> Alle Endpunkte erfordern: `Bearer Token` + `admin`-Rolle.

### `GET /api/cashbook`

Gibt alle Kassenbuch-Einträge zurück (neueste zuerst).

**Response `200`:**
```json
[
  {
    "id": "uuid",
    "type": "deposit | withdrawal | anonymous_coffee",
    "amount": 5.0,
    "comment": "string",
    "machineId": "uuid | null",
    "terminalId": "uuid | null",
    "performedBy": "uuid | 'terminal'",
    "createdAt": "ISO-8601"
  }
]
```

---

### `GET /api/cashbook/balance`

Gibt den berechneten Kassenstand zurück.

**Response `200`:**
```json
{
  "balance": 42.50
}
```

---

### `POST /api/cashbook/deposit`

Erstellt eine Einzahlung.

**Request Body:**
```json
{
  "amount": 10.0,       // Pflicht, muss positiv sein
  "comment": "string"   // Pflicht, min. 1 Zeichen (wird getrimmt)
}
```

**Response `201`:** Erstellter Kassenbuch-Eintrag.

---

### `POST /api/cashbook/withdrawal`

Erstellt eine Auszahlung.

**Request Body:**
```json
{
  "amount": 10.0,       // Pflicht, muss positiv sein
  "comment": "string"   // Pflicht, min. 1 Zeichen (wird getrimmt)
}
```

**Response `201`:** Erstellter Kassenbuch-Eintrag.

---

### `DELETE /api/cashbook/:id`

Löscht einen Kassenbuch-Eintrag.

**URL-Parameter:**

| Parameter | Typ    | Beschreibung |
| --------- | ------ | ------------ |
| `id`      | string | Entry-ID (UUID) |

**Einschränkungen:**
- `anonymous_coffee`-Einträge können nicht gelöscht werden.

**Response `200`:**
```json
{ "success": true }
```

**Fehler:**

| Status | Beschreibung |
| ------ | ------------ |
| `403`  | Gast-Kaffee-Einträge können nicht gelöscht werden |
| `404`  | Eintrag nicht gefunden |

---

## Settings

### `GET /api/settings`

Gibt die aktuellen Einstellungen zurück. **Keine Authentifizierung erforderlich.**

**Response `200`:**
```json
{
  "language": "de | en"
}
```

---

### `PUT /api/settings`

Aktualisiert die Einstellungen.

> Erfordert: `Bearer Token` + `admin`-Rolle.

**Request Body:**
```json
{
  "language": "de | en"   // Pflicht
}
```

**Response `200`:** Aktualisierte Einstellungen.

---

### `DELETE /api/settings/cleanup-logs`

Löscht alle Logs, die älter als 1 Jahr sind. Kaffee-Statistiken werden dabei archiviert.

> Erfordert: `Bearer Token` + `admin`-Rolle.

**Response `200`:**
```json
{
  "deletedCount": 150,
  "periodFrom": "ISO-8601",
  "periodTo": "ISO-8601"
}
```

Wenn keine alten Logs vorhanden:
```json
{
  "deletedCount": 0,
  "message": "Keine Logs älter als ein Jahr gefunden."
}
```

---

### `GET /api/settings/log-cleanups`

Gibt die Historie der Log-Bereinigungen zurück.

> Erfordert: `Bearer Token` + `admin`-Rolle.

**Response `200`:**
```json
[
  {
    "id": 1,
    "deletedAt": "ISO-8601",
    "deletedBy": "string",
    "deletedCount": 150,
    "periodFrom": "ISO-8601",
    "periodTo": "ISO-8601"
  }
]
```

---

## Stats

> Alle Endpunkte erfordern: `Bearer Token` + `admin`-Rolle.

### `GET /api/stats/dashboard`

Gibt aggregierte Statistiken für das Dashboard zurück.

**Response `200`:**
```json
{
  "totalCoffees": 1234,
  "coffeesToday": 12,
  "coffeesPerDay": [
    { "date": "2026-03-25", "count": 15 },
    { "date": "2026-03-26", "count": 8 }
  ],
  "topDrinkers": [
    { "userId": "uuid", "displayName": "string", "count": 200 }
  ],
  "popularMachines": [
    { "machineId": "uuid", "name": "string", "count": 500 }
  ],
  "totalUsers": 42,
  "totalMachines": 3,
  "totalTerminals": 5
}
```

**Details:**
- `coffeesPerDay`: Letzte 30 Tage, inkl. Tage ohne Kaffees (count: 0).
- `topDrinkers`: Top 5 Kaffeetrinker (aktuell + archiviert).
- `popularMachines`: Alle Maschinen nach Nutzung sortiert (aktuell + archiviert).
- Archivierte Statistiken (aus Log-Bereinigungen) werden mit eingerechnet.

---

## Datenbank-Schema

### `users`

| Spalte      | Typ     | Beschreibung                              |
| ----------- | ------- | ----------------------------------------- |
| `id`        | TEXT PK | UUID                                      |
| `username`  | TEXT    | Einzigartig, Pflicht                      |
| `displayName` | TEXT | Anzeigename                               |
| `password`  | TEXT    | Bcrypt-Hash (null für `api`-Benutzer)     |
| `type`      | TEXT    | `admin`, `api` oder `drinker`             |
| `isRoot`    | INTEGER | 1 = Root-Benutzer (nicht löschbar)        |
| `balance`   | REAL    | Guthaben (Standard: 0)                    |
| `apiKey`    | TEXT    | API-Key (nur für `api`-Benutzer)          |
| `createdAt` | TEXT    | ISO-8601 Zeitstempel                      |
| `updatedAt` | TEXT    | ISO-8601 Zeitstempel                      |

### `identifiers`

| Spalte   | Typ     | Beschreibung                           |
| -------- | ------- | -------------------------------------- |
| `id`     | TEXT PK | UUID                                   |
| `userId` | TEXT FK | Referenz auf `users.id` (CASCADE)      |
| `type`   | TEXT    | z.B. `pin`, `nfc`                      |
| `value`  | TEXT    | Identifier-Wert (PIN oder NFC-Serial)  |

### `machines`

| Spalte          | Typ     | Beschreibung               |
| --------------- | ------- | -------------------------- |
| `id`            | TEXT PK | UUID                       |
| `name`          | TEXT    | Name der Maschine          |
| `room`          | TEXT    | Raum (Standard: "")        |
| `pricePerCoffee`| REAL    | Preis pro Kaffee           |
| `createdAt`     | TEXT    | ISO-8601 Zeitstempel       |
| `updatedAt`     | TEXT    | ISO-8601 Zeitstempel       |

### `terminals`

| Spalte                 | Typ     | Beschreibung                          |
| ---------------------- | ------- | ------------------------------------- |
| `id`                   | TEXT PK | UUID                                  |
| `name`                 | TEXT    | Terminal-Name                         |
| `slug`                 | TEXT    | URL-freundlicher Name (einzigartig)   |
| `machineId`            | TEXT FK | Referenz auf `machines.id`            |
| `type`                 | TEXT    | Terminal-Typ (Standard: `web`)        |
| `quickButtonsEnabled`  | INTEGER | Schnelltasten aktiviert (0/1)         |
| `quickButton1`         | REAL    | Betrag Schnelltaste 1 (Standard: 5)  |
| `quickButton2`         | REAL    | Betrag Schnelltaste 2 (Standard: 10) |
| `alphabetFilterEnabled`| INTEGER | Alphabetfilter aktiviert (0/1)        |
| `createdAt`            | TEXT    | ISO-8601 Zeitstempel                  |
| `updatedAt`            | TEXT    | ISO-8601 Zeitstempel                  |

### `logs`

| Spalte       | Typ     | Beschreibung                                |
| ------------ | ------- | ------------------------------------------- |
| `id`         | TEXT PK | UUID                                        |
| `type`       | TEXT    | Log-Typ (z.B. `coffee`, `login`, `balance`) |
| `userId`     | TEXT    | Betroffener Benutzer (nullable)             |
| `machineId`  | TEXT    | Betroffene Maschine (nullable)              |
| `terminalId` | TEXT    | Betroffenes Terminal (nullable)             |
| `details`    | TEXT    | JSON-Details                                |
| `createdAt`  | TEXT    | ISO-8601 Zeitstempel                        |

**Log-Typen:**

| Typ              | Beschreibung                    |
| ---------------- | ------------------------------- |
| `login`          | Dashboard-Login                 |
| `coffee`         | Kaffee gebucht                  |
| `anonymous_coffee` | Anonymer Kaffee               |
| `balance`        | Guthaben geändert               |
| `user_created`   | Benutzer erstellt               |
| `user_deleted`   | Benutzer gelöscht               |
| `cashbook`       | Kassenbuch-Aktion               |

### `cash_book`

| Spalte       | Typ     | Beschreibung                                       |
| ------------ | ------- | -------------------------------------------------- |
| `id`         | TEXT PK | UUID                                               |
| `type`       | TEXT    | `deposit`, `withdrawal` oder `anonymous_coffee`    |
| `amount`     | REAL    | Betrag (immer positiv)                             |
| `comment`    | TEXT    | Kommentar (Standard: "")                           |
| `machineId`  | TEXT    | Maschine (nullable)                                |
| `terminalId` | TEXT    | Terminal (nullable)                                |
| `performedBy`| TEXT    | User-ID oder `"terminal"`                          |
| `createdAt`  | TEXT    | ISO-8601 Zeitstempel                               |

### `settings`

| Spalte  | Typ     | Beschreibung          |
| ------- | ------- | --------------------- |
| `key`   | TEXT PK | Einstellungsschlüssel |
| `value` | TEXT    | Einstellungswert      |

### `archived_stats`

| Spalte  | Typ     | Beschreibung                           |
| ------- | ------- | -------------------------------------- |
| `key`   | TEXT PK | Statistik-Schlüssel                    |
| `value` | TEXT    | JSON-Wert (Kaffee-Zähler pro User/Maschine) |

### `log_cleanups`

| Spalte        | Typ          | Beschreibung                   |
| ------------- | ------------ | ------------------------------ |
| `id`          | INTEGER PK   | Auto-Increment                 |
| `deletedAt`   | TEXT         | Zeitpunkt der Bereinigung      |
| `deletedBy`   | TEXT         | Username des Ausführenden      |
| `deletedCount`| INTEGER      | Anzahl gelöschter Logs         |
| `periodFrom`  | TEXT         | Ältester gelöschter Log        |
| `periodTo`    | TEXT         | Neuester gelöschter Log        |