// Trainingsbuch – Essen automatisch ausfüllen
// Sucht Produkte in Open Food Facts (offene Lebensmittel-Datenbank) und liest Strichcodes mit der Kamera.
// Es geht nur das Suchwort bzw. die Strichcode-Nummer an Open Food Facts, keine persönlichen Daten.

(function () {
  const SEARCH = "https://de.openfoodfacts.org/cgi/search.pl";
  const PRODUCT = "https://world.openfoodfacts.org/api/v2/product/";
  const FIELDS = "code,product_name,product_name_de,brands,quantity,serving_quantity,nutriments";
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : null; };
  const de = (n, d = 0) => n == null ? "–" : n.toLocaleString("de-DE", { maximumFractionDigits: d });

  const cache = new Map();
  let form = null, timer = null, lastQ = "", picked = null, stream = null, scanning = false;

  // Produkt aus Open Food Facts in einfache Werte umrechnen
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

  // ---------- Formular erweitern ----------
  function attach(f) {
    form = f; picked = null; lastQ = "";
    const input = form.elements.lebensmittel;
    if (!input) return;
    const after = form.querySelector('.combo-list[data-for="lebensmittel"]') || input.closest("label");
    after.insertAdjacentHTML("afterend", `
      <div class="off-tools">
        <button type="button" class="btn ghost small-btn" data-off-scan><svg class="ico" aria-hidden="true"><use href="#i-scan"/></svg> Barcode scannen</button>
        <span class="muted small" data-off-status>Oder tippen, dann kommen Produkte dazu.</span>
      </div>
      <div class="off-list" data-off-list hidden></div>
      <div class="off-pick glass" data-off-pick hidden></div>`);
  }

  function status(t) { const s = form && form.querySelector("[data-off-status]"); if (s) s.textContent = t; }

  // ---------- Suche ----------
  function onInput(e) {
    if (!form || e.target !== form.elements.lebensmittel) return;
    const q = e.target.value.trim();
    clearTimeout(timer);
    if (picked && q === picked.name) return;
    if (q.length < 3) { hideList(); status("Oder tippen, dann kommen Produkte dazu."); return; }
    timer = setTimeout(() => search(q), 900); // Open Food Facts bittet um wenige Suchanfragen
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
        status("Produktsuche gerade nicht erreichbar. Barcode geht trotzdem.");
        return;
      }
    }
    if (!form || form.elements.lebensmittel.value.trim() !== q) return;
    const box = form.querySelector("[data-off-list]");
    if (!list.length) { hideList(); status("Kein Produkt gefunden. Werte einfach selbst eintragen."); return; }
    status("Produkte aus Open Food Facts:");
    box._items = list;
    box.innerHTML = list.map((x, i) => `<button type="button" class="off-item" data-off-i="${i}">
      <strong>${esc(x.name)}</strong><span class="muted small">${esc([x.menge, `${de(x.kcal)} kcal`, x.p != null && `${de(x.p, 1)} g Eiweiß`].filter(Boolean).join(" · "))} pro 100 g</span></button>`).join("");
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
      <p class="muted small">Alle Nährwerte werden für diese Menge ausgerechnet. Werte von Open Food Facts.</p>`;
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
    if (el.notiz && !el.notiz.value) el.notiz.value = "Werte von Open Food Facts";
  }

  // ---------- Strichcode ----------
  async function lookup(code) {
    status("Suche Strichcode " + code + " …");
    try {
      const r = await fetch(`${PRODUCT}${encodeURIComponent(code)}.json?fields=${FIELDS}`);
      const j = await r.json();
      if (!j.product) { status("Dieses Produkt kennt Open Food Facts noch nicht. Werte bitte selbst eintragen."); return; }
      const x = simple({ code, ...j.product });
      if (x.kcal == null) { form.elements.lebensmittel.value = x.name; status("Produkt gefunden, aber ohne Nährwerte. Bitte selbst eintragen."); return; }
      pick(x);
    } catch {
      status("Open Food Facts gerade nicht erreichbar. Versuch es gleich nochmal.");
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
    // Eigene Einträge aus der Auswahlliste gewählt: Produktvorschläge schließen
    if (e.target.closest('.combo-list[data-for="lebensmittel"] .combo-item')) { hideList(); clearTimeout(timer); picked = null; const b = form && form.querySelector("[data-off-pick]"); if (b) b.hidden = true; }
  });
  document.getElementById("entry")?.addEventListener("close", stopScan);

  window.TBFood = { attach };
})();
