# Trainingsbuch

Auroras Handy-App zum Eintragen von Training, Ernährung, Zyklus und Befinden.

**Adresse:** https://aurorascheibner-ux.github.io/trainings-app/

## So funktioniert es

- Die App ist eine Webseite, die sich wie eine App auf den Startbildschirm legen lässt.
- Jede Änderung im Zweig `main` wird automatisch veröffentlicht (siehe `.github/workflows/pages.yml`). Nach ein bis zwei Minuten ist die neue Version online.
- Änderungen kommen als Pull Request, damit sie vorher angeschaut werden können.

## Dateien

| Datei | Wofür |
|---|---|
| `index.html` | Aufbau der Seiten und Tabs |
| `styles.css` | Aussehen (Farben, Abstände) |
| `app.js` | Wechsel zwischen den Tabs, Optik |
| `data.js` | Anmeldung, Formulare, Listen, Heute-Übersicht |
| `config.js` | Adresse und öffentlicher Schlüssel der Datenbank |
| `supabase/schema.sql` | Tabellen und Schutzregeln der Datenbank |
| `manifest.webmanifest` | Name und Icon für den Startbildschirm |
| `sw.js` | Macht die App installierbar und offline startbar |
| `icons/` | App-Icons |

## Stand

Schritt 2: Anmeldung und Eintragen mit Supabase (Tabellen in `supabase/schema.sql`, Verbindung in `config.js`). Essensfoto und Datenübernahme folgen.
