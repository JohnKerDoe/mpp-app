// Test : dans 🏁 Résultats, indiquer un prono joué différent du conseil (ex. 1-1 au lieu de 2-1)
// et vérifier que le bilan rapide compte la bonne cote.
// Usage : node tests/prono-joue.cjs <sauvegarde.json> [dossier-captures]
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state, out = process.argv[3];
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  const ctx = await b.newContext({viewport:{width:412,height:900}, deviceScaleFactor:2, colorScheme:'dark', timezoneId:'Europe/Paris'});
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://**/*', r => r.fulfill({status:404, body:'{}'}));
  await p.clock.install({time:new Date('2026-11-03T21:30:00+01:00')});   // matchs de 18h45 finis
  await p.addInitScript(s => { if (localStorage.getItem('mpp-esperance-v2')) return; s = JSON.parse(JSON.stringify(s)); s.mode = 'ldc';
    s.data.ldc.forEach(m => delete m.qr); s.bilans.ldc = s.bilans.ldc.filter(b => b.jn !== s.data.ldc[0].jn); localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); }, st);
  await p.goto(APP); await p.clock.runFor(3000);
  await p.click('#qrOpen'); await p.waitForTimeout(200);
  const rows = await p.$$eval('#qrList .qrrow', r => r.map(x => x.innerText.replace(/\n/g, ' ')));
  console.log(rows);
  const i = rows.findIndex(t => /Shakhtar/.test(t));
  ok(i >= 0, 'Shakhtar – Sporting dans la fenêtre');
  p.once('dialog', d => d.accept('1-1'));
  await p.click('#qrList .qrrow:nth-child(' + (i + 1) + ') [data-qf="mine"]'); await p.waitForTimeout(200);
  const lbl = await p.textContent('#qrList .qrrow:nth-child(' + (i + 1) + ') [data-qf="mine"]');
  ok(/ton prono 1-1/.test(lbl) && /cote 124/.test(lbl), 'prono joué affiché : ' + lbl);
  await p.click('#qrList .qrrow:nth-child(' + (i + 1) + ') [data-qf="ok"]');
  if (out) await p.locator('.qrsheet, #qrSheet .sheet-in, #qrSheet > *').first().screenshot({path:out + '/prono-joue.png'});
  await p.click('#qrSave'); await p.waitForTimeout(300);
  const bl = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('mpp-esperance-v2')); const b = s.bilans.ldc.find(x => x.src === 'quick'); return b && b.matches.find(m => /Shakhtar/.test(m.home)); });
  console.log(JSON.stringify(bl && {real:bl.real, mine:bl.mine}));
  ok(bl && bl.mine.ph === 1 && bl.mine.pa === 1, 'bilan : ton prono 1-1');
  ok(bl && bl.mine.cote === 124 && bl.mine.gain === 124 && bl.real.o === 1, 'bilan : cote du nul (124) et bon résultat');
  // Effacer le prono joué : retour au conseil
  await p.click('#qrOpen'); await p.waitForTimeout(200);
  p.once('dialog', d => d.accept(''));
  await p.click('#qrList .qrrow:nth-child(' + (i + 1) + ') [data-qf="mine"]'); await p.waitForTimeout(200);
  ok(/^prono \d+-\d+ ✎/.test(await p.textContent('#qrList .qrrow:nth-child(' + (i + 1) + ') [data-qf="mine"]')), 'champ vide : retour au prono conseillé');
  ok(!errs.length, 'pas d\'erreur JS ' + (errs[0] || ''));
  await b.close();
  console.log(fails ? fails + ' échec(s)' : 'Tout est bon'); process.exit(fails ? 1 : 0);
})();
