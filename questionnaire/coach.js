/* Le Vestiaire : espace coach, lecture des bilans (protégé par code) */
(() => {
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const CK = "vestiaire-coach-code";
const STATUTS = { nouveau: "Nouveau", en_cours: "En cours", programme_fait: "Programme fait", archive: "Archivé" };
const FIELDS = SECTIONS.flatMap(s => s.champs);
let CODE = ""; try { CODE = localStorage.getItem(CK) || ""; } catch (e) {}
let ROWS = [], cur = null, filtre = "actifs", q = "";

const rpc = async (fn, args) => {
  const r = await fetch(SB_URL + "/rest/v1/rpc/" + fn, { method: "POST", headers: { "Content-Type": "application/json", apikey: SB_KEY }, body: JSON.stringify(args) });
  if (!r.ok) { const t = await r.text(); throw new Error(/code_invalide/.test(t) ? "code" : "reseau"); }
  return r.json();
};
const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 1800); };
const dateFr = s => new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const num = v => v === undefined || v === "" || v === null ? null : Number(v);

function val(d, f) {
  let v = d[f.k];
  if (v === undefined || v === "" || (Array.isArray(v) && !v.length)) return null;
  if (Array.isArray(v)) v = v.map(x => x === "Autre" && d[f.k + "_autre"] ? d[f.k + "_autre"] : x).join(", ");
  else if (v === "Autre" && d[f.k + "_autre"]) v = d[f.k + "_autre"];
  if (f.type === "number") v = String(v).replace(".", ",") + (f.unite ? " " + f.unite : "");
  if (f.type === "echelle") v = v + " / 10";
  if (f.type === "date") v = new Date(v).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  if (f.type === "accord") v = d[f.k] === "true" || d[f.k] === true ? "Oui" : "Non";
  return String(v);
}
function kpis(d) {
  const p = num(d.poids), t = num(d.taille), g = num(d.poids_vise);
  const imc = p && t ? p / ((t / 100) ** 2) : null;
  return [
    ["Âge", d.age ? d.age + " ans" : "—"], ["Taille", t ? t + " cm" : "—"], ["Poids", p ? String(p).replace(".", ",") + " kg" : "—"],
    ["Visé", g ? String(g).replace(".", ",") + " kg" : "—"], ["Écart", p && g ? (g - p > 0 ? "+" : "") + String(Math.round((g - p) * 10) / 10).replace(".", ",") + " kg" : "—"],
    ["IMC", imc ? imc.toFixed(1).replace(".", ",") : "—"], ["Séances", d.seances ? d.seances + " / sem." : "—"], ["Budget", d.budget || "—"],
  ];
}
function flags(d) {
  const out = [];
  if (d.avis_medical === "Oui") out.push("Un médecin lui a déconseillé le sport : demander un certificat avant de commencer.");
  if (d.grossesse && d.grossesse !== "Non") out.push("Grossesse / post-partum : programme adapté et accord médical nécessaires.");
  const path = (d.pathologies || []).filter(x => x !== "Aucun");
  if (path.length) out.push("Santé : " + path.map(x => x === "Autre" ? d.pathologies_autre || "autre" : x).join(", "));
  const all = (d.allergies || []).filter(x => x !== "Aucune");
  if (all.length) out.push("Allergies : " + all.map(x => x === "Autre" ? d.allergies_autre || "autre" : x).join(", "));
  if (["Je culpabilise souvent", "C'est compliqué"].includes(d.rapport_nourriture)) out.push("Rapport à la nourriture difficile : éviter un plan trop strict, rester bienveillant.");
  if (d.seances && d.jours && d.jours.length < Number(d.seances)) out.push(`Veut ${d.seances} séances mais seulement ${d.jours.length} jour(s) disponible(s).`);
  const p = num(d.poids), t = num(d.taille); if (p && t && p / ((t / 100) ** 2) < 18.5) out.push("IMC sous 18,5 : pas de déficit calorique.");
  return out;
}

