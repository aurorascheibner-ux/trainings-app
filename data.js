// Trainingsbuch – Anmeldung, Eintragen und Listen (Supabase)

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- Hilfen für Datum und Zahlen ----------
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
const parseDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
const fmtDate = (s) => {
  if (!s) return "";
  const d = parseDate(s);
  const diff = daysBetween(s, today());
  if (diff === 0) return "Heute";
  if (diff === 1) return "Gestern";
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() && { year: "numeric" }) });
};
const fmtNum = (n, digits = 0) => n == null || n === "" ? "" : Number(n).toLocaleString("de-DE", { maximumFractionDigits: digits });
// "45" → 45 Min., "45:30" → 45 Min. 30 Sek., "1:05:00" → 1 Std. 5 Min.
function parseDuration(s) {
  if (s == null || s === "") return null;
  const parts = String(s).trim().split(":").map(Number);
  if (parts.some(isNaN)) return NaN;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}
function fmtDuration(sec) {
  if (sec == null) return "";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ---------- Was in welche Tabelle gehört ----------
const ENERGIE = { name: "energie_1_5", label: "Energie (1 schlecht – 5 top)", type: "energie" };
const NOTIZ = { name: "notiz", label: "Notiz", type: "textarea" };

const TABLES = {
  bouldern: {
    label: "Bouldern", dateField: "datum", view: "training",
    fields: [
      { name: "datum", label: "Datum", type: "date", required: true },
      { name: "dauer_min", label: "Dauer (Min.)", type: "number", half: true },
      { name: "max_grad", label: "Schwerster Grad", type: "text", placeholder: "7a", half: true, suggest: "grad" },
      { name: "tops", label: "Geschafft", type: "text", placeholder: "7a:4;7b:1" },
      { name: "projekte", label: "Projekte (versucht)", type: "text", placeholder: "7b:2" },
      { name: "avg_hf", label: "Ø Puls", type: "number", half: true },
      { name: "kcal", label: "kcal", type: "number", half: true },
      ENERGIE, NOTIZ,
    ],
    title: (r) => r.max_grad ? `Bouldern bis ${r.max_grad}` : "Bouldern",
    sub: (r) => [r.tops && `Tops ${r.tops.replaceAll(";", ", ")}`, r.dauer_min && `${r.dauer_min} Min.`, r.avg_hf && `Ø ${r.avg_hf} bpm`].filter(Boolean).join(" · "),
  },
  kraft: {
    label: "Kraft", dateField: "datum", view: "training", sets: true,
    fields: [
      { name: "datum", label: "Datum", type: "date", required: true },
      { name: "uebung", label: "Übung", type: "text", required: true, placeholder: "Kniebeuge", suggest: "uebung" },
      NOTIZ,
    ],
  },
  laufen: {
    label: "Laufen", dateField: "datum", view: "training",
    fields: [
      { name: "datum", label: "Datum", type: "date", required: true, half: true },
      { name: "uhrzeit", label: "Uhrzeit", type: "time", half: true },
      { name: "dauer_s", label: "Dauer (Min. oder h:mm:ss)", type: "duration", placeholder: "45:30", half: true },
      { name: "distanz_km", label: "Distanz (km)", type: "number", step: "0.01", half: true },
      { name: "avg_hf", label: "Ø Puls", type: "number", half: true },
      { name: "max_hf", label: "Max. Puls", type: "number", half: true },
      { name: "kcal", label: "kcal", type: "number", half: true },
      { name: "hoehenmeter", label: "Höhenmeter", type: "number", half: true },
      ENERGIE, NOTIZ,
    ],
    compute: (r) => { r.pace_s_km = r.dauer_s && r.distanz_km ? Math.round(r.dauer_s / r.distanz_km) : null; },
    title: (r) => r.distanz_km ? `${fmtNum(r.distanz_km, 2)} km Laufen` : "Laufen",
    sub: (r) => [r.dauer_s && fmtDuration(r.dauer_s), r.pace_s_km && `${fmtDuration(r.pace_s_km)} /km`, r.avg_hf && `Ø ${r.avg_hf} bpm`].filter(Boolean).join(" · "),
  },
  rad: {
    label: "Rad", dateField: "datum", view: "training",
    fields: [
      { name: "datum", label: "Datum", type: "date", required: true, half: true },
      { name: "uhrzeit", label: "Uhrzeit", type: "time", half: true },
      { name: "dauer_s", label: "Dauer (Min. oder h:mm:ss)", type: "duration", placeholder: "30", half: true },
      { name: "distanz_km", label: "Distanz (km)", type: "number", step: "0.01", half: true },
      { name: "avg_hf", label: "Ø Puls", type: "number", half: true },
      { name: "kcal", label: "kcal", type: "number", half: true },
      { name: "hoehenmeter", label: "Höhenmeter", type: "number", half: true },
      { name: "zweck", label: "Zweck", type: "select", options: [["alltag", "Alltag"], ["freizeit", "Freizeit"]], half: true },
      NOTIZ,
    ],
    compute: (r) => { r.avg_kmh = r.dauer_s && r.distanz_km ? Math.round((r.distanz_km / (r.dauer_s / 3600)) * 10) / 10 : null; },
    title: (r) => r.distanz_km ? `${fmtNum(r.distanz_km, 1)} km Rad` : "Rad",
    sub: (r) => [r.dauer_s && fmtDuration(r.dauer_s), r.avg_kmh && `${fmtNum(r.avg_kmh, 1)} km/h`, r.zweck === "alltag" ? "Alltag" : r.zweck === "freizeit" ? "Freizeit" : ""].filter(Boolean).join(" · "),
  },
  ernaehrung: {
    label: "Ernährung", dateField: "datum", view: "ernaehrung",
    fields: [
      { name: "datum", label: "Datum", type: "date", required: true },
      { name: "lebensmittel", label: "Was hast du gegessen?", type: "text", required: true, placeholder: "Haferflocken mit Skyr", suggest: "essen" },
      { name: "menge", label: "Menge", type: "text", placeholder: "1 Schüssel" },
      { name: "kcal", label: "kcal", type: "number", half: true },
      { name: "protein_g", label: "Eiweiß (g)", type: "number", step: "0.1", half: true },
      { name: "kh_g", label: "Kohlenhydrate (g)", type: "number", half: true, extra: true },
      { name: "zucker_g", label: "davon Zucker (g)", type: "number", half: true, extra: true },
      { name: "fett_g", label: "Fett (g)", type: "number", half: true, extra: true },
      { name: "fett_ges_g", label: "davon gesättigt (g)", type: "number", half: true, extra: true },
      { name: "ballast_g", label: "Ballaststoffe (g)", type: "number", half: true, extra: true },
      NOTIZ,
    ],
    title: (r) => r.lebensmittel,
    sub: (r) => [r.menge, r.kcal != null && `${r.kcal} kcal`, r.protein_g != null && `${fmtNum(r.protein_g, 1)} g Eiweiß`, r.kh_g != null && `${fmtNum(r.kh_g, 1)} g KH`, r.fett_g != null && `${fmtNum(r.fett_g, 1)} g Fett`].filter(Boolean).join(" · "),
  },
  zyklus: {
    label: "Periode", dateField: "periode_start", view: "zyklus",
    fields: [
      { name: "periode_start", label: "Periode Beginn", type: "date", required: true, half: true },
      { name: "periode_ende", label: "Periode Ende", type: "date", half: true },
      NOTIZ,
    ],
    title: (r) => "Periode",
    sub: (r) => r.periode_ende ? `bis ${fmtDate(r.periode_ende)} · ${daysBetween(r.periode_start, r.periode_ende) + 1} Tage` : "läuft noch",
  },
  befinden: {
    label: "Befinden", dateField: "datum_von", view: "befinden",
    fields: [
      { name: "datum_von", label: "Seit", type: "date", required: true, half: true },
      { name: "datum_bis", label: "Bis (leer = dauert an)", type: "date", half: true },
      { name: "status", label: "Was ist los?", type: "select", options: [["krank", "Krank"], ["verletzt", "Verletzt"], ["erschoepft", "Erschöpft"], ["gut", "Mir geht's gut"]] },
      ENERGIE, NOTIZ,
    ],
    title: (r) => ({ krank: "Krank", verletzt: "Verletzt", erschoepft: "Erschöpft", gut: "Gut drauf" }[r.status] || r.status),
    sub: (r) => r.datum_bis ? `bis ${fmtDate(r.datum_bis)}` : "dauert an",
  },
};

// Körperwerte der Waage: Reihenfolge wie in der Waagen-App, damit das Abtippen leicht geht
const kw = (name, label, step = "0.1") => ({ name, label, type: "number", step, half: true });
TABLES.koerper = {
  label: "Körperwerte", dateField: "datum", view: "befinden", optional: true,
  fields: [
    { name: "datum", label: "Datum der Messung", type: "date", required: true, half: true },
    kw("gewicht_kg", "Gewicht (kg)", "0.01"),
    kw("bmi", "BMI"),
    kw("koerperfett_pct", "Körperfett (%)"),
    kw("muskelrate_pct", "Muskelrate (%)"),
    kw("fettfrei_kg", "Fettfreies Gewicht (kg)"),
    kw("unterhautfett_pct", "Unterhautfett (%)"),
    kw("viszeral", "Viszerales Fett"),
    kw("wasser_pct", "Körperwasser (%)"),
    kw("skelettmuskel_pct", "Skelettmuskeln (%)"),
    kw("muskelmasse_kg", "Muskelmasse (kg)"),
    kw("knochen_kg", "Knochenmasse (kg)"),
    kw("protein_pct", "Proteine (%)"),
    kw("grundumsatz_kcal", "Grundumsatz (kcal)", "1"),
    kw("bio_alter", "Biologisches Alter", "1"),
    NOTIZ,
  ],
  title: (r) => r.gewicht_kg != null ? `${fmtNum(r.gewicht_kg, 2)} kg` : "Messung",
  sub: (r) => [r.koerperfett_pct != null && `${fmtNum(r.koerperfett_pct, 1)} % Fett`, r.muskelmasse_kg != null && `${fmtNum(r.muskelmasse_kg, 1)} kg Muskeln`, r.wasser_pct != null && `${fmtNum(r.wasser_pct, 1)} % Wasser`].filter(Boolean).join(" · "),
};

const VIEW_TABLES = { training: ["bouldern", "kraft", "laufen", "rad"], ernaehrung: ["ernaehrung"], zyklus: ["zyklus"], befinden: ["koerper", "befinden"] };
// Tabellen, die per SQL-Datei erst noch angelegt werden müssen
const missing = {};
const EMPTY_TEXT = {
  bouldern: "Noch keine Boulder-Session eingetragen.",
  kraft: "Noch kein Krafttraining eingetragen.",
  laufen: "Noch kein Lauf eingetragen.",
  rad: "Noch keine Radfahrt eingetragen.",
  ernaehrung: "Heute noch nichts gegessen eingetragen.",
  zyklus: "Trag den Beginn deiner letzten Periode ein, dann siehst du auf „Heute“ deinen Zyklustag.",
  befinden: "Alles gut, nichts eingetragen.",
  koerper: "Noch keine Messung eingetragen.",
};

// ---------- Verbindung ----------
const cfg = window.TB_CONFIG || {};
let db = window.__TB_MOCK || null;
if (!db && cfg.url && cfg.key) {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm");
  db = createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true } });
}

