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

