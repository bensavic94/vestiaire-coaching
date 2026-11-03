
/* ===================== DONNÉES ===================== */
const START = "2026-11-02"; // lundi de la semaine 1


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
            <button class="alt" data-alt="${si}-${ei}" title="Demander une alternative au coach" aria-label="Alternative à ${esc(e.n)}">↻</button>
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
  else if (t.dataset.alt){ const [si,ei] = t.dataset.alt.split("-").map(Number); const ex = P[who].sessions[si].ex[ei];
    ask(`Propose-moi 2 alternatives à « ${ex.n} » (séance ${P[who].sessions[si].title}) qui travaillent les mêmes muscles, avec séries et répétitions.`); }
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

/* ===================== COACH ===================== */
let chat = [], busy = false, coachOff = false;
const msgsEl = $("#msgs");
function addMsg(role, html){ const d = document.createElement("div"); d.className = "msg "+role; d.innerHTML = html; msgsEl.appendChild(d); msgsEl.scrollTop = msgsEl.scrollHeight; return d; }
function md(t){ return esc(t).replace(/\*\*(.+?)\*\*/g,"<b>$1</b>").replace(/^#+\s*/gm,""); }
function resetChat(){
  chat = []; msgsEl.innerHTML = ""; busy = false;
  const p = P[who];
  addMsg("c", md(`Salut ${p.name} ! Je suis ton coach. Je connais ton programme, ton plan alimentaire et tes pesées. Demande-moi une alternative à un exercice, une idée de repas au resto, ou dis-moi simplement ton poids du jour : je l’enregistre.`));
  $("#sugg").innerHTML = Object.keys(p.faq).map(q=>`<button data-q="${esc(q)}">${esc(q)}</button>`).join("");
  $("#coachSub").textContent = `Coach de ${p.name} · connaît ton programme`;
}
function context(){
  const p = P[who]; const ph = p.phases[curPhaseIdx(p)]; const pi = Math.min(curPhaseIdx(p),2);
  const sess = p.sessions.map((s,i)=>`Séance ${i+1} (${s.day}) ${s.title} : ` + s.ex.map(e=>e.n+" "+(e.cardio?e.cardio[pi]:e.p[pi].join("×"))).join(" ; ")).join("\n");
  const meals = p.meals.map(m=>m.k+" : "+m.opts.map(o=>`${o.n} (${o.kcal} kcal, ${o.p} g P)`).join(" / ")).join("\n");
  const w = [...S[who].weights].sort((a,b)=>a.d.localeCompare(b.d)).map(x=>`${x.d} : ${x.kg} kg${x.waist?`, taille ${x.waist} cm`:""}`).join(" ; ") || "aucune pesée enregistrée";
  return `Tu es le coach sportif et nutrition personnel de ${p.name}, avec 10 ans d’expérience. Tu tutoies, tu es chaleureux, direct et concret. Réponds en français, en 120 mots maximum sauf si on te demande plus de détails. Pas de titres markdown ; tu peux utiliser **gras** et des listes courtes avec des tirets.
Sécurité : jamais moins de 1 400 kcal par jour, pas de jeûne punitif, pas de compléments brûle-graisse, pas de restriction d’eau. Douleur, malaise ou question médicale : conseille de consulter un médecin. Si tu perçois une relation difficile à la nourriture, réponds avec bienveillance et suggère d’en parler à un professionnel.
Actions : si ${p.name} te donne son poids du jour, commence ta réponse par la balise [POIDS:74.8] (avec son poids, point décimal). Si elle dit avoir fait une séance du programme, commence par [SEANCE:n] avec n de 1 à 4. Ces balises sont invisibles pour elle et enregistrent l’info dans son suivi.

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
  let out = text;
  const mw = out.match(/\[POIDS:\s*([\d.,]+)\]/i);
  if (mw){ if (addWeight(mw[1].replace(",","."), iso(today()))) toast("Pesée enregistrée par le coach"); }
  const ms = out.match(/\[SEANCE:\s*([1-4])\]/i);
  if (ms){ const si = +ms[1]-1; if (!weekDone(who).includes(si)) toggleDone(si, true); }
  return out.replace(/\[(POIDS|SEANCE):[^\]]*\]\s*/gi, "");
}
async function ask(q){
  if (!q || busy) return;
  openCoach();
  addMsg("u", esc(q));
  const p = P[who];
  const offline = () => p.faq[q] || "Le coach en direct n’est pas encore activé. En attendant, choisis une des questions proposées juste au-dessus : j’y ai déjà répondu.";
  if (coachOff || !PIN){
    setTimeout(()=>addMsg("c", md(PIN ? offline() : (p.faq[q] || "Entre ton code personnel pour discuter avec le coach en direct. En attendant, les questions proposées ont déjà leur réponse."))), 350);
    if (!PIN) setTimeout(showLock, 900);
    return;
  }
  chat.push({role:"user", content:q});
  busy = true;
  const bubble = addMsg("c", '<span class="typing"><i></i><i></i><i></i></span>');
  try {
    const r = await fetch(CFG.url + "/functions/v1/coach", {method:"POST", headers:{"Content-Type":"application/json", apikey:CFG.key}, body: JSON.stringify({athlete:who, pin:PIN, system:context(), messages:chat})});
    const j = await r.json().catch(()=>({}));
    if (r.status === 503){ coachOff = true; chat.pop(); bubble.innerHTML = md(offline()); return; }
    if (r.status === 401){ chat.pop(); bubble.innerHTML = md("Ton code n’est plus reconnu. Entre-le à nouveau."); forgetPin(); return; }
    if (!r.ok || !j.text) throw new Error("coach");
    const clean = applyTags(j.text);
    bubble.innerHTML = md(clean);
    chat.push({role:"assistant", content:j.text});
  } catch(err){
    chat.pop();
    bubble.innerHTML = md(p.faq[q] || "Je n’ai pas pu répondre. Vérifie ta connexion et réessaie.");
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
