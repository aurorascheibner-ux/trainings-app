// Trainingsbuch – Essen automatisch ausfüllen
// 1. „Meine Lebensmittel“ (eigene Tabelle in Supabase): selbst angelegte und schon gewählte Produkte, zuerst angezeigt.
// 2. Open Food Facts (offene Lebensmittel-Datenbank): Suche und Strichcode.
// An Open Food Facts geht nur das Suchwort bzw. die Strichcode-Nummer, keine persönlichen Daten.

(function () {
  const SEARCH = "https://de.openfoodfacts.org/cgi/search.pl";
  const SEARCH2 = "https://world.openfoodfacts.org/cgi/search.pl";
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
        const qs = `?search_terms=${encodeURIComponent(q)}&search_simple=1&json=1&page_size=8&sort_by=unique_scans_n&fields=${FIELDS}`;
        // Open Food Facts ist öfter kurz überlastet: bis zu 3 Versuche, abwechselnd zwei Server
        let r = null;
        for (const [i, host] of [SEARCH, SEARCH2, SEARCH].entries()) {
          if (i) { status("Open Food Facts ist gerade langsam, ich versuche es nochmal …"); await new Promise((ok) => setTimeout(ok, 1200 * i)); }
          if (!form || form.elements.lebensmittel.value.trim() !== q) return;
          try { r = await fetch(host + qs); } catch { r = null; }
          if (r && r.ok) break;
        }
        if (!r || !r.ok) throw new Error(r ? r.status : "net");
        const j = await r.json();
        list = (j.products || []).map(simple).filter((x) => x.kcal != null);
        cache.set(q.toLowerCase(), list);
      } catch {
        lastQ = "";
        if (!form || form.elements.lebensmittel.value.trim() !== q) return;
        if (!ownMatches(q).length) hideList();
        status("Open Food Facts ist gerade überlastet, das liegt nicht an dir. In ein paar Minuten nochmal tippen. Deine eigenen Lebensmittel und der Barcode gehen trotzdem.");
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
      <label class="btn ghost small-btn nl-photo"><svg class="ico" aria-hidden="true"><use href="#i-scan"/></svg> Nährwerte fotografieren<input type="file" accept="image/*" capture="environment" data-nl-photo hidden></label>
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

  // ---------- Nährwerttabelle per Foto ablesen (läuft nur auf dem Handy, Tesseract) ----------
  const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  let tessLoad = null;
  function loadTess() {
    if (window.Tesseract) return Promise.resolve();
    return (tessLoad ||= new Promise((ok, fail) => {
      const sc = document.createElement("script");
      sc.src = TESS; sc.onload = ok; sc.onerror = () => { tessLoad = null; fail(new Error("laden")); };
      document.head.appendChild(sc);
    }));
  }
  // Foto verkleinern und in Graustufen, damit es schneller und sicherer erkannt wird
  async function prepImage(img, size) {
    const k = Math.min(1, size / Math.max(img.width, img.height)); // große Handyfotos verkleinern: schneller, Schrift in guter Größe
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext("2d");
    g.filter = "grayscale(1)";
    g.drawImage(img, 0, 0, c.width, c.height);
    return c;
  }
  // Text einer Nährwerttabelle → Werte pro 100 g (erste Zahl nach dem Namen = Spalte „pro 100 g“)
  function parseLabel(text) {
    const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
    const n = (v) => Number(String(v).replace(",", "."));
    // typische Lesefehler in Zahlen: O→0, l/I→1
    const fix = (l) => l.replace(/(?<=\d)[oO](?=[\d,.\sg])|(?<=[\s<])[oO](?=[,.]\d)/g, "0").replace(/(?<=\d)[lI](?=\d)|(?<=\s)[lI](?=[,.]\d)/g, "1");
    // Erste Zahl = Spalte „pro 100 g“. Die Texterkennung liest das „g“ oft als „9“ („5,49“ statt „5,4 g“).
    const firstG = (l) => {
      const m = fix(l).match(/(\d{1,3})(?:[.,](\d{1,3}))?\s*(g\b|9\b|9g\b)?/i);
      if (!m) return null;
      let [, a, b = "", unit = ""] = m;
      if (/^9g$/i.test(unit) || (unit === "9" && b)) unit = "g";
      else if (!unit && b.length >= 2 && b.endsWith("9")) b = b.slice(0, -1); // 5,49 → 5,4
      else if (!unit && !b && a.length >= 2 && a.endsWith("9")) a = a.slice(0, -1); // 339 → 33
      if (!b && Number(a) > 100 && a.endsWith("9")) a = a.slice(0, -1); // 129g → 12 g
      return n(b ? `${a}.${b}` : a);
    };
    const out = {};
    const KEYS = [
      ["ges", /ges[äa]tt|fetts[äa]ur/i],
      ["zucker", /zucker|sugar/i],
      ["ballast", /ballast|fibre|fiber/i],
      ["kh", /kohlen|carbo/i],
      ["p", /eiwei|protein/i],
      ["fett", /\bfett\b|^fett|\bfat\b/i],
    ];
    // kcal: alle Kandidaten sammeln (pro 100 g und pro Portion), unten den passenden wählen
    const kc = [];
    for (const l of lines.map(fix)) {
      for (const m of l.matchAll(/(\d{2,4}(?:[.,]\d)?)\s*k\s*cal/gi)) kc.push(Math.round(n(m[1])));
      for (const m of l.matchAll(/\d{2,4}\s*k\s*[jJ\]]\s*[\/|]\s*(\d{2,3})\b/g)) kc.push(Math.round(n(m[1]))); // „1590 kJ / 380“
      if (!kc.length) for (const m of l.matchAll(/(\d{2,4}(?:[.,]\d)?)\s*k\s*j/gi)) kc.push(Math.round(n(m[1]) / 4.184));
    }
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      for (const [k, re] of KEYS) {
        if (out[k] != null || !re.test(l)) continue;
        if (k === "fett" && /ges[äa]tt|s[äa]ur|unges/i.test(l)) continue;
        const rest = l.replace(re, "§").split("§").slice(1).join(" ");
        const v = firstG(rest) ?? firstG(lines[i + 1] || "");
        if (v != null && v <= 100) out[k] = v;
        break;
      }
    }
    // kcal: erste Zahl, außer die Makros passen klar besser zu einer anderen (z. B. Portionsspalte zuerst gelesen)
    const good = kc.filter((v) => v >= 1 && v <= 950);
    if (good.length) {
      out.kcal = good[0];
      if (out.fett != null && out.kh != null && out.p != null) {
        const est = 9 * out.fett + 4 * out.kh + 4 * out.p + 2 * (out.ballast || 0);
        out.kcal = good.reduce((a, b) => (Math.abs(b - est) < Math.abs(a - est) ? b : a));
        if (Math.abs(out.kcal - est) > est * 0.3) out.kcal = Math.round(est); // gelesene Zahl passt gar nicht: aus den Nährwerten rechnen
      }
    }
    // Plausibilität: Teilmengen dürfen nicht größer sein als das Ganze
    if (out.ges != null && (out.fett != null ? out.ges > out.fett : out.ges > 60)) delete out.ges;
    if (out.zucker != null && out.kh != null && out.zucker > out.kh) delete out.zucker;
    return out;
  }

  async function readPhoto(file) {
    const box = form.querySelector("[data-off-pick]"), msg = box.querySelector("[data-nl-msg]");
    msg.textContent = "Lese die Tabelle … beim ersten Mal dauert es etwas länger.";
    let v = {};
    try {
      await loadTess();
      const img = await createImageBitmap(file);
      const w = await window.Tesseract.createWorker("deu");
      await w.setParameters({ tessedit_pageseg_mode: "3" }); // automatische Aufteilung, klappt bei Tabellen besser
      // Erst normal groß; wenn wenig erkannt wird (z. B. sehr nah fotografiert), noch einmal kleiner versuchen
      for (const size of [1600, 1000, 700]) {
        const r = parseLabel((await w.recognize(await prepImage(img, size))).data.text || "");
        if (Object.keys(r).length > Object.keys(v).length) v = r;
        if (Object.keys(v).length >= 5) break;
      }
      await w.terminate();
    } catch {
      msg.textContent = "Texterkennung gerade nicht möglich (Internet?). Bitte die Werte abtippen.";
      return;
    }
    let found = 0;
    for (const [k] of NUTRI) {
      const inp = box.querySelector(`[name="nl_${k}"]`);
      if (!inp) continue;
      inp.classList.remove("ocr");
      if (v[k] != null) { inp.value = String(v[k]).replace(".", ","); inp.classList.add("ocr"); found++; }
    }
    msg.textContent = found
      ? `${found} von ${NUTRI.length} Werten erkannt (markiert). Bitte kurz mit der Packung vergleichen.`
      : "Keine Werte erkannt. Fotografier die Tabelle möglichst gerade und hell, oder tipp die Werte ab.";
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
  document.addEventListener("change", (e) => {
    if (e.target.matches("[data-nl-photo]") && e.target.files[0]) { readPhoto(e.target.files[0]); e.target.value = ""; }
  });
  document.addEventListener("input", (e) => { if (e.target.classList && e.target.classList.contains("ocr")) e.target.classList.remove("ocr"); });
  document.getElementById("entry")?.addEventListener("close", stopScan);

  window.TBFood = { attach, saved, parseLabel };
})();
