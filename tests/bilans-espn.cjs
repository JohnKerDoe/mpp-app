// Test : les bilans notés ✓ / ✗ sans score sont complétés avec ESPN (réponse simulée), sans contredire tes coches.
// Usage : node tests/bilans-espn.cjs <sauvegarde.json>
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state;
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
const outOf = (h, a) => h > a ? 0 : h === a ? 1 : 2;
// Réponse simulée : pour chaque match de bilan sans score, un score cohérent avec ce que tu as coché
const fake = {};
['l1', 'l2', 'ldc'].forEach(md => (st.bilans[md] || []).forEach(b => b.matches.forEach(m => {
  if (!m.real || m.real.h != null || !m.ts || !m.mine) return;
  const oMe = outOf(m.mine.ph, m.mine.pa), want = m.real.o >= 0 ? m.real.o : (oMe + 1) % 3;
  let sc = [[2, 0], [1, 1], [0, 2]][want];
  if (sc[0] === m.mine.ph && sc[1] === m.mine.pa) sc = [[3, 0], [2, 2], [0, 3]][want];
  const d = m.ts.slice(0, 10).replace(/-/g, ''), lg = {l1:'fra.1', l2:'fra.2', ldc:'uefa.champions'}[md];
  (fake[lg + d] = fake[lg + d] || []).push({date:m.ts, status:{type:{completed:true, state:'post'}}, competitions:[{competitors:[
    {homeAway:'home', score:String(sc[0]), team:{displayName:m.home}}, {homeAway:'away', score:String(sc[1]), team:{displayName:m.away}}]}]});
})));
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  const ctx = await b.newContext({viewport:{width:412,height:900}, colorScheme:'dark', timezoneId:'Europe/Paris'});
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://**/*', r => {
    const u = r.request().url(), m = u.match(/soccer\/([a-z.0-9]+)\/scoreboard\?dates=(\d{8})$/);
    if (/espn/.test(u)) return m ? r.fulfill({status:200, contentType:'application/json', body:JSON.stringify({events:fake[m[1] + m[2]] || []})}) : r.fulfill({status:400, body:'{}'});
    return r.fulfill({status:404, body:'{}'});
  });
  await p.clock.install({time:new Date('2026-11-04T00:20:00+01:00')});
  await p.addInitScript(s => { if (localStorage.getItem('mpp-esperance-v2')) return; s = JSON.parse(JSON.stringify(s)); s.mode = 'l1'; localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); }, st);
  await p.goto(APP); await p.clock.runFor(2000);
  const before = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('mpp-esperance-v2')); let n = 0, g = 0; ['l1','l2','ldc'].forEach(md => s.bilans[md].forEach(b => b.matches.forEach(m => { if (m.real && m.real.h == null) n++; if (m.mine) g += m.mine.gain || 0; }))); return {n, g}; });
  await p.click('#viewSw [data-view="bilans"]');
  await p.waitForFunction(() => /score réel ajouté/.test(document.getElementById('bMsg').textContent), null, {timeout:8000}).catch(() => {});
  const after = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('mpp-esperance-v2')); let n = 0, g = 0; ['l1','l2','ldc'].forEach(md => s.bilans[md].forEach(b => b.matches.forEach(m => { if (m.real && m.real.h == null) n++; if (m.mine) g += m.mine.gain || 0; }))); return {n, g}; });
  console.log(await p.textContent('#bMsg'), before, after);
  ok(before.n === 0 ? after.n === 0 : after.n < before.n, 'matchs sans score : ' + before.n + ' → ' + after.n);
  ok(after.g === before.g, 'tes points ne changent pas (' + after.g + ')');
  // Bouton « Chercher les scores réels » : relance à la demande
  await p.click('#bEspn');
  await p.waitForFunction(() => /^ESPN/.test(document.getElementById('bMsg').textContent), null, {timeout:8000}).catch(() => {});
  const msg2 = await p.textContent('#bMsg'); console.log(msg2);
  ok(/^ESPN/.test(msg2), 'bouton 🔎 : message affiché');
  ok(!errs.length, 'pas d\'erreur JS ' + (errs[0] || ''));
  await b.close();
  console.log(fails ? fails + ' échec(s)' : 'Tout est bon'); process.exit(fails ? 1 : 0);
})();
