// Test : page 🏆 Ligue avec un classement fictif (8 joueurs, 6 journées), saisie d'une journée, statistiques.
// Usage : node tests/ligue.cjs <sauvegarde.json> [dossier-captures]
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state, out = process.argv[3];
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
const P = ['Toi', 'Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Fox', 'Golf'];
const pts = [[380,410,350,300,330,290,360,310],[420,300,390,350,280,330,300,340],[350,380,400,320,360,300,310,290],[400,360,330,380,300,350,290,330],[360,420,310,340,390,280,330,300]];
const league = {me:'Toi', j:{}, seed:1}, tot = {};
pts.forEach((r, k) => { const rows = {}; P.forEach((n, i) => { tot[n] = (tot[n] || 0) + r[i]; rows[n] = {t:tot[n], p:k === 0 ? r[i] : null}; }); league.j[k + 1] = {at:'2026-10-0' + (k + 1) + 'T10:00:00Z', rows}; });
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  const ctx = await b.newContext({viewport:{width:412,height:900}, deviceScaleFactor:2, colorScheme:'dark', timezoneId:'Europe/Paris'});
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.route('https://**/*', r => r.fulfill({status:404, body:'{}'}));
  await p.addInitScript(([s, lg]) => { if (localStorage.getItem('mpp-esperance-v2')) return; s = JSON.parse(JSON.stringify(s)); s.mode = 'l2'; s.league = {l2:lg}; localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); }, [st, league]);
  await p.goto(APP); await p.waitForTimeout(800);
  await p.click('#viewSw [data-view="ligue"]'); await p.waitForTimeout(300);
  const t = await p.textContent('#lgBody');
  ok(!errs.length, 'pas d\'erreur JS ' + (errs[0] || ''));
  // Toi après J5 : 380+420+350+400+360 = 1910
  ok(/Classement · J5/.test(t), 'classement de la J5 affiché');
  ok(await p.$$eval('#lgBody .fchart', x => x.length) >= 3, 'courbes affichées (course, rang, moyenne)');
  ok(/Ton rival direct/.test(t) && /Journées gagnées/.test(t) && /Projection fin de saison/.test(t) && /Podium de la J5/.test(t), 'rival, victoires, projection, podium');
  // points de la J2 calculés par différence : Toi 420
  const myRow = await p.evaluate(() => { const tr = document.querySelector('#lgBody .lgt tr.me'); return tr ? [...tr.children].map(td => td.textContent) : null; });
  console.log(myRow);
  ok(myRow && myRow[2] === '360' && /1\s?910/.test(myRow[3]), 'ta ligne : J5 = 360 (calculé par différence), total 1 910');
  if (out) await p.locator('#ligueView').screenshot({path:out + '/ligue.png'});
  // Saisie de la J6
  await p.click('#lgAdd'); await p.waitForTimeout(200);
  ok(await p.inputValue('#lgJn') === '6', 'nouvelle saisie : J6 proposée');
  const rows = await p.$$('#lgEdit input[data-lf="t"]');
  for (let i = 0; i < rows.length; i++) await rows[i].fill(String(2000 + i * 10));
  await p.click('#lgSave'); await p.waitForTimeout(200);
  ok(/J6 enregistré \(8 joueurs\)/.test(await p.textContent('#lgMsg')), 'J6 enregistrée');
  ok(/Classement · J6/.test(await p.textContent('#lgBody')), 'classement passé à la J6');
  ok(!errs.length, 'toujours pas d\'erreur JS ' + (errs[0] || ''));
  // LdC : classement LIGUEDECH J1–J4 ajouté tout seul (points de journée seulement)
  await p.click('.tabs [data-mode="ldc"], [role="tab"][data-mode="ldc"]').catch(async () => { await p.evaluate(() => { const t = [...document.querySelectorAll('button, a')].find(x => x.textContent.trim() === 'LdC'); t && t.click(); }); });
  await p.waitForTimeout(300);
  const tl = await p.evaluate(() => [...document.querySelectorAll('#lgBody .lgt')][0]?.innerText.replace(/\s+/g, ' '));
  console.log('LdC :', tl);
  ok(tl && /1 NewTeamFC 1\s?056 3\s?620/.test(tl) && /5 JeanChristo#2KN9 586 2\s?508/.test(tl), 'LdC : classement J4 cumulé (NewTeamFC 1er, 3 620)');
  if (out) await p.locator('#ligueView').screenshot({path:out + '/ligue-ldc.png'});
  ok(!errs.length, 'LdC : pas d\'erreur JS ' + (errs[0] || ''));
  // L2 : FUFUFU LIGUE2 J1–J11 ajoutée toute seule (état sans ligue)
  const c2 = await b.newContext({viewport:{width:412,height:900}, colorScheme:'dark', timezoneId:'Europe/Paris'});
  const q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.route('https://**/*', r => r.fulfill({status:404, body:'{}'}));
  await q.addInitScript(s => { if (localStorage.getItem('mpp-esperance-v2')) return; s = JSON.parse(JSON.stringify(s)); s.mode = 'l2'; delete s.league; localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); }, st);
  await q.goto(APP); await q.waitForTimeout(800);
  await q.click('#viewSw [data-view="ligue"]'); await q.waitForTimeout(300);
  const t2 = await q.evaluate(() => document.querySelector('#lgBody .lgt').innerText.replace(/\s+/g, ' '));
  console.log('L2 :', t2);
  ok(/1 NewTeamFC 415 4\s?641/.test(t2) && /Cuitass 137 2\s?557/.test(t2) && /PSGsansMbappe 448 1\s?465/.test(t2), 'L2 : classement J11 (NewTeamFC 4 641, Cuitass 2 557, PSGsansMbappe 1 465)');
  // L1 : LABEXIALIGUE1 J1–J9
  await q.evaluate(() => { const t = [...document.querySelectorAll('button, a')].find(x => x.textContent.trim() === 'L1'); t && t.click(); }); await q.waitForTimeout(300);
  const t1 = await q.evaluate(() => document.querySelector('#lgBody .lgt').innerText.replace(/\s+/g, ' '));
  console.log('L1 :', t1);
  ok(t1.includes('1 NewTeamFC▲1 415 3') && /3\s?261/.test(t1), 'L1 : classement J9 (NewTeamFC 1er, 3 261)');
  await c2.close();
  ok(!errs.length, 'L2 : pas d\'erreur JS ' + (errs[0] || ''));
  await b.close();
  console.log(fails ? fails + ' échec(s)' : 'Tout est bon'); process.exit(fails ? 1 : 0);
})();
