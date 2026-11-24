// Trainingsbuch – Supplement-Plan mit Abhaken (Karte auf „Heute“)
// Plan in Tabelle „supplemente“, Häkchen in „supplement_log“ (SQL: 2026-11-24-supplemente.sql).
// Beim ersten Öffnen wird der mit Aurora abgestimmte Plan (24.11.2026) angelegt; danach ist alles änderbar.
(function () {
  const START = [
    { name: "Kreatin", menge: "5 g", wann: "morgens", regel: "taeglich", sort: 1, info: "Täglich, Zeitpunkt egal. Mehr als 5 g bringt keinen Vorteil." },
    { name: "Vitamin D", menge: "1.000–2.000 IE", wann: "essen", regel: "winter", sort: 2, info: "Oktober bis März, zu einer Mahlzeit mit etwas Fett." },
    { name: "Omega-3", menge: "ca. 2 g EPA+DHA", wann: "essen", regel: "taeglich", sort: 3, info: "Auf den EPA+DHA-Wert der Packung achten. Wirkt nach etwa 6 Wochen." },
    { name: "Citrullin", menge: "6–8 g", wann: "training", regel: "training", sort: 4, info: "Freiwillig, 30–60 Min. vor harten Einheiten." },
    { name: "Proteinpulver", menge: "25–30 g", wann: "abends", regel: "protein", sort: 5, info: "Nur, wenn heute noch mehr als 25 g Eiweiß fehlen." },
    { name: "Magnesium", menge: "200–300 mg", wann: "abends", regel: "taeglich", sort: 6, info: "Abends, nicht zusammen mit Eisen." },
    { name: "Eisen", menge: "Dosis von der Ärztin", wann: "morgens", regel: "taeglich", sort: 7, aktiv: false, info: "Pausiert bis zum Bluttest mit Ferritin. Dann morgens nüchtern mit Vitamin C, nicht mit Kaffee, Tee oder Milch." },
    { name: "Vitamin C", menge: "zum Eisen", wann: "morgens", regel: "taeglich", sort: 8, aktiv: false, info: "Zusammen mit dem Eisen, verbessert die Aufnahme." },
  ];
  // Was es im Körper macht (Antippen auf ⓘ). Schlüssel: Name in Kleinbuchstaben.
  const WIRKUNG = {
    "kreatin": "Füllt den schnellen Energiespeicher im Muskel auf. Das hilft bei kurzen, harten Belastungen wie Sätzen oder Boulderzügen und bringt über Wochen etwas mehr Kraft. Der Muskel speichert dabei etwas Wasser. Auch das Gehirn nutzt Kreatin, aber ob du dort einen Nutzen merkst, ist noch nicht sicher.",
    "vitamin d": "Hilft dem Darm, Calcium aufzunehmen, und ist damit wichtig für die Knochen. Es spielt auch für Muskeln und Abwehrkräfte eine Rolle. Im Winter bildet die Haut hier kaum welches.",
    "omega-3": "Baustein der Zellwände, vor allem in Gehirn und Augen. Es dämpft Entzündungen und senkt die Blutfette.",
    "citrullin": "Der Körper macht daraus Stickstoffmonoxid. Dadurch weiten sich die Blutgefäße und der Muskel wird besser durchblutet. Das kann ein paar Wiederholungen mehr bringen, der Effekt ist aber klein.",
    "proteinpulver": "Liefert Eiweiß, den Baustoff für Muskeln. Es wirkt nicht anders als Eiweiß aus dem Essen, ist nur bequemer.",
    "magnesium": "Wird für Muskel- und Nervenarbeit und für die Energiegewinnung gebraucht. Bei einem Mangel hilft es gegen Krämpfe.",
    "eisen": "Steckt im roten Blutfarbstoff und bringt Sauerstoff zu den Muskeln. Bei einem Mangel bist du müde und hast weniger Ausdauer. Der Ferritin-Wert zeigt, wie voll dein Speicher ist.",
    "vitamin c": "Hilft, Eisen aus der Nahrung oder aus Tabletten aufzunehmen. Außerdem stärkt es die Abwehr und wird für das Bindegewebe gebraucht.",
  };
  const wirkung = (s) => WIRKUNG[String(s.name || "").trim().toLowerCase()] || "";
  const offen = new Set(); // IDs mit aufgeklapptem Text
  const infoBtn = (s) => wirkung(s) ? `<button type="button" class="supp-i${offen.has(s.id) ? " on" : ""}" data-supp-i="${esc(s.id)}" aria-expanded="${offen.has(s.id)}" aria-label="Was macht ${esc(s.name)}?">i</button>` : "";
  const infoText = (s) => offen.has(s.id) && wirkung(s) ? `<p class="supp-wirkung">${esc(wirkung(s))}</p>` : "";
  const WANN = [["morgens", "Morgens"], ["essen", "Zum Essen"], ["training", "Vor dem Training"], ["abends", "Abends"]];
  const REGEL = [["taeglich", "jeden Tag"], ["winter", "Oktober bis März"], ["training", "an Trainingstagen"], ["protein", "wenn Eiweiß fehlt"]];
  const EIWEISS_ZIEL = 130, LUECKE = 25;
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iso = (d) => { const x = new Date(d); return new Date(Date.UTC(x.getFullYear(), x.getMonth(), x.getDate())).toISOString().slice(0, 10); };

  let db = null, cache = {}, el = null, plan = null, log = [], ok = true, edit = false, busy = false;

  async function load() {
    const p = await db.from("supplemente").select("*").order("sort", { ascending: true });
    if (p.error) { ok = false; return; }
    ok = true;
    plan = p.data || [];
    if (!plan.length) {
      const ins = await db.from("supplemente").insert(START.map((s) => ({ aktiv: true, ...s })));
      if (ins.error) { ok = false; return; }
      plan = (await db.from("supplemente").select("*").order("sort", { ascending: true })).data || [];
    }
    const seit = iso(Date.now() - 13 * 864e5);
    const l = await db.from("supplement_log").select("*").order("datum", { ascending: false }).limit(500);
    log = (l.data || []).filter((r) => r.datum >= seit);
  }

  // Ist das Supplement an diesem Tag dran?
  function faellig(s, tag) {
    if (!s.aktiv) return { due: false, why: "pausiert" };
    const m = new Date(tag + "T12:00:00Z").getUTCMonth() + 1;
    if (s.regel === "winter") return m >= 10 || m <= 3 ? { due: true } : { due: false, why: "erst ab Oktober" };
    if (s.regel === "training") {
      const t = ["bouldern", "kraft", "laufen", "rad"].some((k) => (cache[k] || []).some((r) => r.datum === tag));
      return { due: t, soft: !t, why: t ? "" : "nur wenn du heute trainierst" };
    }
    if (s.regel === "protein") {
      const p = (cache.ernaehrung || []).filter((r) => r.datum === tag).reduce((a, r) => a + (Number(r.protein_g) || 0), 0);
      const fehlt = Math.round(EIWEISS_ZIEL - p);
      return fehlt > LUECKE ? { due: true, why: `heute fehlen noch ${fehlt} g Eiweiß` } : { due: false, soft: true, why: "heute nicht nötig, Eiweiß passt" };
    }
    return { due: true };
  }
  const genommen = (s, tag) => log.some((r) => r.datum === tag && r.name === s.name);

  let auf = (() => { try { return localStorage.getItem("supp-auf") === "1"; } catch { return false; } })();
  function html() {
    const tag = iso(Date.now());
    if (!ok) return `<div class="glass c-card supp"><h3 class="c-title">Supplemente</h3>
      <p class="c-text">Für den Supplement-Plan braucht die Datenbank zwei neue Tabellen. Führ einmal die Datei <b>2026-11-24-supplemente.sql</b> im Supabase SQL Editor aus, dann erscheint hier dein Plan.</p></div>`;
    if (!plan) return "";
    const rows = plan.map((s) => ({ s, f: faellig(s, tag), g: genommen(s, tag) }));
    const due = rows.filter((r) => r.f.due), done = due.filter((r) => r.g).length;
    // Woche: Anteil der festen Supplemente (jeden Tag / Winter), die genommen wurden
    const fest = plan.filter((s) => s.aktiv && (s.regel === "taeglich" || s.regel === "winter"));
    const woche = Array.from({ length: 7 }, (_, i) => {
      const d = iso(Date.now() - (6 - i) * 864e5);
      const soll = fest.filter((s) => faellig(s, d).due);
      const ist = soll.filter((s) => genommen(s, d)).length;
      return { d, q: soll.length ? ist / soll.length : null, wd: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][new Date(d + "T12:00:00Z").getUTCDay()] };
    });
    const gruppen = WANN.map(([k, lbl]) => {
      const rs = rows.filter((r) => r.s.wann === k && (edit || r.s.aktiv));
      if (!rs.length) return "";
      return `<p class="supp-when">${lbl}</p>` + rs.map(({ s, f, g }) => edit ? editRow(s) : `
        <div class="supp-item"><div class="supp-line">
        <button type="button" class="supp-row${g ? " on" : ""}${f.due ? "" : " soft"}" data-supp-tick="${esc(s.id)}" aria-pressed="${g}">
          <span class="supp-box">${g ? "✓" : ""}</span>
          <span class="supp-main"><b>${esc(s.name)}</b> <span class="supp-menge">${esc(s.menge)}</span>
          ${f.why ? `<span class="supp-info">${esc(f.why)}</span>` : ""}</span></button>${infoBtn(s)}</div>${infoText(s)}</div>`).join("");
    }).join("");
    const paused = plan.filter((s) => !s.aktiv);
    const alle = due.length && done >= due.length;
    const status = !due.length ? `<span class="supp-st ok" title="Heute nichts fällig">✓</span>` : alle ? `<span class="supp-st ok" title="Alles genommen">✓</span>` : `<span class="supp-st">${done}/${due.length}</span>`;
    if (!auf && !edit) return `<div class="glass c-card supp zu"><button type="button" class="supp-toggle" data-supp-auf aria-expanded="false"><h3 class="c-title">Supplemente</h3>${status}<span class="supp-chev">⌄</span></button></div>`;
    return `<div class="glass c-card supp">
      <div class="supp-head"><button type="button" class="supp-toggle" data-supp-auf aria-expanded="true"><h3 class="c-title">Supplemente</h3>${status}<span class="supp-chev up">⌄</span></button><button type="button" class="btn ghost small-btn" data-supp-edit>${edit ? "Fertig" : "Bearbeiten"}</button></div>
      ${gruppen}
      ${edit ? addForm() : `<div class="supp-week">${woche.map((w) => `<span title="${w.d}"><i style="--q:${w.q == null ? 0 : w.q}" class="${w.q == null ? "none" : ""}"></i>${w.wd}</span>`).join("")}</div>
      ${paused.length ? `<p class="c-hint">Pausiert: ${esc(paused.map((s) => s.name).join(", "))}</p>` : ""}`}
    </div>`;
  }
  const opts = (list, v) => list.map(([k, l]) => `<option value="${k}"${k === v ? " selected" : ""}>${l}</option>`).join("");
  function editRow(s) {
    return `<div class="supp-edit${s.aktiv ? "" : " paused"}" data-supp-id="${esc(s.id)}">
      <div class="supp-edit-top"><b>${esc(s.name)}</b>${infoBtn(s)}
        <button type="button" class="btn ghost small-btn" data-supp-toggle>${s.aktiv ? "Pausieren" : "Aktivieren"}</button>
        <button type="button" class="icon-btn" data-supp-del aria-label="${esc(s.name)} löschen">✕</button></div>
      ${infoText(s)}<div class="supp-edit-grid">
        <label class="field"><span>Menge</span><input type="text" data-supp-f="menge" value="${esc(s.menge)}"></label>
        <label class="field"><span>Wann</span><select data-supp-f="wann">${opts(WANN, s.wann)}</select></label>
        <label class="field"><span>Wie oft</span><select data-supp-f="regel">${opts(REGEL, s.regel)}</select></label>
      </div></div>`;
  }
  function addForm() {
    return `<div class="supp-add"><p class="supp-when">Neues Supplement</p>
      <div class="supp-edit-grid">
        <label class="field"><span>Name</span><input type="text" data-supp-new="name" placeholder="z. B. Kollagen"></label>
        <label class="field"><span>Menge</span><input type="text" data-supp-new="menge" placeholder="z. B. 15 g"></label>
        <label class="field"><span>Wann</span><select data-supp-new="wann">${opts(WANN, "morgens")}</select></label>
        <label class="field"><span>Wie oft</span><select data-supp-new="regel">${opts(REGEL, "taeglich")}</select></label>
      </div>
      <button type="button" class="btn small-btn" data-supp-add>Hinzufügen</button></div>`;
  }
  const draw = () => { if (el) el.innerHTML = html(); };

  async function render(target, client, c) {
    el = target; cache = c || {};
    if (!el) return;
    if (!client) { el.innerHTML = ""; return; }
    if (client !== db || !plan) { db = client; plan = null; await load(); }
    draw();
  }

  document.addEventListener("click", async (e) => {
    if (!el || !el.contains(e.target) || busy) return;
    const tag = iso(Date.now());
    const ib = e.target.closest("[data-supp-i]");
    if (ib) { const id = ib.dataset.suppI; offen.has(id) ? offen.delete(id) : offen.add(id); draw(); return; }
    const tick = e.target.closest("[data-supp-tick]");
    if (tick) {
      const s = plan.find((x) => x.id === tick.dataset.suppTick); if (!s) return;
      busy = true;
      const had = log.find((r) => r.datum === tag && r.name === s.name);
      if (had) { log = log.filter((r) => r !== had); draw(); await db.from("supplement_log").delete().eq("datum", tag).eq("name", s.name); }
      else { log.push({ datum: tag, name: s.name }); draw(); const r = await db.from("supplement_log").insert({ datum: tag, name: s.name }); if (r.error) { log = log.filter((x) => !(x.datum === tag && x.name === s.name)); draw(); } }
      busy = false; return;
    }
    if (e.target.closest("[data-supp-edit]")) { edit = !edit; draw(); return; }
    if (e.target.closest("[data-supp-auf]")) { auf = !auf; try { localStorage.setItem("supp-auf", auf ? "1" : "0"); } catch {} draw(); return; }
    const row = e.target.closest("[data-supp-id]");
    if (row && e.target.closest("[data-supp-toggle]")) {
      const s = plan.find((x) => x.id === row.dataset.suppId); s.aktiv = !s.aktiv; draw();
      await db.from("supplemente").update({ aktiv: s.aktiv }).eq("id", s.id); return;
    }
    if (row && e.target.closest("[data-supp-del]")) {
      const s = plan.find((x) => x.id === row.dataset.suppId);
      if (!window.confirm(`${s.name} aus dem Plan löschen? Pausieren geht auch.`)) return;
      plan = plan.filter((x) => x !== s); draw();
      await db.from("supplemente").delete().eq("id", s.id); return;
    }
    if (e.target.closest("[data-supp-add]")) {
      const v = (k) => el.querySelector(`[data-supp-new="${k}"]`).value.trim();
      if (!v("name")) { el.querySelector('[data-supp-new="name"]').focus(); return; }
      busy = true;
      const neu = { name: v("name"), menge: v("menge"), wann: v("wann"), regel: v("regel"), aktiv: true, sort: plan.length + 1 };
      await db.from("supplemente").insert(neu);
      plan = (await db.from("supplemente").select("*").order("sort", { ascending: true })).data || plan;
      busy = false; draw(); return;
    }
  });
  document.addEventListener("change", async (e) => {
    const f = e.target.closest && e.target.closest("[data-supp-f]");
    if (!f || !el || !el.contains(f)) return;
    const s = plan.find((x) => x.id === f.closest("[data-supp-id]").dataset.suppId);
    s[f.dataset.suppF] = f.value.trim();
    await db.from("supplemente").update({ [f.dataset.suppF]: s[f.dataset.suppF] }).eq("id", s.id);
  });

  window.TBSupp = { render };
})();
