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
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short" });
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
    label: "Essen", dateField: "datum", view: "ernaehrung",
    fields: [
      { name: "datum", label: "Datum", type: "date", required: true },
      { name: "lebensmittel", label: "Was hast du gegessen?", type: "text", required: true, placeholder: "Haferflocken mit Skyr", suggest: "essen" },
      { name: "menge", label: "Menge", type: "text", placeholder: "1 Schüssel" },
      { name: "kcal", label: "kcal", type: "number", half: true },
      { name: "protein_g", label: "Eiweiß (g)", type: "number", step: "0.1", half: true },
      NOTIZ,
    ],
    title: (r) => r.lebensmittel,
    sub: (r) => [r.menge, r.kcal != null && `${r.kcal} kcal`, r.protein_g != null && `${fmtNum(r.protein_g, 1)} g Eiweiß`].filter(Boolean).join(" · "),
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

const VIEW_TABLES = { training: ["bouldern", "kraft", "laufen", "rad"], ernaehrung: ["ernaehrung"], zyklus: ["zyklus"], befinden: ["befinden"] };
const EMPTY_TEXT = {
  bouldern: "Noch keine Boulder-Session eingetragen.",
  kraft: "Noch kein Krafttraining eingetragen.",
  laufen: "Noch kein Lauf eingetragen.",
  rad: "Noch keine Radfahrt eingetragen.",
  ernaehrung: "Heute noch nichts gegessen eingetragen.",
  zyklus: "Trag den Beginn deiner letzten Periode ein, dann siehst du auf „Heute“ deinen Zyklustag.",
  befinden: "Hier trägst du ein, wenn du krank oder verletzt bist oder wie es dir geht.",
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
  if (error) { toast("Laden hat nicht geklappt."); console.error(error); return cache[table] || []; }
  cache[table] = data;
  return data;
}

async function refreshAll() {
  await Promise.all(Object.keys(TABLES).map(load));
  renderAll();
}

function renderAll() {
  renderTraining();
  ["ernaehrung", "zyklus", "befinden"].forEach((v) => renderList($(`[data-list="${v}"]`), v));
  renderToday();
  renderCharts();
}

function renderCharts() {
  if (!window.TBCharts) return;
  const view = (location.hash.replace("#", "") || "heute");
  try { window.TBCharts.render(cache, view, sport); } catch (e) { console.error("Grafik", e); }
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
  const items = itemsFor(table);
  if (!items.length) {
    el.innerHTML = `<div class="glass empty"><p class="muted">${EMPTY_TEXT[table]}</p><button type="button" class="btn small-btn" data-add="${table}">+ Eintragen</button></div>`;
    return;
  }
  let lastDate = null;
  el.innerHTML = items.map((it) => {
    const head = it.date !== lastDate ? `<h3 class="day">${esc(fmtDate(it.date))}</h3>` : "";
    lastDate = it.date;
    return `${head}<button type="button" class="glass entry" data-edit="${table}" data-key="${esc(it.key)}">
      <span class="entry-main"><strong>${esc(it.title)}</strong>${it.sub ? `<span class="muted small">${esc(it.sub)}</span>` : ""}${it.note ? `<span class="note small">${esc(it.note)}</span>` : ""}</span>
      <span class="chev" aria-hidden="true">›</span></button>`;
  }).join("");
}

function renderTraining() {
  $$(".chip").forEach((c) => c.classList.toggle("active", c.dataset.sport === sport));
  renderList($('[data-list="training"]'), "training", sport);
}