let session = null;
let sport = (() => { try { return localStorage.getItem("sport") || "bouldern"; } catch { return "bouldern"; } })();
const cache = {};

function toast(text) {
  const t = $("#toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 2600);
}

// ---------- Anmeldung ----------
function showLogin(show) {
  $("#login").hidden = !show;
  $("#views").hidden = show;
  $("#fab").disabled = show;
  $("#fab").hidden = show;
  $(".tabbar").hidden = show;
}

async function initAuth() {
  if (!db) {
    $("#fab").disabled = true;
    $$(".entries").forEach((el) => (el.innerHTML = `<div class="glass empty"><h2>Noch nicht verbunden</h2><p class="muted">Die Datenbank wird gerade eingerichtet. Danach kannst du hier eintragen.</p></div>`));
    return;
  }
  const { data } = await db.auth.getSession();
  setSession(data.session);
  db.auth.onAuthStateChange((_event, s) => setSession(s));
}

function setSession(s) {
  const was = session?.user?.id;
  session = s;
  showLogin(!s);
  $("#account").hidden = !s;
  $("#account-email").textContent = s?.user?.email || "";
  if (s && s.user.id !== was) refreshAll();
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const msg = $("#login-msg");
  msg.textContent = "Einen Moment …";
  const { error } = await db.auth.signInWithPassword({ email: f.get("email"), password: f.get("password") });
  msg.textContent = error ? loginError(error) : "";
});

