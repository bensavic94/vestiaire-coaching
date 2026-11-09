
/* ===================== DONNÉES ===================== */
const START = "2026-11-10"; // jour 1 du programme (semaine 1)


const ORDER = [Object.keys(P)[0]];
const LSK = "vestiaire-" + ORDER[0];

/* ===================== ÉTAT ===================== */
const who = ORDER[0];
let tab = "prog";
let phaseSel = null;
let energy = 1; // 0 fatiguée, 1 normale, 2 au top
const mealSel = {[who]:[0,0,0,0]};
const blank = () => ({weights:[], waist:[], done:{}});
let S = {[who]:blank()};
try { const raw = localStorage.getItem(LSK); if (raw) S[who] = Object.assign(blank(), JSON.parse(raw)); } catch(e){}

/* ===================== OUTILS ===================== */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = (n,d=1) => Number(n).toLocaleString("fr-FR",{minimumFractionDigits:d, maximumFractionDigits:d});
const DAY = 864e5;
const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const iso = d => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const parse = s => { const [y,m,d] = s.split("-").map(Number); return new Date(y,m-1,d); };
const weekNo = (d=today()) => Math.max(1, Math.floor((d - parse(START))/ (7*DAY)) + 1);
const dateOfWeek = w => new Date(parse(START).getTime() + w*7*DAY);
const frDate = d => d.toLocaleDateString("fr-FR",{day:"numeric", month:"long"});
const frShort = d => d.toLocaleDateString("fr-FR",{day:"numeric", month:"short"});

function curPhaseIdx(p){ const w = weekNo(); let i = 0; p.phases.forEach((ph,k)=>{ if(w >= ph.from) i = k; }); return i; }
function latestW(k){ const a = S[k].weights; if(!a.length) return P[k].w0; return [...a].sort((x,y)=>x.d.localeCompare(y.d)).at(-1).kg; }
function pct(k){ const p = P[k]; const lost = p.w0 - latestW(k); return Math.max(0, Math.min(100, lost/(p.w0-p.goal)*100)); }
function weekDone(k, w=weekNo()){ return S[k].done["w"+w] || []; }

/* trajectoire : 2 premières semaines plus rapides (eau), puis rythme régulier */
function projAt(p, t){
  let w;
  if (t <= 2) w = p.w0 - t*0.9;
  else {
    const fit = p.deadlines[0] ? (parse(p.deadlines[0].d) - parse(START))/(7*DAY) : Infinity;
    if (t <= fit) w = p.w0 - 1.8 - (t-2)*p.rate;
    else w = p.w0 - 1.8 - (fit-2)*p.rate - (t-fit)*p.rateAfter;
  }
  return Math.max(p.goal, w);
}
function weekWhen(p, kg){ for(let t=0; t<80; t+=0.1){ if(projAt(p,t) <= kg + 1e-9) return t; } return null; }

/* ===================== SAUVEGARDE (Supabase) ===================== */
const CFG = {url:"https://cmnsivebunxyscohsfdp.supabase.co", key:"sb_publishable_SktPKMvnU1Qk0SV4VK97Cg_S5Idojyk"};
let PIN = null, syncState = "local", saveT = null;
try { PIN = localStorage.getItem(LSK+"-pin"); } catch(e){}
async function rpc(fn, args){
  const r = await fetch(CFG.url+"/rest/v1/rpc/"+fn, {method:"POST", headers:{"Content-Type":"application/json", apikey:CFG.key}, body:JSON.stringify(args)});
  if (r.status === 400 || r.status === 401 || r.status === 403){ const e = new Error("code"); e.code = "pin"; throw e; }
  if (!r.ok) throw new Error("net");
  return r.json();
}
function save(k){
  try { localStorage.setItem(LSK, JSON.stringify(S[k])); } catch(e){}
  if (!PIN) return;
  clearTimeout(saveT);
  saveT = setTimeout(async ()=>{
    try { await rpc("coaching_save", {p_athlete:who, p_pin:PIN, p_data:S[who]}); syncState = "cloud"; }
    catch(e){ syncState = e.code === "pin" ? "pin" : "offline"; }
    renderSync();
  }, 600);
}
function renderSync(){
  const el = $("#syncNote"); const pill = $("#syncPill");
  const txt = syncState === "cloud" ? "Synchronisé : tes données te suivent sur tous tes appareils."
    : syncState === "offline" ? "Pas de connexion : enregistré sur cet appareil, synchro au prochain enregistrement."
    : syncState === "pin" ? "Code incorrect : entre ton code pour synchroniser."
    : "Enregistré sur cet appareil seulement. Entre ton code pour synchroniser.";
  if (el) el.textContent = txt;
  if (pill){ pill.textContent = syncState === "cloud" ? "● Synchronisé" : "○ Entrer mon code"; pill.dataset.state = syncState; }
}
async function loadCloud(){
  if (!PIN) { renderSync(); return; }
  try {
    const d = await rpc("coaching_get", {p_athlete:who, p_pin:PIN});
    if (d && (d.weights || d.done)) { S[who] = Object.assign(blank(), d); try { localStorage.setItem(LSK, JSON.stringify(S[who])); } catch(e){} }
    else if (S[who].weights.length || Object.keys(S[who].done).length) { await rpc("coaching_save", {p_athlete:who, p_pin:PIN, p_data:S[who]}); }
    syncState = "cloud"; renderAll(); return true;
  } catch(e){
    if (e.code === "pin"){ forgetPin(); syncState = "pin"; } else syncState = "offline";
    renderSync(); return false;
  }
}
function forgetPin(){ PIN = null; try { localStorage.removeItem(LSK+"-pin"); } catch(e){} renderSync(); }
function showLock(){ $("#lock").classList.add("open"); setTimeout(()=>$("#pinIn").focus(), 50); }
function hideLock(){ $("#lock").classList.remove("open"); try { localStorage.setItem(LSK+"-seen","1"); } catch(e){} }
$("#lockForm").addEventListener("submit", async e=>{
  e.preventDefault(); const v = $("#pinIn").value.replace(/\D/g,""); const err = $("#pinErr");
  if (v.length < 4){ err.textContent = "Ton code fait 6 chiffres."; return; }
  PIN = v; err.textContent = "Vérification…";
  const ok = await loadCloud();
  if (ok){ try { localStorage.setItem(LSK+"-pin", v); } catch(e){} err.textContent = ""; hideLock(); toast("Code accepté, tes données sont synchronisées"); }
  else { PIN = null; err.textContent = syncState === "pin" ? "Ce code ne correspond pas. Réessaie." : "Connexion impossible pour l’instant. Réessaie dans un moment."; }
});
$("#lockLater").addEventListener("click", hideLock);
$("#syncPill").addEventListener("click", ()=>{ if (syncState !== "cloud") showLock(); });

/* ===================== RENDU : EN-TÊTE ===================== */
function renderDuo(){}
function renderHero(){
  const p = P[who]; const cur = latestW(who); const imc = cur/(p.h*p.h);
  const wd = weekDone(who).length;
  let cd = "";
  if (p.deadlines.length){
    cd = '<div class="countdown">' + p.deadlines.map((d,i)=>{
      const n = Math.ceil((parse(d.d)-today())/DAY);
      return `<div class="cd ${i?'alt':''}"><small>${esc(d.label)}</small><b class="num">J-${n}</b><span>${frDate(parse(d.d))}</span></div>`;
    }).join("") + '</div>';
  } else {
    const t = weekWhen(p, p.goal);
    cd = `<div class="countdown"><div class="cd"><small>Objectif ${p.goal} kg</small><b class="num">≈ ${t?frShort(dateOfWeek(t)):"—"}</b><span>au rythme prévu</span></div></div>`;
  }
  $("#hero").innerHTML = `
    <div class="hero-top">
      <div>
        <div class="eyebrow">Semaine ${weekNo()} · ${esc(p.phases[curPhaseIdx(p)].n)}</div>
        <h1>${esc(p.name)}</h1>
        <p class="tag">${esc(p.tagline)}</p>
        <div class="chips">${p.chips.map(c=>`<span class="chip">${esc(c)}</span>`).join("")}</div>
      </div>
      ${cd}
    </div>
    <div class="tiles">
      <div class="tile"><small>Poids actuel</small><b class="num">${fmt(cur)} kg</b><span>IMC ${fmt(imc)}</span></div>
      <div class="tile"><small>Objectif</small><b class="num">${p.goal} kg</b><span>reste ${fmt(Math.max(0,cur-p.goal))} kg</span><div class="prog"><b style="width:${pct(who)}%"></b></div></div>
      <div class="tile"><small>Calories / jour</small><b class="num">${p.kcal.toLocaleString("fr-FR")}</b><span>${p.Pg} g de protéines</span></div>
      <div class="tile"><small>Cette semaine</small><b class="num">${wd} / ${p.freq}</b><span>séances validées</span><div class="prog"><b style="width:${wd/p.freq*100}%"></b></div></div>
    </div>
    <div class="note"><div class="stamp">10<br>ans</div><div><h4>${esc(p.note.t)}</h4><p>${esc(p.note.p)}</p></div></div>`;
}

/* ===================== PROGRAMME ===================== */
function rxFor(e, ph){
  if (e.cardio){
    let s = e.cardio[Math.min(ph, e.cardio.length-1)];
    if (energy === 0) s = s.replace(/(\d+) min/, (m,n)=> Math.max(10, Math.round(n*0.6))+" min");
    return {txt:s, sets:1, rest:0};
  }
  let [sets, reps] = e.p[Math.min(ph, e.p.length-1)];
  if (energy === 0) sets = Math.max(2, sets-1);
  return {txt:`${sets} × ${reps}`, sets, reps, rest:e.r};
}
function renderProg(){
  const p = P[who]; const cur = curPhaseIdx(p); const ph = phaseSel ?? cur;
  const pIdx = Math.min(ph, 2);
  const done = weekDone(who);
  const eNote = ["Version allégée : une série de moins par exercice, cardio raccourci, charges −10 %. Mieux vaut une séance douce qu’une séance sautée.",
                 "Séance normale, comme prévu.",
                 "Tu as de l’énergie : garde le plan et ajoute le finisher bonus en fin de séance (3 × 30 s de montée de genoux / 30 s de repos)."][energy];
  $("#p-prog").innerHTML = `
    <div class="sec-h"><h2>Ta semaine type</h2><p>${p.freq} séances · pas quotidiens : ${esc(p.steps)}</p></div>
    <div class="phases">${p.phases.map((x,i)=>`
      <button class="phase" data-ph="${i}" aria-pressed="${i===ph}">${i===cur?'<span class="now">En cours</span>':''}<small>${esc(x.w)}</small><b>${esc(x.n)}</b></button>`).join("")}
    </div>
    <p class="phase-txt">${esc(p.phases[ph].txt)}</p>
    <div class="energy" role="group" aria-label="Forme du jour">
      <span>Ta forme aujourd’hui</span>
      ${["Fatiguée","Normale","Au top"].map((l,i)=>`<button data-en="${i}" aria-pressed="${i===energy}">${l}</button>`).join("")}
      <em>${eNote}</em>
    </div>
    <div class="sessions">${p.sessions.map((s,si)=>`
      <article class="card sess">
        <div class="sess-h">
          <div class="dayb"><span>${s.day}</span><b>${si+1}</b></div>
          <div><h3>${esc(s.title)}</h3><p>${esc(s.focus)} · ${s.dur}</p></div>
          <div class="sess-act">
            <button class="btn" data-play="${si}">▶ Lancer la séance</button>
            <button class="done-t" data-done="${si}" aria-pressed="${done.includes(si)}" aria-label="Marquer la séance ${si+1} comme faite cette semaine" title="Faite cette semaine">✓</button>
          </div>
        </div>
        <div class="warm"><b>Échauffement :</b> ${esc(s.warm)}</div>
        ${s.ex.map((e,ei)=>{ const r = rxFor(e,pIdx); return `
          <div class="ex ${e.cardio?'cardio':''}">
            <div class="i">${String(ei+1).padStart(2,"0")}</div>
            <div><div class="n">${esc(e.n)}</div><div class="c">${esc(e.c)}</div></div>
            <div class="rx num">${esc(r.txt)}${r.rest?`<small>repos ${r.rest} s</small>`:""}</div>
            ${GUIDE_OF[e.n] ? `<button class="alt how" data-guide="${si}-${ei}" title="Comment faire cet exercice" aria-label="Comment faire : ${esc(e.n)}">?</button>` : "<span></span>"}
            <button class="alt" data-alt="${si}-${ei}" title="Remplacer cet exercice" aria-label="Alternative à ${esc(e.n)}">↻</button>
          </div>`;}).join("")}
      </article>`).join("")}
    </div>`;
}