$$(".chip").forEach((c) => c.addEventListener("click", () => {
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

function renderToday() {
  const t = today();
  const trainings = [
    ...(cache.bouldern || []).filter((r) => r.datum === t).map(() => "Bouldern"),
    ...groupKraft((cache.kraft || []).filter((r) => r.datum === t)).map((g) => g.uebung),
    ...(cache.laufen || []).filter((r) => r.datum === t).map(() => "Laufen"),
    ...(cache.rad || []).filter((r) => r.datum === t).map(() => "Rad"),
  ];
  $('[data-sum="training"]').textContent = trainings.length ? trainings.join(", ") : "heute noch nichts";

  const food = (cache.ernaehrung || []).filter((r) => r.datum === t);
  const kcal = food.reduce((a, r) => a + (r.kcal || 0), 0);
  const prot = food.reduce((a, r) => a + Number(r.protein_g || 0), 0);
  $('[data-sum="ernaehrung"]').textContent = food.length ? `${fmtNum(kcal)} kcal · ${fmtNum(prot)} g Eiweiß` : "heute noch nichts";

  const c = cycleInfo();
  $('[data-sum="zyklus"]').textContent = c ? `Tag ${c.day} · ${c.phase}` : "noch nichts eingetragen";
  if (c) {
    const frac = Math.min(1, (c.day - 1) / c.len);
    const track = $("#cycle-track");
    const p = track.getPointAtLength(track.getTotalLength() * frac);
    $("#cycle-dot").setAttribute("cx", p.x);
    $("#cycle-dot").setAttribute("cy", p.y);
    $("#cycle-done").setAttribute("stroke-dasharray", `${frac * 100} 100`);
    const tip = $("#cycle-tip");
    tip.hidden = !PHASE_TIPP[c.phase];
    tip.textContent = PHASE_TIPP[c.phase] || "";
    $("#cycle-text").textContent = `Zyklustag ${c.day} · ${c.phase}. ${c.overdue ? "Periode lässt auf sich warten." : c.next ? `Nächste Periode in etwa ${c.next} ${c.next === 1 ? "Tag" : "Tagen"}.` : ""}`;
  }

  const open = (cache.befinden || []).find((r) => !r.datum_bis && r.status !== "gut");
  const lastB = (cache.befinden || [])[0];
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
        fill: { menge: r.menge, kcal: r.kcal, protein_g: r.protein_g },
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
  const list = input.form && input.form.querySelector(`.combo-list[data-for="${input.name}"]`);
  if (!list) return;
  const q = input.value.trim().toLowerCase();
  const all = SUGGEST[input.dataset.suggest](input.form);
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
  form.elements[list.dataset.for].value = o.value;
  list.hidden = true;
  const f = o.fill || {};
  for (const k of ["menge", "kcal", "protein_g"]) {
    if (k in f && form.elements[k] && !form.elements[k].value) form.elements[k].value = f[k] ?? "";
  }
  if (f.sets && f.sets.length && !(editing && editing.rows)) {
    const box = form.querySelector(".sets");
    box.querySelectorAll("[data-set]").forEach((el) => el.replaceWith());
    box.querySelector("#add-set").insertAdjacentHTML("beforebegin", f.sets.map(setRowHTML).join(""));
  }
}

document.addEventListener("focusin", (e) => { if (e.target.dataset && e.target.dataset.suggest) showSuggestions(e.target); });
document.addEventListener("input", (e) => { if (e.target.dataset && e.target.dataset.suggest) showSuggestions(e.target); });
document.addEventListener("click", (e) => {
  const item = e.target.closest(".combo-item");
  if (item) return pickSuggestion(item.closest(".combo-list"), Number(item.dataset.i));
  if (!(e.target.dataset && e.target.dataset.suggest)) document.querySelectorAll(".combo-list").forEach((l) => (l.hidden = true));
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

function renumberSets() { $$("[data-set] .set-no").forEach((el, i) => (el.textContent = i + 1)); }

function openForm(table, rows = null) {
  const t = TABLES[table];
  editing = { table, rows };
  $("#entry-picker").hidden = true;
  $(".sheet-actions").hidden = false;
  $("#entry-title").textContent = `${t.label} ${rows ? "bearbeiten" : "eintragen"}`;
  const base = rows ? rows[0] : { [t.dateField]: today(), zweck: "freizeit", status: "krank" };
  let html = t.fields.map((f) => fieldHTML(f, base[f.name])).join("");
  if (t.sets) {
    const sets = rows || [{}, {}, {}];
    html += `<div class="sets"><p class="label">Sätze <span class="muted small">(bei Halteübungen Sek. statt Wdh.)</span></p>${sets.map(setRowHTML).join("")}
      <button type="button" class="btn ghost small-btn" id="add-set">+ Satz</button></div>`;
  }
  if (rows) html += `<button type="button" class="btn danger" id="delete-entry">Eintrag löschen</button>`;
  $("#entry-fields").innerHTML = html;
  $("#entry-msg").textContent = "";
  if (!dlg.open) dlg.showModal();
}

function openPicker() {
  editing = null;
  $("#entry-title").textContent = "Was möchtest du eintragen?";
  $("#entry-fields").innerHTML = "";
  $("#entry-msg").textContent = "";
  const p = $("#entry-picker");
  p.innerHTML = Object.entries(TABLES).map(([k, t]) => `<button type="button" class="glass pick" data-pick="${k}">${t.label}</button>`).join("");
  p.hidden = false;
  $(".sheet-actions").hidden = true;
  dlg.showModal();
}

dlg.addEventListener("click", async (e) => {
  if (e.target === dlg || e.target.closest("[data-close]")) return dlg.close();
  const pick = e.target.closest("[data-pick]");
  if (pick) return openForm(pick.dataset.pick);
  if (e.target.closest("#add-set")) {
    const rows = $$("[data-set]");
    const last = rows[rows.length - 1];
    const prev = last ? { wdh: $('[name="wdh"]', last).value, gewicht_kg: $('[name="gewicht_kg"]', last).value, dauer_s: $('[name="dauer_s"]', last).value } : {};
    e.target.closest("#add-set").insertAdjacentHTML("beforebegin", setRowHTML(prev, rows.length));
    return;
  }
  const rm = e.target.closest("[data-remove-set]");
  if (rm) { rm.closest("[data-set]").remove(); renumberSets(); return; }
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
    const sets = $$("[data-set]", form).map((row) => ({
      wdh: row.querySelector('[name="wdh"]').value, gewicht_kg: row.querySelector('[name="gewicht_kg"]').value, dauer_s: row.querySelector('[name="dauer_s"]').value,
    })).filter((s) => s.wdh || s.gewicht_kg || s.dauer_s)
      .map((s, i) => ({ ...rec, satz: i + 1, wdh: s.wdh ? Number(s.wdh) : null, gewicht_kg: s.gewicht_kg ? Number(String(s.gewicht_kg).replace(",", ".")) : null, dauer_s: s.dauer_s ? Number(s.dauer_s) : null }));
    if (!sets.length) { msg.textContent = "Bitte mindestens einen Satz ausfüllen."; return; }
    ({ error } = await db.from(table).insert(sets));
    if (!error && rows) ({ error } = await db.from(table).delete().in("id", rows.map((r) => r.id)));
  } else if (rows) {
    ({ error } = await db.from(table).update(rec).eq("id", rows[0].id));
  } else {
    ({ error } = await db.from(table).insert(rec));
  }
  if (error) { console.error(error); msg.textContent = "Speichern hat nicht geklappt: " + error.message; return; }
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

$("#fab").addEventListener("click", () => {
  const view = (location.hash.replace("#", "") || "heute");
  if (view === "training") return openForm(sport);
  if (VIEW_TABLES[view]) return openForm(VIEW_TABLES[view][0]);
  openPicker();
});

// Beim Zurückkehren in die App neu laden (z. B. wenn Claude etwas eingetragen hat)
document.addEventListener("visibilitychange", () => { if (!document.hidden && session) refreshAll(); });

initAuth();
