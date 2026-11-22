// Test : la tablette (restée en veille, puis scores ESPN trouvés au réveil) ne doit pas écraser
// le résultat noté et les cotes plus récentes faits sur le téléphone.
// Usage : node tests/synchro-fusion.cjs <sauvegarde.json>
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state;
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
(async () => {
  const md = ['l1', 'l2', 'ldc'].find(k => (st.data[k] || []).length);
  if (!md){ console.log('IGNORÉ  aucun match'); process.exit(0); }
  const base = Date.parse('2026-11-22T10:00:00Z');
  // Téléphone (gist) : résultat noté + cotes à 15h
  const phone = JSON.parse(JSON.stringify(st)); delete phone.mode;
  const m0 = phone.data[md][0];
  m0.qr = {ok:true, ex:true, bonus:30, x2:false, at:'2026-11-22T16:00:00Z', mine:{ph:1, pa:0}, real:{h:1, a:0}};
  m0.snap = Object.assign({}, m0.snap || {}, {odds:[2.5, 3.3, 2.9], at:'2026-11-22T14:00:00Z'}); m0.odds = ['2.500', '3.300', '2.900'];
  phone.dataAt = Object.assign({}, phone.dataAt, {[md]:base + 3600e3});
  const gist = {files:{'jkd-sync.json':{content:JSON.stringify({app:'jkd', at:base + 3600e3, dev:'téléphone', state:phone})}}};
  let patched = null;
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  const p = await (await b.newContext({timezoneId:'Europe/Paris'})).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://**/*', r => {
    const u = r.request().url();
    if (/api\.github\.com\/gists\/G1/.test(u)){
      if (r.request().method() === 'PATCH'){ patched = JSON.parse(r.request().postData()); return r.fulfill({status:200, contentType:'application/json', body:'{}'}); }
      return r.fulfill({status:200, contentType:'application/json', body:JSON.stringify(gist)});
    }
    r.fulfill({status:404, body:'{}'});
  });
  await p.clock.install({time:new Date('2026-11-22T19:30:00+01:00')});
  await p.addInitScript(([s, md, base]) => { if (localStorage.getItem('mpp-esperance-v2')) return;
    s = JSON.parse(JSON.stringify(s)); s.mode = md;
    const m = s.data[md][0]; delete m.qr; m.snap = Object.assign({}, m.snap || {}, {odds:[2.1, 3.4, 3.5], at:'2026-11-22T09:00:00Z'}); m.odds = ['2.100', '3.400', '3.500'];
    // tablette : modifiée après la dernière synchro (ex. scores au réveil), compétition « plus récente »
    s.savedAt = base + 7200e3; s.dataAt = Object.assign({}, s.dataAt, {[md]:base + 7200e3});
    localStorage.setItem('mpp-esperance-v2', JSON.stringify(s));
    localStorage.setItem('mpp-gh-token', 'ghp_TEST'); localStorage.setItem('mpp-gist-id', 'G1'); localStorage.setItem('mpp-sync-at', String(base));
  }, [st, md, base]);
  await p.goto(APP); await p.clock.runFor(4000); await p.waitForTimeout(500); await p.clock.runFor(4000);
  const m = await p.evaluate(md => JSON.parse(localStorage.getItem('mpp-esperance-v2')).data[md][0], md);
  ok(m.qr && m.qr.at === '2026-11-22T16:00:00Z' && m.qr.mine && m.qr.mine.ph === 1, 'résultat noté sur le téléphone récupéré');
  ok(m.snap && m.snap.at === '2026-11-22T14:00:00Z' && m.odds[0] === '2.500', 'cotes plus récentes du téléphone récupérées');
  ok(!!patched, 'état fusionné renvoyé au gist');
  ok(!errs.length, 'aucune erreur JS ' + errs.join(' | '));
  await b.close(); process.exit(fails ? 1 : 0);
})();
