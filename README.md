# Driver Shift Platform

Prima versione web del modello di pianificazione turni driver sviluppato in Excel/VBA.

## Funzioni incluse

- Dashboard KPI per fabbisogno rotte, turni pianificati, copertura, driver e ore extra.
- Calendario turni su 1, 2, 4 o 6 settimane.
- Filtri per filiale: OSI2, DSI2, DLZ3 o filiali importate.
- Import Excel/CSV forecast, dipendenti e assenze nei formati AMZ.
- Vincoli turno forzato `X` e riposo forzato `R`.
- Colori distinti per `X`, `R`, `F`, `M`, `B`, `G`, `A`, `N`, `X` vincolata e `R` vincolata.
- Algoritmo 1: priorita ai giorni contrattuali.
- Algoritmo 2: priorita alla saturazione contrattuale.
- Conferma e sblocco giornata.
- Lista gialla per dipendenti reperibili su giornata confermata, selezionabili solo tra chi è in stato R.
- Modifica mirata della giornata confermata tramite maschera dedicata.
- Consuntivo rotte per data/station con precedenza sul forecast.
- Viste di controllo per forecast importato e assenze importate, filtrabili per station.
- Log modifiche su giornate confermate e operazioni principali.
- Export CSV del piano.
- Persistenza locale su browser tramite `localStorage`.

## Import Excel e CSV

La piattaforma importa direttamente i tre file Excel usati nel progetto:

- Forecast Amazon: foglio `RANZ` con `ofd_date`, `station`, `service_type_scheduling`, `routes_output`. Le righe vengono aggregate per data e filiale.
- Lista dipendenti: `Station`, `ID DRIVER`, `NOME E COGNOME`, `CONTRATTO`, `Stato`, `Matricola TS`. Una nuova importazione aggiorna per matricola o nome normalizzato e accoda i nuovi dipendenti.
- Piano assenze: intestazione alla riga 2 con `Matricola`, `Data`, `FERIE ORE`, `PERMESSI`, `MALATTIA`, `INFORTUNIO`.

Il forecast viene sempre sommato per chiave `data + station` quando il file contiene piu righe sulla stessa giornata. Una nuova importazione aggiorna la stessa chiave `data + station` e accoda le nuove giornate/station.

Sono ancora accettati anche CSV con campi equivalenti.

Forecast CSV:

```csv
ofd_date;station;routes_output
2026-10-05;DLZ3;18
```

Dipendenti:

```csv
id;name;station;contract;weekly_hours;days;matricola;active
DLZ3-001;Mario Rossi;DLZ3;da lunedi a venerdi;39;;M001;true
```

Assenze CSV:

```csv
date;matricola;type
2026-10-06;M001;F
```

## Apertura

Aprire `index.html` con un browser moderno oppure avviare un server locale nella cartella:

```bash
python3 -m http.server 8080
```

Poi visitare `http://localhost:8080`.

## Logica algoritmi

Algoritmo 1 replica la logica a priorita giorni contrattuali:

- applica prima assenze `F/M` e vincoli `X/R`;
- pianifica prima i driver nel proprio giorno contrattuale e non ancora saturi;
- poi usa altri driver comunque nel giorno contrattuale;
- usa giorni fuori contratto solo a fabbisogno residuo;
- riequilibra la settimana spostando X da risorse sopra target a risorse sotto target, quando il giorno e compatibile;
- evita 6°/7° giorno salvo necessita;
- lascia `B` sui buchi contrattuali non saturati.

Algoritmo 2 replica la logica a priorita saturazione contrattuale:

- applica prima assenze `F/M` e vincoli `X/R`;
- cerca prima di saturare i contratti settimanali dei driver;
- preserva comunque il rispetto dei giorni contrattuali come criterio successivo;
- minimizza i giorni supplementari/fuori contratto;
- evita sbilanciamenti evidenti tra driver gia molto pianificati e driver sotto-saturati.

## Flusso giornaliero

1. Eseguire Algoritmo 1 o Algoritmo 2.
2. Confermare la giornata: le X vengono cristallizzate con colore verde opaco e la giornata non è più modificabile con click diretto.
3. Aprire Lista gialla e selezionare eventuali dipendenti reperibili tra quelli in stato R. La G non concorre alla saturazione.
4. Usare Modifica giornata solo se serve correggere un caso specifico, ad esempio X -> M o G -> X. Il click diretto sulle celle del calendario è disabilitato.

## Consuntivo rotte

Il consuntivo rotte viene salvato per data e station. Se presente, il fabbisogno della giornata usa il consuntivo; in assenza di consuntivo continua a usare il forecast.

## Evoluzione consigliata

La versione corrente e un prototipo frontend completo. Per trasformarla in piattaforma aziendale servono:

- backend con database;
- login e profili autorizzativi;
- storico piani per filiale;
- esportazione Excel formattata;
- motore algoritmico versionato e testabile lato server.