/* ===================== NUTRITION ===================== */
function donut(p){
  const tot = p.Pg*4 + p.Gg*4 + p.Lg*9; const R = 70, C = 2*Math.PI*R;
  const parts = [[p.Pg*4,"var(--acc)"],[p.Gg*4,"color-mix(in srgb, var(--acc) 45%, var(--surface-2))"],[p.Lg*9,"var(--warn)"]];
  let off = 0;
  const arcs = parts.map(([v,c])=>{ const l = v/tot*C; const s = `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${c}" stroke-width="18" stroke-dasharray="${l-3} ${C-l+3}" stroke-dashoffset="${-off}" transform="rotate(-90 90 90)"/>`; off += l; return s; }).join("");
  return `<svg viewBox="0 0 180 180" width="190" height="190" role="img" aria-label="Répartition des calories">
    <circle cx="90" cy="90" r="${R}" fill="none" stroke="var(--line)" stroke-width="18"/>${arcs}
    <text x="90" y="88" text-anchor="middle" font-family="Syne" font-weight="800" font-size="30" fill="var(--ink)">${p.kcal.toLocaleString("fr-FR")}</text>
    <text x="90" y="110" text-anchor="middle" font-size="12" fill="var(--muted)">kcal / jour</text></svg>`;
}
function renderNut(){
  const p = P[who]; const tot = p.Pg*4+p.Gg*4+p.Lg*9;
  const sel = mealSel[who];
  const sumK = p.meals.reduce((a,m,i)=>a+m.opts[sel[i]].kcal,0);
  const sumP = p.meals.reduce((a,m,i)=>a+m.opts[sel[i]].p,0);
  const marge = p.kcal - sumK;
  const macro = (lab, sub, g, kc, col) => `<div class="mac-row"><div class="lab"><b>${lab}</b><small>${sub}</small></div><div class="bar"><b style="width:${kc/tot*100}%;background:${col}"></b></div><div class="v num">${g} g</div></div>`;
  $("#p-nut").innerHTML = `
    <div class="sec-h"><h2>Ton assiette au quotidien</h2><p>Déficit doux et tenable · eau : ${esc(p.water)} / jour</p></div>
    <div class="nut-top">
      <div class="card ring-card">${donut(p)}</div>
      <div class="card macros">
        ${macro("Protéines","muscle & satiété",p.Pg,p.Pg*4,"var(--acc)")}
        ${macro("Glucides","énergie des séances",p.Gg,p.Gg*4,"color-mix(in srgb, var(--acc) 45%, var(--surface-2))")}
        ${macro("Lipides","hormones",p.Lg,p.Lg*9,"var(--warn)")}
        <div class="plate">
          <svg viewBox="0 0 80 80" width="74" height="74" aria-hidden="true">
            <circle cx="40" cy="40" r="36" fill="var(--surface-2)" stroke="var(--line)" stroke-width="2"/>
            <path d="M40 40 L40 8 A32 32 0 0 1 40 72 Z" fill="var(--good)" opacity=".75"/>
            <path d="M40 40 L40 72 A32 32 0 0 1 8 40 Z" fill="var(--acc)"/>
            <path d="M40 40 L8 40 A32 32 0 0 1 40 8 Z" fill="var(--warn)" opacity=".8"/>
          </svg>
          <p><b>La règle de l’assiette :</b> ½ légumes, ¼ protéines, ¼ féculents. Avec ça, tu peux manger au restaurant ou chez ta famille sans rien compter.</p>
        </div>
      </div>
    </div>
    <div class="meals">${p.meals.map((m,i)=>{ const o = m.opts[sel[i]]; return `
      <article class="card meal">
        <div class="meal-h"><h4>${m.k}</h4><small>${m.h}</small></div>
        <div class="dish">${esc(o.n)}</div>
        <ul>${o.l.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>
        <div class="meal-f">
          <div class="kp"><span class="num">${o.kcal} kcal</span><span class="num">${o.p} g prot.</span></div>
          <div class="dots">${m.opts.map((_,j)=>`<i class="${j===sel[i]?'on':''}"></i>`).join("")}<button class="swap" data-swap="${i}">Autre idée ↻</button></div>
        </div>
      </article>`;}).join("")}
    </div>
    <div class="card daytotal">
      <div>Ta journée composée : <b class="num">${sumK.toLocaleString("fr-FR")} kcal</b> · <b class="num">${sumP} g</b> de protéines</div>
      <span class="chip">${marge>=0?`Marge plaisir : ${marge} kcal (lait dans le café, carré de chocolat, huile de cuisson)`:`${-marge} kcal au-dessus : réduis un féculent`}</span>
    </div>
    <div class="card rules"><h3>Les règles d’or de ${esc(p.name)}</h3>
      <ol>${p.rules.map(([b,s])=>`<li><div><b>${esc(b)}</b><span>${esc(s)}</span></div></li>`).join("")}</ol>
    </div>
    <div class="card shop"><div class="sec-h" style="margin:0"><h3>Liste de courses de la semaine</h3><button class="btn ghost" id="copyShop">Copier la liste</button></div>
      <div class="shop-g">${Object.entries(p.shop).map(([g,l])=>`<div><h5>${g}</h5><ul>${l.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}</div>
    </div>`;
}

/* ===================== SUIVI ===================== */
function chart(){
  const p = P[who]; const W = 640, H = 300, m = {l:40,r:16,t:16,b:30};
  const horizon = p.deadlines.length ? Math.ceil((parse(p.deadlines.at(-1).d)-parse(START))/(7*DAY))+2 : Math.ceil((weekWhen(p,p.goal)||26))+3;
  const pts = [...S[who].weights].sort((a,b)=>a.d.localeCompare(b.d)).map(x=>({t:(parse(x.d)-parse(START))/(7*DAY), kg:x.kg}));
  const all = pts.map(x=>x.kg).concat([p.w0, p.goal]);
  const yMax = Math.ceil(Math.max(...all)+1), yMin = Math.floor(Math.min(...all)-1);
  const X = t => m.l + (t/horizon)*(W-m.l-m.r), Y = kg => m.t + (yMax-kg)/(yMax-yMin)*(H-m.t-m.b);
  let g = "";
  for (let kg = Math.ceil(yMin); kg <= yMax; kg++){ if ((kg - yMin) % 2) continue;
    g += `<line x1="${m.l}" x2="${W-m.r}" y1="${Y(kg)}" y2="${Y(kg)}" stroke="var(--line)"/><text x="${m.l-8}" y="${Y(kg)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${kg}</text>`; }
  for (let t = 0; t <= horizon; t += 4){ g += `<text x="${X(t)}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--muted)">${frShort(dateOfWeek(t))}</text>`; }
  p.deadlines.forEach(d=>{ const t = (parse(d.d)-parse(START))/(7*DAY);
    g += `<line x1="${X(t)}" x2="${X(t)}" y1="${m.t}" y2="${H-m.b}" stroke="var(--cam)" stroke-dasharray="3 4"/><text x="${X(t)-4}" y="${m.t+12}" text-anchor="end" font-size="11" font-weight="700" fill="var(--cam)">${d.label}</text>`; });
  p.milestones.forEach(ms=>{ if (ms.kg < yMin || ms.kg > yMax) return;
    g += `<line x1="${m.l}" x2="${W-m.r}" y1="${Y(ms.kg)}" y2="${Y(ms.kg)}" stroke="var(--warn)" stroke-dasharray="2 4"/><text x="${W-m.r}" y="${Y(ms.kg)-5}" text-anchor="end" font-size="11" fill="var(--warn)">${ms.kg} kg · ${esc(ms.label)}</text>`; });
  g += `<line x1="${m.l}" x2="${W-m.r}" y1="${Y(p.goal)}" y2="${Y(p.goal)}" stroke="var(--acc)" stroke-width="1.5"/><text x="${m.l+6}" y="${Y(p.goal)-6}" font-size="11" font-weight="700" fill="var(--acc)">Objectif ${p.goal} kg</text>`;
  let d = "", area = "";
  for (let t = 0; t <= horizon; t += 0.25){ d += (t?"L":"M")+X(t).toFixed(1)+" "+Y(projAt(p,t)).toFixed(1)+" "; }
  area = d + `L${X(horizon)} ${H-m.b} L${X(0)} ${H-m.b} Z`;
  g += `<path d="${area}" fill="var(--acc)" opacity=".08"/><path d="${d}" fill="none" stroke="var(--acc)" stroke-width="2" stroke-dasharray="6 5" opacity=".7"/>`;
  if (pts.length){
    const line = pts.map((q,i)=>(i?"L":"M")+X(q.t).toFixed(1)+" "+Y(q.kg).toFixed(1)).join(" ");
    g += `<path d="${line}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>`;
    pts.forEach((q,i)=>{ const last = i===pts.length-1; g += `<circle cx="${X(q.t)}" cy="${Y(q.kg)}" r="${last?5.5:3.5}" fill="${last?'var(--acc)':'var(--ink)'}" stroke="var(--surface)" stroke-width="2"/>`; });
    const l = pts.at(-1); g += `<text x="${X(l.t)+9}" y="${Y(l.kg)+4}" font-size="12" font-weight="700" fill="var(--ink)">${fmt(l.kg)}</text>`;
  }
  const tn = (today()-parse(START))/(7*DAY);
  g += `<line x1="${X(tn)}" x2="${X(tn)}" y1="${m.t}" y2="${H-m.b}" stroke="var(--muted)" opacity=".5"/><text x="${X(tn)+4}" y="${m.t+12}" font-size="10.5" fill="var(--muted)">aujourd’hui</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Trajectoire de poids prévue et pesées">${g}</svg>`;
}
function badges(){
  const p = P[who]; const lost = p.w0 - latestW(who);
  const weeks = Object.values(S[who].done);
  const total = weeks.reduce((a,b)=>a+b.length,0);
  const full = weeks.filter(w=>w.length>=p.freq).length;
  const list = [
    ["1", "Première séance", "Le plus dur est fait", total>=1],
    ["4/4", "Semaine parfaite", "4 séances sur 4", full>=1],
    ["−2", "Premiers −2 kg", "Ça bouge", lost>=2],
    ["−5", "Cap des −5 kg", "Le corps change", lost>=5],
    who==="camelia" ? ["68", "Retour à 68 kg", "Ton ancien record", latestW(who)<=68] : ["−10", "Cap des −10 kg", "Équilibre en vue", lost>=10],
    ["20", "20 séances", "La régularité paie", total>=20]
  ];
  return list.map(([m,b,s,on])=>`<div class="badge ${on?'on':''}"><div class="m">${m}</div><div><b>${b}</b><small>${s}</small></div></div>`).join("");
}
function renderSuivi(){
  const p = P[who]; const wN = weekNo();
  const hist = [...S[who].weights].sort((a,b)=>b.d.localeCompare(a.d));
  const tFit = p.deadlines.length ? (parse(p.deadlines[0].d)-parse(START))/(7*DAY) : null;
  const t68 = p.milestones[0] ? weekWhen(p, p.milestones[0].kg) : null;
  const tGoal = weekWhen(p, p.goal);
  const lines = [];
  if (tFit) lines.push(`À l’essayage : environ <b>${fmt(projAt(p,tFit))} kg</b>`);
  if (t68) lines.push(`${p.milestones[0].kg} kg (${esc(p.milestones[0].label.toLowerCase())}) : vers le <b>${frDate(dateOfWeek(t68))}</b>`);
  if (tGoal) lines.push(`${p.goal} kg : vers le <b>${frDate(dateOfWeek(tGoal))}</b>`);
  if (p.deadlines[1]) lines.push(`Au mariage : environ <b>${fmt(projAt(p,(parse(p.deadlines[1].d)-parse(START))/(7*DAY)))} kg</b>, poids stable depuis l’essayage`);
  let wk = "";
  for (let w = 1; w <= Math.max(wN, 12); w++){ const n = (S[who].done["w"+w]||[]).length; wk += `<div class="wk l${Math.min(4,n)} ${w===wN?'cur':''}" title="Semaine ${w} : ${n} séance(s)">${w}</div>`; }
  $("#p-suivi").innerHTML = `
    <div class="sec-h"><h2>Ta trajectoire</h2><p>Pointillés : le plan · trait plein : tes pesées</p></div>
    <div class="track-top">
      <div class="card chart-card">${chart()}
        <div class="legend"><span><i style="background:var(--acc)"></i>Trajectoire prévue</span><span><i style="background:var(--ink)"></i>Tes pesées</span></div>
        <p style="font-size:13.5px;margin:10px 2px 6px">${lines.join(" · ")}</p>
      </div>
      <div class="card log">
        <h3 style="font-size:17px">Pesée du jour</h3>
        <p style="margin:2px 0 0;font-size:12.5px;color:var(--muted)">Le matin, à jeun, après les toilettes. 1 à 2 fois par semaine suffit.</p>
        <label for="inDate">Date</label><input id="inDate" type="date" value="${iso(today())}">
        <label for="inKg">Poids (kg)</label><input id="inKg" type="number" step="0.1" min="35" max="160" placeholder="${fmt(latestW(who))}">
        <label for="inWaist">Tour de taille (cm, facultatif)</label><input id="inWaist" type="number" step="0.5" min="40" max="160">
        <button class="btn" id="addW">Enregistrer</button>
        <div class="hist">${hist.length? hist.map(x=>`<div><span>${frDate(parse(x.d))}</span><span class="num"><b>${fmt(x.kg)} kg</b>${x.waist?` · ${fmt(x.waist)} cm`:""} <button data-del="${x.d}" aria-label="Supprimer la pesée du ${x.d}">✕</button></span></div>`).join("") : '<div><span style="color:var(--muted)">Point de départ : '+fmt(p.w0)+' kg. Ajoute ta première pesée.</span></div>'}</div>
        <div class="sync" id="syncNote"></div>
      </div>
    </div>
    <div class="card week"><h3 style="font-size:17px">Régularité</h3><p style="margin:2px 0 0;font-size:13px;color:var(--muted)">Chaque case est une semaine : plus elle est foncée, plus tu as fait de séances. Coche tes séances dans l’onglet Programme.</p>
      <div class="weekgrid">${wk}</div>
    </div>
    <div class="badges">${badges()}</div>`;
  renderSync();
}

/* ===================== ACTIONS ===================== */
function toast(t){ const el = $("#toast"); el.textContent = t; el.classList.add("on"); clearTimeout(toast._t); toast._t = setTimeout(()=>el.classList.remove("on"), 2400); }
function toggleDone(si, force){
  const k = "w"+weekNo(); const a = new Set(S[who].done[k]||[]);
  const on = force ?? !a.has(si); on ? a.add(si) : a.delete(si);
  S[who].done[k] = [...a].sort(); save(who); renderAll();
  if (on && a.size === P[who].freq) toast("Semaine parfaite, 4 séances sur 4 !");
  else if (on) toast("Séance validée");
}
function addWeight(kg, d, waist){
  kg = Number(kg); if (!(kg > 35 && kg < 160)) return false;
  const arr = S[who].weights.filter(x=>x.d!==d); const e = {d, kg:Math.round(kg*10)/10}; if (waist) e.waist = Number(waist);
  arr.push(e); S[who].weights = arr; save(who); renderAll(); return true;
}
document.addEventListener("click", e=>{
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.tab){ tab = t.dataset.tab; renderTabs(); }
  else if (t.dataset.ph){ phaseSel = +t.dataset.ph; renderProg(); }
  else if (t.dataset.en){ energy = +t.dataset.en; renderProg(); }
  else if (t.dataset.done){ toggleDone(+t.dataset.done); }
  else if (t.dataset.play){ openPlayer(+t.dataset.play); }
  else if (t.dataset.guide){ const [si,ei] = t.dataset.guide.split("-").map(Number); openGuide(P[who].sessions[si].ex[ei]); }
  else if (t.dataset.guidename){ const ex = P[who].sessions.flatMap(s=>s.ex).find(x=>x.n===t.dataset.guidename); if (ex) openGuide(ex); }
  else if (t.dataset.alt){ const [si,ei] = t.dataset.alt.split("-").map(Number); const ex = P[who].sessions[si].ex[ei];
    if (liveCoach()) ask(`Propose-moi 2 alternatives à « ${ex.n} » (séance ${P[who].sessions[si].title}) qui travaillent les mêmes muscles, avec séries et répétitions.`);
    else if (GUIDE_OF[ex.n]) openGuide(ex, true);
    else ask("Une machine est prise, je fais quoi ?"); }
  else if (t.dataset.sheetclose){ t.closest(".sheet").classList.remove("open"); }
  else if (t.dataset.libcat !== undefined){ libCat = t.dataset.libcat; renderLib(); }
  else if (t.id === "openLib"){ openLib(); }
  else if (t.dataset.askg){ $("#guide").classList.remove("open"); ask(t.dataset.askg); }
  else if (t.dataset.swap){ const i = +t.dataset.swap; mealSel[who][i] = (mealSel[who][i]+1) % P[who].meals[i].opts.length; renderNut(); }
  else if (t.id === "copyShop"){ const txt = Object.entries(P[who].shop).map(([g,l])=>g+"\n"+l.map(x=>"- "+x).join("\n")).join("\n\n");
    navigator.clipboard.writeText(txt).then(()=>toast("Liste copiée"), ()=>toast("Copie impossible ici, sélectionne la liste à la main")); }
  else if (t.id === "addW"){ if (addWeight($("#inKg").value, $("#inDate").value || iso(today()), $("#inWaist").value)) toast("Pesée enregistrée"); else toast("Entre un poids valide, par exemple 75,4"); }
  else if (t.dataset.del){ S[who].weights = S[who].weights.filter(x=>x.d!==t.dataset.del); save(who); renderAll(); }
  else if (t.dataset.q){ ask(t.dataset.q); }
});
function renderTabs(){
  ["prog","nut","suivi"].forEach(x=>{ $("#tab-"+x).setAttribute("aria-selected", x===tab); $("#p-"+x).hidden = x!==tab; });
}
function renderAll(){ renderDuo(); renderHero(); renderProg(); renderNut(); renderSuivi(); renderTabs(); }