/* Fiche texte à coller dans Claude pour générer le programme */
function fiche(r) {
  const d = r.data;
  let s = `Agis comme un coach sportif et nutrition avec 10 ans d'expérience. Construis le programme sport ET le programme nutrition de ${r.prenom}, adaptés à son profil, son objectif, ses disponibilités, son budget courses et ses allergies. Présente-le de façon très esthétique, comme pour Aya et Camélia.\n\n`;
  s += `===== BILAN DE ${r.prenom.toUpperCase()}${r.nom ? " " + r.nom.toUpperCase() : ""} (reçu le ${dateFr(r.created_at)}) =====\n`;
  const fl = flags(d); if (fl.length) s += `\n⚠ Points d'attention :\n- ${fl.join("\n- ")}\n`;
  for (const sec of SECTIONS) {
    const lines = sec.champs.filter(f => !["consentement", "email", "tel", "nom", "source"].includes(f.k)).map(f => [f, val(d, f)]).filter(x => x[1]);
    if (!lines.length) continue;
    s += `\n## ${sec.titre}\n` + lines.map(([f, v]) => `- ${f.label} : ${v}`).join("\n") + "\n";
  }
  if (r.note_coach) s += `\n## Notes du coach\n${r.note_coach}\n`;
  return s;
}

function csv() {
  const cols = ["created_at", "statut", ...FIELDS.map(f => f.k)];
  const head = ["Reçu le", "Statut", ...FIELDS.map(f => f.label)];
  const cell = x => `"${String(x ?? "").replace(/"/g, '""')}"`;
  const rows = ROWS.map(r => cols.map(c => c === "created_at" ? dateFr(r.created_at) : c === "statut" ? STATUTS[r.statut] : val(r.data, FIELDS.find(f => f.k === c)) ?? "").map(cell).join(";"));
  const blob = new Blob(["﻿" + [head.map(cell).join(";"), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `bilans-vestiaire-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

/* ---------- écrans ---------- */
function lockScreen(err) {
  $("#logout").hidden = true;
  $("#main").innerHTML = `<div class="card lock fade"><div class="kicker">Espace coach</div><h1>Bilans clients</h1>
    <p>Entre le code coach pour voir les questionnaires reçus.</p>
    <form id="lf"><input class="in" id="code" autocomplete="off" autocapitalize="characters" maxlength="20" aria-label="Code coach">
    <button class="btn big" style="width:100%">Ouvrir</button></form>
    <div class="alert ${err ? "on" : ""}" role="alert">${esc(err || "")}</div></div>`;
  $("#code").focus();
  $("#lf").addEventListener("submit", async e => { e.preventDefault(); CODE = $("#code").value.trim().toUpperCase(); await load(); });
}
async function load() {
  try {
    ROWS = await rpc("questionnaire_liste", { p_code: CODE });
    try { localStorage.setItem(CK, CODE); } catch (e) {}
    $("#logout").hidden = false; renderApp();
  } catch (e) {
    try { localStorage.removeItem(CK); } catch (_) {}
    lockScreen(e.message === "code" ? "Code incorrect." : "Connexion impossible. Réessaie dans un instant.");
  }
}
function shown() {
  return ROWS.filter(r => (filtre === "tous" || (filtre === "actifs" ? r.statut !== "archive" : r.statut === filtre))
    && (!q || (r.prenom + " " + (r.nom || "") + " " + (r.email || "")).toLowerCase().includes(q)));
}
function renderList() {
  const list = shown(), n = ROWS.filter(r => r.statut === "nouveau").length;
  const link = location.origin + location.pathname.replace(/coach(\.html)?$/, "");
  $("#lst").innerHTML = `<div class="linkbox"><code>${esc(link)}</code><button id="cpLink">Copier le lien client</button></div>
    <div class="tools"><input class="in" id="q" placeholder="Rechercher un client…" value="${esc(q)}" style="flex:1"><button class="btn ghost" id="csv" style="padding:8px 12px;font-size:13px">Export Excel</button></div>
    <div class="filters">${[["actifs", "Actifs"], ["nouveau", `Nouveaux${n ? " · " + n : ""}`], ["en_cours", "En cours"], ["programme_fait", "Faits"], ["archive", "Archivés"], ["tous", "Tous"]]
      .map(([k, l]) => `<button data-f="${k}" aria-pressed="${filtre === k}">${l}</button>`).join("")}</div>
    ${list.length ? list.map(r => `<button class="item" data-id="${r.id}" aria-current="${cur === r.id}"><b>${esc(r.prenom)} ${esc(r.nom || "")}</b><span class="tag ${r.statut}">${STATUTS[r.statut]}</span>
      <small>${esc(r.data.objectif || "")}</small><small>${dateFr(r.created_at)}${r.data.age ? " · " + r.data.age + " ans" : ""}${r.data.poids ? " · " + String(r.data.poids).replace(".", ",") + " kg" : ""}</small></button>`).join("")
      : `<p class="empty">${ROWS.length ? "Aucun bilan dans ce filtre." : "Aucun bilan reçu pour l'instant.<br>Envoie le lien client pour commencer."}</p>`}`;
}
function renderDet() {
  const r = ROWS.find(x => x.id === cur), el = $("#det");
  $(".layout").classList.toggle("detail", !!r);
  if (!r) { el.innerHTML = `<p class="empty">Choisis un bilan dans la liste.</p>`; return; }
  const d = r.data, fl = flags(d);
  el.innerHTML = `<div class="fade">
    <button class="btn ghost back" id="back" style="padding:7px 14px;font-size:13px;margin-bottom:12px">← Liste</button>
    <div class="det-head"><div><div class="kicker">Reçu le ${dateFr(r.created_at)}</div><h1>${esc(r.prenom)} ${esc(r.nom || "")}</h1>
      <div class="row" style="color:var(--muted);font-size:14px;margin-top:4px">${r.email ? `<a href="mailto:${esc(r.email)}" style="color:inherit">${esc(r.email)}</a>` : ""}${d.tel ? ` · <a href="https://wa.me/${esc(String(d.tel).replace(/\D/g, "").replace(/^0/, "33"))}" target="_blank" rel="noopener" style="color:inherit">${esc(d.tel)} (WhatsApp)</a>` : ""}</div></div>
      <span class="sp"></span>
      <div class="row"><select class="in" id="st" aria-label="Statut">${Object.entries(STATUTS).map(([k, l]) => `<option value="${k}" ${r.statut === k ? "selected" : ""}>${l}</option>`).join("")}</select>
      <button class="btn" id="cp">Copier la fiche pour Claude</button></div></div>
    <div class="kpis">${kpis(d).map(([l, v]) => `<div class="kpi"><span>${l}</span><b>${esc(v)}</b></div>`).join("")}</div>
    ${fl.map(f => `<p class="flag">⚠ ${esc(f)}</p>`).join("")}
    <div class="qa">${SECTIONS.map(sec => { const rows = sec.champs.map(f => [f, val(d, f)]).filter(x => x[1]); return rows.length ? `<h3>${esc(sec.titre)}</h3><dl>${rows.map(([f, v]) => `<dt>${esc(f.label)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""; }).join("")}
    <h3>Notes du coach</h3><textarea class="in" id="note" placeholder="Tes remarques sur ce client (privées).">${esc(r.note_coach || "")}</textarea>
    <div class="row" style="margin-top:10px"><button class="btn ghost" id="saveNote">Enregistrer la note</button></div></div></div>`;
}
function renderApp() {
  $("#main").innerHTML = `<div class="layout"><aside class="card list" id="lst"></aside><section class="card det" id="det"></section></div>`;
  renderList(); renderDet();
}

async function maj(id, statut, note) {
  try { await rpc("questionnaire_maj", { p_code: CODE, p_id: id, p_statut: statut, p_note: note }); const r = ROWS.find(x => x.id === id); if (statut) r.statut = statut; if (note != null) r.note_coach = note; renderList(); toast("Enregistré"); }
  catch (e) { toast(e.message === "code" ? "Code expiré, reconnecte-toi" : "Échec de l'enregistrement"); }
}
const copy = async (txt, msg) => { try { await navigator.clipboard.writeText(txt); toast(msg); } catch (e) { const t = document.createElement("textarea"); t.value = txt; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); toast(msg); } };

document.addEventListener("click", e => {
  const t = e.target.closest("button"); if (!t) return;
  if (t.dataset.id) { cur = t.dataset.id; renderList(); renderDet(); window.scrollTo({ top: 0 }); }
  else if (t.dataset.f) { filtre = t.dataset.f; renderList(); }
  else if (t.id === "cp") { const r = ROWS.find(x => x.id === cur); copy(fiche(r), "Fiche copiée : colle-la dans Claude"); if (r.statut === "nouveau") { $("#st").value = "en_cours"; maj(r.id, "en_cours", null); } }
  else if (t.id === "saveNote") maj(cur, null, $("#note").value);
  else if (t.id === "back") { cur = null; renderList(); renderDet(); }
  else if (t.id === "csv") csv();
  else if (t.id === "cpLink") copy(location.origin + location.pathname.replace(/coach(\.html)?$/, ""), "Lien client copié");
  else if (t.id === "logout") { CODE = ""; try { localStorage.removeItem(CK); } catch (_) {} lockScreen(); }
});
document.addEventListener("change", e => { if (e.target.id === "st") maj(cur, e.target.value, null); });
document.addEventListener("input", e => { if (e.target.id === "q") { q = e.target.value.toLowerCase(); const pos = e.target.selectionStart; renderList(); const i = $("#q"); i.focus(); i.setSelectionRange(pos, pos); } });

CODE ? load() : lockScreen();
})();
