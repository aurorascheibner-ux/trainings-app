// Trainingsbuch – Essen automatisch ausfüllen
// 1. „Meine Lebensmittel“ (eigene Tabelle in Supabase): selbst angelegte und schon gewählte Produkte, zuerst angezeigt.
// 2. Open Food Facts (offene Lebensmittel-Datenbank): Suche und Strichcode.
// An Open Food Facts geht nur das Suchwort bzw. die Strichcode-Nummer, keine persönlichen Daten.

(function () {
  const SEARCH = "https://de.openfoodfacts.org/cgi/search.pl";
  const PRODUCT = "https://world.openfoodfacts.org/api/v2/product/";
  const FIELDS = "code,product_name,product_name_de,brands,quantity,serving_quantity,nutriments";
  const TABLE = "lebensmittel";
  const NUTRI = [["kcal", "kcal", "kcal"], ["p", "protein_g", "Eiweiß (g)"], ["kh", "kh_g", "Kohlenhydrate (g)"], ["zucker", "zucker_g", "davon Zucker (g)"],
    ["fett", "fett_g", "Fett (g)"], ["ges", "fett_ges_g", "davon gesättigt (g)"], ["ballast", "ballast_g", "Ballaststoffe (g)"]];
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { if (v == null || String(v).trim() === "") return null; const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : null; };
  const de = (n, d = 0) => n == null ? "–" : n.toLocaleString("de-DE", { maximumFractionDigits: d });
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const cache = new Map();
  let form = null, db = null, timer = null, lastQ = "", picked = null, stream = null, scanning = false;
  let own = null, ownOk = true; // eigene Lebensmittel (einmal laden)

  // Produkt aus Open Food Facts in einfache Werte umrechnen (alles pro 100 g)
  function simple(p) {
    const n = p.nutriments || {};
    const kcal = num(n["energy-kcal_100g"]) ?? (num(n["energy-kj_100g"]) != null ? num(n["energy-kj_100g"]) / 4.184 : num(n.energy_100g) != null ? num(n.energy_100g) / 4.184 : null);
    const name = (p.product_name_de || p.product_name || "").trim();
    const brand = String(p.brands || "").split(",")[0].trim();
    return {
      code: p.code, brand, menge: p.quantity || "",
      name: brand && name && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} (${brand})` : name || brand || "Unbekanntes Produkt",
      kcal: kcal != null ? Math.round(kcal) : null,
      p: num(n.proteins_100g),
      kh: num(n.carbohydrates_100g), zucker: num(n.sugars_100g), fett: num(n.fat_100g), ges: num(n["saturated-fat_100g"]), ballast: num(n.fiber_100g),
      portion: num(p.serving_quantity),
    };
  }
  // Zeile aus „Meine Lebensmittel“ ↔ einfache Werte
  const fromRow = (r) => ({ id: r.id, mine: true, code: r.code || "", name: r.name, brand: r.marke || "", menge: "", kcal: num(r.kcal), p: num(r.protein_g), kh: num(r.kh_g),
    zucker: num(r.zucker_g), fett: num(r.fett_g), ges: num(r.fett_ges_g), ballast: num(r.ballast_g), portion: num(r.portion_g), anzahl: r.anzahl || 0 });
  const toRow = (x) => { const r = { code: x.code || null, name: x.name, marke: x.brand || null, portion_g: x.portion ?? null }; NUTRI.forEach(([k, col]) => (r[col] = x[k] ?? null)); return r; };

  async function loadOwn(force) {
    if (own && !force) return own;
    if (!db) return (own = []);
    let data = null, error = null;
    try { ({ data, error } = await db.from(TABLE).select("*")); } catch (e) { error = e; }
    ownOk = !error; // Tabelle fehlt noch (SQL-Datei nicht ausgeführt): App geht trotzdem, merkt sich nur nichts
    own = error ? [] : (data || []).map(fromRow);
    return own;
  }
  function ownMatches(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return (own || []).filter((x) => { const t = norm(x.name + " " + x.brand); return words.every((w) => t.includes(w)); })
      .sort((a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, "de")).slice(0, 6);
  }

  // ---------- Formular erweitern ----------
  function attach(f, client) {
    form = f; db = client || db; picked = null; lastQ = "";
    const input = form.elements.lebensmittel;
    if (!input) return;
    const after = form.querySelector('.combo-list[data-for="lebensmittel"]') || input.closest("label");
    after.insertAdjacentHTML("afterend", `
      <div class="off-tools">
        <button type="button" class="btn ghost small-btn" data-off-scan><svg class="ico" aria-hidden="true"><use href="#i-scan"/></svg> Barcode scannen</button>
        <button type="button" class="btn ghost small-btn" data-own-new>+ Neues Lebensmittel</button>
      </div>
      <p class="muted small" data-off-status>Oder tippen, dann kommen Produkte dazu.</p>
      <div class="off-list" data-off-list hidden></div>
      <div class="off-pick glass" data-off-pick hidden></div>`);
    loadOwn();
  }

  function status(t) { const s = form && form.querySelector("[data-off-status]"); if (s) s.textContent = t; }

  // ---------- Suche: erst eigene, dann Open Food Facts ----------
  function onInput(e) {
    if (!form || e.target !== form.elements.lebensmittel) return;
    const q = e.target.value.trim();
    clearTimeout(timer);
    if (picked && q === picked.name) return;
    if (q.length < 2) { hideList(); status("Oder tippen, dann kommen Produkte dazu."); return; }
    const mine = ownMatches(q);
    if (mine.length) show(mine, [], q.length >= 3);
    else if (q.length < 3) hideList();
    if (q.length >= 3) timer = setTimeout(() => search(q), 900); // Open Food Facts bittet um wenige Suchanfragen
  }

  async function search(q) {
    if (q === lastQ) return;
    lastQ = q;
    let list = cache.get(q.toLowerCase());
    if (!list) {
      status("Suche Produkte …");
      try {
        const url = `${SEARCH}?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=8&sort_by=unique_scans_n&fields=${FIELDS}`;
        let r = await fetch(url);
        if (r.status === 503) { await new Promise((ok) => setTimeout(ok, 1500)); r = await fetch(url); } // Open Food Facts ist manchmal kurz überlastet
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        list = (j.products || []).map(simple).filter((x) => x.kcal != null);
        cache.set(q.toLowerCase(), list);
      } catch {
        lastQ = "";
        if (!form || form.elements.lebensmittel.value.trim() !== q) return;
        if (!ownMatches(q).length) hideList();
        status("Produktsuche gerade nicht erreichbar. Barcode und eigene Lebensmittel gehen trotzdem.");
        return;
      }
    }
    if (!form || form.elements.lebensmittel.value.trim() !== q) return;
    const mine = ownMatches(q), codes = new Set(mine.map((x) => x.code).filter(Boolean));
    show(mine, list.filter((x) => !codes.has(x.code)), false);
  }

  function show(mine, off, loading) {
    const box = form.querySelector("[data-off-list]");
    const all = [...mine, ...off];
    if (!all.length) { hideList(); status("Kein Produkt gefunden. Leg es mit „+ Neues Lebensmittel“ an oder trag die Werte selbst ein."); return; }
    status(loading ? "Deine Lebensmittel, suche noch weitere …" : off.length ? "Deine Lebensmittel zuerst, dann Open Food Facts:" : "Deine Lebensmittel:");
    box._items = all;
    box.innerHTML = all.map((x, i) => `<button type="button" class="off-item" data-off-i="${i}">
      <strong>${x.mine ? '<span class="off-mine">Deins</span> ' : ""}${esc(x.name)}</strong><span class="muted small">${esc([x.menge, `${de(x.kcal)} kcal`, x.p != null && `${de(x.p, 1)} g Eiweiß`].filter(Boolean).join(" · "))} pro 100 g</span></button>`).join("");
    box.hidden = false;
  }

  function hideList() { const b = form && form.querySelector("[data-off-list]"); if (b) b.hidden = true; }

  // ---------- Auswahl und Menge ----------
  function pick(x) {
    picked = x;
    hideList();
    const el = form.elements;
    el.lebensmittel.value = x.name;
    const list = form.querySelector('.combo-list[data-for="lebensmittel"]'); if (list) list.hidden = true;
    const g = x.portion && x.portion > 0 && x.portion < 2000 ? Math.round(x.portion) : 100;
    const box = form.querySelector("[data-off-pick]");
    box.innerHTML = `<p class="small"><strong>${esc(x.name)}</strong><br><span class="muted">pro 100 g: ${[`${de(x.kcal)} kcal`, x.p != null && `${de(x.p, 1)} g Eiweiß`, x.kh != null && `${de(x.kh, 1)} g KH`, x.fett != null && `${de(x.fett, 1)} g Fett`].filter(Boolean).join(" · ")}</span></p>
      <label class="field"><span>Wie viel Gramm?</span><input type="text" inputmode="decimal" name="off_gramm" value="${g}"></label>
      <p class="muted small">Alle Nährwerte werden für diese Menge ausgerechnet. ${x.mine ? "Werte aus deinen Lebensmitteln." : "Werte von Open Food Facts."}</p>`;
    box.hidden = false;
    const more = form.querySelector("details.more"); if (more) more.open = true;
    calc();
    status("Übernommen.");
  }

  function calc() {
    if (!picked || !form) return;
    const g = num(form.elements.off_gramm && form.elements.off_gramm.value);
    if (g == null || g <= 0) return;
    const el = form.elements;
    el.menge.value = `${de(g)} g`;
    if (picked.kcal != null) el.kcal.value = Math.round((picked.kcal * g) / 100);
    const put = (name, per100) => { if (el[name]) el[name].value = per100 == null ? "" : String(Math.round((per100 * g) / 10) / 10).replace(".", ","); };
    put("protein_g", picked.p); put("kh_g", picked.kh); put("zucker_g", picked.zucker); put("fett_g", picked.fett); put("fett_ges_g", picked.ges); put("ballast_g", picked.ballast);
    if (el.notiz && (!el.notiz.value || /^Werte (von Open Food Facts|aus deinen Lebensmitteln)$/.test(el.notiz.value))) el.notiz.value = picked.mine ? "Werte aus deinen Lebensmitteln" : "Werte von Open Food Facts";
  }

  // Nach dem Speichern des Essens: gewähltes Produkt in „Meine Lebensmittel“ merken bzw. hochzählen
  async function saved() {
    const x = picked;
    if (!x || !db) return;
    await loadOwn();
    if (!ownOk) return;
    const same = x.id ? own.find((o) => o.id === x.id) : x.code ? own.find((o) => o.code === x.code) : null;
    const today = new Date().toISOString().slice(0, 10);
    if (same) {
      same.anzahl += 1;
      await db.from(TABLE).update({ anzahl: same.anzahl, zuletzt: today }).eq("id", same.id);
    } else {
      const row = { id: crypto.randomUUID(), ...toRow(x), anzahl: 1, zuletzt: today };
      const { error } = await db.from(TABLE).insert(row);
      if (!error) own.push(fromRow(row));
    }
  }

  // ---------- Neues Lebensmittel anlegen ----------
  function newForm(pre = {}) {
    picked = null;
    hideList();
    const box = form.querySelector("[data-off-pick]");
    const field = (name, label, val = "", cls = "half", mode = ' inputmode="decimal"') =>
      `<label class="field ${cls}"><span>${label}</span><input type="text" name="nl_${name}" value="${esc(val)}"${mode}></label>`;
    box.innerHTML = `<p class="small"><strong>Neues Lebensmittel</strong><br><span class="muted">Trag ab, was auf der Packung steht, immer <b>pro 100 g</b>. Danach findet die App es bei der Suche und beim Scannen sofort.</span></p>
      <div class="more-grid">
        ${field("name", "Name", pre.name || form.elements.lebensmittel.value.trim(), "full", "")}
        ${field("brand", "Marke (optional)", pre.brand || "", "half", "")}
        ${field("code", "Barcode (optional)", pre.code || "", "half", ' inputmode="numeric"')}
        ${NUTRI.map(([k, , label]) => field(k, label + (k === "kcal" ? "" : ""), "")).join("")}
        ${field("portion", "1 Portion = … g (optional)", "")}
      </div>
      <p class="muted small" data-nl-msg></p>
      <div class="nl-actions"><button type="button" class="btn small-btn" data-nl-save>Speichern und übernehmen</button><button type="button" class="btn ghost small-btn" data-nl-cancel>Abbrechen</button></div>`;
    box.hidden = false;
    const first = box.querySelector(pre.name ? '[name="nl_kcal"]' : '[name="nl_name"]');
    if (first) first.focus();
    status(pre.code ? "Barcode " + pre.code + " ist neu für die App." : "Neues Lebensmittel anlegen.");
  }

  async function saveNew() {
    const box = form.querySelector("[data-off-pick]"), v = (n) => box.querySelector(`[name="nl_${n}"]`).value.trim();
    const msg = box.querySelector("[data-nl-msg]");
    const x = { mine: true, name: v("name"), brand: v("brand"), code: v("code").replace(/\D/g, ""), menge: "", portion: num(v("portion")), anzahl: 0 };
    if (!x.name) { msg.textContent = "Bitte einen Namen eintragen."; return; }
    for (const [k, , label] of NUTRI) {
      x[k] = num(v(k));
      if (v(k) && x[k] == null) { msg.textContent = `„${label}“ ist keine gültige Zahl.`; return; }
    }
    if (x.kcal == null) { msg.textContent = "Bitte mindestens die kcal pro 100 g eintragen."; return; }
    await loadOwn();
    if (db && ownOk) {
      msg.textContent = "Speichere …";
      const same = x.code && own.find((o) => o.code === x.code);
      const row = toRow(x);
      const { error } = same ? await db.from(TABLE).update(row).eq("id", same.id) : await db.from(TABLE).insert({ id: (x.id = crypto.randomUUID()), ...row, anzahl: 0 });
      if (error) { msg.textContent = "Speichern hat nicht geklappt: " + error.message; return; }
      if (same) { x.id = same.id; x.anzahl = same.anzahl; Object.assign(same, x); } else own.push(x);
      pick(x);
      status("Gespeichert in deinen Lebensmitteln und übernommen.");
    } else {
      pick(x);
      status("Übernommen. Dauerhaft merken geht erst, wenn die SQL-Datei in Supabase ausgeführt ist.");
    }
  }

  // ---------- Strichcode ----------
  async function lookup(code) {
    await loadOwn();
    const mine = own.find((o) => o.code && o.code === code);
    if (mine) { pick(mine); status("Aus deinen Lebensmitteln übernommen."); return; }
    status("Suche Strichcode " + code + " …");
    try {
      const r = await fetch(`${PRODUCT}${encodeURIComponent(code)}.json?fields=${FIELDS}`);
      const j = await r.json();
      if (!j.product) { newForm({ code }); status("Dieses Produkt kennt noch niemand. Leg es hier einmal an, dann kennt die App es."); return; }
      const x = simple({ code, ...j.product });
      if (x.kcal == null) { form.elements.lebensmittel.value = x.name; newForm({ code, name: x.name, brand: x.brand }); status("Produkt gefunden, aber ohne Nährwerte. Trag sie einmal von der Packung ab."); return; }
      pick(x);
    } catch {
      status("Open Food Facts gerade nicht erreichbar. Du kannst das Produkt mit „+ Neues Lebensmittel“ selbst anlegen.");
    }
  }

  function overlay() {
    let o = document.getElementById("scan");
    if (o) return o;
    o = document.createElement("div");
    o.id = "scan";
    o.className = "scan";
    o.innerHTML = `<div class="scan-box">
      <video playsinline muted></video><div class="scan-frame"></div>
      <p class="scan-msg">Halte den Strichcode in den Rahmen.</p>
      <form class="scan-manual"><input name="code" inputmode="numeric" pattern="[0-9]{6,14}" placeholder="oder Nummer eintippen"><button class="btn small-btn">Suchen</button></form>
      <button type="button" class="btn ghost" data-scan-close>Abbrechen</button></div>`;
    document.getElementById("entry").appendChild(o); // im Dialog, damit es darüber liegt
    o.querySelector(".scan-manual").addEventListener("submit", (e) => { e.preventDefault(); const c = e.target.code.value.trim(); if (c) { stopScan(); lookup(c); } });
    return o;
  }

  async function startScan() {
    const o = overlay();
    o.hidden = false;
    const msg = o.querySelector(".scan-msg"), video = o.querySelector("video");
    if (!("BarcodeDetector" in window) || !navigator.mediaDevices) { msg.textContent = "Dein Browser kann keine Strichcodes lesen. Tipp die Nummer unter dem Strichcode ein."; video.hidden = true; return; }
    video.hidden = false;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch {
      msg.textContent = "Kein Zugriff auf die Kamera. Erlaube ihn in den Einstellungen oder tipp die Nummer ein.";
      return;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    const det = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
    scanning = true;
    msg.textContent = "Halte den Strichcode in den Rahmen.";
    const loop = async () => {
      if (!scanning) return;
      try {
        const found = await det.detect(video);
        if (found.length) { const code = found[0].rawValue; if (navigator.vibrate) navigator.vibrate(60); stopScan(); lookup(code); return; }
      } catch {}
      setTimeout(loop, 250);
    };
    loop();
  }

  function stopScan() {
    scanning = false;
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; }
    const o = document.getElementById("scan");
    if (o) { o.hidden = true; o.querySelector("video").srcObject = null; o.querySelector(".scan-manual").reset(); }
  }

  // ---------- Bedienung ----------
  document.addEventListener("input", (e) => {
    onInput(e);
    if (e.target.name === "off_gramm") calc();
    if (form && e.target === form.elements.lebensmittel && picked && e.target.value.trim() !== picked.name) {
      picked = null;
      const b = form.querySelector("[data-off-pick]"); if (b) b.hidden = true;
    }
  });
  document.addEventListener("click", (e) => {
    const it = e.target.closest("[data-off-i]");
    if (it) { const box = it.closest("[data-off-list]"); return pick(box._items[Number(it.dataset.offI)]); }
    if (e.target.closest("[data-off-scan]")) return startScan();
    if (e.target.closest("[data-scan-close]")) return stopScan();
    if (e.target.closest("[data-own-new]")) return newForm();
    if (e.target.closest("[data-nl-save]")) return saveNew();
    if (e.target.closest("[data-nl-cancel]")) { const b = form.querySelector("[data-off-pick]"); b.hidden = true; b.innerHTML = ""; return status("Oder tippen, dann kommen Produkte dazu."); }
    // Eigene Einträge aus der Auswahlliste gewählt: Produktvorschläge schließen
    if (e.target.closest('.combo-list[data-for="lebensmittel"] .combo-item')) { hideList(); clearTimeout(timer); picked = null; const b = form && form.querySelector("[data-off-pick]"); if (b) b.hidden = true; }
  });
  // Enter in den Feldern für ein neues Lebensmittel soll nicht das ganze Essen speichern
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.name && e.target.name.startsWith("nl_")) { e.preventDefault(); saveNew(); }
  });
  document.getElementById("entry")?.addEventListener("close", stopScan);

  window.TBFood = { attach, saved };
})();
