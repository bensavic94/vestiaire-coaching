const fs = require('fs');
const src = fs.readFileSync(__dirname + '/template.html','utf8');
const coach = fs.readFileSync(__dirname + '/guides.js','utf8') + '\n' + fs.readFileSync(__dirname + '/coach.js','utf8'), save = fs.readFileSync(__dirname + '/save.js','utf8');
const pStart = src.indexOf('const P = {'), pEnd = src.indexOf('\nconst ORDER');
const P = Function(src.slice(pStart, pEnd) + '\nreturn P;')();
const PERSO = require(__dirname + '/faq-perso.js');
for (const k of ['aya','camelia']) P[k].faq = PERSO[k];
// Aya : valeurs du questionnaire
P.aya.w0 = 76; P.aya.goal = 61;
P.aya.note.p = P.aya.note.p.replace('62 kg','61 kg');
P.aya.profil = "Profil : débutante, ancien poids max 108 kg (déjà −30 kg), plus bas 70 kg. Veut perdre du gras en général (ventre, bras, dos) et prendre un peu de muscle aux fessiers et cuisses ; haut du corps déjà fort. Marche au quotidien, disponible tous les jours, dort 8 h, mange équilibré 2 à 3 repas. Très motivée.";
P.camelia.profil = "Profil : 3 ans de pratique, aime le cardio sur tapis incliné, a un peu de mal dans les escaliers (souffle). Marche ~5 000 pas/jour, dort moins de 8 h en ce moment, essaie de manger 1 500 kcal mais a repris du poids (ancien 90 kg, descendue à 68 kg). Aime sa morphologie, ne veut pas développer le bas du corps. Essayage de robe de mariée début avril 2027, mariage le 5 mai 2027 : retouches légères possibles, pas de grosses. Priorité : revenir au moins à 68 kg.";
const css = `
.who-tag{font-weight:700; color:var(--muted); font-size:14px}
.pill{margin-left:auto; border:1px solid var(--line); background:var(--surface); border-radius:999px; padding:7px 14px; font-weight:700; font-size:13px; color:var(--muted)}
.pill[data-state="cloud"]{color:var(--good); border-color:color-mix(in srgb, var(--good) 40%, var(--line)); cursor:default}
.lock{position:fixed; inset:0; z-index:95; display:none; align-items:center; justify-content:center; padding:16px; background:color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter:blur(10px)}
.lock.open{display:flex}
.lock .card{width:min(420px,100%); padding:28px; text-align:center}
.lock h2{font-size:26px; margin:8px 0 6px}
.lock p{color:var(--muted); margin:0 0 18px; font-size:14.5px}
.lock input{width:100%; text-align:center; font-family:var(--f-display); font-size:30px; letter-spacing:.35em; padding:12px; border-radius:14px; border:1px solid var(--line); background:var(--surface-2)}
.lock .btn{width:100%; justify-content:center; margin-top:12px; padding:13px}
.lock .later{border:0; background:none; color:var(--muted); margin-top:10px; font-weight:600; text-decoration:underline}
.lock .err{min-height:20px; font-size:13px; color:var(--cam); margin-top:8px}
`;
for (const who of ['aya','camelia']){
  const p = P[who];
  let h = src;
  const rep = (a,b) => { const ok = (a instanceof RegExp) ? a.test(h) : h.includes(a); if (!ok) throw new Error('missing: '+String(a).slice(0,70)); h = h.replace(a,b); };
  rep(/<title>[^<]*<\/title>/, `<title>Le Vestiaire ${who==='aya'?'d’Aya':'de Camélia'}</title>
<meta name="theme-color" content="${who==='aya'?'#0f8a67':'#c3245b'}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Vestiaire">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='16' fill='${who==='aya'?'#0f8a67':'#c3245b'}'/><text x='32' y='44' font-family='Arial' font-weight='900' font-size='34' text-anchor='middle' fill='white'>${who==='aya'?'A':'C'}</text></svg>`)}">`);
  rep('</style>', css + '</style>');
  rep('<body data-who="aya">', `<body data-who="${who}">`);
  rep(/<div class="switch"[\s\S]*?<\/div>\s*<div class="duo"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
      `<span class="who-tag">· ${p.name}</span>
    <button class="pill" id="syncPill" data-state="local">○ Entrer mon code</button>
  </div>`);
  rep('.brand i{display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--aya); box-shadow:12px 0 0 var(--cam); margin-right:12px}',
      '.brand i{display:inline-block; width:10px; height:10px; border-radius:50%; background:var(--acc)}');
  rep('<div class="toast" id="toast"></div>', `<div class="toast" id="toast"></div>
<div class="lock" id="lock" role="dialog" aria-modal="true" aria-labelledby="lockT">
  <form class="card" id="lockForm">
    <div class="eyebrow">Le Vestiaire</div>
    <h2 id="lockT">Bienvenue ${p.name}</h2>
    <p>Entre ton code personnel pour sauvegarder tes pesées et tes séances sur tous tes appareils, et parler au coach.</p>
    <label for="pinIn" class="sr" style="position:absolute;left:-9999px">Code personnel</label>
    <input id="pinIn" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••">
    <div class="err" id="pinErr" aria-live="polite"></div>
    <button class="btn" type="submit">Valider</button>
    <button class="later" type="button" id="lockLater">Plus tard, juste consulter</button>
  </form>
</div>`);
  // données d'une seule fille
  h = h.slice(0, h.indexOf('const P = {')) + 'const P = ' + JSON.stringify({[who]:p}, null, 1) + ';' + h.slice(h.indexOf('\nconst ORDER'));
  rep('const ORDER = ["aya","camelia"];', `const ORDER = [Object.keys(P)[0]];\nconst LSK = "vestiaire-" + ORDER[0];`);
  rep('let who = location.hash === "#camelia" ? "camelia" : "aya";', `const who = ORDER[0];`);
  rep('const mealSel = {aya:[0,0,0,0], camelia:[0,0,0,0]};', `const mealSel = {[who]:[0,0,0,0]};`);
  rep(/let S = \{aya:blank\(\), camelia:blank\(\)\};\ntry \{[^\n]*\n/, `let S = {[who]:blank()};\ntry { const raw = localStorage.getItem(LSK); if (raw) S[who] = Object.assign(blank(), JSON.parse(raw)); } catch(e){}\n`);
  const a = h.indexOf('/* ===================== SAUVEGARDE'), b = h.indexOf('/* ===================== RENDU : EN-TÊTE');
  h = h.slice(0,a) + save + '\n' + h.slice(b);
  rep(/function renderDuo\(\)\{[\s\S]*?\n\}\n/, 'function renderDuo(){}\n');
  rep(/function setWho\(k\)\{[\s\S]*?\n\}\nwindow\.addEventListener\("hashchange"[^\n]*\n/, '');
  rep('if (t.dataset.p){ setWho(t.dataset.p); }\n  else ', '');
  const c = h.indexOf('/* ===================== COACH'), d = h.indexOf('/* ===================== DÉMARRAGE');
  h = h.slice(0,c) + coach + h.slice(d);
  rep(/document\.body\.dataset\.who = who;\ndocument\.querySelectorAll\("\.switch button"\)[^\n]*\nrenderAll\(\); resetChat\(\);/,
      `renderAll(); resetChat(); renderSync();\nloadCloud();\ntry { if (!PIN && !localStorage.getItem(LSK+"-seen")) showLock(); } catch(e){ showLock(); }`);
  rep('Programme établi pour deux femmes de 24 ans en bonne santé.', `Programme personnel de ${p.name}, établi pour une femme de 24 ans en bonne santé.`);
  if (/claude\.use|sample\(/.test(h)) throw new Error('reste claude.use');
  const other = who==='aya' ? 'Camélia' : 'Aya';
  if (h.includes(other)) throw new Error(who + ' mentionne ' + other);
  // découpe : css + app.js communs, index.html propre à chaque fille
  const css0 = h.slice(h.indexOf('<style>')+7, h.indexOf('</style>'));
  const sc0 = h.indexOf('<script>'), sc1 = h.lastIndexOf('</script>');
  let js = h.slice(sc0+8, sc1);
  const pa = js.indexOf('const P = '), pb = js.indexOf('\nconst ORDER');
  const dataJs = js.slice(pa, pb);
  js = js.slice(0, pa) + js.slice(pb);
  let shell = h.slice(0, h.indexOf('<style>')) + '<link rel="stylesheet" href="app.css">' + h.slice(h.indexOf('</style>')+8, sc0)
     + '<script>' + dataJs + '</script>\n<script src="app.js"></script>\n' + h.slice(sc1+9);
  const out = require('path').join(__dirname, '..', who);
  fs.mkdirSync(out, {recursive:true});
  fs.writeFileSync(out + '/index.html', shell);
  fs.writeFileSync(out + '/app.js', js);
  fs.writeFileSync(out + '/app.css', css0);
  console.log('built', who, h.length);
}
