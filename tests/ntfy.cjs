// Test : rappels ntfy 45 min et 10 min avant chaque créneau (ntfy.sh simulé), sans doublon à la réouverture.
// Usage : node tests/ntfy.cjs <sauvegarde.json>
const { chromium } = require(process.env.PW || '/home/claude/.npm-global/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const st = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).state;
let fails = 0; const ok = (c, msg) => { console.log((c ? 'OK  ' : 'ÉCHEC ') + msg); if (!c) fails++; };
(async () => {
  const b = await chromium.launch({executablePath:process.env.PW_CHROME || '/opt/pw-browsers/chromium'});
  const ctx = await b.newContext({viewport:{width:412,height:900}, colorScheme:'dark', timezoneId:'Europe/Paris'});
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const posts = [];
  await p.route('https://**/*', r => { const u = r.request().url();
    if (/ntfy\.sh/.test(u)){ posts.push({u, body:r.request().postData()}); return r.fulfill({status:200, headers:{'access-control-allow-origin':'*'}, body:'{}'}); }
    return r.fulfill({status:404, body:'{}'}); });
  await p.clock.install({time:new Date('2026-11-07T13:00:00+01:00')});
  await p.addInitScript(s => { if (localStorage.getItem('mpp-esperance-v2')) return; s = JSON.parse(JSON.stringify(s)); s.mode = 'l1';
    s.data.l1 = [
      {day:'Samedi 7 novembre', time:'17h00', home:'Toulouse', away:'Strasbourg', pts:['80','118','105'], odds:['2.20','3.50','3.30'], crowd:['','',''], jn:10, ts:'2026-11-07T16:00:00Z'},
      {day:'Samedi 7 novembre', time:'17h00', home:'Paris SG', away:'Troyes', pts:['30','150','190'], odds:['1.20','7.00','12.0'], crowd:['','',''], jn:10, ts:'2026-11-07T16:00:00Z'},
      {day:'Samedi 7 novembre', time:'13h30', home:'Auxerre', away:'Paris FC', pts:['100','115','85'], odds:['3.00','3.40','2.40'], crowd:['','',''], jn:10, ts:'2026-11-07T12:30:00Z'},
      {day:'Samedi 14 novembre', time:'21h00', home:'Lens', away:'Marseille', pts:['80','118','98'], odds:['2.10','3.60','3.40'], crowd:['','',''], jn:11, ts:'2026-11-14T20:00:00Z'}];
    localStorage.setItem('mpp-esperance-v2', JSON.stringify(s)); localStorage.setItem('mpp-ntfy-on', '1'); localStorage.setItem('mpp-ntfy-topic', 'jkd-testtopic01'); }, st);
  await p.goto(APP); await p.clock.runFor(4000); await p.waitForTimeout(500);
  console.log(posts.map(x => decodeURIComponent(x.u.replace(/^.*\?/, '')).slice(0, 90)));
  const at = x => +(x.u.match(/at=(\d+)/) || [])[1];
  const t17 = Date.parse('2026-11-07T16:00:00Z') / 1000, t1330 = Date.parse('2026-11-07T12:30:00Z') / 1000;
  ok(posts.length === 3, '3 rappels : 17h00 (−45 et −10 min), 13h30 (−10 min seulement, −45 déjà passé), rien pour dans 7 jours');
  ok(posts.some(x => at(x) === t17 - 45 * 60) && posts.some(x => at(x) === t17 - 600) && posts.some(x => at(x) === t1330 - 600), 'heures d\'envoi exactes');
  ok(posts.every(x => /ntfy\.sh\/jkd-testtopic01\?/.test(x.u)), 'envoyés sur ton sujet');
  const p17 = posts.find(x => at(x) === t17 - 600);
  ok(p17 && /Toulouse – Strasbourg/.test(p17.body) && /Paris SG – Troyes/.test(p17.body), 'un seul rappel pour les 2 matchs du créneau de 17h00');
  await p.reload(); await p.clock.runFor(4000); await p.waitForTimeout(500);
  ok(posts.length === 3, 'pas de doublon après réouverture');
  ok(!errs.length, 'pas d\'erreur JS ' + (errs[0] || ''));
  await b.close();
  console.log(fails ? fails + ' échec(s)' : 'Tout est bon'); process.exit(fails ? 1 : 0);
})();
