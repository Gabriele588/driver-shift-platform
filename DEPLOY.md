# Pubblicazione online multiutente

Questa versione è predisposta per uso aziendale multiutente con:

- frontend su Vercel;
- API serverless su Vercel;
- database condiviso su Supabase;
- sessione utente tramite cookie server-side;
- stato operativo condiviso tra Admin, CAM e Dispatcher.

## 1. Creare il progetto Supabase

1. Crea un nuovo progetto su Supabase.
2. Apri `SQL Editor`.
3. Esegui tutto il contenuto del file `supabase-schema.sql`.
4. Recupera:
   - `Project URL`;
   - `service_role key`.

## 2. Creare il progetto Vercel

1. Crea un repository GitHub con questi file.
2. Importa il repository in Vercel.
3. Framework preset: `Other`.
4. Build command: vuoto.
5. Output directory: vuoto / root progetto.

## 3. Variabili ambiente Vercel

In `Settings > Environment Variables` imposta:

| Variabile | Valore |
| --- | --- |
| `SUPABASE_URL` | URL del progetto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key Supabase |
| `SESSION_SECRET` | Stringa lunga casuale, almeno 32 caratteri |

Esempio `SESSION_SECRET`: genera una stringa casuale, non usare valori semplici.

## 4. Primo accesso

Al primo login il backend inizializza automaticamente gli utenti base:

| Ruolo | User | Password |
| --- | --- | --- |
| Amministratore | `Admin` | `123456` |
| Key Account Manager | `CAM` | `123456` |
| Dispatcher | `DSP1` | `654321` |

Dopo il primo accesso è consigliato modificare le password dalla sezione utenti.

## 5. Nota sicurezza

Il database Supabase ha RLS attiva e viene letto/scritto solo dalle API server-side tramite service role.

Le password non vengono salvate in chiaro nella tabella utenti server: vengono trasformate con hash PBKDF2.

Il frontend mantiene un fallback locale per test e apertura diretta del file, ma in produzione Vercel usa le API `/api/*`.