$("#signup").addEventListener("click", async () => {
  const form = $("#login-form");
  if (!form.reportValidity()) return;
  const f = new FormData(form);
  const msg = $("#login-msg");
  msg.textContent = "Einen Moment …";
  const { data, error } = await db.auth.signUp({
    email: f.get("email"),
    password: f.get("password"),
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) msg.textContent = loginError(error);
  else if (!data.session) msg.textContent = "Fast geschafft: Bestätige den Link in der E-Mail, die du gleich bekommst. Danach hier anmelden.";
});

function loginError(error) {
  const m = (error.message || "").toLowerCase();
  if (m.includes("invalid login")) return "E-Mail oder Passwort stimmt nicht.";
  if (m.includes("not confirmed")) return "Bitte bestätige zuerst den Link in deiner E-Mail.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Neue Konten sind gesperrt.";
  if (m.includes("already registered")) return "Für diese E-Mail gibt es schon ein Konto. Melde dich einfach an.";
  return "Das hat nicht geklappt: " + error.message;
}

$("#logout").addEventListener("click", async () => {
  await db.auth.signOut();
  $("#settings").close();
});

// ---------- Laden und Anzeigen ----------
async function load(table) {
  const t = TABLES[table];
  const { data, error } = await db.from(table).select("*")
    .order(t.dateField, { ascending: false }).order("created_at", { ascending: false }).limit(3000);
  if (error && t.optional) { missing[table] = true; console.warn(table, error.message); cache[table] = []; return []; }
  if (error) { toast("Laden hat nicht geklappt."); console.error(error); return cache[table] || []; }
  missing[table] = false;
  cache[table] = data;
  return data;
}

// Tages-Check im Zyklus: eine Zeile pro Tag (Blutung + angetippte Beschwerden)
let tagOk = true;
async function loadTags() {
  const { data, error } = await db.from("zyklus_tag").select("*").order("datum", { ascending: false }).limit(3000);
  tagOk = !error;
  if (error) console.warn("zyklus_tag", error.message);
  cache.zyklus_tag = data || [];
}

async function saveTag(datum, rec, id) {
  const leer = !rec.blutung && !(rec.symptome || []).length;
  let res;
  if (id && leer) res = await db.from("zyklus_tag").delete().eq("id", id);
  else if (id) res = await db.from("zyklus_tag").update(rec).eq("id", id);
  else if (!leer) res = await db.from("zyklus_tag").insert({ datum, ...rec });
  if (res && res.error) { toast("Speichern hat nicht geklappt."); console.error(res.error); }
  await loadTags();
}

function renderZyklus() {
  if (!window.TBZyklus) return;
  try { window.TBZyklus.render({ cache, tagOk, openForm, saveTag }); } catch (e) { console.error("Zyklus", e); }
}

async function refreshAll() {
  await Promise.all([...Object.keys(TABLES).map(load), loadTags()]);
  renderAll();
}

function renderAll() {
  renderTraining();
  ["ernaehrung", "zyklus"].forEach((v) => renderList($(`[data-list="${v}"]`), v));
  ["koerper", "befinden"].forEach((t) => renderList($(`[data-list="${t}"]`), "befinden", t));
  renderToday();
  renderCharts();
  renderZyklus();
  renderBnow();
  renderBzeit();
}

// ---------- Befinden: „Wie geht's dir heute?“ mit einem Tipp (Usability 25.11.) ----------
const B_OPT = [["gut", "Gut", "#i-gut"], ["krank", "Krank", "#i-krank"], ["verletzt", "Verletzt", "#i-verletzt"], ["erschoepft", "Erschöpft", "#i-erschoepft"]];
const B_COL = { krank: "#e5484d", verletzt: "#f0883e", erschoepft: "#8b7fd6" };
const dm = (s) => { const [, m, d] = String(s).split("-"); return `${+d}.${+m}.`; };
const spanTxt = (a, b) => { if (a === b) return dm(a); const [, ma] = a.split("-"), [, mb] = b.split("-"); return ma === mb ? `${+a.slice(8)}.–${dm(b)}` : `${dm(a)}–${dm(b)}`; };
// Zeitstrahl: die letzten 8 Wochen als Kalender, jeder Tag in der Farbe seines Zustands (Wunsch 27.11.)
function renderBzeit() {
  const box = $("[data-bzeit]"); if (!box) return;
  const rs = (cache.befinden || []).filter((r) => r.status !== "gut" && r.datum_von);
  const t = today(), now = new Date(t + "T12:00:00");
  // aktuelle Woche oben, nach unten ältere Wochen bis zum ersten Eintrag (mind. 8, höchstens 52) (Wunsch 27.11.)
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const first = rs.reduce((m, r) => (r.datum_von < m ? r.datum_von : m), t);
  const W = Math.min(52, Math.max(8, Math.floor(daysBetween(first, isoDate(mon)) / 7) + 2));
  const cnt = {};
  let rows = "";
  for (let w = 0; w < W; w++) {
    const ws = new Date(mon); ws.setDate(mon.getDate() - 7 * w);
    let cells = "";
    for (let d = 0; d < 7; d++) {
      const day = new Date(ws); day.setDate(ws.getDate() + d); const iso = isoDate(day);
      const hit = rs.filter((r) => r.datum_von <= iso && iso <= (r.datum_bis || t))
        .filter((r, i, a) => a.findIndex((x) => x.status === r.status) === i)
        .sort((a, b) => Object.keys(B_COL).indexOf(a.status) - Object.keys(B_COL).indexOf(b.status));
      const fut = iso > t;
      if (!fut && w < 8) hit.forEach((r) => { cnt[r.status] = (cnt[r.status] || 0) + 1; });
      // mehrere Zustände am selben Tag: gleich breite schräge Streifen, beliebig viele (Wunsch 27.11.)
      const bg = hit.length === 1 ? B_COL[hit[0].status] : hit.length > 1 ? `linear-gradient(135deg, ${hit.map((r, i) => `${B_COL[r.status]} ${(i * 100 / hit.length).toFixed(1)}% ${((i + 1) * 100 / hit.length).toFixed(1)}%`).join(", ")})` : "";
      cells += `<${hit.length && !fut ? `button type="button" data-edit="befinden" data-key="${esc(hit[0].id)}" aria-label="${esc(fmtDate(iso))}: ${esc(hit.map((r) => TABLES.befinden.title(r)).join(", "))}"` : "span"} class="bz-d${iso === t ? " heute" : ""}${fut ? " fut" : ""}"${bg && !fut ? ` style="background:${bg}"` : ""}></${hit.length && !fut ? "button" : "span"}>`;
    }
    rows += `<span class="bz-w">${dm(isoDate(ws))}</span>${cells}`;
  }
  const sum = Object.keys(B_COL).filter((k) => cnt[k]).map((k) => `<span><i style="background:${B_COL[k]}"></i>${TABLES.befinden.title({ status: k })} ${cnt[k]} ${cnt[k] === 1 ? "Tag" : "Tage"}</span>`).join("");
  box.innerHTML = `<h3 class="c-title">Verlauf</h3>
    <div class="c-legend bz-leg"><span class="muted">Letzte 8 Wochen:</span>${sum || `<span>alles gut</span>`}</div>
    <div class="bz-grid"><span></span>${["M", "D", "M", "D", "F", "S", "S"].map((x) => `<span class="bz-h">${x}</span>`).join("")}${rows}</div>`;
}
// aktiv = offen oder endet erst heute oder später (sonst ließ „Gut“ solche Einträge stehen, 27.11.)
const bActive = () => { const t = today(); return (cache.befinden || []).filter((r) => r.status !== "gut" && (!r.datum_bis || r.datum_bis >= t)); };
function renderBnow() {
  const box = $("[data-bnow]"); if (!box) return;
  const open = bActive();
  // Mehrere Zustände gleichzeitig möglich (27.11.): jeder Knopf schaltet seinen Zustand an oder aus
  const on = (k) => (k === "gut" ? !open.length : open.some((r) => r.status === k));
  box.innerHTML = `<h3 class="c-title">Wie geht's dir heute?</h3>
    <div class="b-opts">${B_OPT.map(([k, l, ic]) => `<button type="button" class="b-opt${on(k) ? " on" : ""}" data-bset="${k}" aria-pressed="${on(k)}"><svg class="ico"><use href="${ic}"/></svg><span>${l}</span></button>`).join("")}</div>
    ${open.length ? `<p class="c-hint">${open.map((r) => `${esc(TABLES.befinden.title(r))} seit ${esc(dm(r.datum_von))}`).join(" · ")}</p>` : ""}`;
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-bset]"); if (!b || !db) return;
  const want = b.dataset.bset, t = today();
  const open = bActive();
  const y = isoDate(new Date(Date.now() - 864e5));
  // An/aus je Zustand (27.11.), ohne Schnipsel: heute begonnen → löschen, älter → endet gestern;
  // ein gerade erst beendeter gleicher Zustand läuft einfach weiter
  const stop = (r) => (r.datum_von === t ? db.from("befinden").delete().eq("id", r.id) : db.from("befinden").update({ datum_bis: y }).eq("id", r.id));
  const mine = open.filter((r) => r.status === want);
  let qs, msg;
  if (want === "gut") { if (!open.length) return; qs = open.map(stop); msg = "Schön, dass es dir gut geht ✓"; }
  else if (mine.length) { qs = mine.map(stop); msg = B_OPT.find((o) => o[0] === want)[1] + " beendet ✓"; }
  else {
    const prev = (cache.befinden || []).find((r) => r.status === want && r.datum_bis === y);
    qs = [prev ? db.from("befinden").update({ datum_bis: null }).eq("id", prev.id) : db.from("befinden").insert({ datum_von: t, status: want })];
    msg = B_OPT.find((o) => o[0] === want)[1] + " eingetragen ✓";
  }
  for (const q of qs) {
    const { error } = await q;
    if (error) { console.error(error); return toast("Speichern hat nicht geklappt."); }
  }
  toast(msg);
  await load("befinden");
  renderAll();
});

function renderCharts() {
  if (!window.TBCharts) return;
  const view = (location.hash.replace("#", "") || "heute");
  try { window.TBCharts.render({ ...cache, _missing: missing }, view, sport); } catch (e) { console.error("Grafik", e); }
}
window.addEventListener("hashchange", () => setTimeout(renderCharts, 0));

function groupKraft(rows) {
  const groups = [];
  const byKey = new Map();
  for (const r of rows) {
    const key = `${r.datum}|${r.uebung}`;
    if (!byKey.has(key)) { const g = { datum: r.datum, uebung: r.uebung, notiz: r.notiz, rows: [] }; byKey.set(key, g); groups.push(g); }
    byKey.get(key).rows.push(r);
  }
  groups.forEach((g) => g.rows.sort((a, b) => (a.satz ?? 0) - (b.satz ?? 0)));
  return groups;
}

const setText = (r) => r.dauer_s != null && r.wdh == null
  ? `${r.dauer_s} s${r.gewicht_kg ? ` @ ${fmtNum(r.gewicht_kg, 1)} kg` : ""}`
  : `${r.wdh ?? "?"}×${r.gewicht_kg != null ? ` ${fmtNum(r.gewicht_kg, 1)} kg` : ""}`;

