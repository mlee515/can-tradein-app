# Central Avenue Nissan – Trade-In Appraisal App

Single-page, mobile-friendly trade-in estimator (Node 20 + Express + SQLite via sql.js, no native build needed).

## Run
```bash
npm install
ADMIN_PASSWORD='something-strong' PORT=8080 node server.js
```
- Customer page: `http://HOST:8080/`
- Admin: `http://HOST:8080/admin` (HTTP Basic auth, any username, password = `ADMIN_PASSWORD`, default `changeme`). CSV at `/admin/export.csv`.
- DB: `data/leads.sqlite` (override with `DB_FILE`).

## Files
- `config.js` holds every tunable: MSRP tables, depreciation curve, mileage rule, condition multipliers, trade-in factor, range spread, ZIP adjustments, provider.
- `valuation.js` contains the estimate engine and the adapter stubs (`blackbook`, `kbbico`, `marketcheck`). Set `provider` in config to switch. If a provider fails, the app falls back to builtin.
- `server.js` has the API (`/api/decode/:vin`, `/api/appraise`), the NHTSA vPIC decode, SQLite storage and admin.
- `public/index.html` is the UI.

## Estimate formula
`trade = MSRP × ageCurve(age) × makeRetention × mileageFactor × condition × zip × tradeInFactor`, range = ±rangeSpread.
- MSRP: make|model table → NHTSA BodyClass table (× luxury multiplier) → default.
- Age curve: interpolated retail-retention table, ×0.92/yr after year 10. Value is floored at $1,000.
- Mileage: ±0.4% per 1,000 mi vs 12k/yr (capped at −35% / +12%).
- Condition: Excellent 1.05, Good 1.00, Fair 0.88, Poor 0.70.
- Trade-in factor 0.82 of retail.

**Not a book value.** The result is labeled "Estimated range, final offer subject to in-person inspection."

## PWA (installable app)
- `public/manifest.json` sets name "Central Avenue Nissan Trade-In", short_name "CAN Trade-In", standalone display, theme #c3002f.
- Icons are in `public/icons/`: 192, 512, maskable 192/512, apple-touch-icon (180) and a favicon.
- `public/sw.js` caches the app shell (cache-first for assets, network-first for the page with an offline fallback). It **never** caches `/api/*` or `/admin*`. Bump `CACHE` when you deploy UI changes.
- Install prompt: on Android/Chrome the `beforeinstallprompt` event shows an "Install" bar. On iOS Safari a "Share → Add to Home Screen" hint appears. Dismissing it is remembered.

## Camera VIN scanner
- The "Scan" button next to the VIN field opens the rear camera with ZXing (`public/vendor/zxing-browser.min.js` bundled locally, with a jsDelivr CDN fallback). It reads Code 39, DataMatrix, QR, Code 128 and PDF417.
- A leading "I" on Code 39 VINs is stripped. The VIN is validated to 17 characters, then the field is filled and decoded.
- **The camera requires HTTPS** (or `localhost`). Over plain http on a LAN IP the button explains this and the customer can type the VIN. Denied permission or no camera also shows a friendly message.

## Tests
`node test/pwa-scan-test.js` (server must be running) checks the manifest, the SW and cache rules, installability through Chrome DevTools, decoding of generated Code 39 and DataMatrix VIN barcodes and the no-camera fallback. It also refreshes the screenshots in `screens/`.
