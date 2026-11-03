// Test : rappel « mets à jour les cotes » sur le prochain match serré.
// Usage : node tests/rappel.cjs <sauvegarde.json> [dossier-captures]
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state, out = process.argv[3];
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
async function run(b, time, lastImp, shot){
  const ctx = await b.newContext({viewport:{width:412,height:900}, deviceScaleFactor:2, colorScheme:'dark', timezoneId:'Europe/Paris'});
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.clock.install({time:new Date(time)});
  await p.addInitScript(([s, li]) => { s = JSON.parse(JSON.stringify(s)); s.mode = 'ldc'; s.lastImport.ldc = li; s.data.ldc[1].odds = ['3.380','3.560','2.230']; /* Shakhtar – Sporting rendu serré (pastille rouge) */ localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); }, [st, lastImp]);
  await p.goto(APP); await p.clock.runFor(3000);
  const r = await p.evaluate(() => [...document.querySelectorAll('#recapList li[data-ko]')].map(li => ({t:li.innerText.split('\n')[0], lv:li.dataset.lv, gap:+li.dataset.gap, warn:li.classList.contains('nxw'), vis:getComputedStyle(li.querySelector('.nxwt')).display !== 'none'})));
  if (shot) await p.locator('#recapList').screenshot({path:shot});
  await ctx.close();
  return {r, errs};
}
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  let x = await run(b, '2026-11-03T18:00:00+01:00', '2026-11-03T08:49:52Z', out && out + '/rappel-on.png');
  console.log(x.r);
  ok(x.errs.length === 0, 'pas d\'erreur JS');
  ok(x.r.length > 0, 'prochains matchs repérés');
  x.r.forEach(m => ok(m.warn === (m.lv === 'r' || (m.lv === 'o' && m.gap < 2)) && m.warn === m.vis, 'rappel cohérent : ' + m.t + ' (' + m.lv + ', écart ' + m.gap.toFixed(1) + ')'));
  ok(x.r.some(m => m.warn && /Shakhtar/.test(m.t)), 'rappel sur le match rouge (Shakhtar) à 45 min, cotes de 9 h à 45 min avec cotes de 9 h');
  x = await run(b, '2026-11-03T18:00:00+01:00', '2026-11-03T16:30:00Z');
  ok(x.r.every(m => !m.warn), 'pas de rappel si cotes de 30 min');
  x = await run(b, '2026-11-03T17:30:00+01:00', '2026-11-03T08:49:52Z');
  ok(x.r.every(m => !m.warn), 'pas de rappel à 1 h 15 du match');
  await b.close();
  console.log(fails ? fails + ' échec(s)' : 'Tout est bon'); process.exit(fails ? 1 : 0);
})();