/* ===================== MODE SÉANCE ===================== */
let PL = null, ac = null;
function beep(){ try { ac = ac || new (window.AudioContext||window.webkitAudioContext)(); [0,0.18,0.36].forEach((d,i)=>{ const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = i===2?1046:784; g.gain.setValueAtTime(.0001, ac.currentTime+d); g.gain.exponentialRampToValueAtTime(.25, ac.currentTime+d+.02); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime+d+.15); o.connect(g).connect(ac.destination); o.start(ac.currentTime+d); o.stop(ac.currentTime+d+.16); }); } catch(e){} }
function openPlayer(si){
  const p = P[who]; const ph = Math.min(phaseSel ?? curPhaseIdx(p), 2);
  PL = {si, ph, ei:0, set:0, rest:0, left:0, timer:null};
  try { ac = ac || new (window.AudioContext||window.webkitAudioContext)(); } catch(e){}
  $("#player").classList.add("open"); drawPlayer();
}
function closePlayer(){ if (PL) clearInterval(PL.timer); PL = null; $("#player").classList.remove("open"); }
function drawPlayer(){
  const p = P[who]; const s = p.sessions[PL.si];
  if (PL.ei >= s.ex.length){
    $("#pl").innerHTML = `<button class="close" data-pl="close" aria-label="Fermer">✕</button>
      <div class="step">Séance terminée</div><h2>Bravo ${esc(p.name)} !</h2>
      <p class="cue">${esc(s.title)} bouclée. Étire-toi 5 minutes, bois un grand verre d’eau et prends ton repas ou ta collation protéinée dans les 2 heures.</p>
      <div class="pl-act" style="margin-top:20px"><button class="btn" data-pl="finish">Valider la séance ✓</button></div>`;
    return;
  }
  const e = s.ex[PL.ei]; const r = rxFor(e, PL.ph); const C = 2*Math.PI*84;
  const resting = PL.left > 0;
  const prog = resting ? PL.left / PL.rest : 1;
  $("#pl").innerHTML = `<button class="close" data-pl="close" aria-label="Fermer">✕</button>
    <div class="step">${esc(s.title)} · exercice ${PL.ei+1} / ${s.ex.length}</div>
    <h2>${esc(e.n)}</h2><div class="rx num">${esc(r.txt)}</div>
    <p class="cue">${esc(e.c)}</p>
    ${GUIDE_OF[e.n] ? `<button class="howlink" data-guidename="${esc(e.n)}">Comment faire cet exercice ?</button>` : ""}
    ${e.cardio ? "" : `<div class="timer"><svg viewBox="0 0 190 190"><circle cx="95" cy="95" r="84" fill="none" stroke="var(--line)" stroke-width="10"/><circle id="arc" cx="95" cy="95" r="84" fill="none" stroke="var(--acc)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C*(1-prog)}"/></svg>
      <div class="t"><div>${resting ? `<span id="tl" class="num">${PL.left}</span><small>repos</small>` : `<span class="num">${PL.set+1}</span><small>série en cours</small>`}</div></div></div>
      <div class="setdots">${Array.from({length:r.sets},(_,i)=>`<i class="${i<PL.set?'on':''}"></i>`).join("")}</div>`}
    <div class="pl-act" style="${e.cardio?'margin-top:20px':''}">
      ${e.cardio ? `<button class="btn" data-pl="next">Cardio terminé →</button>`
        : resting ? `<button class="btn ghost" data-pl="skip">Passer le repos</button>`
        : `<button class="btn" data-pl="set">Série terminée</button>`}
      <button class="btn ghost" data-pl="next">${PL.ei === s.ex.length-1 ? "Terminer" : "Exercice suivant"}</button>
    </div>`;
}
document.getElementById("player").addEventListener("click", e=>{
  const b = e.target.closest("[data-pl]"); if (!b || !PL) return;
  const a = b.dataset.pl; const s = P[who].sessions[PL.si]; const ex = s.ex[PL.ei];
  if (a === "close") return closePlayer();
  if (a === "finish"){ const si = PL.si; closePlayer(); toggleDone(si, true); return; }
  if (a === "next"){ clearInterval(PL.timer); PL.ei++; PL.set = 0; PL.left = 0; return drawPlayer(); }
  if (a === "skip"){ clearInterval(PL.timer); PL.left = 0; return drawPlayer(); }
  if (a === "set"){
    const r = rxFor(ex, PL.ph); PL.set++;
    if (PL.set >= r.sets){ PL.ei++; PL.set = 0; return drawPlayer(); }
    PL.rest = r.rest; PL.left = r.rest; drawPlayer();
    clearInterval(PL.timer);
    PL.timer = setInterval(()=>{
      if (!PL) return; PL.left--;
      if (PL.left <= 0){ clearInterval(PL.timer); PL.left = 0; beep(); drawPlayer(); return; }
      const tl = document.getElementById("tl"), arc = document.getElementById("arc");
      if (tl) tl.textContent = PL.left; if (arc){ const C = 2*Math.PI*84; arc.setAttribute("stroke-dashoffset", C*(1-PL.left/PL.rest)); }
    }, 1000);
  }
});
document.addEventListener("keydown", e=>{ if (e.key === "Escape" && PL) closePlayer(); });

