const express = require('express'), path = require('path'), fs = require('fs'), initSqlJs = require('sql.js');
const C = require('./config'), { estimate } = require('./valuation');
const PORT = process.env.PORT || 8080, ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'data', 'leads.sqlite');
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
let db;
const save = () => { fs.mkdirSync(path.dirname(DB_FILE), { recursive: true }); fs.writeFileSync(DB_FILE, Buffer.from(db.export())); };

async function decodeVin(vin) {
  const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`, { signal: AbortSignal.timeout(10000) });
  const d = (await r.json()).Results[0];
  if (!d.Make || !d.ModelYear) throw new Error('VIN could not be decoded: ' + (d.ErrorText || 'unknown'));
  return { vin, year: d.ModelYear, make: d.Make, model: d.Model, trim: [d.Trim, d.Series].filter(Boolean).join(' ') || '',
    bodyClass: d.BodyClass, engine: [d.DisplacementL && d.DisplacementL.slice(0,3) + 'L', d.EngineCylinders && d.EngineCylinders + '-cyl', d.FuelTypePrimary].filter(Boolean).join(' '),
    drive: d.DriveType, decodeNote: d.ErrorCode && d.ErrorCode !== '0' ? d.ErrorText : '' };
}

const app = express(); app.use(express.json()); app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/config', (q, s) => s.json({ dealer: C.dealer, conditions: Object.fromEntries(Object.entries(C.conditions).map(([k, v]) => [k, { label: v.label, desc: v.desc }])) }));
app.get('/api/decode/:vin', async (q, s) => {
  const vin = q.params.vin.toUpperCase(); if (!VIN_RE.test(vin)) return s.status(400).json({ error: 'VIN must be 17 characters (no I, O or Q).' });
  try { s.json(await decodeVin(vin)); } catch (e) { s.status(422).json({ error: e.message }); }
});
app.post('/api/appraise', async (q, s) => {
  const b = q.body || {}; const vin = (b.vin || '').toUpperCase().trim(); const mileage = parseInt(b.mileage, 10);
  const errs = [];
  if (!VIN_RE.test(vin)) errs.push('Valid 17-character VIN required');
  if (!(mileage >= 0 && mileage < 1e6)) errs.push('Valid mileage required');
  if (!C.conditions[b.condition]) errs.push('Condition required');
  if (b.zip && !/^\d{5}$/.test(b.zip)) errs.push('ZIP must be 5 digits');
  if (!b.name || b.name.trim().length < 2) errs.push('Name required');
  if (!/^\D*(\d\D*){10,11}$/.test(b.phone || '')) errs.push('Valid phone required');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email || '')) errs.push('Valid email required');
  if (errs.length) return s.status(400).json({ error: errs.join('; ') });
  try {
    const v = await decodeVin(vin); const est = await estimate(v, { mileage, condition: b.condition, zip: b.zip });
    const ts = new Date().toISOString();
    db.run(`INSERT INTO leads (created_at,name,phone,email,zip,vin,year,make,model,trim,body_class,mileage,condition,est_low,est_high,est_point,provider,breakdown)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [ts, b.name.trim(), b.phone.trim(), b.email.trim(), b.zip || '', vin, v.year, v.make, v.model, v.trim, v.bodyClass || '', mileage, b.condition, est.low, est.high, est.point, est.provider, JSON.stringify(est.breakdown)]);
    save();
    s.json({ vehicle: v, estimate: est, disclaimer: 'Estimated range, final offer subject to in-person inspection.', created_at: ts });
  } catch (e) { s.status(422).json({ error: e.message }); }
});
// ---- admin (HTTP Basic auth) ----
function auth(q, s, n) {
  const [, b64] = (q.headers.authorization || '').split(' '); const pw = b64 ? Buffer.from(b64, 'base64').toString().split(':').slice(1).join(':') : null;
  if (pw === ADMIN_PASSWORD) return n(); s.set('WWW-Authenticate', 'Basic realm="Admin"').status(401).send('Authentication required');
}
const rows = () => { const r = db.exec('SELECT * FROM leads ORDER BY id DESC')[0]; return r ? r.values.map(v => Object.fromEntries(r.columns.map((c, i) => [c, v[i]]))) : []; };
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
app.get('/admin', auth, (q, s) => {
  const L = rows(); const $ = n => '$' + Number(n).toLocaleString();
  s.send(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Leads – ${C.dealer.name}</title>
<style>body{font-family:system-ui;margin:20px;color:#222}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}th{background:#c3002f;color:#fff}a.btn{background:#c3002f;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none}.wrap{overflow-x:auto}</style>
<h1>${C.dealer.name} – Trade-In Leads (${L.length})</h1><p><a class=btn href="/admin/export.csv">Export CSV</a></p><div class=wrap><table><tr><th>Date</th><th>Name</th><th>Phone</th><th>Email</th><th>ZIP</th><th>Vehicle</th><th>VIN</th><th>Miles</th><th>Cond.</th><th>Estimate</th></tr>
${L.map(r => `<tr><td>${esc(r.created_at.replace('T', ' ').slice(0, 16))}</td><td>${esc(r.name)}</td><td><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></td><td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td><td>${esc(r.zip)}</td><td>${esc(`${r.year} ${r.make} ${r.model} ${r.trim}`)}</td><td>${esc(r.vin)}</td><td>${Number(r.mileage).toLocaleString()}</td><td>${esc(r.condition)}</td><td>${$(r.est_low)} – ${$(r.est_high)}</td></tr>`).join('')}</table></div>`);
});
app.get('/admin/export.csv', auth, (q, s) => {
  const L = rows(); const cols = L.length ? Object.keys(L[0]) : ['id'];
  const cell = x => { x = String(x ?? ''); if (/^[=+\-@]/.test(x)) x = "'" + x; return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  s.set('Content-Type', 'text/csv').set('Content-Disposition', 'attachment; filename="tradein-leads.csv"').send([cols.join(','), ...L.map(r => cols.map(c => cell(r[c])).join(','))].join('\n'));
});
(async () => {
  const SQL = await initSqlJs(); db = fs.existsSync(DB_FILE) ? new SQL.Database(fs.readFileSync(DB_FILE)) : new SQL.Database();
  db.run(`CREATE TABLE IF NOT EXISTS leads (id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT, name TEXT, phone TEXT, email TEXT, zip TEXT, vin TEXT, year TEXT, make TEXT, model TEXT, trim TEXT, body_class TEXT, mileage INTEGER, condition TEXT, est_low INTEGER, est_high INTEGER, est_point INTEGER, provider TEXT, breakdown TEXT)`); save();
  app.listen(PORT, () => console.log(`Trade-in app on http://localhost:${PORT}  (admin pw ${ADMIN_PASSWORD === 'changeme' ? 'DEFAULT changeme' : 'from env'})`));
})();
