// Headless checks: manifest, SW, installability (CDP), VIN scan decoding, screenshots.
const { chromium } = require('playwright-core'); const bwip = require('bwip-js'); const fs = require('fs');
const S = __dirname + '/../screens/', VIN = '1N4BL4BV8LC123456';
(async () => {
  fs.writeFileSync(__dirname + '/../public/test-code39.png', await bwip.toBuffer({ bcid: 'code39', text: 'I' + VIN, scale: 3, height: 12, includetext: true }));
  fs.writeFileSync(__dirname + '/../public/test-dm.png', await bwip.toBuffer({ bcid: 'datamatrix', text: VIN, scale: 8, padding: 20, backgroundcolor: 'FFFFFF' }));
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 420, height: 900 }, deviceScaleFactor: 2 }); const p = await ctx.newPage();
  await p.goto('http://localhost:8080'); await p.waitForSelector('.cond');
  const sw = await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; return { scope: r.scope, active: !!r.active, state: r.active && r.active.state }; });
  console.log('SW:', JSON.stringify(sw));
  await p.reload(); await p.waitForSelector('.cond');
  console.log('SW controls page:', await p.evaluate(() => !!navigator.serviceWorker.controller));
  console.log('Cache contents:', await p.evaluate(async () => (await (await caches.open('can-tradein-v2')).keys()).map(r => new URL(r.url).pathname).join(' ')));
  const cdp = await ctx.newCDPSession(p);
  const m = await cdp.send('Page.getAppManifest'); console.log('Manifest errors:', JSON.stringify(m.errors));
  const inst = await cdp.send('Page.getInstallabilityErrors'); console.log('Installability errors:', JSON.stringify(inst.installabilityErrors));
  const man = JSON.parse(m.data); const req = ['name','short_name','start_url','display','theme_color','background_color'].filter(k => !man[k]);
  console.log('Manifest missing fields:', req, '| icons:', man.icons.map(i => i.sizes + '/' + i.purpose).join(', '));
  // admin/api never cached: fetch them then check cache
  await p.evaluate(() => fetch('/api/decode/' + '1N4BL4BV8LC123456')); await p.waitForTimeout(500);
  console.log('Cached /api or /admin entries:', await p.evaluate(async () => (await (await caches.open('can-tradein-v2')).keys()).filter(r => /\/(api|admin)/.test(r.url)).length));
  // ZXing decode tests using same cleanVin as the app
  const dec = await p.evaluate(async () => { await loadZXing(); const Z = ZXingBrowser, out = {};
    for (const f of ['test-code39.png', 'test-dm.png']) { const r = new Z.BrowserMultiFormatReader(); try { const res = await r.decodeFromImageUrl('/' + f); out[f] = { raw: res.getText(), format: res.getBarcodeFormat(), vin: cleanVin(res.getText()) }; } catch (e) { out[f] = 'ERR ' + e; } }
    out.hasBarcodeFormat = !!Z.BarcodeFormat; return out; });
  console.log('Scan decode:', JSON.stringify(dec));
  // Scan button with no camera -> graceful message
  await p.click('#scanbtn'); await p.waitForTimeout(2500);
  console.log('No-camera fallback msg:', await p.textContent('#vinerr'), '| overlay:', await p.$eval('#scanner', e => e.style.display));
  await p.evaluate(() => { document.getElementById('vinerr').textContent = ''; });
  // screenshots
  await p.evaluate(() => { const a = document.getElementById('a2hs'); a.style.display = 'flex'; document.getElementById('a2hsbtn').style.display = ''; });
  await p.screenshot({ path: S + 'main.png', fullPage: false });
  await p.screenshot({ path: S + 'scan-vin-button.png', clip: { x: 0, y: 160, width: 420, height: 380 } });
  await p.evaluate(() => document.getElementById('a2hs').style.display = 'none');
  await p.evaluate(() => { document.getElementById('scanner').style.display = 'flex'; });
  await p.screenshot({ path: S + 'scanner-overlay.png' }); await p.evaluate(() => stopScan());
  await p.fill('#vin', VIN); await p.waitForSelector('#veh b', { timeout: 15000 });
  await p.fill('#mi', '62000'); await p.fill('#zip', '10704'); await p.click('.cond[data-k=good]');
  await p.fill('#nm', 'Alex Rivera'); await p.fill('#ph', '914-555-0142'); await p.fill('#em', 'alex@example.com');
  await p.screenshot({ path: S + 'form-filled.png', fullPage: true });
  await p.click('#go'); await p.waitForSelector('#result .range', { timeout: 15000 }); await p.click('summary');
  await p.screenshot({ path: S + 'result.png', fullPage: true }); console.log('Result:', await p.textContent('.range'));
  const ios = await b.newPage({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await ios.goto('http://localhost:8080'); await ios.waitForTimeout(2000); console.log('iOS hint:', await ios.textContent('#a2hstxt'), await ios.$eval('#a2hs', e => e.style.display));
  await ios.screenshot({ path: S + 'ios-install-hint.png' });
  const pa = await b.newPage({ httpCredentials: { username: 'admin', password: 'changeme' }, viewport: { width: 1280, height: 600 } });
  await pa.goto('http://localhost:8080/admin'); await pa.screenshot({ path: S + 'admin.png', fullPage: true });
  await b.close(); fs.unlinkSync(__dirname + '/../public/test-code39.png'); fs.unlinkSync(__dirname + '/../public/test-dm.png');
})().catch(e => { console.error(e); process.exit(1); });
