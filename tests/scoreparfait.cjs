// Test : bloc « face à Score Parfait » des bilans (chiffres attendus = calcul fait à part le 6/11), ligne Score Parfait sur les cartes.
// Usage : node tests/scoreparfait.cjs <sauvegarde.json>
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state;
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  const out = {};
  for (const md of ['l1', 'l2', 'ldc']){
    const ctx = await b.newContext({viewport:{width:412,height:900}, colorScheme:'dark', timezoneId:'Europe/Paris'});
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.route('https://**/*', r => r.fulfill({status:404, body:'{}'}));
    await p.addInitScript(([s, md]) => { if (localStorage.getItem('mpp-esperance-v2')) return; s = JSON.parse(JSON.stringify(s)); s.mode = md; localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); }, [st, md]);
    await p.goto(APP); await p.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.hidden || getComputedStyle(sp).display === 'none' || getComputedStyle(sp).pointerEvents === 'none'; }, null, {timeout:8000}).catch(() => {}); await p.waitForTimeout(400);
    await p.click('#viewSw [data-view="bilans"]', {force:true}); await p.waitForSelector('.bstats .fav', {timeout:5000}).catch(() => {});
    out[md] = await p.evaluate(() => { const d = [...document.querySelectorAll('.bstats .fav')].find(x => /Score Parfait/.test(x.innerText)); return d ? d.innerText.replace(/\s+/g, ' ') : null; });
    console.log(md, out[md]);
    ok(!errs.length, md + ' : pas d\'erreur JS ' + (errs[0] || ''));
    await ctx.close();
  }
  if (JSON.stringify(st).includes('"src":"espn"')){   // chiffres attendus : sauvegarde du 4/11 avec les scores ESPN
    ok(/Ancienne méthode J1–J5 : \+96 pts · toi 1499, Score Parfait 1403 sur 42 matchs/.test(out.l1 || ''), 'L1 ancienne méthode : +96 (toi 1 499, SP 1 403, 42 matchs)');
    ok(/JKD\+ J6–J9 : -117 pts · toi 1391, Score Parfait 1508 sur 35 matchs/.test(out.l1 || ''), 'L1 JKD+ : −117 (toi 1 391, SP 1 508, 35 matchs)');
    ok(/JKD\+ J8–J11 : \+5 pts/.test(out.l2 || '') && /Ancienne méthode J3–J7 : \+196 pts/.test(out.l2 || ''), 'L2 : +196 puis +5');
    ok(/Ancienne méthode J1 : -42 pts/.test(out.ldc || ''), 'LdC J1 : −42');
  }
  await b.close();
  console.log(fails ? fails + ' échec(s)' : 'Tout est bon'); process.exit(fails ? 1 : 0);
})();