/* ===================== FICHES EXERCICES ===================== */
/* n : nom · m : muscles · set : installation · st : étapes · b : respiration · err : erreurs · easy / hard : variantes · alt : remplacements · yt : recherche vidéo */
const GUIDES = {
  hipthrust:{n:"Hip thrust", m:["Fessiers","Ischios"],
    set:"Assieds-toi par terre, le haut du dos (sous les omoplates) contre un banc. Barre ou haltère posé sur le pli de la hanche, avec une mousse pour le confort. Pieds à plat, écartés largeur de hanches.",
    st:["Rentre le menton et regarde devant toi, pas le plafond.","Pousse dans les talons pour monter les hanches jusqu’à ce que le buste soit parallèle au sol.","En haut, serre fort les fessiers 1 seconde : genoux à 90°, tibias verticaux.","Redescends lentement sans poser les fesses au sol, puis remonte."],
    b:"Inspire en bas, souffle en montant.",
    err:["Cambrer le bas du dos en haut au lieu de serrer les fessiers.","Pieds trop loin (ça travaille les ischios) ou trop près (les cuisses).","Pousser sur la pointe des pieds."],
    easy:"Pont fessier au sol, sans charge.", hard:"Pause de 3 secondes en haut, ou version une jambe.",
    alt:["Machine hip thrust","Pont fessier au sol lesté"], yt:"hip thrust technique débutante"},
  gobletsquat:{n:"Squat gobelet", m:["Cuisses","Fessiers","Gainage"],
    set:"Tiens un haltère ou un kettlebell verticalement contre ta poitrine, coudes vers le bas. Pieds un peu plus larges que les hanches, pointes légèrement ouvertes.",
    st:["Gaine le ventre comme si on allait te pousser.","Descends en envoyant les hanches entre tes talons, buste fier.","Va aussi bas que possible en gardant le dos droit et les talons au sol.","Remonte en poussant le sol avec tout le pied."],
    b:"Inspire en descendant, souffle en remontant.",
    err:["Genoux qui rentrent vers l’intérieur : pousse-les dans l’axe des pieds.","Talons qui décollent.","Dos qui s’arrondit en bas."],
    easy:"Squat sur une chaise : tu t’assois, tu te relèves.", hard:"Descente en 3 secondes et pause en bas.",
    alt:["Presse à cuisses","Squat à la Smith machine"], yt:"goblet squat technique"},
  fentearriere:{n:"Fente arrière", m:["Fessiers","Cuisses"],
    set:"Debout, pieds largeur de hanches, un haltère dans chaque main (ou sans charge), bras le long du corps.",
    st:["Fais un grand pas en arrière avec une jambe.","Descends jusqu’à ce que le genou arrière frôle le sol.","Garde le buste légèrement penché en avant : le fessier de la jambe avant travaille plus.","Pousse dans le talon avant pour revenir debout. Fais toutes les répétitions d’un côté, puis change."],
    b:"Inspire en descendant, souffle en remontant.",
    err:["Pas trop court : le genou avant part loin devant.","Genou avant qui rentre vers l’intérieur.","Se relever en poussant avec la jambe arrière."],
    easy:"Sans charge, en te tenant à un mur.", hard:"Pied avant surélevé sur un step de 10 cm.",
    alt:["Step-up","Fente bulgare (pied arrière sur un banc)"], yt:"fente arrière haltères technique"},
  abduction:{n:"Abduction à la machine", m:["Moyen fessier (haut des fesses)"],
    set:"Règle les coussins pour qu’ils soient à l’extérieur des genoux. Choisis une charge que tu contrôles sur 15 répétitions.",
    st:["Penche légèrement le buste en avant et tiens les poignées.","Écarte les jambes le plus loin possible.","Marque une pause d’une seconde.","Reviens lentement en 2 secondes sans laisser les plaques se toucher."],
    b:"Souffle en écartant, inspire en revenant.",
    err:["Utiliser l’élan.","Charge trop lourde avec une amplitude réduite."],
    easy:"Moins de charge, amplitude complète.", hard:"Termine avec 10 répétitions partielles en position écartée.",
    alt:["Pas latéraux avec élastique","Abduction allongée sur le côté"], yt:"abduction machine fessiers technique"},
  kickback:{n:"Kickback à la poulie", m:["Grand fessier"],
    set:"Poulie en position basse, sangle autour de la cheville. Face à la machine, mains sur la machine, buste légèrement penché.",
    st:["Garde le bassin immobile et le ventre gainé.","Pousse la jambe en arrière et légèrement en diagonale, genou presque tendu.","Serre le fessier en fin de mouvement, une seconde.","Reviens lentement sans poser le pied."],
    b:"Souffle en poussant la jambe, inspire au retour.",
    err:["Cambrer le dos pour monter plus haut.","Faire tourner le bassin."],
    easy:"Version à quatre pattes au sol, sans charge.", hard:"Pause de 2 secondes en haut.",
    alt:["Kickback avec élastique","Donkey kick au sol"], yt:"cable kickback fessiers technique"},
  marche:{n:"Marche inclinée sur tapis", m:["Fessiers","Mollets","Cardio"],
    set:"Règle la pente puis la vitesse indiquées. Chaussures de sport, bouteille d’eau à portée.",
    st:["Lâche les barres : tenir les barres réduit fortement l’effort.","Fais des pas naturels, buste droit, bras qui balancent.","Garde un rythme où tu peux parler en phrases courtes.","Les 2 dernières minutes, baisse la pente pour récupérer."],
    b:"Respire régulièrement, par le nez si possible.",
    err:["Se tenir aux barres.","Se pencher fortement en avant."],
    easy:"Pente plus faible (5-6 %).", hard:"Augmente la pente de 1 à 2 % chaque semaine.",
    alt:["Vélo","Elliptique","Marche en côte dehors"], yt:"marche inclinée tapis technique"},
  tirage:{n:"Tirage vertical", m:["Dos (grand dorsal)","Biceps"],
    set:"Assieds-toi, cuisses bloquées sous les coussins. Prise large (ou serrée selon la séance), paumes vers l’avant.",
    st:["Penche légèrement le buste en arrière, poitrine sortie.","Tire la barre vers le haut de ta poitrine en pensant « coudes dans les poches ».","Serre les omoplates en bas, une seconde.","Remonte lentement jusqu’à bras tendus."],
    b:"Souffle en tirant, inspire en remontant.",
    err:["Tirer derrière la nuque.","Se balancer en arrière pour aider.","Tirer avec les bras seulement, épaules qui montent aux oreilles."],
    easy:"Tirage avec élastique fixé en hauteur.", hard:"Descente en 3 secondes.",
    alt:["Tractions assistées","Tirage avec élastique"], yt:"tirage vertical poulie haute technique"},
  rowinghaltere:{n:"Rowing haltère un bras", m:["Dos","Arrière d’épaule","Biceps"],
    set:"Un genou et une main sur un banc, l’autre pied au sol. Dos plat, haltère dans la main libre, bras tendu.",
    st:["Gaine le ventre, dos bien plat comme une table.","Tire le coude vers la hanche, pas vers l’épaule.","Serre l’omoplate en haut une seconde.","Redescends lentement jusqu’à bras tendu. Fais toutes les répétitions, puis change de côté."],
    b:"Souffle en tirant, inspire en descendant.",
    err:["Tourner le buste pour monter l’haltère.","Dos arrondi."],
    easy:"Haltère plus léger, mouvement plus lent.", hard:"Pause de 2 secondes en haut.",
    alt:["Rowing poulie basse","Rowing machine"], yt:"rowing haltère un bras technique"},
  devincline:{n:"Développé incliné haltères", m:["Haut des pectoraux","Épaules","Triceps"],
    set:"Banc incliné à 30°. Haltères posés sur les cuisses, puis amène-les à hauteur de poitrine en t’allongeant.",
    st:["Serre les omoplates et plante les pieds au sol.","Pousse les haltères vers le haut, ils se rapprochent sans se toucher.","Redescends lentement jusqu’à ce que les coudes soient un peu sous le banc.","Les coudes restent à environ 45° du corps, pas à l’horizontale."],
    b:"Inspire en descendant, souffle en poussant.",
    err:["Coudes trop écartés (épaules en danger).","Décoller les fesses du banc."],
    easy:"Pompes contre un banc.", hard:"Descente en 3 secondes.",
    alt:["Développé à la machine","Pompes inclinées"], yt:"développé incliné haltères technique"},
  devcouche:{n:"Développé couché haltères", m:["Pectoraux","Épaules","Triceps"],
    set:"Allongée sur un banc plat, haltères à hauteur de poitrine, pieds bien au sol.",
    st:["Serre les omoplates comme pour les mettre dans tes poches arrière.","Pousse les haltères vers le haut sans les cogner.","Redescends lentement en 2 secondes.","Coudes à environ 45° du corps."],
    b:"Inspire en descendant, souffle en poussant.",
    err:["Coudes à l’horizontale.","Rebondir en bas."],
    easy:"Développé à la machine.", hard:"Pause d’une seconde en bas.",
    alt:["Machine développé","Pompes"], yt:"développé couché haltères technique"},
  elevlat:{n:"Élévations latérales", m:["Épaules (deltoïde latéral)"],
    set:"Debout, un haltère léger dans chaque main, bras le long du corps, coudes très légèrement fléchis.",
    st:["Penche très légèrement le buste en avant.","Monte les bras sur les côtés jusqu’à hauteur d’épaules, pas plus haut.","Imagine que tu verses une carafe : les petits doigts légèrement vers le haut.","Redescends en 2 secondes."],
    b:"Souffle en montant, inspire en descendant.",
    err:["Prendre trop lourd et donner de l’élan.","Hausser les épaules vers les oreilles."],
    easy:"Un bras à la fois, en te tenant à un support.", hard:"Pause d’une seconde en haut.",
    alt:["Élévations à la poulie","Machine élévations latérales"], yt:"élévations latérales haltères technique"},
  curl:{n:"Curl biceps", m:["Biceps"],
    set:"Debout, haltères ou poulie basse avec barre, coudes collés au corps.",
    st:["Monte la charge en pliant les coudes, sans bouger le haut du bras.","Serre le biceps en haut.","Redescends lentement jusqu’à bras presque tendus."],
    b:"Souffle en montant, inspire en descendant.",
    err:["Balancer le buste.","Coudes qui avancent."],
    easy:"Charge plus légère, assise.", hard:"Descente en 3 secondes.",
    alt:["Curl élastique","Curl marteau"], yt:"curl biceps haltères technique"},
  triceps:{n:"Extension triceps à la poulie", m:["Triceps (arrière du bras)"],
    set:"Poulie haute avec corde ou barre. Debout face à la machine, coudes collés au corps.",
    st:["Garde les coudes fixes contre les côtes.","Pousse vers le bas jusqu’à bras tendus, écarte la corde en bas.","Remonte lentement jusqu’à ce que les avant-bras soient à l’horizontale."],
    b:"Souffle en poussant, inspire en remontant.",
    err:["Coudes qui s’écartent ou remontent.","Pencher le buste pour pousser avec le poids du corps."],
    easy:"Charge légère, mouvement lent.", hard:"Pause d’une seconde bras tendus.",
    alt:["Dips sur un banc","Extension haltère au-dessus de la tête"], yt:"extension triceps poulie corde technique"},
  planche:{n:"Planche (gainage)", m:["Abdominaux profonds","Gainage"],
    set:"Sur les avant-bras, coudes sous les épaules, jambes tendues sur la pointe des pieds.",
    st:["Aligne tête, épaules, bassin et talons.","Serre les fessiers et rentre le nombril.","Pousse le sol avec les avant-bras.","Tiens le temps indiqué en respirant."],
    b:"Respire calmement, ne bloque pas ta respiration.",
    err:["Fesses trop hautes.","Bas du dos qui creuse."],
    easy:"Sur les genoux.", hard:"Lève un pied pendant 5 secondes, en alternant.",
    alt:["Dead bug","Planche sur les mains"], yt:"planche gainage technique"},
  deadbug:{n:"Dead bug", m:["Abdominaux profonds"],
    set:"Allongée sur le dos, bras tendus vers le plafond, genoux pliés à 90° au-dessus des hanches.",
    st:["Plaque le bas du dos au sol, c’est la règle n°1.","Tends lentement une jambe et le bras opposé vers le sol.","Reviens au centre et change de côté.","Une répétition = un côté."],
    b:"Souffle à fond en tendant bras et jambe.",
    err:["Le bas du dos se décolle du sol.","Aller trop vite."],
    easy:"Bouge seulement les jambes.", hard:"Tiens un haltère léger dans les mains.",
    alt:["Planche","Crunch inversé lent"], yt:"dead bug exercice technique"},
  velo:{n:"Vélo ou elliptique (zone 2)", m:["Cardio","Jambes"],
    set:"Règle la selle à hauteur de hanche (vélo). Résistance moyenne.",
    st:["Échauffe-toi 3 minutes en douceur.","Trouve un rythme où tu peux parler mais pas chanter : c’est la zone 2.","Garde ce rythme jusqu’à la fin.","Termine par 2 minutes plus lentes."],
    b:"Respiration régulière, un peu accélérée.",
    err:["Aller trop fort : en zone 2 tu dois pouvoir parler."],
    easy:"Résistance plus faible.", hard:"Ajoute 5 minutes.",
    alt:["Marche inclinée","Rameur doux"], yt:"cardio zone 2 explication"},
  rdl:{n:"Soulevé de terre roumain", m:["Ischios","Fessiers","Bas du dos"],
    set:"Debout, haltères devant les cuisses, pieds largeur de hanches, genoux légèrement fléchis.",
    st:["Pousse les hanches vers l’arrière comme pour fermer une porte avec les fesses.","Les haltères glissent le long des cuisses, puis des tibias.","Descends jusqu’à sentir un étirement à l’arrière des cuisses, dos toujours plat.","Remonte en poussant les hanches vers l’avant et en serrant les fessiers."],
    b:"Inspire en descendant, souffle en remontant.",
    err:["Arrondir le dos : c’est l’erreur à éviter absolument.","Plier les genoux comme un squat.","Écarter les haltères des jambes."],
    easy:"Avec un bâton ou à vide pour apprendre le geste.", hard:"Version une jambe.",
    alt:["Leg curl","Good morning avec élastique"], yt:"soulevé de terre roumain haltères technique"},
  presse:{n:"Presse à cuisses", m:["Cuisses","Fessiers"],
    set:"Dos bien plaqué au dossier. Pieds largeur d’épaules sur la plateforme (hauts et larges pour viser les fessiers).",
    st:["Déverrouille la sécurité.","Descends en pliant les genoux jusqu’à environ 90°, sans décoller le bas du dos.","Pousse avec tout le pied, surtout les talons.","Ne verrouille pas complètement les genoux en haut."],
    b:"Inspire en descendant, souffle en poussant.",
    err:["Fesses qui décollent du siège en bas.","Genoux qui rentrent vers l’intérieur.","Bloquer les genoux tendus en haut."],
    easy:"Moins de charge, amplitude réduite.", hard:"Descente en 3 secondes.",
    alt:["Squat gobelet","Hack squat léger"], yt:"presse à cuisses technique fessiers"},
  stepup:{n:"Step-up (montée sur banc ou marche)", m:["Fessiers","Cuisses","Équilibre"],
    set:"Face à un banc ou une marche stable (30 à 45 cm). Haltères en main ou sans charge.",
    st:["Pose tout le pied sur le banc.","Monte en poussant uniquement avec la jambe posée sur le banc, sans élan de l’autre jambe.","Tiens-toi droite en haut.","Redescends lentement. Fais toutes les répétitions d’un côté, puis change."],
    b:"Souffle en montant, inspire en descendant.",
    err:["Pousser avec le pied resté au sol.","Banc trop haut au début."],
    easy:"Marche plus basse, sans charge.", hard:"Haltères plus lourds ou banc plus haut.",
    alt:["Fente arrière","Fente marchée"], yt:"step up banc technique fessiers"},
  legcurl:{n:"Leg curl", m:["Ischios (arrière des cuisses)"],
    set:"Allongée ou assise selon la machine. Le coussin se place juste au-dessus des talons, genoux alignés avec l’axe de la machine.",
    st:["Plie les genoux en ramenant les talons vers les fesses.","Serre une seconde.","Reviens en 3 secondes, lentement."],
    b:"Souffle en pliant, inspire au retour.",
    err:["Décoller les hanches.","Revenir trop vite."],
    easy:"Moins de charge.", hard:"Version une jambe.",
    alt:["Soulevé de terre roumain","Curl avec ballon de gym"], yt:"leg curl machine technique"},
  pontuni:{n:"Pont fessier une jambe", m:["Fessiers"],
    set:"Allongée sur le dos, un pied au sol près des fesses, l’autre jambe tendue ou pliée en l’air.",
    st:["Pousse dans le talon au sol pour lever le bassin.","Garde le bassin bien horizontal, sans pencher d’un côté.","Serre le fessier une seconde en haut.","Redescends sans poser complètement."],
    b:"Souffle en montant.",
    err:["Bassin qui tourne.","Pousser avec la pointe du pied."],
    easy:"Pont fessier deux jambes.", hard:"Épaules sur un banc.",
    alt:["Hip thrust","Kickback"], yt:"pont fessier unilatéral technique"},
  intervalles:{n:"Intervalles sur tapis", m:["Cardio","Jambes"],
    set:"Note tes deux réglages avant de commencer : un rythme rapide (pente ou vitesse) et un rythme lent.",
    st:["Échauffe-toi 3 minutes en marchant.","Alterne 1 minute rapide et 1 minute lente.","Rapide = tu peux dire quelques mots, pas une phrase.","Termine par 2 minutes de marche lente."],
    b:"Respiration rapide pendant l’effort, tu récupères pendant la minute lente.",
    err:["Partir trop fort et finir épuisée.","Se tenir aux barres."],
    easy:"30 s rapide / 90 s lent.", hard:"Ajoute 2 intervalles.",
    alt:["Vélo en intervalles","Rameur en intervalles"], yt:"intervalles tapis de course marche inclinée"},
  kbswing:{n:"Kettlebell swing", m:["Fessiers","Ischios","Cardio"],
    set:"Pieds un peu plus larges que les hanches, kettlebell au sol devant toi.",
    st:["Attrape le kettlebell à deux mains et fais-le passer entre les jambes en poussant les hanches en arrière.","Pousse les hanches vers l’avant d’un coup sec : c’est la hanche qui lance le kettlebell, pas les bras.","Il monte jusqu’à hauteur de poitrine, bras tendus et détendus.","Laisse-le redescendre et enchaîne."],
    b:"Souffle fort à chaque poussée de hanches.",
    err:["Faire un squat au lieu de pousser les hanches.","Lever le kettlebell avec les bras.","Dos arrondi."],
    easy:"Pont fessier rapide au sol.", hard:"Kettlebell plus lourd.",
    alt:["Pont fessier dynamique","Good morning"], yt:"kettlebell swing technique débutant"},
  trx:{n:"Rowing TRX (sangles)", m:["Dos","Biceps"],
    set:"Tiens les poignées, recule les pieds et penche-toi en arrière, corps droit, bras tendus.",
    st:["Gaine le corps comme une planche.","Tire la poitrine vers les poignées en serrant les omoplates.","Redescends lentement.","Plus tes pieds avancent, plus c’est dur."],
    b:"Souffle en tirant.",
    err:["Fesses qui tombent.","Épaules qui montent."],
    easy:"Recule les pieds pour être plus droite.", hard:"Avance les pieds.",
    alt:["Rowing haltère","Tirage horizontal"], yt:"trx row technique"},
  fentesmarchees:{n:"Fentes marchées", m:["Fessiers","Cuisses"],
    set:"Debout, avec un espace de 10 mètres devant toi. Sans charge ou haltères légers.",
    st:["Fais un grand pas en avant et descends, genou arrière près du sol.","Pousse dans le talon avant pour avancer et ramener l’autre jambe devant.","Enchaîne en avançant.","Buste droit, regard devant."],
    b:"Inspire en descendant, souffle en remontant.",
    err:["Pas trop courts.","Genou avant qui rentre vers l’intérieur."],
    easy:"Fentes sur place en te tenant.", hard:"Haltères en main.",
    alt:["Fente arrière","Step-up"], yt:"fentes marchées technique"},
  mountain:{n:"Mountain climbers", m:["Abdominaux","Cardio"],
    set:"Position de pompe, mains sous les épaules.",
    st:["Ramène un genou vers la poitrine, puis l’autre, en alternant.","Garde les fesses à hauteur des épaules.","Va à un rythme que tu tiens 30 secondes."],
    b:"Respiration rapide et régulière.",
    err:["Fesses trop hautes.","Mains trop en avant."],
    easy:"Mains sur un banc, rythme lent.", hard:"Rythme plus rapide.",
    alt:["Montées de genoux","Planche"], yt:"mountain climbers technique"},
  pompes:{n:"Pompes", m:["Pectoraux","Triceps","Gainage"],
    set:"Mains un peu plus larges que les épaules. Au sol, sur les genoux, ou mains sur un banc (pompes inclinées).",
    st:["Corps gainé et droit de la tête aux talons (ou aux genoux).","Descends la poitrine vers le sol, coudes à 45° du corps.","Pousse le sol pour remonter.","Plus les mains sont hautes (banc, mur), plus c’est facile."],
    b:"Inspire en descendant, souffle en poussant.",
    err:["Fesses en l’air ou ventre qui tombe.","Coudes complètement écartés."],
    easy:"Contre un mur ou un banc.", hard:"Au sol, sur les pieds.",
    alt:["Développé couché haltères","Machine développé"], yt:"pompes inclinées débutante technique"},
  rowingpoulie:{n:"Rowing poulie basse (tirage horizontal)", m:["Dos","Biceps"],
    set:"Assise, pieds sur les cales, genoux légèrement fléchis, poignée triangle.",
    st:["Buste droit, poitrine sortie.","Tire la poignée vers le nombril en serrant les omoplates.","Pause d’une seconde.","Tends les bras lentement sans arrondir le dos."],
    b:"Souffle en tirant.",
    err:["Se balancer d’avant en arrière.","Dos arrondi au retour."],
    easy:"Moins de charge.", hard:"Pause de 2 secondes.",
    alt:["Rowing haltère","Rowing machine"], yt:"tirage horizontal poulie basse technique"},
  stair:{n:"Stairmaster (escalier mécanique)", m:["Fessiers","Cuisses","Cardio"],
    set:"Choisis un niveau où tu peux monter sans t’accrocher. Commence doucement.",
    st:["Pose tout le pied sur chaque marche.","Buste droit, mains posées sur les rampes seulement pour l’équilibre.","Pendant le repos, descends ou reste sur la machine au niveau minimum.","Ralentis plutôt que t’arrêter si c’est dur."],
    b:"Souffle long et régulier, essaie de garder un rythme de respiration.",
    err:["S’accrocher aux rampes en penchant le buste.","Monter sur la pointe des pieds."],
    easy:"Niveau plus bas, intervalles plus courts.", hard:"Niveau plus élevé ou repos plus courts.",
    alt:["Marche inclinée à 15 %","Vraies montées d’escaliers"], yt:"stairmaster débutant conseils"},
  mollets:{n:"Mollets debout", m:["Mollets"],
    set:"Debout, l’avant des pieds sur une marche, talons dans le vide. Tiens-toi à un support.",
    st:["Monte sur la pointe des pieds le plus haut possible.","Pause d’une seconde.","Redescends lentement sous le niveau de la marche."],
    b:"Respire normalement.",
    err:["Rebondir."],
    easy:"Au sol, sans marche.", hard:"Une jambe à la fois.",
    alt:["Machine mollets","Corde à sauter douce"], yt:"mollets debout marche technique"},
  facepull:{n:"Face pull", m:["Arrière des épaules","Haut du dos","Posture"],
    set:"Poulie à hauteur du visage, corde. Recule d’un pas, bras tendus.",
    st:["Tire la corde vers ton visage en écartant les mains.","Les coudes restent hauts, au niveau des épaules.","Serre les omoplates une seconde.","Reviens lentement."],
    b:"Souffle en tirant.",
    err:["Prendre trop lourd et se pencher en arrière.","Coudes qui tombent."],
    easy:"Avec un élastique.", hard:"Pause de 2 secondes.",
    alt:["Oiseau avec haltères","Élastique tiré vers le visage"], yt:"face pull technique corde"},
  farmer:{n:"Farmer walk (marche du fermier)", m:["Avant-bras","Gainage","Posture"],
    set:"Un haltère lourd dans chaque main, bras le long du corps.",
    st:["Tiens-toi très droite, épaules basses et en arrière.","Marche à petits pas rapides sur la distance indiquée.","Pose les haltères en pliant les jambes, dos droit."],
    b:"Respire normalement, ventre gainé.",
    err:["Se pencher d’un côté.","Hausser les épaules."],
    easy:"Haltères plus légers.", hard:"Haltères plus lourds ou distance plus longue.",
    alt:["Planche","Port de kettlebells"], yt:"farmer walk technique"},
  militaire:{n:"Développé militaire haltères assis", m:["Épaules","Triceps"],
    set:"Assise sur un banc à dossier vertical, haltères à hauteur d’oreilles, paumes vers l’avant.",
    st:["Dos collé au dossier, ventre gainé.","Pousse les haltères au-dessus de la tête sans les cogner.","Redescends lentement à hauteur d’oreilles."],
    b:"Souffle en poussant.",
    err:["Cambrer fortement le dos.","Descendre trop bas."],
    easy:"Haltères légers, un bras à la fois.", hard:"Debout.",
    alt:["Machine développé épaules","Pompes piquées"], yt:"développé militaire haltères assis technique"},
  pallof:{n:"Pallof press", m:["Abdominaux","Taille (obliques en gainage)"],
    set:"Poulie à hauteur de poitrine, sur le côté. Tiens la poignée à deux mains contre ta poitrine, pieds largeur de hanches.",
    st:["La poulie tire vers le côté : tu résistes, ton buste ne tourne pas.","Tends les bras devant toi lentement.","Tiens 2 secondes, puis ramène.","Fais toutes les répétitions, puis change de côté."],
    b:"Souffle en tendant les bras.",
    err:["Laisser le buste tourner.","Charge trop lourde."],
    easy:"Avec un élastique léger.", hard:"Pause de 5 secondes bras tendus.",
    alt:["Planche latérale","Dead bug"], yt:"pallof press technique"}
};
/* exercice du programme → fiche(s) */
const GUIDE_OF = {
  "Hip thrust (barre ou machine)":["hipthrust"], "Hip thrust « pump »":["hipthrust"], "Squat gobelet":["gobletsquat"],
  "Fente arrière haltères":["fentearriere"], "Fente arrière sans charge":["fentearriere"], "Abduction machine":["abduction"],
  "Kickback à la poulie":["kickback"], "Marche inclinée":["marche"], "Tapis incliné":["marche"],
  "Tirage vertical prise large":["tirage"], "Tirage vertical":["tirage"], "Tirage vertical prise serrée":["tirage"],
  "Rowing haltère un bras":["rowinghaltere"], "Développé incliné haltères":["devincline"], "Développé couché haltères":["devcouche"],
  "Élévations latérales":["elevlat"], "Superset curl + extension triceps":["curl","triceps"], "Superset triceps + curl":["triceps","curl"],
  "Planche + dead bug":["planche","deadbug"], "Planche":["planche"], "Dead bug":["deadbug"], "Vélo ou elliptique":["velo"],
  "Soulevé de terre roumain haltères":["rdl"], "Presse à cuisses pieds hauts":["presse"], "Presse à cuisses légère":["presse"],
  "Step-up sur banc":["stepup"], "Step-up sur marche basse":["stepup"], "Leg curl":["legcurl"], "Pont fessier unilatéral":["pontuni"],
  "Intervalles sur tapis":["intervalles"], "Intervalles tapis":["intervalles"],
  "Circuit 6 exercices":["gobletsquat","pompes","kbswing","trx","fentesmarchees","mountain"],
  "Stairmaster par intervalles":["stair"], "Mollets debout":["mollets"], "Pompes (inclinées si besoin)":["pompes"],
  "Rowing poulie basse":["rowingpoulie"], "Face pull":["facepull"], "Farmer walk":["farmer"],
  "Développé militaire haltères assis":["militaire"], "Pallof press":["pallof"]
};

