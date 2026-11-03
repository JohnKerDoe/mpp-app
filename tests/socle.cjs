// Test de base : l'appli s'ouvre sans erreur sur les trois compétitions, avec ta sauvegarde,
// et les garde-fous déjà corrigés ne reviennent pas.
// Usage : node tests/socle.cjs <sauvegarde.json>
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state;
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
async function page(b, md, time){
  const ctx = await b.newContext({viewport:{width:412,height:900}, colorScheme:'dark', timezoneId:'Europe/Paris'});
  const p = await ctx.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
  await p.route('https://**/*', r => r.fulfill({status:404, body:'{}'}));   // aucun appel réseau réel
  await p.clock.install({time:new Date(time)});
  await p.addInitScript(([s, md]) => { if (localStorage.getItem('mpp-esperance-v2')) return; s = JSON.parse(JSON.stringify(s)); s.mode = md; localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); }, [st, md]);
  await p.goto(APP); await p.clock.runFor(3000);
  return [p, ctx];
}
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  for (const md of ['l1', 'l2', 'ldc']){
    const [p, ctx] = await page(b, md, '2026-11-03T12:00:00+01:00');
    const r = await p.evaluate(() => ({
      rows:document.querySelectorAll('#recapList li[data-k]').length,
      top:!!document.querySelector('.pbar'),
      mod:document.body.innerText.match(/prono[s]? modifié[s]?/i) ? 1 : 0 }));
    const n = (st.data[md] || []).length;
    ok(!p.errs.length, md + ' : ouverture sans erreur JS ' + (p.errs[0] || ''));
    ok(r.rows === n, md + ' : ' + r.rows + ' matchs dans le récap (' + n + ' dans la sauvegarde)');
    // ouvrir un match puis revenir
    if (r.rows){
      await p.click('#recapList li[data-k]'); await p.waitForTimeout(300);
      ok(!p.errs.length, md + ' : fiche d\'un match ouverte sans erreur');
      await p.reload(); await p.clock.runFor(2000);
    }
    // page Bilans
    await p.click('#viewSw [data-view="bilans"]'); await p.waitForTimeout(300);
    const nb = await p.evaluate(() => document.querySelectorAll('#bList [data-bshare]').length);
    ok(!p.errs.length && nb === (st.bilans[md] || []).length, md + ' : bilans affichés (' + nb + ')');
    await ctx.close();
  }
  // Le jeton GitHub ne doit jamais être effacé par « Enregistrer » avec un champ vide
  const [p, ctx] = await page(b, 'l1', '2026-11-03T12:00:00+01:00');
  await p.evaluate(() => { localStorage.setItem('mpp-gh-token', 'ghp_TEST'); document.getElementById('ghSave').click(); });
  await p.waitForTimeout(200);
  ok(await p.evaluate(() => localStorage.getItem('mpp-gh-token')) === 'ghp_TEST', 'jeton GitHub conservé après « Enregistrer » vide');
  // La sauvegarde exportée ne contient ni clés API ni jeton
  const keys = await p.evaluate(() => Object.keys(localStorage).filter(k => /key|token/i.test(k)));
  const dump = await p.evaluate(() => localStorage.getItem('mpp-esperance-v2'));
  ok(!/ghp_|github_pat_/.test(dump), 'aucun jeton dans les données sauvegardées (clés à part : ' + keys.join(', ') + ')');
  await ctx.close();
  await b.close();
  console.log(fails ? fails + ' échec(s)' : 'Tout est bon'); process.exit(fails ? 1 : 0);
})();
