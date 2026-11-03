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
