// Test : lecture d'une capture de l'onglet « Résultats » d'une ligue MPP (texte OCR réel, Tesseract simulé).
// Usage : node tests/ligue-capture.cjs <sauvegarde.json>
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state;
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
// Textes tels que Tesseract les lit sur les vraies captures (L1 J4, LdC J3 : « 5511 Pts », « AT6 Pts »)
const L1J4 = "LABEXIALIGUEI\nClassement Résultats Matchs Palmarés Réglages\nJ.4/ 34\n€ J4 v ?\n4 € -NewTeamFC- 300 Pts\nJoueurs Points\n1 Cuitass @ 467 Pts\n2 a PSGsansMbappe %&; 431 Pts\nran\n3 ae JeanChristo#2KN9 @ 302 Pts\n4\n4 € -NewTeamFC- 300 Pts\n5 a Merenguespagnole “> 180 Pts\nS 0\nMes ligues";
const LDC3 = "LIGUEDECH\nClassement Résultats Matchs Palmarés Réglages\nJ.3/17\n€ J3 v >\n1 a) -NewTeamFC- @f) 719 Pts\nJoueurs Points\n1 €) -NewTeamFC- @i) 719 Pts\n2 Cuitass @ 712 Pts\n° an PSGsansMbappe ©) 5511 Pts\n4 ap Merenguespagnole %) 529 Pts\n-\n5 me JeanChristo#2KN9 @ AT6 Pts\nra\nSs 0\nMes ligues";
async function run(b, md, text, img){
  const ctx = await b.newContext({viewport:{width:412,height:900}, colorScheme:'dark', timezoneId:'Europe/Paris'});
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://**/*', r => r.fulfill({status:404, body:'{}'}));
  await p.addInitScript(([s, md, text]) => {
    window.Tesseract = {createWorker: async () => ({setParameters: async () => {}, recognize: async () => ({data:{text}}), terminate: async () => {}})};
    if (localStorage.getItem('mpp-esperance-v2')) return; s = JSON.parse(JSON.stringify(s)); s.mode = md; delete s.league; localStorage.setItem('mpp-esperance-v2', JSON.stringify(s));
  }, [st, md, text]);
  await p.goto(APP); await p.waitForFunction(() => { const sp = document.getElementById('splash'); return !sp || sp.hidden || getComputedStyle(sp).display === 'none' || getComputedStyle(sp).pointerEvents === 'none'; }, null, {timeout:8000}).catch(() => {}); await p.waitForTimeout(500);
  await p.click('#viewSw [data-view="ligue"]', {force:true}); await p.waitForTimeout(200);
  await p.setInputFiles('#lgFile', img); await p.waitForTimeout(1500);
  if (!(await p.$('#lgJn'))) console.log('MSG', await p.textContent('#lgMsg'), errs);
  const rows = await p.$$eval('#lgEdit .lgin', r => r.slice(1).map(x => [...x.querySelectorAll('input')].slice(0, 3).map(i => i.value)));
  const jn = await p.inputValue('#lgJn'), msg = await p.textContent('#lgMsg');
  return {p, ctx, rows, jn, msg, errs};
}
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  const img = path.resolve(__dirname, '..', 'icon-192.png');
  let r = await run(b, 'l1', L1J4, fs.existsSync(img) ? img : process.argv[2]);
  console.log(r.jn, r.msg, r.rows);
  const P = n => (r.rows.find(x => x[0] === n) || [])[2];
  ok(r.jn === '4', 'L1 : journée 4 lue');
  ok(P('Cuitass') === '467' && P('PSGsansMbappe') === '431' && P('JeanChristo#2KN9') === '302' && P('NewTeamFC') === '300' && P('Merenguespagnole') === '180', 'L1 : 5 joueurs et leurs points (pseudos reconnus, -NewTeamFC- = NewTeamFC)');
  ok(r.rows.filter(x => x[0] === 'NewTeamFC').length === 1, 'L1 : ta ligne en double comptée une fois');
  await r.p.click('#lgSave'); await r.p.waitForTimeout(200);
  ok(/J4 enregistré/.test(await r.p.textContent('#lgMsg')), 'L1 : J4 enregistrée');
  ok(!r.errs.length, 'L1 : pas d\'erreur JS ' + (r.errs[0] || ''));
  await r.ctx.close();
  r = await run(b, 'ldc', LDC3, fs.existsSync(img) ? img : process.argv[2]);
  console.log(r.jn, r.msg, r.rows);
  const Q = n => (r.rows.find(x => x[0] === n) || [])[2];
  ok(r.jn === '3' && Q('PSGsansMbappe') === '551' && Q('JeanChristo#2KN9') === '476' && Q('NewTeamFC') === '719', 'LdC : « 5511 » corrigé en 551, « AT6 » lu 476');
  ok(!/⚠️ Cette capture/.test(r.msg), 'LdC : pas d\'alerte d\'onglet');
  await r.ctx.close();
  r = await run(b, 'l1', LDC3, fs.existsSync(img) ? img : process.argv[2]);
  ok(/Ligue des champions/.test(r.msg), 'capture LdC sur l\'onglet L1 : alerte');
  await r.ctx.close();
  await b.close();
  console.log(fails ? fails + ' échec(s)' : 'Tout est bon'); process.exit(fails ? 1 : 0);
})();
