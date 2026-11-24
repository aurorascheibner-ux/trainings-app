// Trainingsbuch – Zyklus-Bereich (Ring, Kalender, Tages-Check, Auswertung)
// Angelehnt an gängige Zyklus-Apps (Clue, Flo, Apple Zyklusprotokoll), plus Training je Phase.
// Braucht charts.js (Phasen-Logik). Daten und Speichern kommen aus data.js über ctx.

(function () {
  const DAY = 864e5;
  const pd = (s) => new Date(s + "T00:00:00Z");
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const todayISO = () => { const n = new Date(); return iso(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); };
  const addDays = (s, n) => iso(+pd(s) + n * DAY);
  const diff = (a, b) => Math.round((pd(b) - pd(a)) / DAY);
  // Jahr nur anzeigen, wenn das Datum nicht aus dem aktuellen Jahr ist
  const fmt = (s, o = { day: "numeric", month: "short" }) => pd(s).toLocaleDateString("de-DE", { ...o, ...(pd(s).getUTCFullYear() !== new Date().getFullYear() && { year: "numeric" }), timeZone: "UTC" });
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const BANDC = { Periode: "#d9728f", Follikelphase: "#5fb88f", Eisprung: "#e0c04f", Lutealphase: "#9b8be0" };
  const KURZ = { Periode: "Periode", Follikelphase: "Follikelphase", Eisprung: "Eisprung", Lutealphase: "Lutealphase" };

  // Was man pro Tag antippen kann. Blutung: eine Auswahl, sonst beliebig viele.
  const BLUTUNG = ["Keine", "Schmierblutung", "Leicht", "Mittel", "Stark"];
  const GRUPPEN = [
    ["Körper", ["Krämpfe", "Kopfweh", "Rückenschmerzen", "Brustspannen", "Blähbauch", "Hautunreinheiten", "Ausfluss"]],
    ["Stimmung", ["Energiegeladen", "Ausgeglichen", "Müde", "Gereizt", "Traurig", "Ängstlich"]],
    ["Sonstiges", ["Heißhunger", "Schlecht geschlafen", "Gut geschlafen", "Verdauung"]],
  ];
  const BLUTET = new Set(["Schmierblutung", "Leicht", "Mittel", "Stark"]);

  let monthOffset = 0;      // 0 = aktueller Monat
  let selected = null;      // gewähltes Datum für den Tages-Check
  let ctx = null;

  function render(c) {
    ctx = c;
    const box = document.querySelector("[data-zyklus]");
    if (!box || !window.TBCharts) return;
    const t = todayISO();
    if (!selected || selected > t) selected = t;
    const phasen = window.TBCharts.phasen(c.cache.zyklus);
    const phaseOn = (d) => { const p = phasen.find((x) => x.start <= d && d <= x.ende); return p || null; };
    const tags = new Map((c.cache.zyklus_tag || []).map((r) => [r.datum, r]));
    box.replaceChildren();
    const top = el(`<div class="charts z-top"></div>`);
    if (window.TBCharts.zyklusTop) window.TBCharts.zyklusTop(top, c.cache);
    box.append(ring(phasen, phaseOn, t), top, kalender(phasen, phaseOn, tags, t), check(tags, phaseOn), auswertung(phasen, t), symptomeJePhase(tags, phaseOn));
  }

  const el = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };

  // ---------- 1. Zyklusring ----------
  function ring(phasen, phaseOn, t) {
    const z = window.TBCharts.zyklusHeute(ctx.cache);
    const rows = (ctx.cache.zyklus || []).slice().sort((a, b) => b.periode_start.localeCompare(a.periode_start));
    const laufend = rows[0] && !rows[0].periode_ende && diff(rows[0].periode_start, t) < 10 ? rows[0] : null;
    if (!z) {
      return el(`<div class="glass z-ring-card"><p class="muted">Trag den Beginn deiner letzten Periode ein, dann siehst du hier deinen Zyklus.</p>
        <button type="button" class="btn" data-add="zyklus">Periode eintragen</button></div>`);
    }
    const cyc = phasen.filter((p) => p.phase === "Periode" && !p.prognose && p.start <= t).pop();
    const L = Math.max(z.len, z.day);
    const R = 100, C = 130, SW = 18;
    const pt = (a, r = R) => [C + r * Math.cos(a), C + r * Math.sin(a)];
    const ang = (i) => -Math.PI / 2 + (i / L) * 2 * Math.PI;
    let segs = "";
    for (let i = 0; i < L; i++) {
      const d = addDays(cyc.start, i), p = phaseOn(d);
      const a0 = ang(i) + 0.012, a1 = ang(i + 1) - 0.012;
      const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
      const fut = d > t;
      segs += `<path d="M${x0.toFixed(1)},${y0.toFixed(1)} A${R},${R} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)}" stroke="${p ? BANDC[p.phase] : "#888"}" stroke-width="${SW}" fill="none" opacity="${fut ? 0.35 : 0.95}"/>`;
    }
    const [mx, my] = pt(ang(z.day - 0.5));
    const sub = z.overdue ? "Periode lässt auf sich warten" : z.next != null ? `Periode in etwa ${z.next} ${z.next === 1 ? "Tag" : "Tagen"}` : "";
    // Neue Periode trägt man über das + unten ein; nur das Ende einer laufenden Periode gibt es hier direkt.
    const btn = laufend ? `<button type="button" class="btn" data-edit-periode="${esc(laufend.id)}">Periode ist vorbei</button>` : "";
    return el(`<div class="glass z-ring-card">
      ${window.TBCharts.uhrSvg ? window.TBCharts.uhrSvg(ctx.cache) : ""}
      <p class="z-r-sub">${esc(sub)}</p>
      <div class="z-legend">${Object.keys(BANDC).map((k) => `<span><i style="background:${BANDC[k]}"></i>${k}</span>`).join("")}</div>
      ${btn ? `<div class="z-actions">${btn}</div>` : ""}
    </div>`);
  }

  // ---------- 2. Monatskalender ----------
  function kalender(phasen, phaseOn, tags, t) {
    const now = pd(t);
    const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + monthOffset, 1));
    const days = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7;
    const titel = first.toLocaleDateString("de-DE", { month: "long", year: "numeric", timeZone: "UTC" });
    const echtePeriode = (d) => (ctx.cache.zyklus || []).some((r) => r.periode_start <= d && d <= (r.periode_ende || (diff(r.periode_start, t) < 10 ? t : addDays(r.periode_start, 4))));
    let cells = "";
    for (let i = 0; i < lead; i++) cells += `<span></span>`;
    for (let n = 1; n <= days; n++) {
      const d = iso(+first + (n - 1) * DAY), p = phaseOn(d), tag = tags.get(d);
      const cls = ["z-day"];
      if (echtePeriode(d) || (tag && BLUTET.has(tag.blutung))) cls.push("per");
      else if (p && p.phase === "Periode" && p.prognose) cls.push("per-prog");
      else if (p && p.phase === "Eisprung") cls.push("ovu");
      if (d === t) cls.push("today");
      if (d === selected) cls.push("sel");
      if (d > t) cls.push("fut");
      const dot = tag && (tag.symptome || []).length ? `<i class="z-dot"></i>` : "";
      cells += `<button type="button" class="${cls.join(" ")}" data-zday="${d}" ${d > t ? "disabled" : ""}>${n}${dot}</button>`;
    }
    return el(`<div class="glass z-cal">
      <div class="z-cal-head">
        <button type="button" class="icon-btn" data-zmonth="-1" aria-label="Voriger Monat">‹</button>
        <h3>${titel}</h3>
        <button type="button" class="icon-btn" data-zmonth="1" aria-label="Nächster Monat">›</button>
      </div>
      <div class="z-grid z-wd">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((w) => `<span>${w}</span>`).join("")}</div>
      <div class="z-grid">${cells}</div>
      <div class="z-legend"><span><i class="per"></i>Periode</span><span><i class="per-prog"></i>erwartet</span><span><i class="ovu"></i>Eisprung</span><span><i class="z-dot-l"></i>Notiert</span></div>
    </div>`);
  }

  // ---------- 3. Tages-Check ----------
  function check(tags, phaseOn) {
    const t = todayISO(), d = selected, tag = tags.get(d) || {};
    const sym = new Set(tag.symptome || []);
    const p = phaseOn(d);
    const head = d === t ? "Wie geht's dir heute?" : `Wie ging's dir am ${fmt(d, { weekday: "short", day: "numeric", month: "short" })}?`;
    if (!ctx.tagOk) {
      return el(`<div class="glass z-check"><h3 class="c-title">${head}</h3>
        <p class="c-note">Für den Tages-Check fehlt noch eine Tabelle in Supabase. Sobald sie angelegt ist, kannst du hier antippen.</p></div>`);
    }
    const chip = (v, on, kind) => `<button type="button" class="z-chip${on ? " on" : ""}" data-ztag="${kind}" data-v="${esc(v)}">${esc(v)}</button>`;
    return el(`<div class="glass z-check">
      <h3 class="c-title">${head}</h3>
      ${p ? `<p class="c-note">${KURZ[p.phase]}</p>` : ""}
      <span class="c-lbl">Blutung</span>
      <div class="z-chips">${BLUTUNG.map((v) => chip(v, tag.blutung === v, "blutung")).join("")}</div>
      ${GRUPPEN.map(([g, list]) => `<span class="c-lbl">${g}</span><div class="z-chips">${list.map((v) => chip(v, sym.has(v), "sym")).join("")}</div>`).join("")}
    </div>`);
  }

  // ---------- 4. Auswertung: Zykluslänge und Periodendauer ----------
  function auswertung(phasen, t) {
    const rows = (ctx.cache.zyklus || []).slice().sort((a, b) => a.periode_start.localeCompare(b.periode_start));
    if (!rows.length) return el(`<span hidden></span>`);
    const zyklen = rows.map((r, i) => {
      const next = rows[i + 1];
      const len = next ? diff(r.periode_start, next.periode_start) : diff(r.periode_start, t) + 1;
      const per = r.periode_ende ? diff(r.periode_start, r.periode_ende) + 1 : null;
      return { start: r.periode_start, len, per, laufend: !next };
    }).slice(-6);
    const fertig = zyklen.filter((z) => !z.laufend && z.len >= 18 && z.len <= 60);
    const pers = zyklen.filter((z) => z.per);
    const avg = (a) => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
    const aL = avg(fertig.map((z) => z.len)), aP = avg(pers.map((z) => z.per));
    const max = Math.max(35, ...zyklen.map((z) => z.len));
    const bars = zyklen.slice().reverse().map((z) => `
      <div class="z-bar">
        <span class="z-bar-d">${fmt(z.start)}</span>
        <div class="z-bar-t"><i class="z-bar-len${z.laufend ? " run" : ""}" style="width:${(z.len / max) * 100}%"></i><i class="z-bar-per" style="width:${((z.per || 0) / max) * 100}%"></i></div>
        <span class="z-bar-n">${z.len}${z.laufend ? "+" : ""} T.</span>
      </div>`).join("");
    return el(`<div class="glass c-card">
      <h3 class="c-title">Deine Zyklen</h3>
      <div class="z-stats">
        <div><b>${aL ?? "–"}</b><span>Ø Zykluslänge${aL ? " (Tage)" : ", ab 2 Perioden"}</span></div>
        <div><b>${aP ?? "–"}</b><span>Ø Periode (Tage)</span></div>
      </div>
      ${bars}
      <div class="z-legend"><span><i style="background:${BANDC.Periode}"></i>Periode</span><span><i style="background:var(--ring-rest)"></i>ganzer Zyklus</span></div>
    </div>`);
  }

  // ---------- 5. Beschwerden je Phase ----------
  function symptomeJePhase(tags, phaseOn) {
    if (!ctx.tagOk) return el(`<span hidden></span>`);
    const per = { Periode: new Map(), Follikelphase: new Map(), Eisprung: new Map(), Lutealphase: new Map() };
    let any = false;
    for (const [d, r] of tags) {
      const p = phaseOn(d); if (!p) continue;
      (r.symptome || []).forEach((s) => { per[p.phase].set(s, (per[p.phase].get(s) || 0) + 1); any = true; });
    }
    const rows = Object.entries(per).map(([ph, m]) => {
      const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, n]) => `${esc(s)} <span class="muted">${n}×</span>`).join(", ");
      return `<tr><td><i style="background:${BANDC[ph]}"></i>${ph}</td><td>${top || '<span class="muted">–</span>'}</td></tr>`;
    }).join("");
    return el(`<div class="glass c-card">
      <h3 class="c-title">Was in welcher Phase auftaucht</h3>
      ${any ? "" : `<p class="c-note">Noch leer.</p>`}
      <table class="c-table z-table">${rows}</table>
    </div>`);
  }

  // ---------- Bedienung ----------
  document.addEventListener("click", async (e) => {
    const m = e.target.closest("[data-zmonth]");
    if (m) { monthOffset += Number(m.dataset.zmonth); return ctx && render(ctx); }
    const day = e.target.closest("[data-zday]");
    if (day) { selected = day.dataset.zday; render(ctx); document.querySelector(".z-check")?.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    const ep = e.target.closest("[data-edit-periode]");
    if (ep) { const r = (ctx.cache.zyklus || []).find((x) => String(x.id) === ep.dataset.editPeriode); if (r) ctx.openForm("zyklus", [{ ...r, periode_ende: r.periode_ende || todayISO() }]); return; }
    const chip = e.target.closest("[data-ztag]");
    if (chip && ctx) {
      const d = selected, cur = (ctx.cache.zyklus_tag || []).find((r) => r.datum === d) || { datum: d, blutung: null, symptome: [] };
      const next = { blutung: cur.blutung, symptome: [...(cur.symptome || [])] };
      const v = chip.dataset.v;
      if (chip.dataset.ztag === "blutung") next.blutung = cur.blutung === v ? null : v;
      else next.symptome = next.symptome.includes(v) ? next.symptome.filter((s) => s !== v) : [...next.symptome, v];
      chip.classList.toggle("on");
      await ctx.saveTag(d, next, cur.id);
      render(ctx);
    }
  });

  window.TBZyklus = { render };
})();
