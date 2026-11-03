// Test : scores réels ESPN (réponse simulée, noms d'équipes au format ESPN) → 🏁 Résultats pré-rempli.
// Usage : node tests/espn.cjs <sauvegarde.json> [dossier-captures]
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state, out = process.argv[3];
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
const ev = (date, h, a, sh, sa, done = true) => ({date, status:{type:{completed:done, state:done ? 'post' : 'in'}}, competitions:[{competitors:[
  {homeAway:'home', score:String(sh), team:{displayName:h, shortDisplayName:h.split(' ')[0]}}, {homeAway:'away', score:String(sa), team:{displayName:a, shortDisplayName:a.split(' ')[0]}}]}]});
const UCL = {events:[
  ev('2026-11-03T17:45Z', 'Galatasaray', 'VfB Stuttgart', 1, 1),
  ev('2026-11-03T17:45Z', 'Shakhtar Donetsk', 'Sporting CP', 0, 1),
  ev('2026-11-03T20:00Z', 'Bodø/Glimt', 'Lille OSC', 0, 0),
  ev('2026-11-03T20:00Z', 'Villarreal', 'Paris Saint-Germain', 1, 2),
  ev('2026-11-04T17:45Z', 'AEK Athens', 'Real Madrid', 0, 0, false)]};
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  const ctx = await b.newContext({viewport:{width:412,height:900}, deviceScaleFactor:2, colorScheme:'dark', timezoneId:'Europe/Paris'});
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  let calls = 0;
  await p.route('https://**/*', r => {
    const u = r.request().url();
    if (/site\.api\.espn\.com/.test(u)){ calls++; return r.fulfill({status:200, contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body:JSON.stringify(/uefa\.champions/.test(u) ? UCL : {events:[]})}); }
    return r.fulfill({status:404, body:'{}'});
  });
  await p.clock.install({time:new Date('2026-11-03T23:50:00+01:00')});
  await p.addInitScript(s => { if (localStorage.getItem('mpp-esperance-v2')) return; s = JSON.parse(JSON.stringify(s)); s.mode = 'ldc';
    s.data.ldc.forEach(m => { delete m.qr; delete m.score; }); if (s.bDel) s.bDel.ldc = []; s.bilans.ldc = s.bilans.ldc.filter(b => b.jn !== 4); localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); }, st);
  await p.goto(APP); await p.clock.runFor(3000);
  const sc = await p.evaluate(() => JSON.parse(localStorage.getItem('mpp-esperance-v2')).data.ldc.filter(m => m.score).map(m => m.home + ' ' + m.score.h + '-' + m.score.a));
  console.log(sc);
  ok(calls >= 1, 'ESPN appelé au démarrage (' + calls + ' appel)');
  ok(sc.length === 4 && sc.includes('Shakhtar 0-1') && sc.includes('Bodo/Glimt 0-0'), '4 scores trouvés malgré les noms ESPN (Bodø, Sporting CP, PSG…), match pas fini ignoré');
  await p.click('#qrOpen'); await p.waitForTimeout(300);
  const rows = await p.$$eval('#qrList .qrrow', r => r.map(x => ({t:x.innerText.replace(/\n/g, ' '), ok:x.querySelector('[data-qf="ok"]').classList.contains('on'), ex:x.querySelector('[data-qf="ex"]').classList.contains('on')})));
  rows.forEach(r => console.log(r.ok ? '✓' : '✗', r.ex ? '🎯' : '  ', r.t));
  const R = n => rows.find(r => new RegExp(n).test(r.t));
  ok(R('Galatasaray') && !R('Galatasaray').ok && /score réel 1-1 · ESPN/.test(R('Galatasaray').t), 'Galatasaray (prono 2-1, réel 1-1) : ✗ pré-rempli');
  ok(R('Villarreal') && R('Villarreal').ok && R('Villarreal').ex, 'Villarreal (prono 1-2, réel 1-2) : ✓ 🎯 pré-remplis');
  ok(R('Bodo') && !R('Bodo').ok, 'Bodo/Glimt (réel 0-0) : ✗');
  ok(R('Barcelona') && !R('Barcelona').ok && /score réel \? ✎/.test(R('Barcelona').t), 'Barcelona sans score ESPN : à remplir à la main');
  if (out) await p.locator('#qrSheet').screenshot({path:out + '/espn.png'});
  await p.click('#qrSave'); await p.waitForTimeout(300);
  const bl = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('mpp-esperance-v2')); const b = s.bilans.ldc.find(x => x.jn === 4); return b && b.matches.filter(m => m.mine).map(m => m.home + ' ' + (m.real.h == null ? 'o' + m.real.o : m.real.h + '-' + m.real.a) + ' ' + m.mine.gain); });
  console.log(bl);
  ok(bl && bl.includes('Galatasaray 1-1 0') && bl.includes('Villarreal 1-2 ' + (68 + 20)), 'bilan : scores réels enregistrés, gain avec bonus 20 par défaut');
  ok(!errs.length, 'pas d\'erreur JS ' + (errs[0] || ''));
  await b.close();
  console.log(fails ? fails + ' échec(s)' : 'Tout est bon'); process.exit(fails ? 1 : 0);
})();