function itemsFor(table) {
  const rows = cache[table] || [];
  const t = TABLES[table];
  if (t.sets) {
    return groupKraft(rows).map((g) => ({
      key: g.rows.map((r) => r.id).join(","), date: g.datum,
      title: g.uebung, sub: `${g.rows.length} ${g.rows.length === 1 ? "Satz" : "Sätze"}: ${g.rows.map(setText).join(", ")}`,
      note: g.notiz,
    }));
  }
  return rows.map((r) => ({ key: r.id, date: r[t.dateField], title: t.title(r), sub: t.sub(r), note: r.notiz }));
}

function renderList(el, view, table = VIEW_TABLES[view][0]) {
  if (!el) return;
  if (missing[table]) {
    el.innerHTML = `<div class="glass empty"><p class="muted">Dafür fehlt noch die Tabelle in Supabase. Führ einmal die Datei <b>2026-11-24-koerperwerte.sql</b> im SQL Editor aus, dann kannst du hier eintragen.</p></div>`;
    return;
  }
  const items = itemsFor(table);
  if (!items.length) {
    el.innerHTML = `<div class="glass empty"><p class="muted">${EMPTY_TEXT[table]}</p><button type="button" class="btn small-btn" data-add="${table}">+ Eintragen</button></div>`;
    return;
  }
  // Befinden: eine Zeile je Phase, ohne Datumsüberschriften (Wunsch 27.11.)
  if (table === "befinden") {
    const rs = (cache.befinden || []).filter((r) => r.status !== "gut").slice().sort((a, b) => String(b.datum_von).localeCompare(String(a.datum_von)));
    el.innerHTML = `<h3 class="section-h">Alle Phasen</h3>` + rs.map((r) => {
      const bis = r.datum_bis || today(), n = daysBetween(r.datum_von, bis) + 1;
      const zeit = r.datum_bis ? `${spanTxt(r.datum_von, r.datum_bis)} · ${n} ${n === 1 ? "Tag" : "Tage"}` : `seit ${dm(r.datum_von)} · ${n} ${n === 1 ? "Tag" : "Tage"}`;
      return `<button type="button" class="glass entry b-row${!r.datum_bis || r.datum_bis >= today() ? " b-open" : ""}" data-edit="befinden" data-key="${esc(r.id)}" style="--bc:${B_COL[r.status] || "var(--muted)"}">
        <span class="entry-main"><strong>${esc(TABLES.befinden.title(r))}</strong><span class="muted small">${esc(zeit)}${r.energie_1_5 ? " · Energie " + r.energie_1_5 + "/5" : ""}</span>${r.notiz ? `<span class="note small">${esc(r.notiz)}</span>` : ""}</span>
        ${CHEV()}</button>`;
    }).join("");
    return;
  }
  let lastDate = null;
  // Essen: Tagessumme neben dem Datum
  const daySum = {};
  if (table === "ernaehrung") (cache.ernaehrung || []).forEach((r) => { const o = daySum[r.datum] || (daySum[r.datum] = { k: 0, p: 0 }); o.k += Number(r.kcal) || 0; o.p += Number(r.protein_g) || 0; });
  const sumTxt = (d) => daySum[d] ? `<span class="day-sum">${fmtNum(Math.round(daySum[d].k))} kcal · ${fmtNum(Math.round(daySum[d].p))} g Eiweiß</span>` : "";
  // Lange Listen: erst die letzten 7 Tage mit Einträgen, der Rest auf Knopfdruck
  const days = [...new Set(items.map((it) => it.date))];
  const cut = !showAll.has(table) && days.length > 7 ? days[6] : null;
  const shown = cut ? items.filter((it) => it.date >= cut) : items;
  const rows = (arr, heads = true) => arr.map((it) => {
    const head = heads && it.date !== lastDate ? `<h3 class="day">${esc(fmtDate(it.date))}${sumTxt(it.date)}</h3>` : "";
    lastDate = it.date;
    return `${head}<button type="button" class="glass entry" data-edit="${table}" data-key="${esc(it.key)}">
      <span class="entry-main"><strong>${esc(it.title)}</strong>${it.sub ? `<span class="muted small">${esc(it.sub)}</span>` : ""}${it.note ? `<span class="note small">${esc(it.note)}</span>` : ""}</span>
      ${CHEV()}</button>`;
  }).join("");
  const moreBtn = cut ? `<button type="button" class="fold-row more-btn" data-more="${table}">Ältere Einträge · ${days.length - 7} ${days.length - 7 === 1 ? "Tag" : "Tage"} ${CHEV("down")}</button>` : "";
  if (table === "ernaehrung") {
    // Ernährung: Gegessenes eingeklappt unter der Übersicht (Wunsch 25.11.)
    const td = today(), heute = shown.filter((it) => it.date === td), frueher = shown.filter((it) => it.date !== td);
    const fold = (key, label, body) => `<details class="fold eat-fold" data-fold="${key}"${openFolds.has(key) ? " open" : ""}><summary class="fold-row">${label} ${CHEV("down")}</summary>${body}</details>`;
    const n = heute.length, s = daySum[td];
    el.innerHTML = fold("heute", `Heute gegessen <span class="fold-meta">${n ? n + (n === 1 ? " Eintrag" : " Einträge") + (s ? " · " + fmtNum(Math.round(s.k)) + " kcal" : "") : "noch nichts"}</span>`,
      n ? rows(heute, false) : `<p class="muted small fold-empty">Heute ist noch nichts eingetragen.</p>`)
      + (frueher.length || cut ? fold("frueher", "Frühere Tage", rows(frueher) + moreBtn) : "");
    return;
  }
  el.innerHTML = rows(shown) + moreBtn;
}
const showAll = new Set();
const openFolds = new Set();
document.addEventListener("toggle", (e) => { const d = e.target; if (!d.dataset || !d.dataset.fold) return; if (d.open) openFolds.add(d.dataset.fold); else openFolds.delete(d.dataset.fold); }, true);
document.addEventListener("click", (e) => {
  const m = e.target.closest("[data-more]"); if (!m) return;
  showAll.add(m.dataset.more); renderAll();
});

function renderTraining() {
  $$(".chip[data-sport]").forEach((c) => c.classList.toggle("active", c.dataset.sport === sport));
  renderList($('[data-list="training"]'), "training", sport);
}

// Körper-Seite: Körperwerte (Waage) und Befinden (krank, Energie) getrennt (Wunsch 24.11.)
let ksub = (() => { try { return localStorage.getItem("ksub") || "koerper"; } catch { return "koerper"; } })();
function renderKsub() {
  $$(".chip[data-ksub]").forEach((c) => c.classList.toggle("active", c.dataset.ksub === ksub));
  $$("[data-ksub-box]").forEach((b) => (b.hidden = b.dataset.ksubBox !== ksub));
}
function setKsub(v) { ksub = v; try { localStorage.setItem("ksub", v); } catch {} renderKsub(); }
$$(".chip[data-ksub]").forEach((c) => c.addEventListener("click", () => { setKsub(c.dataset.ksub); renderCharts(); }));
document.addEventListener("click", (e) => { const t = e.target.closest("[data-goto-ksub]"); if (t) setKsub(t.dataset.gotoKsub); });
renderKsub();

// Sportarten als Piktogramme (Wunsch 25.11.): der Name steht nur beim gewählten Sport
$$(".chip[data-sport]").forEach((c) => {
  const l = c.textContent.trim(); c.setAttribute("aria-label", l); c.title = l;
  if (window.TBPickIcon) c.innerHTML = window.TBPickIcon(c.dataset.sport) + `<span>${l}</span>`;
});
$('.chips[aria-label="Sportart"]')?.classList.add("sport-pick");
$$(".chip[data-sport]").forEach((c) => c.addEventListener("click", () => {
  sport = c.dataset.sport;
  try { localStorage.setItem("sport", sport); } catch {}
  renderTraining();
  renderCharts();
}));

