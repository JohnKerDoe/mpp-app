// Test : des matchs importés sans numéro de journée (cas L2 J12, 6 matchs du vendredi)
// doivent quand même entrer dans le bilan rapide de la journée principale de l'onglet.
// Usage : node tests/journee-sans-numero.cjs <sauvegarde.json>
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state;
if (!st.data.l2 || st.data.l2.length < 7){ console.log('IGNORÉ  pas assez de matchs L2 dans cette sauvegarde'); process.exit(0); }
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  const p = await (await b.newContext({timezoneId:'Europe/Paris'})).newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://**/*', r => r.fulfill({status:404, body:'{}'}));
  await p.clock.install({time:new Date('2026-11-08T09:00:00+01:00')});
  await p.addInitScript(s => { if (localStorage.getItem('mpp-esperance-v2')) return; s = JSON.parse(JSON.stringify(s)); s.mode = 'l2';
    const d = s.data.l2, vend = new Date('2026-11-06T19:00:00Z').toISOString();
    // 6 matchs finis, résultat noté, sans journée + 3 avec J12
    d.forEach((m, i) => { m.ts = i < 6 ? vend : '2026-11-07T13:00:00Z'; if (i < 6) delete m.jn; else m.jn = 12; m.score = {h:1, a:0, src:'espn', at:'x'};
      m.qr = {ok:i % 2 === 0, ex:false, bonus:0, x2:false, at:'2026-11-07T21:10:00Z', real:{h:1, a:0}}; });
    s.bilans.l2 = (s.bilans.l2 || []).filter(x => x.jn !== 12); if (s.bDel) s.bDel.l2 = [];
    localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); }, st);
  await p.goto(APP); await p.clock.runFor(3000);
  const bl = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('mpp-esperance-v2')); return (s.bilans.l2 || []).find(x => x.jn === 12); });
  const n = st.data.l2.length;
  ok(bl && bl.matches.length === n, 'bilan J12 : ' + (bl ? bl.matches.length : 0) + ' matchs sur ' + n);
  ok(bl && !bl.partial, 'bilan J12 complet (pas partiel)');
  ok(!errs.length, 'aucune erreur JS ' + errs.join(' | '));
  await b.close(); process.exit(fails ? 1 : 0);
})();
