// Test : bloc « face au favori » des bilans (ancienne méthode / JKD+), avec les cotes Betclic ajoutées après coup,
// recalculé à part et comparé à l'affichage, plus la courbe.
// Usage : node tests/favori.cjs <sauvegarde.json> [dossier-captures]
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state, out = process.argv[3];
const FROM = {l1:6, l2:8, ldc:2};
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
const outOf = (h, a) => h > a ? 0 : h === a ? 1 : 2;
function expected(md, stt){
  const r = {old:0, jkd:0, nOld:0, nJkd:0};
  (stt.bilans[md] || []).filter(b => !b.partial).forEach(b => {
    const meth = b.jn < FROM[md] ? 'old' : 'jkd'; let used = false;
    b.matches.forEach(m => {
      const mi = m.mine; let f = m.fav;
      if (!f && m.pts && m.odds && m.odds.every(x => +x > 1)){ let k = 0; m.odds.forEach((x, i) => { if (+x < +m.odds[k]) k = i; }); f = {k, pts:+m.pts[k]}; }
      if (!m.real || !mi || !f) return;
      const oMe = outOf(mi.ph, mi.pa);
      let ro = m.real.h == null ? (m.real.o === undefined ? -1 : m.real.o) : outOf(m.real.h, m.real.a);
      if (ro < 0 && oMe === f.k) ro = -2; if (ro === -1) return;
      used = true;
      if (ro === oMe) r[meth] += +mi.cote || (m.pts && +m.pts[oMe]) || 0;
      if (ro === f.k) r[meth] -= f.pts;
    });
    if (used) r[meth === 'old' ? 'nOld' : 'nJkd']++;
  });
  return {old:Math.round(r.old), jkd:Math.round(r.jkd), nOld:r.nOld, nJkd:r.nJkd};
}
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  for (const md of ['l1', 'l2', 'ldc']){
    const ctx = await b.newContext({viewport:{width:412,height:900}, deviceScaleFactor:2, colorScheme:'dark', timezoneId:'Europe/Paris'});
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('https://**/*', r => r.fulfill({status:404, body:'{}'}));
    await p.addInitScript(([s, md]) => { if (localStorage.getItem('mpp-esperance-v2')) return; s = JSON.parse(JSON.stringify(s)); s.mode = md; localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); }, [st, md]);
    await p.goto(APP); await p.waitForTimeout(800);
    await p.click('#viewSw [data-view="bilans"]'); await p.waitForTimeout(400);
    const txt = await p.evaluate(() => { const d = document.querySelector('.bstats .fav'); return d ? d.innerText.replace(/\n/g, ' ') : null; });
    const e = expected(md, await p.evaluate(() => JSON.parse(localStorage.getItem('mpp-esperance-v2'))));   // après les correctifs de l'appli
    const sg = v => (v >= 0 ? '+' : '') + v + ' pts';
    console.log(md.toUpperCase(), '→', txt, e);
    ok(!errs.length, md + ' : pas d\'erreur JS ' + (errs[0] || ''));
    if (e.nOld) ok(txt && txt.includes('Ancienne méthode') && txt.includes(sg(e.old)), md + ' : ancienne méthode ' + sg(e.old));
    if (e.nJkd) ok(txt && txt.includes('JKD+') && txt.includes(sg(e.jkd)), md + ' : JKD+ ' + sg(e.jkd));
    if (e.nOld + e.nJkd >= 2) ok(await p.$('.bstats .fav svg.fchart path'), md + ' : courbe affichée');
    if (out && txt) await p.locator('.bstats .fav').screenshot({path:out + '/favori-' + md + '.png'});
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' échec(s)' : 'Tout est bon'); process.exit(fails ? 1 : 0);
})();