// ---------- Heute ----------
function cycleInfo() {
  // gleiche Phasen-Logik wie die Grafiken (Lutealphase läuft weiter, wenn die Periode auf sich warten lässt)
  if (window.TBCharts) { try { return window.TBCharts.zyklusHeute(cache); } catch (e) { console.error(e); } }
  const rows = (cache.zyklus || []).slice().sort((a, b) => a.periode_start.localeCompare(b.periode_start));
  if (!rows.length) return null;
  const starts = rows.map((r) => r.periode_start);
  const gaps = starts.slice(1).map((s, i) => daysBetween(starts[i], s)).filter((g) => g >= 18 && g <= 45);
  const len = gaps.length ? Math.round(gaps.slice(-6).reduce((a, b) => a + b, 0) / gaps.slice(-6).length) : 26;
  const last = rows[rows.length - 1];
  const day = daysBetween(last.periode_start, today()) + 1;
  if (day < 1) return null;
  const periodLen = last.periode_ende ? daysBetween(last.periode_start, last.periode_ende) + 1 : 5;
  const ovu = len - 14;
  let phase;
  if (day <= periodLen && (!last.periode_ende || today() <= last.periode_ende)) phase = "Periode";
  else if (day < ovu - 1) phase = "Follikelphase";
  else if (day <= ovu + 1) phase = "Eisprung";
  else if (day <= len) phase = "Lutealphase";
  else phase = "Periode erwartet";
  return { day, len, phase, next: Math.max(0, len - day + 1) };
}

// kurzer Satz je Phase: was das für Training und Essen heißt
const PHASE_TIPP = {
  Periode: "Training nach Gefühl: lockere Technik oder kurze Einheiten sind okay. Beim Essen auf Erhaltung, kein Defizit, eisenreich essen.",
  Follikelphase: "Gute Zeit für Kraft und schwere Boulder, du erholst dich schneller. Essen ganz normal nach Plan.",
  Eisprung: "Kraft ist oft am höchsten, aber gründlich aufwärmen, die Bänder sind lockerer. Essen normal, Eiweiß über den Tag verteilen.",
  Lutealphase: "Eher Volumen und Technik statt Maximalversuche, Läufe nach Puls. Du brauchst etwa 150 kcal mehr, Hunger ist normal.",
};

// Karte „Essen heute“: kcal übrig, Eiweiß und Ballaststoffe
function renderEssenHeute() {
  const box = $('[data-today="essen"]');
  if (!box || !window.TBCharts || !window.d3) return;
  let e;
  try { e = window.TBCharts.essenHeute(cache); } catch (err) { console.error(err); return; }
  const set = (k, v) => { const el = box.querySelector(`[data-tf="${k}"]`); if (el) el.innerHTML = v; };
  const rest = e.ziel.kcal - e.kcal, over = rest < 0;
  box.classList.toggle("over", over);
  set("num", fmtNum(Math.abs(rest)));
  set("unit", over ? "kcal drüber" : "kcal übrig");
  set("sub", `${fmtNum(e.kcal)} von ${fmtNum(e.ziel.kcal)} kcal · ${e.why.split(",")[0].split(" · ")[0]}`);
  box.querySelector('[data-tf="ring"]').setAttribute("stroke-dasharray", `${Math.min(100, (e.kcal / e.ziel.kcal) * 100).toFixed(1)} 100`);
  set("p", `${fmtNum(e.p)}<small>/${e.ziel.p} g</small>`);
  set("b", `${fmtNum(e.b)}<small>/${e.ziel.b} g</small>`);
  box.querySelector('[data-tf="pring"]').setAttribute("stroke-dasharray", `${Math.min(100, (e.p / e.ziel.p) * 100).toFixed(1)} 100`);
  box.querySelector('[data-tf="bring"]').setAttribute("stroke-dasharray", `${Math.min(100, (e.b / e.ziel.b) * 100).toFixed(1)} 100`);
}

function renderToday() {
  // Hintergrund in der Farbe der Zyklusphase (Wunsch 24.11.)
  try { const z = cycleInfo(); if (z && z.phase) document.documentElement.dataset.phase = z.phase; else delete document.documentElement.dataset.phase; } catch {}
  const t = today();
  const trainings = [
    ...(cache.bouldern || []).filter((r) => r.datum === t).map(() => "Bouldern"),
    ...groupKraft((cache.kraft || []).filter((r) => r.datum === t)).map((g) => g.uebung),
    ...(cache.laufen || []).filter((r) => r.datum === t).map(() => "Laufen"),
    ...(cache.rad || []).filter((r) => r.datum === t).map(() => "Rad"),
  ];
  $('[data-sum="training"]').textContent = trainings.length ? trainings.join(", ") : "heute noch nichts";

  renderEssenHeute();

  // Zyklus-Uhr als Punktekranz (charts.js)
  if (window.TBCharts && window.TBCharts.heuteUhr) {
    try { window.TBCharts.heuteUhr($("[data-zuhr]"), cache); } catch (e) { console.error("Zyklus-Uhr", e); }
  }

  if (window.TBSupp) window.TBSupp.render($("[data-supp]"), db, cache);

  const open = (cache.befinden || []).find((r) => !r.datum_bis && r.status !== "gut");
  const lastB = (cache.befinden || [])[0];
  // Symbol auf der Kachel je Zustand (Wunsch 21.11.)
  const zustand = open ? open.status : lastB ? "gut" : null;
  $("#befinden-ico").setAttribute("href", { krank: "#i-krank", verletzt: "#i-verletzt", erschoepft: "#i-erschoepft", gut: "#i-gut" }[zustand] || "#i-befinden");
  $('[data-sum="befinden"]').textContent = open
    ? `${TABLES.befinden.title(open)} seit ${fmtDate(open.datum_von)}`
    : lastB?.energie_1_5 ? `Energie ${lastB.energie_1_5}/5` : "alles gut";
}

// ---------- Vorschläge, sortiert nach Wahrscheinlichkeit ----------
// Je öfter und je kürzer her, desto weiter oben. Bei Übungen zählt zusätzlich,
// was du sonst zusammen mit den heute schon eingetragenen Übungen machst.
// Beim Essen zählt, was du sonst um diese Uhrzeit isst.
const GRADE = ["5a","5a+","5b","5b+","5c","5c+","6a","6a+","6b","6b+","6c","6c+","7a","7a+","7b","7b+","7c","7c+","8a","8a+","8b"];
const recency = (dateStr, halfLife = 30) => Math.pow(0.5, Math.max(0, daysBetween(dateStr, today())) / halfLife);

const SUGGEST = {
  uebung(form) {
    const rows = cache.kraft || [];
    const dateOf = form.elements.datum?.value || today();
    const sessions = new Map(); // datum -> Set(uebung)
    rows.forEach((r) => { if (!sessions.has(r.datum)) sessions.set(r.datum, new Set()); sessions.get(r.datum).add(r.uebung); });
    const doneToday = sessions.get(dateOf) || new Set();
    const score = new Map();
    for (const [datum, set] of sessions) {
      if (datum === dateOf) continue;
      const w = recency(datum);
      const overlap = [...doneToday].filter((u) => set.has(u)).length;
      for (const u of set) score.set(u, (score.get(u) || 0) + w * (1 + 2 * overlap));
    }
    doneToday.forEach((u) => { if (!score.has(u)) score.set(u, 0); });
    const lastSets = (u) => {
      const l = rows.filter((r) => r.uebung === u && r.datum !== dateOf);
      const d = l.reduce((m, r) => (r.datum > m ? r.datum : m), "");
      return { d, sets: l.filter((r) => r.datum === d).sort((a, b) => (a.satz ?? 0) - (b.satz ?? 0)) };
    };
    return [...score.entries()]
      .map(([u, sc]) => ({ u, sc: doneToday.has(u) ? sc / 100 - 1 : sc }))
      .sort((a, b) => b.sc - a.sc)
      .map(({ u }) => {
        const { d, sets } = lastSets(u);
        const hint = ""; // nur der Name (Wunsch 21.11.)
        return { value: u, hint, fill: { sets } };
      });
  },
  essen() {
    const rows = cache.ernaehrung || [];
    const hourNow = new Date().getHours();
    const score = new Map(), lastRow = new Map();
    for (const r of rows) {
      const h = r.created_at ? new Date(r.created_at).getHours() : hourNow;
      const dh = Math.min(Math.abs(h - hourNow), 24 - Math.abs(h - hourNow));
      const w = recency(r.datum, 45) * (0.4 + Math.exp(-dh / 3));
      score.set(r.lebensmittel, (score.get(r.lebensmittel) || 0) + w);
      if (!lastRow.has(r.lebensmittel)) lastRow.set(r.lebensmittel, r); // neueste zuerst geladen
    }
    return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => {
      const r = lastRow.get(name);
      return {
        value: name,
        hint: [r.menge, r.kcal != null && `${r.kcal} kcal`, r.protein_g != null && `${fmtNum(r.protein_g, 1)} g Eiweiß`].filter(Boolean).join(" · "),
        fill: { menge: r.menge, kcal: r.kcal, protein_g: r.protein_g, kh_g: r.kh_g, zucker_g: r.zucker_g, fett_g: r.fett_g, fett_ges_g: r.fett_ges_g, ballast_g: r.ballast_g },
      };
    });
  },
  grad() {
    const rows = cache.bouldern || [];
    const score = new Map();
    rows.forEach((r) => r.max_grad && score.set(r.max_grad, (score.get(r.max_grad) || 0) + recency(r.datum, 21)));
    const known = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
    const center = known.length ? GRADE.indexOf(known[0]) : GRADE.indexOf("7a");
    const rest = GRADE.filter((g) => !score.has(g)).sort((a, b) => Math.abs(GRADE.indexOf(a) - center) - Math.abs(GRADE.indexOf(b) - center) || GRADE.indexOf(b) - GRADE.indexOf(a)); // nahe an deinem Niveau zuerst
    return [...known, ...rest].map((g) => ({ value: g }));
  },
};

