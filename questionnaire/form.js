/* Le Vestiaire : moteur du questionnaire (une étape par section, sauvegarde auto sur l'appareil) */
(() => {
const LSK = "vestiaire-bilan-v1";
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const N = SECTIONS.length;

let D = {}, step = -1;
try { const o = JSON.parse(localStorage.getItem(LSK) || "null"); if (o && o.D) { D = o.D; step = Math.min(o.step ?? -1, N - 1); } } catch (e) {}
if (D._envoye) step = N;

const save = () => { try { localStorage.setItem(LSK, JSON.stringify({ D, step })); $("#saved").textContent = "Enregistré sur ton téléphone"; } catch (e) {} };
const visible = f => !f.si || f.si(D);

/* ---------- rendu d'un champ ---------- */
function field(f) {
  const id = "f_" + f.k, req = f.requis ? '<span class="req" aria-hidden="true">*</span>' : "";
  const aide = f.aide ? `<p class="aide">${esc(f.aide)}</p>` : "";
  const v = D[f.k];
  const attrs = `id="${id}" name="${f.k}" ${f.requis ? "required" : ""} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ""} ${f.auto ? `autocomplete="${f.auto}"` : ""}`;
  let inner = "";
  switch (f.type) {
    case "text": case "email": case "tel": case "date":
      inner = `<input class="in" type="${f.type}" ${attrs} value="${esc(v)}" ${f.type === "date" ? 'style="max-width:220px"' : ""}>`; break;
    case "number":
      inner = `<div class="unit"><input class="in" type="number" inputmode="decimal" ${attrs} value="${esc(v)}" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} step="${f.step || 1}">${f.unite ? `<em>${f.unite}</em>` : ""}</div>`; break;
    case "textarea":
      inner = `<textarea class="in" ${attrs}>${esc(v)}</textarea>`; break;
    case "choix": case "multi": {
      const multi = f.type === "multi", arr = multi ? (v || []) : [v];
      inner = `<div class="chips" role="${multi ? "group" : "radiogroup"}">` + f.options.map(o =>
        `<label class="chip"><input type="${multi ? "checkbox" : "radio"}" name="${f.k}" value="${esc(o)}" ${arr.includes(o) ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")
        + (f.autre ? `<label class="chip"><input type="${multi ? "checkbox" : "radio"}" name="${f.k}" value="Autre" ${arr.includes("Autre") ? "checked" : ""}><span>Autre</span></label>` : "") + `</div>`;
      if (f.autre && arr.includes("Autre")) inner += `<input class="in autre" data-autre="${f.k}" placeholder="Précise…" value="${esc(D[f.k + "_autre"])}">`;
      return `<fieldset class="f" data-k="${f.k}"><legend>${esc(f.label)}${req}</legend>${aide}${inner}<p class="msg">Choisis au moins une réponse.</p></fieldset>`;
    }
    case "echelle":
      inner = `<div class="chips scale" role="radiogroup">` + Array.from({ length: 10 }, (_, i) => i + 1).map(n =>
        `<label class="chip"><input type="radio" name="${f.k}" value="${n}" ${String(v) === String(n) ? "checked" : ""}><span>${n}</span></label>`).join("")
        + `</div><div class="scale-l"><span>${esc(f.bas)}</span><span>${esc(f.haut)}</span></div>`;
      return `<fieldset class="f" data-k="${f.k}"><legend>${esc(f.label)}${req}</legend>${aide}${inner}<p class="msg">Choisis une note.</p></fieldset>`;
    case "accord":
      return `<div class="f" data-k="${f.k}"><label class="accord"><input type="checkbox" name="${f.k}" ${v ? "checked" : ""}><span>${esc(f.label)}</span></label><p class="msg">Nécessaire pour envoyer ton bilan.</p></div>`;
  }
  return `<div class="f" data-k="${f.k}"><label for="${id}">${esc(f.label)}${req}</label>${aide}${inner}<p class="msg">${f.type === "email" ? "Vérifie ton e-mail." : f.type === "number" ? "Vérifie ce nombre." : "Ce champ est nécessaire."}</p></div>`;
}

/* ---------- écrans ---------- */
function intro() {
  return `<div class="hero fade">
    <div class="kicker">Bilan d'inscription</div>
    <h1>On construit ton programme, sur mesure.</h1>
    <p>Réponds à ces questions le plus honnêtement possible : ton entraînement et ton plan nutrition (avec ton budget et tes allergies) seront construits à partir de tes réponses.</p>
    <p>Compte environ <b>8 minutes</b>. Tes réponses sont enregistrées au fur et à mesure : tu peux t'arrêter et reprendre plus tard sur ce téléphone.</p>
    <ol class="steps-list">${SECTIONS.map((s, i) => `<li><span>${i + 1}</span>${esc(s.titre)}</li>`).join("")}</ol>
    <button type="button" class="btn big" id="start">${Object.keys(D).length ? "Reprendre mon bilan" : "Commencer"}</button>
  </div>`;
}
function done() {
  return `<div class="done fade"><div class="ok" aria-hidden="true">✓</div>
    <h1>Merci ${esc(D.prenom || "")} !</h1>
    <p>Ton bilan est bien arrivé chez Ben et Kevin. On analyse tes réponses et on revient vers toi avec ton programme sport et nutrition.</p>
    <p>Une question d'ici là ? Réponds simplement au message qui t'a envoyé ce lien.</p>
    <p style="margin-top:22px"><button type="button" class="btn ghost" id="again">Remplir pour une autre personne</button></p></div>`;
}
function section(i) {
  const s = SECTIONS[i];
  return `<div class="fade"><div class="sec-head"><div class="kicker">Étape ${i + 1} sur ${N}</div><h2>${esc(s.titre)}</h2><p>${esc(s.sous)}</p></div>
    ${s.champs.filter(visible).map(field).join("")}</div>`;
}

function render(focus = true) {
  const app = $("#app");
  app.innerHTML = step < 0 ? intro() : step >= N ? done() : section(step);
  $("#nav").hidden = step < 0 || step >= N;
  const p = step < 0 ? 0 : step >= N ? 100 : Math.round(step / N * 100);
  $("#bar").style.width = p + "%";
  $("#progTxt").textContent = step >= 0 && step < N ? `${step + 1} / ${N}` : "";
  $("#prev").textContent = step === 0 ? "Accueil" : "Retour";
  $("#next").textContent = step === N - 1 ? "Envoyer mon bilan" : "Continuer";
  $("#alert").classList.remove("on");
  if (focus) window.scrollTo({ top: 0, behavior: "smooth" });
  $("#start")?.addEventListener("click", () => go(0));
  $("#again")?.addEventListener("click", () => { D = {}; step = -1; save(); render(); });
}

/* ---------- saisie ---------- */
function rerenderKeep() {
  const y = window.scrollY, a = document.activeElement, nm = a?.name, val = a?.value, ak = a?.dataset?.autre;
  render(false); window.scrollTo(0, y);
  const el = ak ? document.querySelector(`[data-autre="${ak}"]`) : nm ? document.querySelector(`[name="${nm}"]${a.type === "radio" || a.type === "checkbox" ? `[value="${CSS.escape(val)}"]` : ""}`) : null;
  el?.focus({ preventScroll: true });
}
$("#app").addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.autre) { D[t.dataset.autre + "_autre"] = t.value; save(); return; }
  const k = t.name; if (!k) return;
  const f = SECTIONS.flatMap(s => s.champs).find(x => x.k === k); if (!f) return;
  const before = SECTIONS[step]?.champs.filter(visible).map(x => x.k).join();
  let structural = false;
  if (f.type === "multi") {
    let arr = [...document.querySelectorAll(`input[name="${k}"]:checked`)].map(x => x.value);
    const excl = ["Aucune", "Aucun", "Rien du tout", "Pas de préférence", "Je mange de tout"];
    if (t.checked && excl.includes(t.value)) arr = [t.value];
    else if (t.checked) arr = arr.filter(x => !excl.includes(x));
    const hadAutre = (D[k] || []).includes("Autre");
    D[k] = arr; structural = arr.length !== document.querySelectorAll(`input[name="${k}"]:checked`).length || hadAutre !== arr.includes("Autre");
  } else if (f.type === "accord") D[k] = t.checked;
  else if (f.type === "number") D[k] = t.value === "" ? "" : t.value;
  else { const had = f.autre && D[k] === "Autre"; D[k] = t.value; structural = f.autre && had !== (t.value === "Autre"); }
  t.closest(".f")?.classList.remove("err");
  save();
  const after = SECTIONS[step]?.champs.filter(visible).map(x => x.k).join();
  if (structural || before !== after) rerenderKeep();
});

/* ---------- validation ---------- */
function check() {
  let first = null;
  for (const f of SECTIONS[step].champs.filter(visible)) {
    const v = D[f.k], el = document.querySelector(`.f[data-k="${f.k}"]`);
    let ok = true;
    if (f.requis) ok = f.type === "multi" ? (v || []).length > 0 : f.type === "accord" ? !!v : String(v ?? "").trim() !== "";
    if (ok && v !== "" && v != null && f.type === "email") ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());
    if (ok && v !== "" && v != null && f.type === "number") { const n = Number(String(v).replace(",", ".")); ok = !isNaN(n) && (f.min == null || n >= f.min) && (f.max == null || n <= f.max); }
    el?.classList.toggle("err", !ok);
    if (!ok && !first) first = el;
  }
  if (first) { first.scrollIntoView({ behavior: "smooth", block: "center" }); first.querySelector("input,textarea")?.focus({ preventScroll: true }); }
  return !first;
}

function go(i) { step = i; save(); render(); }

async function send() {
  const btn = $("#next"); btn.disabled = true; btn.textContent = "Envoi…";
  const out = { _version: 1, _envoye_le: new Date().toISOString() };
  for (const s of SECTIONS) for (const f of s.champs) if (visible(f) && D[f.k] !== undefined && D[f.k] !== "") {
    out[f.k] = f.type === "number" ? Number(String(D[f.k]).replace(",", ".")) : D[f.k];
    if (f.autre && D[f.k + "_autre"]) out[f.k + "_autre"] = D[f.k + "_autre"];
  }
  out.consentement = D.consentement ? "true" : "false";
  try {
    const r = await fetch(SB_URL + "/rest/v1/rpc/questionnaire_envoyer", {
      method: "POST", headers: { "Content-Type": "application/json", apikey: SB_KEY }, body: JSON.stringify({ p_data: out })
    });
    if (!r.ok) { const t = await r.text(); throw new Error(/trop_de_demandes/.test(t) ? "Beaucoup d'envois en ce moment : réessaie dans quelques minutes." : "L'envoi n'a pas marché. Vérifie ta connexion et réessaie."); }
    D = { prenom: D.prenom, _envoye: true }; step = N; save(); render();
  } catch (e) {
    const a = $("#alert"); a.textContent = e.message.startsWith("L'envoi") || e.message.startsWith("Beaucoup") ? e.message : "L'envoi n'a pas marché. Vérifie ta connexion et réessaie. Tes réponses sont gardées."; a.classList.add("on");
    btn.disabled = false; btn.textContent = "Envoyer mon bilan";
  }
}

$("#next").addEventListener("click", () => { if (!check()) return; step === N - 1 ? send() : go(step + 1); });
$("#prev").addEventListener("click", () => go(step - 1));
$("#app").addEventListener("submit", e => e.preventDefault());
render(false);
})();