/* ===================== QUESTIONS / RÉPONSES COMMUNES ===================== */
/* c : catégorie · q : question · k : mots-clés · a : réponse ({name} {kcal} {Pg} {steps} {water} {goal} sont remplacés) */
const FAQ_COMMON = [
  // ---- Entraînement
  {c:"Entraînement", q:"Combien de temps dure une séance ?", k:"duree temps combien minutes seance longue", a:"Entre 50 et 65 minutes, échauffement et cardio compris. Si tu as moins de temps, garde les 3 premiers exercices (les plus importants) et raccourcis le cardio."},
  {c:"Entraînement", q:"Je n’ai que 30 minutes aujourd’hui", k:"30 minutes peu temps presse rapide court aujourd dispo", a:"Fais l’échauffement en 3 minutes, puis seulement les 3 premiers exercices de ta séance avec 60 s de repos. Termine par 5 minutes de cardio si tu peux. Une séance courte vaut toujours mieux qu’une séance sautée."},
  {c:"Entraînement", q:"J’ai raté une séance, je fais quoi ?", k:"rate manque oublie seance sautee loupe rattraper", a:"Pas de panique, et pas de double séance. Décale simplement : fais la séance ratée le lendemain et continue dans l’ordre. Si la semaine est trop chargée, 3 séances bien faites suffisent cette semaine-là."},
  {c:"Entraînement", q:"Je peux faire deux séances le même jour ?", k:"deux seances meme jour double rattraper", a:"Non, c’est contre-productif : la fatigue fait baisser la qualité et augmente le risque de blessure. Mieux vaut décaler la séance au lendemain."},
  {c:"Entraînement", q:"Quelle charge choisir ?", k:"charge poids kilos lourd leger choisir haltere combien prendre", a:"Prends une charge avec laquelle tu fais toutes les répétitions demandées en gardant la bonne technique, et où il te resterait 2 ou 3 répétitions « en réserve ». Si tu finis facilement, c’est trop léger. Si la technique se dégrade, c’est trop lourd."},
  {c:"Entraînement", q:"Quand augmenter les charges ?", k:"augmenter progresser charge plus lourd progression quand", a:"Quand tu réussis toutes les séries et toutes les répétitions avec une bonne technique deux séances de suite, ajoute 1 à 2 kg (ou le plus petit cran de la machine). Note tes charges dans ton téléphone pour suivre ta progression."},
  {c:"Entraînement", q:"C’est quoi « répétitions en réserve » ?", k:"repetitions reserve rir signifie veut dire", a:"C’est le nombre de répétitions que tu pourrais encore faire à la fin d’une série. « 2 en réserve » veut dire : tu t’arrêtes alors que tu pourrais en faire encore 2 proprement. Ça permet de progresser sans s’épuiser ni se blesser."},
  {c:"Entraînement", q:"Combien de temps de repos entre les séries ?", k:"repos pause entre series combien temps recuperation", a:"Le temps est indiqué sous chaque exercice (45 à 90 secondes). Le bouton « Lancer la séance » lance le minuteur pour toi et sonne à la fin du repos."},
  {c:"Entraînement", q:"J’ai des courbatures, je m’entraîne quand même ?", k:"courbatures douleur musculaire mal muscles lendemain", a:"Oui, si ce sont de simples courbatures : bouger aide même à les faire passer. Choisis « Fatiguée » dans « Ta forme aujourd’hui » pour alléger la séance. Une douleur vive, articulaire ou qui empire, c’est différent : repos et avis d’un médecin."},
  {c:"Entraînement", q:"J’ai mal au genou ou au dos pendant un exercice", k:"mal genou dos douleur articulation lombaires bless", a:"Arrête l’exercice tout de suite. Vérifie la technique avec la fiche « Comment faire » et baisse la charge. Si la douleur revient, remplace l’exercice (bouton ↻) et parles-en à un médecin ou un kiné. Une douleur n’est jamais normale, contrairement à la sensation de brûlure musculaire."},
  {c:"Entraînement", q:"Une machine est prise, je fais quoi ?", k:"machine prise occupee pas disponible remplacer", a:"Passe à l’exercice suivant et reviens après, ou clique sur ↻ à côté de l’exercice pour voir les remplacements possibles. Chaque fiche « Comment faire » liste aussi deux alternatives."},
  {c:"Entraînement", q:"Je peux faire plus de cardio pour aller plus vite ?", k:"plus cardio vite accelerer perdre rapidement", a:"Un peu, oui : ajouter 10 minutes de marche inclinée ou 2 000 pas par jour aide. Mais doubler le cardio fatigue, donne faim et fait souvent craquer. Les pas au quotidien ({steps}) sont le levier le plus efficace et le plus facile à tenir."},
  {c:"Entraînement", q:"Le cardio, avant ou après la musculation ?", k:"cardio avant apres musculation ordre", a:"Après. Tu fais la musculation quand tu as le plus d’énergie, puis le cardio. Seule exception : 5 minutes de cardio léger au début pour l’échauffement."},
  {c:"Entraînement", q:"Comment bien s’échauffer ?", k:"echauffement echauffer debut commencer", a:"Suis l’échauffement écrit en haut de chaque séance (5 à 8 minutes). Puis fais une première série très légère du premier exercice pour répéter le geste."},
  {c:"Entraînement", q:"Faut-il s’étirer ?", k:"etirement etirer souplesse stretching", a:"Ce n’est pas obligatoire pour les résultats, mais 5 minutes d’étirements doux après la séance font du bien et aident à se détendre. Évite les étirements forcés avant la séance."},
  {c:"Entraînement", q:"Je peux changer les jours de séance ?", k:"changer jours ordre planning semaine decaler", a:"Oui. L’important est de garder l’ordre des séances et d’éviter de faire deux séances jambes deux jours de suite. Par exemple lundi, mardi, jeudi, samedi ou mardi, mercredi, vendredi, dimanche."},
  {c:"Entraînement", q:"J’ai peur du regard des autres à la salle", k:"peur regard gene honte timide salle juge", a:"C’est très fréquent, et en réalité chacun est concentré sur sa propre séance. Va à la salle en heures creuses au début, avec tes écouteurs, et utilise le mode séance sur ton téléphone : tu sais exactement quoi faire, et ça se voit."},
  {c:"Entraînement", q:"Je dois faire des abdos pour avoir le ventre plat ?", k:"abdos ventre plat abdominaux crunch", a:"Les abdos renforcent et gainent la taille, mais ne font pas fondre la graisse du ventre. C’est la perte de poids globale qui l’affine. Le gainage du programme (planche, dead bug) suffit."},
  {c:"Entraînement", q:"Je peux faire du sport pendant mes règles ?", k:"regles menstruations cycle douleurs ventre", a:"Oui, si tu te sens bien. Les jours difficiles, choisis « Fatiguée » pour alléger la séance, ou remplace-la par 30 minutes de marche. C’est aussi normal d’avoir 1 à 2 kg d’eau en plus sur la balance à ce moment-là."},
  {c:"Entraînement", q:"Je ne suis pas essoufflée, ça marche quand même ?", k:"essoufflee transpire pas assez facile efficace", a:"Oui. La musculation n’a pas besoin d’essouffler : c’est la qualité des répétitions qui compte. Si une série te paraît vraiment facile, augmente la charge à la séance suivante."},
  {c:"Entraînement", q:"Je fais quoi les jours de repos ?", k:"repos jour off sans seance recuperation", a:"Tu marches pour faire tes pas ({steps}), tu dors bien et tu manges normalement ton plan. Pas besoin de manger moins les jours de repos."},
  // ---- Nutrition
  {c:"Nutrition", q:"Combien de calories je dois manger ?", k:"calories combien kcal manger par jour", a:"Ton objectif est de {kcal} kcal par jour, avec {Pg} g de protéines. C’est un déficit doux : tu perds du gras sans perdre ton muscle ni ton énergie."},
  {c:"Nutrition", q:"Je dois peser tout ce que je mange ?", k:"peser balance cuisine compter calories application", a:"Pendant 3 à 4 semaines, c’est le meilleur moyen d’apprendre les bonnes portions. Après, tu sauras estimer à l’œil avec la règle de l’assiette (½ légumes, ¼ protéines, ¼ féculents) et tu pourras arrêter."},
  {c:"Nutrition", q:"J’ai faim le soir", k:"faim soir fringale affamee dinner diner nuit", a:"Garde une collation protéinée vers 16-17h, commence le dîner par une soupe de légumes ou une salade, et bois de l’eau. Si la faim reste forte plusieurs jours de suite, dis-le : on déplacera des calories du midi vers le soir."},
  {c:"Nutrition", q:"Envie de sucre, comment faire ?", k:"sucre envie chocolat gateau sucre grignoter craving", a:"Prévois-le au lieu de lutter : 1 ou 2 carrés de chocolat noir, un fruit ou un yaourt avec un peu de miel rentrent dans ta marge plaisir. Les envies baissent nettement quand tu manges assez de protéines et que tu dors bien."},
  {c:"Nutrition", q:"Je grignote, comment arrêter ?", k:"grignoter grignotage arreter snack", a:"Mange à heures fixes, avec une protéine à chaque repas. Ne garde pas de grignotage à portée de main. Et quand l’envie arrive, attends 10 minutes avec un grand verre d’eau ou un thé : souvent, elle passe."},
  {c:"Nutrition", q:"Quelles collations choisir ?", k:"collation gouter encas snack idee", a:"Fromage blanc ou skyr + fruit, un shaker de whey, des tranches de blanc de dinde + pomme, un œuf dur, une poignée d’amandes (15 g). Elles sont aussi dans l’onglet Nutrition."},
  {c:"Nutrition", q:"Je peux manger au restaurant ?", k:"restaurant resto sortir manger dehors", a:"Oui. Choisis une viande ou un poisson grillé, demande des légumes à la place d’une partie des frites, et la sauce à part. Un dessert ou un verre, mais pas les deux. Et ensuite, tu reprends ton plan au repas suivant."},
  {c:"Nutrition", q:"Que prendre au fast-food ?", k:"fast food mcdo burger kebab pizza", a:"Prends un burger simple ou au poulet grillé, une petite portion de frites ou une salade, et une boisson zéro. Pour une pizza : garde 2-3 parts avec une salade. Ça reste un repas plaisir, une fois par semaine maximum."},
  {c:"Nutrition", q:"Je peux manger du pain ?", k:"pain baguette tartine", a:"Oui, en le comptant comme un féculent : 40 à 70 g (environ 1/5 de baguette) à la place du riz ou des pâtes du repas. Le pain complet cale plus longtemps."},
  {c:"Nutrition", q:"Les féculents le soir, ça fait grossir ?", k:"feculents soir grossir glucides pates riz", a:"Non. C’est le total de la journée qui compte, pas l’heure. Des féculents le soir peuvent même aider à mieux dormir."},
  {c:"Nutrition", q:"Je peux sauter le petit-déjeuner ?", k:"sauter petit dejeuner matin pas faim", a:"Oui, si tu n’as pas faim le matin. Répartis alors les calories et les protéines sur les autres repas. L’important, c’est d’atteindre ton total de protéines ({Pg} g) dans la journée."},
  {c:"Nutrition", q:"Je n’aime pas un aliment du menu", k:"aime pas aliment poisson remplacer gout", a:"Remplace-le par un aliment de la même famille : poisson ↔ poulet, dinde ou œufs ; riz ↔ pâtes, pommes de terre ou quinoa ; skyr ↔ fromage blanc ou yaourt grec. Le bouton « Autre idée » propose aussi d’autres repas."},
  {c:"Nutrition", q:"Je suis végétarienne, comment avoir mes protéines ?", k:"vegetarienne vegetarien viande protéines vegan tofu", a:"Œufs, skyr, fromage blanc, yaourt grec, tofu, tempeh, lentilles, pois chiches, edamame, seitan. Une whey (ou protéine végétale) aide à atteindre {Pg} g par jour."},
  {c:"Nutrition", q:"Combien d’eau boire ?", k:"eau boire hydratation litres", a:"Environ {water} par jour, plus les jours de séance. Le plus simple : une gourde le matin, une l’après-midi. Ton urine doit être claire."},
  {c:"Nutrition", q:"Café, thé, boissons zéro : c’est autorisé ?", k:"cafe the boissons zero light coca soda", a:"Oui. Café et thé sans sucre, boissons zéro avec modération. Attention au sucre et au lait ajoutés : ils comptent dans tes calories."},
  {c:"Nutrition", q:"Je peux boire de l’alcool ?", k:"alcool vin biere cocktail soiree verre", a:"Un verre de temps en temps, ça passe. Mais l’alcool apporte des calories sans nourrir, donne faim et abîme le sommeil. Garde-le pour les vraies occasions."},
  {c:"Nutrition", q:"La whey est-elle obligatoire ?", k:"whey proteine poudre obligatoire shaker", a:"Non. C’est juste pratique pour atteindre tes protéines. Si tu en prends, choisis une whey simple, sans additifs « brûle-graisse »."},
  {c:"Nutrition", q:"Et les brûle-graisses ou les compléments ?", k:"brule graisse complement pilule detox minceur the", a:"Inutiles, et parfois dangereux. Aucune pilule ne fait perdre du gras de façon significative. Le seul complément vraiment utile du programme, c’est éventuellement la whey."},
  {c:"Nutrition", q:"Comment faire pendant le Ramadan ?", k:"ramadan jeune iftar ftour shour", a:"Garde tes calories et tes protéines sur la fenêtre de repas : un ftour avec protéines + légumes + féculent, une collation protéinée en soirée, et un shour avec œufs ou skyr et avoine. Entraîne-toi léger (mode « Fatiguée ») avant le ftour, ou plus normalement 1 à 2 heures après. Bois beaucoup entre le ftour et le shour."},
  {c:"Nutrition", q:"Repas de famille ou fêtes", k:"famille fete noel anniversaire repas invite mariage", a:"Profite du repas sans culpabilité : mange d’abord les protéines et les légumes, une seule assiette, un dessert si tu en as envie. Pas de compensation le lendemain : tu reprends simplement ton plan."},
  {c:"Nutrition", q:"Je dois manger moins les jours sans séance ?", k:"moins manger jour repos sans entrainement", a:"Non, garde les mêmes calories. C’est plus simple, et c’est pendant le repos que le corps se répare."},
  // ---- Récupération
  {c:"Récupération", q:"Je dors mal ou moins de 7 heures", k:"dormir sommeil dors mal insomnie nuit fatigue heures", a:"Le sommeil compte autant que la nutrition : moins de 7 h donne plus faim le lendemain. Écrans coupés 30 minutes avant de dormir, chambre fraîche, heure de coucher fixe, et pas de café après 15 h."},
  {c:"Récupération", q:"Je suis très fatiguée", k:"fatiguee epuisee pas energie crevee", a:"Choisis « Fatiguée » dans « Ta forme aujourd’hui » : la séance s’allège automatiquement. Si la fatigue dure plus d’une semaine, vérifie ton sommeil et dis-le : on remontera un peu les calories."},
  {c:"Récupération", q:"Je suis malade, je m’entraîne ?", k:"malade rhume grippe fievre", a:"Fièvre ou symptômes dans la poitrine : repos complet. Petit rhume : une marche ou une séance allégée si tu te sens bien. Reprends normalement dès que tu vas mieux."},
  // ---- Suivi
  {c:"Suivi", q:"Tous les combien me peser ?", k:"peser pesee souvent combien fois balance", a:"1 à 2 fois par semaine, le matin à jeun, après les toilettes. Ce qui compte, c’est la tendance sur 2 semaines, pas le chiffre d’un jour."},
  {c:"Suivi", q:"La balance a pris 1 kg d’un coup", k:"pris kilo balance monte augmente remonte", a:"C’est de l’eau, pas du gras : un repas salé, les règles, une grosse séance ou un mauvais sommeil suffisent. Pour prendre 1 kg de gras, il faudrait manger environ 7 000 kcal de trop. Continue ton plan, ça redescend en 2 à 3 jours."},
  {c:"Suivi", q:"La balance ne bouge pas", k:"stagne stagnation bouge pas plateau balance bloque", a:"Regarde la moyenne sur 2 semaines et ton tour de taille. Si rien ne bouge pendant 3 semaines, vérifie d’abord la précision des portions et le sommeil, puis ajoute 2 000 pas par jour. On ne descend jamais sous 1 400 kcal."},
  {c:"Suivi", q:"Comment mesurer mon tour de taille ?", k:"mesurer tour taille mensuration metre ruban", a:"Le matin, à jeun, debout et détendue. Place le mètre ruban au niveau du nombril, bien horizontal, sans serrer. Note-le chaque semaine dans l’onglet Suivi."},
  {c:"Suivi", q:"Quand vais-je voir des résultats ?", k:"resultats quand voir temps combien semaines", a:"Sur la balance : dès les 2 premières semaines. Dans les vêtements : vers 4 semaines. Sur les photos et dans le miroir : entre 6 et 8 semaines. Prends une photo de face et de profil aujourd’hui, tu seras contente de comparer."},
  {c:"Suivi", q:"Je peux perdre plus vite ?", k:"plus vite rapide accelerer maigrir vite", a:"Le rythme prévu est déjà soutenu. Aller plus vite fait perdre du muscle, donne faim, fatigue et augmente le risque de reprendre ensuite. Le meilleur accélérateur, c’est la régularité : 4 séances et tes pas chaque semaine."},
  {c:"Suivi", q:"Ma peau va-t-elle se relâcher ?", k:"peau relache relachement vergetures detendue", a:"Perdre à un rythme régulier, garder du muscle grâce à la musculation, manger assez de protéines et bien s’hydrater aident la peau à suivre. La génétique joue aussi. Si cela t’inquiète, un dermatologue peut te conseiller."},
  {c:"Suivi", q:"Et la cellulite ?", k:"cellulite peau orange", a:"Elle est normale chez presque toutes les femmes. Elle devient moins visible avec la perte de gras et le renforcement des fessiers et des cuisses, ce que fait justement ton programme."},
  {c:"Motivation", q:"Je perds ma motivation", k:"motivation demotivee envie plus courage abandonner", a:"Normal : la motivation monte et descend, c’est l’habitude qui fait le travail. Réduis l’objectif du jour (juste l’échauffement et un exercice), coche tes séances et regarde tes badges. Et souviens-toi de pourquoi tu as commencé."},
  {c:"Motivation", q:"J’ai craqué ce week-end", k:"craque ecart excès weekend trop mange", a:"Un week-end ne défait pas un mois. Pas de jeûne, pas de compensation : tu reprends ton plan dès le prochain repas. La balance montera peut-être 1 ou 2 jours (eau et sel), puis elle redescendra."},
  {c:"Motivation", q:"Comment rester régulière ?", k:"regulier regularite habitude constante tenir", a:"Fixe tes 4 séances dans ton agenda comme des rendez-vous, prépare ton sac la veille, et prépare tes repas 2 fois par semaine. Le jour où c’est dur, fais la version courte : l’important, c’est de ne pas casser la série."}
];