function showSuggestions(input) {
  const next = input.closest("label")?.nextElementSibling;
  const list = next && next.matches(`.combo-list[data-for="${input.name}"]`) ? next : input.form && input.form.querySelector(`.combo-list[data-for="${input.name}"]`);
  if (!list) return;
  const q = input.value.trim().toLowerCase();
  let all = SUGGEST[input.dataset.suggest](input.form);
  if (input.dataset.suggest === "uebung") { // schon in einem anderen Block eingetragene Übungen nicht nochmal vorschlagen
    const other = $$('[data-ueb] [name="uebung"]', input.form).filter((x) => x !== input).map((x) => x.value.trim().toLowerCase());
    all = all.filter((o) => !other.includes(o.value.toLowerCase()));
  }
  const isGrade = input.dataset.suggest === "grad";
  const items = (q ? all.filter((o) => o.value.toLowerCase().includes(q) && o.value.toLowerCase() !== q) : all).slice(0, isGrade ? 12 : 8);
  if (!items.length) { list.hidden = true; return; }
  list._items = items;
  list.innerHTML = items.map((o, i) => `<button type="button" class="combo-item" data-i="${i}"><strong>${esc(o.value)}</strong>${o.hint ? `<span class="muted small">${esc(o.hint)}</span>` : ""}</button>`).join("");
  list.classList.toggle("grades", isGrade);
  list.hidden = false;
}

function pickSuggestion(list, i) {
  const o = list._items[i];
  const form = list.closest("form");
  const input = list.previousElementSibling?.querySelector(`[name="${list.dataset.for}"]`) || form.elements[list.dataset.for];
  input.value = o.value;
  list.hidden = true;
  const f = o.fill || {};
  for (const k of ["menge", "kcal", "protein_g", "kh_g", "zucker_g", "fett_g", "fett_ges_g", "ballast_g"]) {
    if (k in f && form.elements[k] && !form.elements[k].value) form.elements[k].value = f[k] ?? "";
  }
  if (f.sets && f.sets.length && !(editing && editing.rows)) {
    const box = (list.closest("[data-ueb]") || form).querySelector(".sets");
    box.querySelectorAll("[data-set]").forEach((el) => el.replaceWith());
    box.querySelector(".add-set").insertAdjacentHTML("beforebegin", f.sets.map(setRowHTML).join(""));
  }
}

document.addEventListener("focusin", (e) => { if (e.target.dataset && e.target.dataset.suggest) showSuggestions(e.target); });
document.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.suggest) showSuggestions(e.target); });
document.addEventListener("click", (e) => {
  const item = e.target.closest(".combo-item");
  if (item) return pickSuggestion(item.closest(".combo-list"), Number(item.dataset.i));
  if (!(e.target.dataset && e.target.dataset.suggest)) document.querySelectorAll(".combo-list").forEach((l) => (l.hidden = true));
  else showSuggestions(e.target); // Antippen eines schon aktiven Felds zeigt die Vorschläge wieder
});

// ---------- Formular ----------
const dlg = $("#entry");
let editing = null; // { table, rows }

