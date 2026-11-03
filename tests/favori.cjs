// Test : ligne « face au favori » dans les bilans, recalculée à la main et comparée à l'affichage.
// Usage : node tests/favori.cjs <sauvegarde.json> [dossier-captures]
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state, out = process.argv[3];
const FROM = {l1:6, l2:8, ldc:2};
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
const outOf = (h, a) => h > a ? 0 : h === a ? 1 : 2;
function expected(md){
  let fav = 0, me = 0, n = 0;
  (st.bilans[md] || []).filter(b => !b.partial && b.jn >= FROM[md]).forEach(b => b.matches.forEach(m => {
    const mi = m.mine; if (!m.real || !mi || !m.pts || !m.odds || !m.odds.every(x => +x > 1)) return;
    let f = 0; m.odds.forEach((x, k) => { if (+x < +m.odds[f]) f = k; });
    const oMe = outOf(mi.ph, mi.pa);
    let ro = m.real.h == null ? (m.real.o === undefined ? -1 : m.real.o) : outOf(m.real.h, m.real.a);
    if (ro < 0 && oMe === f) ro = -2; if (ro === -1) return;
    n++; if (ro === f) fav += +m.pts[f] || 0; if (ro === oMe) me += +mi.cote || +m.pts[oMe] || 0;
  }));
  return {n, fav:Math.round(fav), me:Math.round(me)};
}
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  for (const md of ['l1', 'l2', 'ldc']){
    const ctx = await b.newContext({viewport:{width:412,height:900}, deviceScaleFactor:2, colorScheme:'dark', timezoneId:'Europe/Paris'});
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(([s, md]) => { s = JSON.parse(JSON.stringify(s)); s.mode = md; localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); }, [st, md]);
    await p.goto(APP); await p.waitForTimeout(800);
    await p.click('#viewSw [data-view="bilans"]'); await p.waitForTimeout(400);
    const txt = await p.evaluate(() => { const d = [...document.querySelectorAll('.bstats > div')].find(x => /face au favori/.test(x.innerText)); return d ? d.innerText.replace(/\n/g, ' ') : null; });
    const e = expected(md);
    console.log(md.toUpperCase(), '→', txt);
    ok(!errs.length, md + ' : pas d\'erreur JS');
    if (!e.n) ok(txt === null, md + ' : pas de ligne sans journée JKD+');
    else {
      ok(!!txt, md + ' : ligne affichée');
      ok(txt && txt.includes('tu aurais eu ' + e.fav + ' pts') && txt.includes('tu en as eu ' + e.me) && txt.includes('mêmes ' + e.n + ' matchs'), md + ' : chiffres justes (favori ' + e.fav + ', toi ' + e.me + ', ' + e.n + ' matchs)');
      if (out && txt){ const el = p.locator('.bstats > div', {hasText:'face au favori'}); await el.screenshot({path:out + '/favori-' + md + '.png'}); }
    }
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' échec(s)' : 'Tout est bon'); process.exit(fails ? 1 : 0);
})();
