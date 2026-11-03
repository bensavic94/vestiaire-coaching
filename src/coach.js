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