function fieldHTML(f, value) {
  const v = value ?? "";
  const id = `f-${f.name}`;
  const cls = `field${f.half ? " half" : ""}`;
  if (f.type === "textarea") return `<label class="${cls}"><span>${f.label}</span><textarea name="${f.name}" id="${id}" rows="2">${esc(v)}</textarea></label>`;
  if (f.type === "select") return `<label class="${cls}"><span>${f.label}</span><select name="${f.name}" id="${id}">${f.options.map(([val, lab]) => `<option value="${val}" ${val === v ? "selected" : ""}>${lab}</option>`).join("")}</select></label>`;
  if (f.type === "energie") return `<fieldset class="field energie"><legend>${f.label}</legend><div class="dots">${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="${f.name}" value="${n}" ${Number(v) === n ? "checked" : ""}><span>${n}</span></label>`).join("")}</div></fieldset>`;
  const type = f.type === "duration" || f.type === "number" ? "text" : f.type; // Text statt Zahl, damit Komma geht
  const mode = f.type === "number" ? ` inputmode="decimal"` : f.type === "duration" ? ` inputmode="numeric"` : "";
  const val = f.type === "duration" ? (v === "" ? "" : fmtDuration(v)) : v;
  return `<label class="${cls}"><span>${f.label}</span><input type="${type}" name="${f.name}" id="${id}" value="${esc(val)}"${mode}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ""}${f.required ? " required" : ""}${f.suggest ? ` data-suggest="${f.suggest}" autocomplete="off"` : ""}></label>${f.suggest ? `<div class="combo-list" data-for="${f.name}" hidden></div>` : ""}`;
}

function setRowHTML(r = {}, i = 0) {
  return `<div class="set-row" data-set>
    <span class="set-no">${i + 1}</span>
    <label class="field"><span>Wdh.</span><input inputmode="numeric" type="number" name="wdh" value="${r.wdh ?? ""}"></label>
    <label class="field"><span>kg</span><input inputmode="decimal" type="text" name="gewicht_kg" value="${r.gewicht_kg ?? ""}"></label>
    <label class="field"><span>Sek.</span><input inputmode="numeric" type="number" name="dauer_s" value="${r.dauer_s ?? ""}"></label>
    <button type="button" class="icon-btn" data-remove-set aria-label="Satz entfernen">✕</button>
  </div>`;
}

function renumberSets(scope) { $$("[data-set] .set-no", scope).forEach((el, i) => (el.textContent = i + 1)); }

function uebBlockHTML(f, name, sets, i) {
  return `<div class="ueb-block" data-ueb>
    ${i ? `<div class="ueb-head"><span class="label">Übung ${i + 1}</span><button type="button" class="icon-btn" data-remove-ueb aria-label="Übung entfernen">✕</button></div>` : ""}
    ${fieldHTML(f, name).replace(' id="f-uebung"', i ? ` id="f-uebung-${i}"` : ' id="f-uebung"')}
    <div class="sets"><p class="label">Sätze <span class="muted small">(bei Halteübungen Sek. statt Wdh.)</span></p>${sets.map(setRowHTML).join("")}
      <button type="button" class="btn ghost small-btn add-set">+ Satz</button></div>
  </div>`;
}

function openForm(table, rows = null, preset = null) {
  const t = TABLES[table];
  editing = { table, rows };
  $("#entry-picker").hidden = true;
  $(".sheet-actions").hidden = false;
  $("#entry-title").textContent = `${t.label} ${rows ? "bearbeiten" : "eintragen"}`;
  const base = rows ? rows[0] : { [t.dateField]: today(), zweck: "freizeit", status: "krank" };
  // Zusätzliche Nährwerte zum Aufklappen, damit das Formular kurz bleibt
  const extras = t.fields.filter((f) => f.extra);
  let html = t.fields.map((f) => {
    // Kraft: Übung + Sätze als Block, beim Neu-Eintragen beliebig viele Übungen auf einmal
    if (t.sets && f.name === "uebung") return (rows ? "" : `<details class="diktat"${preset ? "" : " open"}><summary class="fold-row">Diktieren oder einfügen ${CHEV("down")}</summary>
      <label class="field"><textarea name="diktat_text" rows="4" placeholder="z. B. Bankdrücken 3 mal 55, 9 mal 45, 3 mal 55. Kniebeuge 10 mal 50 …"></textarea></label>
      <button type="button" class="btn ghost small-btn" id="diktat-mic" hidden>🎤 Sprechen</button>
      <button type="button" class="btn small-btn" id="diktat-go">Übernehmen</button><p class="small" data-diktat-msg></p></details>`) + `<div class="uebungen">${preset ? preset.map((p, i) => uebBlockHTML(f, p.u, [0, 1, 2].map(() => ({ gewicht_kg: p.w ?? "" })), i)).join("") : uebBlockHTML(f, base.uebung, rows || [{}, {}, {}], 0)}</div>${rows ? "" : `<button type="button" class="btn ghost small-btn" id="add-ueb">+ Weitere Übung</button>`}`;
    if (!f.extra) return fieldHTML(f, base[f.name]);
    if (f !== extras[0]) return "";
    const open = extras.some((x) => base[x.name] != null && base[x.name] !== "");
    return `<details class="more"${open ? " open" : ""}><summary class="fold-row">Kohlenhydrate, Fett, Ballaststoffe ${CHEV("down")}</summary><div class="more-grid">${extras.map((x) => fieldHTML(x, base[x.name])).join("")}</div></details>`;
  }).join("");
  if (table === "koerper") html = `<p class="muted small form-hint">Am vergleichbarsten: einmal pro Woche, morgens nach der Toilette, vor Essen und Trinken, barfuß. Leere Felder einfach frei lassen.</p>` + html;
  if (rows) html += `<button type="button" class="btn danger" id="delete-entry">Eintrag löschen</button>`;
  $("#entry-fields").innerHTML = html;
  if (table === "ernaehrung" && window.TBFood) window.TBFood.attach($("#entry-form"), db);
  $("#entry-msg").textContent = "";
  if (!dlg.open) dlg.showModal();
}

function openPicker(tables = Object.keys(TABLES)) {
  editing = null;
  $("#entry-title").textContent = "Was möchtest du eintragen?";
  $("#entry-fields").innerHTML = "";
  $("#entry-msg").textContent = "";
  const p = $("#entry-picker");
  // Zuletzt benutzte Bereiche zuerst (Usability 25.11.)
  const lastUse = (k) => (cache[k] || []).reduce((m, r) => (String(r.created_at || "") > m ? String(r.created_at) : m), "");
  const order = tables.slice().sort((a, b) => lastUse(b).localeCompare(lastUse(a)));
  p.innerHTML = order.map((k) => [k, TABLES[k]]).map(([k, t]) => `<button type="button" class="glass pick" data-pick="${k}">${window.TBPickIcon ? window.TBPickIcon(k) : ""}<span>${t.label}</span></button>`).join("");
  p.hidden = false;
  $(".sheet-actions").hidden = true;
  dlg.showModal();
}

dlg.addEventListener("click", async (e) => {
  if (e.target === dlg || e.target.closest("[data-close]")) return dlg.close();
  const pick = e.target.closest("[data-pick]");
  if (pick) return openForm(pick.dataset.pick);
  const addSet = e.target.closest(".add-set");
  if (addSet) {
    const box = addSet.closest(".sets"), rows = $$("[data-set]", box);
    const last = rows[rows.length - 1];
    const prev = last ? { wdh: $('[name="wdh"]', last).value, gewicht_kg: $('[name="gewicht_kg"]', last).value, dauer_s: $('[name="dauer_s"]', last).value } : {};
    addSet.insertAdjacentHTML("beforebegin", setRowHTML(prev, rows.length));
    return;
  }
  const rm = e.target.closest("[data-remove-set]");
  if (rm) { const box = rm.closest(".sets"); rm.closest("[data-set]").remove(); renumberSets(box); return; }
  if (e.target.closest("#add-ueb")) {
    const list = $(".uebungen"), n = $$("[data-ueb]", list).length;
    list.insertAdjacentHTML("beforeend", uebBlockHTML(TABLES.kraft.fields.find((f) => f.name === "uebung"), "", [{}, {}, {}], n));
    const inp = list.lastElementChild.querySelector('[name="uebung"]');
    inp.scrollIntoView({ block: "center", behavior: "smooth" });
    setTimeout(() => inp.focus(), 0); // erst nach dem Klick, sonst schließt der Klick die Vorschläge gleich wieder
    return;
  }
  if (e.target.closest("#diktat-mic")) { toggleMic(e.target.closest("#diktat-mic")); return; }
  if (e.target.closest("#diktat-go") && window.TBDiktat) {
    stopMic();
    const box = e.target.closest(".diktat"), msg = $("[data-diktat-msg]", box);
    const known = [...new Set((cache.kraft || []).map((r) => r.uebung))];
    const r = window.TBDiktat.parse($('[name="diktat_text"]', box).value, known);
    if (!r.uebungen.length) { msg.textContent = "Keine Übung mit Sätzen erkannt. Nenn die Übung und die Sätze, z. B. „Kniebeuge 10 mal 50“."; return; }
    const f = TABLES.kraft.fields.find((x) => x.name === "uebung");
    $(".uebungen").innerHTML = r.uebungen.map((u, i) => uebBlockHTML(f, u.u, u.sets, i)).join("");
    const n = r.uebungen.reduce((s, u) => s + u.sets.length, 0);
    msg.textContent = `${r.uebungen.length} ${r.uebungen.length === 1 ? "Übung" : "Übungen"} mit ${n} Sätzen übernommen, bitte unten kurz prüfen.`
      + (r.ohneSaetze.length ? ` Ohne Sätze: ${r.ohneSaetze.join(", ")}.` : "")
      + (r.unklar.length ? ` Nicht verstanden: „${r.unklar.join("“, „")}“.` : "");
    box.open = false;
    box.insertAdjacentElement("afterend", msg);
    return;
  }
  const rmU = e.target.closest("[data-remove-ueb]");
  if (rmU) { rmU.closest("[data-ueb]").remove(); $$("[data-ueb] .ueb-head .label").forEach((el, i) => (el.textContent = `Übung ${i + 2}`)); return; }
  if (e.target.closest("#delete-entry")) {
    if (!confirmDelete()) return;
    const { table, rows } = editing;
    const { error } = await db.from(table).delete().in("id", rows.map((r) => r.id));
    if (error) { $("#entry-msg").textContent = "Löschen hat nicht geklappt."; return; }
    dlg.close();
    toast("Gelöscht");
    await load(table);
    renderAll();
  }
});

// Zweimal tippen statt Bestätigungsfenster
let deleteArmed = 0;
function confirmDelete() {
  const btn = $("#delete-entry");
  if (Date.now() - deleteArmed < 4000) return true;
  deleteArmed = Date.now();
  btn.textContent = "Wirklich löschen? Nochmal tippen";
  return false;
}

function readValue(f, form) {
  if (f.type === "energie") { const c = $(`[name="${f.name}"]:checked`, form); return c ? Number(c.value) : null; }
  const raw = form.elements[f.name].value.trim();
  if (raw === "") return null;
  if (f.type === "number") return Number(raw.replace(",", "."));
  if (f.type === "duration") return parseDuration(raw);
  return raw;
}

$("#entry-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editing) return;
  const form = e.target;
  const { table, rows } = editing;
  const t = TABLES[table];
  const msg = $("#entry-msg");
  const rec = {};
  for (const f of t.fields) {
    if (t.sets && f.name === "uebung") continue; // steht je Übungs-Block, siehe unten
    const v = readValue(f, form);
    if (f.required && v == null) { msg.textContent = `Bitte „${f.label}“ ausfüllen.`; return; }
    if (typeof v === "number" && isNaN(v)) { msg.textContent = `„${f.label}“ ist keine gültige Zahl.`; return; }
    rec[f.name] = v;
  }
  if (t.compute) t.compute(rec);
  if (table === "befinden" && rec.datum_bis && rec.datum_bis < rec.datum_von) { msg.textContent = "„Bis“ liegt vor „Seit“."; return; }
  if (table === "zyklus" && rec.periode_ende && rec.periode_ende < rec.periode_start) { msg.textContent = "Das Ende liegt vor dem Beginn."; return; }
  if (["bouldern", "laufen", "rad"].includes(table) && !rows) rec.quelle = "App";

  msg.textContent = "Speichere …";
  let error;
  if (t.sets) {
    const sets = [];
    for (const [bi, block] of $$("[data-ueb]", form).entries()) {
      const uebung = $('[name="uebung"]', block).value.trim();
      const bs = $$("[data-set]", block).map((row) => ({
        wdh: row.querySelector('[name="wdh"]').value, gewicht_kg: row.querySelector('[name="gewicht_kg"]').value, dauer_s: row.querySelector('[name="dauer_s"]').value,
      })).filter((s) => s.wdh || s.gewicht_kg || s.dauer_s);
      if (!uebung && !bs.length && bi > 0) continue; // leere weitere Übung einfach ignorieren
      if (!uebung) { msg.textContent = bi ? `Bitte bei Übung ${bi + 1} den Namen ausfüllen.` : "Bitte „Übung“ ausfüllen."; return; }
      if (!bs.length) { msg.textContent = `Bitte bei „${uebung}“ mindestens einen Satz ausfüllen.`; return; }
      bs.forEach((s, i) => sets.push({ ...rec, uebung, satz: i + 1, wdh: s.wdh ? Number(s.wdh) : null, gewicht_kg: s.gewicht_kg ? Number(String(s.gewicht_kg).replace(",", ".")) : null, dauer_s: s.dauer_s ? Number(s.dauer_s) : null }));
    }
    if (!sets.length) { msg.textContent = "Bitte mindestens einen Satz ausfüllen."; return; }
    ({ error } = await db.from(table).insert(sets));
    if (!error && rows) ({ error } = await db.from(table).delete().in("id", rows.map((r) => r.id)));
  } else if (rows) {
    ({ error } = await db.from(table).update(rec).eq("id", rows[0].id));
  } else {
    ({ error } = await db.from(table).insert(rec));
  }
  // Neue Nährwert-Spalten noch nicht in Supabase angelegt: ohne sie speichern
  if (error && /column|schema cache/i.test(error.message || "") && t.fields.some((f) => f.extra)) {
    t.fields.filter((f) => f.extra).forEach((f) => delete rec[f.name]);
    ({ error } = rows ? await db.from(table).update(rec).eq("id", rows[0].id) : await db.from(table).insert(rec));
    if (!error) toast("Gespeichert, aber ohne Kohlenhydrate und Fette: dafür fehlt noch die SQL-Datei.");
  }
  if (error) { console.error(error); msg.textContent = "Speichern hat nicht geklappt: " + error.message; return; }
  if (table === "ernaehrung" && window.TBFood) window.TBFood.saved(); // gewähltes Produkt in „Meine Lebensmittel“ merken
  dlg.close();
  toast("Gespeichert ✓");
  await load(table);
  renderAll();
});

document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) return openForm(add.dataset.add);
  const ed = e.target.closest("[data-edit]");
  if (ed) {
    const ids = ed.dataset.key.split(",");
    const rows = (cache[ed.dataset.edit] || []).filter((r) => ids.includes(r.id)).sort((a, b) => (a.satz ?? 0) - (b.satz ?? 0));
    if (rows.length) openForm(ed.dataset.edit, rows);
  }
});

// „Tag A/B eintragen“ aus der Plan-Karte: alle Übungen mit geplantem Gewicht vorbefüllt
window.addEventListener("tb-plan", (e) => openForm("kraft", null, e.detail));
// Essen für einen anderen Tag nachtragen (Pfeile auf der Ziel-Karte)
function openFormAm(table, datum) {
  openForm(table);
  const f = $("#entry-form").elements[TABLES[table].dateField];
  if (f && datum) f.value = datum;
}
window.addEventListener("tb-add", (e) => openFormAm(e.detail.table, e.detail.datum));
// Ein Antippen bei „Passt noch heute“: sofort speichern, ohne Formular
window.addEventListener("tb-quickadd", async (e) => {
  const { table, rec } = e.detail;
  let { error } = await db.from(table).insert(rec);
  if (error && /column|schema cache/i.test(error.message || "")) {
    ["kh_g", "zucker_g", "fett_g", "fett_ges_g", "ballast_g"].forEach((k) => delete rec[k]);
    ({ error } = await db.from(table).insert(rec));
  }
  if (error) { console.error(error); toast("Eintragen hat nicht geklappt."); return; }
  toast(rec.lebensmittel + " eingetragen ✓");
  await load(table);
  renderAll();
});

$("#fab").addEventListener("click", () => {
  const view = (location.hash.replace("#", "") || "heute");
  if (view === "training") return openForm(sport);
  if (view === "befinden") return openForm(ksub);
  if (view === "ernaehrung" && window.TBCharts && window.TBCharts.foodDay && window.TBCharts.foodDay()) return openFormAm("ernaehrung", window.TBCharts.foodDay());
  if (VIEW_TABLES[view] && VIEW_TABLES[view].length > 1) return openPicker(VIEW_TABLES[view]);
  if (VIEW_TABLES[view]) return openForm(VIEW_TABLES[view][0]);
  openPicker();
});

// Spracheingabe direkt in der App (Chrome auf Android), statt über das Tastatur-Mikrofon
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let mic = null;
function stopMic() { if (mic) { mic.want = false; try { mic.rec.stop(); } catch (_) {} } }
function toggleMic(btn) {
  if (mic && mic.want) return stopMic();
  const box = btn.closest(".diktat"), ta = $('[name="diktat_text"]', box), msg = $("[data-diktat-msg]", box);
  const rec = new SpeechRec();
  rec.lang = "de-DE";
  rec.interimResults = true;
  rec.continuous = false; // auf Android zuverlässiger; nach einer Sprechpause startet es von selbst neu
  const before = () => (ta.value.trim() ? ta.value.trim() + " " : "");
  let base = before();
  mic = { rec, want: true };
  const me = mic;
  rec.onresult = (ev) => {
    let fin = "", tmp = "";
    for (const r of ev.results) (r.isFinal ? (fin += r[0].transcript) : (tmp += r[0].transcript));
    ta.value = base + fin + tmp;
    if (fin) base = ta.value.trim() + " ";
  };
  rec.onerror = (ev) => {
    if (ev.error === "no-speech" || ev.error === "aborted") return;
    me.want = false;
    msg.textContent = ev.error === "not-allowed" || ev.error === "service-not-allowed"
      ? "Die App darf das Mikrofon nicht benutzen. Erlaube es in den Website-Einstellungen (Schloss-Symbol neben der Adresse)."
      : "Spracheingabe hat nicht geklappt (" + ev.error + "). Du kannst den Text auch eintippen oder einfügen.";
  };
  rec.onend = () => {
    if (me.want && mic === me) { base = before(); try { rec.start(); return; } catch (_) {} }
    btn.textContent = "🎤 Sprechen"; btn.classList.remove("on");
    if (mic === me) mic = null;
  };
  try { rec.start(); } catch (_) { mic = null; return; }
  btn.textContent = "■ Fertig gesprochen"; btn.classList.add("on");
  msg.textContent = "Ich höre zu …";
}
// Knopf nur zeigen, wenn der Browser Spracheingabe kann
new MutationObserver(() => { const b = $("#diktat-mic"); if (b && SpeechRec) b.hidden = false; }).observe(document.body, { childList: true, subtree: true });
$("#entry").addEventListener("close", stopMic);

// Beim Zurückkehren in die App neu laden (z. B. wenn Claude etwas eingetragen hat), aber nicht mitten im Eintragen
document.addEventListener("visibilitychange", () => { if (!document.hidden && session && !$("#entry").open) refreshAll(); });

initAuth();