/* ===================== COACH ===================== */
let chat = [], busy = false, coachOff = false, libCat = "";
const msgsEl = $("#msgs");
const liveCoach = () => !!PIN && !coachOff;
function addMsg(role, html){ const d = document.createElement("div"); d.className = "msg "+role; d.innerHTML = html; msgsEl.appendChild(d); msgsEl.scrollTop = msgsEl.scrollHeight; return d; }
function md(t){ return esc(t).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/^#+\s*/gm,""); }
function fill(a){ const p = P[who]; return a.replace(/\{(\w+)\}/g, (m,k)=> ({name:p.name, kcal:p.kcal.toLocaleString("fr-FR"), Pg:p.Pg, steps:p.steps, water:p.water, goal:p.goal})[k] ?? m); }
function allFaq(){ return (P[who].faq || []).concat(FAQ_COMMON); }

/* ---------- recherche dans les réponses ---------- */
const STOP = new Set("je j tu il elle on nous vous ils le la les l un une des de du d a au aux et ou mais donc que qui quoi est c ce ca ça cet cette mes mon ma me m te t se s en y pas ne n plus pour par sur avec dans comment pourquoi quand combien quel quelle quels quelles faire fait fais suis es ai as avoir etre peux peut dois doit veux faut bien tres trop alors si coach hui moi toi prendre ok oui non stp svp merci bonjour salut".split(" "));
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ");
const toks = s => norm(s).split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
function near(a,b){ if (a === b) return true; const m = Math.min(a.length, b.length); if (m < 4) return false; let i = 0; while (i < m && a[i] === b[i]) i++; return i >= Math.min(5, m); }
let FAQ_IDX = null;
function scoreFaq(q){
  const all = allFaq();
  if (!FAQ_IDX || FAQ_IDX.n !== all.length) FAQ_IDX = {n: all.length, kw: all.map(f => toks(f.k + " " + f.q))};
  const qt = [...new Set(toks(q))];
  const hits = qt.map(w => FAQ_IDX.kw.map(kw => kw.some(k => near(w,k))));
  const df = hits.map(h => h.filter(Boolean).length);
  return all.map((f,i) => {
    let s = 0, n = 0;
    qt.forEach((w,j) => { if (hits[j][i]){ s += (w.length >= 5 ? 1.5 : 1) / Math.sqrt(df[j]); n++; } });
    return {f, s, cov: qt.length ? n / qt.length : 0};
  }).sort((a,b)=>b.s-a.s || b.cov-a.cov);
}
function findGuide(q){
  const n = norm(q); let best = null;
  Object.entries(GUIDES).forEach(([key,g]) => {
    const words = toks(g.n).filter(w => w.length >= 4);
    const hit = words.filter(w => n.includes(w)).length;
    if (hit && (!best || hit > best.hit)) best = {key, hit};
  });
  return best ? best.key : null;
}

/* ---------- actions comprises sans le coach en direct ---------- */
function offlineActions(q){
  const n = norm(q);
  const kg = q.match(/(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:kg|kilo)/i) || (/(pes|poids|fais|balance)/.test(n) && q.match(/\b(\d{2,3}(?:[.,]\d{1,2})?)\b(?!\s*(?:min|pas|kcal|cal|%|sec|s\b|fois|rep|g\b|ans|cm|km))/i));
  if (kg){
    const v = parseFloat(kg[1].replace(",", "."));
    if (v >= 40 && v <= 150){
      const prev = latestW(who); addWeight(v, iso(today()));
      const d = Math.round((v - prev)*10)/10, rest = Math.round((v - P[who].goal)*10)/10;
      return `C’est noté : **${fmt(v)} kg** aujourd’hui (${d <= 0 ? fmt(-d)+" kg de moins" : "+"+fmt(d)+" kg"} depuis la dernière pesée). Il reste ${fmt(Math.max(0,rest))} kg avant ${P[who].goal} kg. ${d > 0.4 ? "Une hausse d’un jour, c’est de l’eau : regarde la tendance sur 2 semaines." : "Continue comme ça !"}`;
    }
  }
  const se = n.match(/seance\s*(?:n\s*)?([1-4])/);
  if (se && /(fait|fini|termine|valide|boucle)/.test(n)){
    const si = +se[1]-1; if (!weekDone(who).includes(si)) toggleDone(si, true);
    return `Séance ${si+1} validée pour cette semaine. Tu en es à **${weekDone(who).length} / ${P[who].freq}**. Bravo !`;
  }
  return null;
}
function offlineAnswer(q){
  const act = offlineActions(q); if (act) return {html: md(act)};
  const exact = allFaq().find(f => f.q === q); if (exact) return {html: md(fill(exact.a))};
  const g = findGuide(q);
  const ranked = scoreFaq(q);
  if (g && /(comment|faire|explique|comprends|technique|position|geste|quoi|c est)/.test(norm(q)) && !(ranked[0] && ranked[0].s >= 1.5 && ranked[0].cov >= 0.5)){
    const G = GUIDES[g];
    return {html: md(`**${G.n}** : ${G.st.join(" ")}`) + `<br><button class="howlink" data-gkey="${g}">Voir la fiche complète</button>`};
  }
  if (ranked[0] && ranked[0].s >= 0.8 && ranked[0].cov >= 0.3){
    const top = ranked[0].f, more = ranked.slice(1,3).filter(r => r.s >= 0.6);
    let h = `<b>${esc(top.q)}</b>\n` + md(fill(top.a));
    if (more.length) h += `<div class="sugg" style="padding:8px 0 0">${more.map(r=>`<button data-q="${esc(r.f.q)}">${esc(r.f.q)}</button>`).join("")}</div>`;
    return {html: h};
  }
  const sug = ranked.slice(0,3).filter(r=>r.s>0);
  return {html: md("Je n’ai pas de réponse toute prête à cette question.") + (sug.length ? `<div class="sugg" style="padding:8px 0 0">${sug.map(r=>`<button data-q="${esc(r.f.q)}">${esc(r.f.q)}</button>`).join("")}</div>` : "") + `<br><button class="howlink" id="openLib">Parcourir toutes les réponses</button>`};
}

function resetChat(){
  chat = []; msgsEl.innerHTML = ""; busy = false;
  const p = P[who]; const faq = allFaq();
  addMsg("c", md(`Salut ${p.name} ! Je suis ton coach. Pose-moi ta question, choisis-en une ci-dessous ou parcours les ${faq.length} réponses déjà prêtes. Tu peux aussi me dire ton poids du jour (« je fais 74,8 ») : je l’enregistre.`));
  $("#sugg").innerHTML = (p.faq||[]).slice(0,4).map(f=>`<button data-q="${esc(f.q)}">${esc(f.q)}</button>`).join("") + `<button class="more" id="openLib">Toutes les réponses (${faq.length})</button>`;
  $("#coachSub").textContent = `Coach de ${p.name} · connaît ton programme`;
}

/* ---------- bibliothèque ---------- */
function openLib(){ $("#coach").classList.remove("open"); $("#lib").classList.add("open"); $("#libQ").value = ""; libCat = ""; renderLib(); setTimeout(()=>$("#libQ").focus(), 50); }
function renderLib(){
  const all = allFaq(); const cats = [...new Set(all.map(f=>f.c))];
  $("#libCats").innerHTML = [["","Tout"]].concat(cats.map(c=>[c,c])).map(([v,l])=>`<button data-libcat="${esc(v)}" aria-pressed="${v===libCat}">${esc(l)}</button>`).join("");
  const q = $("#libQ").value.trim();
  let list = all.filter(f => !libCat || f.c === libCat);
  if (q){ const sc = new Map(scoreFaq(q).map(r=>[r.f, r.s])); list = list.filter(f=>sc.get(f) > 0 || norm(f.q).includes(norm(q))).sort((a,b)=>sc.get(b)-sc.get(a)); }
  let html = "", last = null;
  list.forEach(f => { if (!q && f.c !== last){ html += `<div class="cat">${esc(f.c)}</div>`; last = f.c; } html += `<details><summary>${esc(f.q)}</summary><p>${md(fill(f.a))}</p></details>`; });
  $("#libList").innerHTML = html || `<p style="color:var(--muted)">Aucune réponse trouvée. Pose la question directement au coach.</p>`;
}
$("#libQ").addEventListener("input", renderLib);

/* ---------- fiche exercice ---------- */
function guideHtml(g, focusAlt){
  return `<h3>${esc(g.n)}</h3>
    <div class="chips">${g.m.map(x=>`<span class="chip">${esc(x)}</span>`).join("")}</div>
    <div class="g-sec"><b class="lab">Installation</b><p>${esc(g.set)}</p></div>
    <div class="g-sec"><b class="lab">Le mouvement</b><ol>${g.st.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></div>
    <div class="g-sec"><b class="lab">Respiration</b><p>${esc(g.b)}</p></div>
    <div class="g-sec"><b class="lab">Erreurs à éviter</b><ul>${g.err.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>
    <div class="g-two"><div><b>Trop dur ?</b>${esc(g.easy)}</div><div><b>Trop facile ?</b>${esc(g.hard)}</div></div>
    <div class="g-two"><div class="${focusAlt?'g-alt':''}" style="grid-column:1/-1"><b>Machine prise ou exercice impossible ? Remplace par</b>${g.alt.map(esc).join(" · ")}</div></div>
    <div class="g-act"><a class="btn ghost" href="https://www.youtube.com/results?search_query=${encodeURIComponent(g.yt)}" target="_blank" rel="noopener">▶ Voir des vidéos de démonstration</a></div>`;
}
function openGuide(ex, focusAlt){
  const keys = Array.isArray(ex) ? ex : GUIDE_OF[ex.n]; if (!keys) return;
  const title = Array.isArray(ex) ? GUIDES[keys[0]].n : ex.n;
  $("#guideIn").innerHTML = `<button class="close" data-sheetclose="1" aria-label="Fermer">✕</button>
    <div class="eyebrow">Comment faire</div><h2>${esc(title)}</h2>
    ${!Array.isArray(ex) && ex.c ? `<p style="margin:0;color:var(--muted)">${esc(ex.c)}</p>` : ""}
    ${keys.map(k=>guideHtml(GUIDES[k], focusAlt)).join("")}
    <div class="g-act"><button class="btn" data-askg="${esc("Je ne comprends pas bien l’exercice « " + title + " », tu peux m’expliquer autrement ?")}">Je ne comprends toujours pas : demander au coach</button></div>`;
  $("#guide").classList.add("open"); $("#guideIn").scrollTop = 0;
}
document.addEventListener("click", e => {
  const gk = e.target.closest("[data-gkey]"); if (gk) openGuide([gk.dataset.gkey]);
  if (e.target.classList && e.target.classList.contains("sheet")) e.target.classList.remove("open");
});
document.addEventListener("keydown", e => { if (e.key === "Escape") document.querySelectorAll(".sheet.open").forEach(x=>x.classList.remove("open")); });

/* ---------- coach en direct (si la clé API est configurée) ---------- */
function context(){
  const p = P[who]; const ph = p.phases[curPhaseIdx(p)]; const pi = Math.min(curPhaseIdx(p),2);
  const sess = p.sessions.map((s,i)=>`Séance ${i+1} (${s.day}) ${s.title} : ` + s.ex.map(e=>e.n+" "+(e.cardio?e.cardio[pi]:e.p[pi].join("×"))).join(" ; ")).join("\n");
  const meals = p.meals.map(m=>m.k+" : "+m.opts.map(o=>`${o.n} (${o.kcal} kcal, ${o.p} g P)`).join(" / ")).join("\n");
  const w = [...S[who].weights].sort((a,b)=>a.d.localeCompare(b.d)).map(x=>`${x.d} : ${x.kg} kg${x.waist?`, taille ${x.waist} cm`:""}`).join(" ; ") || "aucune pesée enregistrée";
  return `Tu es le coach sportif et nutrition personnel de ${p.name}, avec 10 ans d’expérience. Tu tutoies, tu es chaleureux, direct et concret. Réponds en français, en 120 mots maximum sauf si on te demande plus de détails. Pas de titres markdown ; tu peux utiliser **gras** et des listes courtes avec des tirets.
Sécurité : jamais moins de 1 400 kcal par jour, pas de jeûne punitif, pas de compléments brûle-graisse, pas de restriction d’eau. Douleur, malaise ou question médicale : conseille de consulter un médecin. Si tu perçois une relation difficile à la nourriture, réponds avec bienveillance et suggère d’en parler à un professionnel.
Actions : si ${p.name} te donne son poids du jour, commence ta réponse par la balise [POIDS:74.8] (avec son poids, point décimal). Si elle dit avoir fait une séance du programme, commence par [SEANCE:n] avec n de 1 à 4. Ces balises sont invisibles pour elle et enregistrent l’info dans son suivi.
Pour expliquer un exercice, décris l’installation, le mouvement étape par étape, la respiration et les erreurs fréquentes, avec des images simples.

Date du jour : ${iso(today())} (semaine ${weekNo()} du programme, phase « ${ph.n} » : ${ph.txt})
${p.name}, ${p.age} ans, 1,65 m, départ ${p.w0} kg, objectif ${p.goal} kg, poids actuel ${latestW(who)} kg. ${p.profil}
Plan nutrition : ${p.kcal} kcal, ${p.Pg} g protéines, ${p.Gg} g glucides, ${p.Lg} g lipides, eau ${p.water}, ${p.steps}.
Règles : ${p.rules.map(r=>r[0]).join(" ; ")}.
Repas proposés :
${meals}
Programme (4 séances/semaine, phase actuelle) :
${sess}
Pesées : ${w}
Séances validées cette semaine : ${weekDone(who).map(i=>i+1).join(", ") || "aucune"}.`;
}
function applyTags(text){
  const mw = text.match(/\[POIDS:\s*([\d.,]+)\]/i);
  if (mw){ if (addWeight(mw[1].replace(",","."), iso(today()))) toast("Pesée enregistrée par le coach"); }
  const ms = text.match(/\[SEANCE:\s*([1-4])\]/i);
  if (ms){ const si = +ms[1]-1; if (!weekDone(who).includes(si)) toggleDone(si, true); }
  return text.replace(/\[(POIDS|SEANCE):[^\]]*\]\s*/gi, "");
}
async function ask(q){
  if (!q || busy) return;
  openCoach();
  addMsg("u", esc(q));
  const exact = allFaq().find(f => f.q === q);
  if (exact || !liveCoach()){
    const r = offlineAnswer(q);
    setTimeout(()=>{ addMsg("c", r.html); }, 300);
    return;
  }
  chat.push({role:"user", content:q});
  busy = true;
  const bubble = addMsg("c", '<span class="typing"><i></i><i></i><i></i></span>');
  try {
    const r = await fetch(CFG.url + "/functions/v1/coach", {method:"POST", headers:{"Content-Type":"application/json", apikey:CFG.key}, body: JSON.stringify({athlete:who, pin:PIN, system:context(), messages:chat})});
    const j = await r.json().catch(()=>({}));
    if (r.status === 503){ coachOff = true; chat.pop(); bubble.innerHTML = offlineAnswer(q).html; return; }
    if (r.status === 401){ chat.pop(); forgetPin(); bubble.innerHTML = offlineAnswer(q).html; return; }
    if (!r.ok || !j.text) throw new Error("coach");
    bubble.innerHTML = md(applyTags(j.text));
    chat.push({role:"assistant", content:j.text});
  } catch(err){
    chat.pop();
    bubble.innerHTML = offlineAnswer(q).html;
  } finally { busy = false; msgsEl.scrollTop = msgsEl.scrollHeight; }
}
$("#compose").addEventListener("submit", e=>{ e.preventDefault(); const v = $("#q").value.trim(); if (v){ $("#q").value = ""; ask(v); } });
function openCoach(){ $("#coach").classList.add("open"); }
$("#fab").addEventListener("click", openCoach);
$("#coachClose").addEventListener("click", ()=>$("#coach").classList.remove("open"));

/* ===================== DÉMARRAGE ===================== */
renderAll(); resetChat(); renderSync();
loadCloud();
try { if (!PIN && !localStorage.getItem(LSK+"-seen")) showLock(); } catch(e){ showLock(); }
