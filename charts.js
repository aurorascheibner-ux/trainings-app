// Trainingsbuch – Grafiken (übernommen aus dem Dashboard, angepasst an die App)
// Braucht d3 (wird in index.html geladen). Daten kommen aus data.js (cache).

(function () {
  const DAY = 864e5;
  const pd = (s) => new Date(s + "T00:00:00Z");
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const fmtD = (d) => { const t = new Date(d); return t.toLocaleDateString("de-DE", { day: "numeric", month: "short", ...(t.getUTCFullYear() !== new Date().getFullYear() && { year: "2-digit" }), timeZone: "UTC" }); };
  const dm = (t) => { const d = new Date(t); return d.getUTCDate() + "." + (d.getUTCMonth() + 1) + "."; };
  const mmss = (s) => Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");
  const todayUTC = () => { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); };
  const fnum = (n) => Number(n).toLocaleString("de-DE");
  const E = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const GRADES = ["4", "4+", "5a", "5a+", "5b", "5b+", "5c", "5c+", "6a", "6a+", "6b", "6b+", "6c", "6c+", "7a", "7a+", "7b", "7b+", "7c", "7c+", "8a", "8a+", "8b"];
  // Sportarten nehmen die Farben des gewählten Farbkonzepts
  const SPORTC = { Bouldern: "var(--c4)", Kraft: "var(--c1)", Laufen: "var(--c2)", Rad: "var(--c3)" };
  const SETC = ["var(--c1)", "var(--c4)", "var(--c2)", "var(--c3)", "var(--text)"];
  const BANDC = { Periode: "#d9728f", Follikelphase: "#5fb88f", Eisprung: "#e0c04f", Lutealphase: "#9b8be0" };
  const SICK = "#ff5a5a";
  const PHASES = ["Periode", "Follikelphase", "Eisprung", "Lutealphase"];

  let C = {}; // aktueller Datenstand

  // ---------- Berechnungen ----------
  // Phasen je Zyklus: Eisprung 14 Tage vor der nächsten Periode, künftige Zyklen mit Ø-Länge (sonst 26 Tage).
  // Ohne neue Periode wird die nächste frühestens für morgen erwartet.
  function phasen(zyklus) {
    const p = (zyklus || []).filter((r) => r.periode_start).map((r) => ({ s: Date.parse(r.periode_start), e: Date.parse(r.periode_ende || r.periode_start) + (r.periode_ende ? 0 : 4 * DAY) })).sort((a, b) => a.s - b.s);
    if (!p.length) return [];
    const gaps = p.slice(1).map((x, i) => Math.round((x.s - p[i].s) / DAY)).filter((g) => g >= 18 && g <= 45);
    const len = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : 26;
    const mlen = Math.round(p.reduce((a, x) => a + (x.e - x.s) / DAY, 0) / p.length);
    const last = p[p.length - 1];
    const first = Math.max(last.s + len * DAY, +todayUTC() + DAY);
    for (let k = 0; k < 3; k++) p.push({ s: first + k * len * DAY, e: first + (k * len + mlen) * DAY, prognose: true });
    const out = [];
    for (let i = 0; i < p.length - 1; i++) {
      const c = p[i], next = p[i + 1].s, ov = next - 14 * DAY, prog = !!c.prognose, zl = Math.round((next - c.s) / DAY), zs = iso(c.s);
      out.push({ phase: "Periode", start: iso(c.s), ende: iso(c.e), prognose: prog, zyklus_start: zs, zyklus_laenge: zl });
      out.push({ phase: "Follikelphase", start: iso(c.e + DAY), ende: iso(ov - 2 * DAY), prognose: prog, zyklus_start: zs, zyklus_laenge: zl });
      out.push({ phase: "Eisprung", start: iso(ov - DAY), ende: iso(ov + DAY), prognose: true, zyklus_start: zs, zyklus_laenge: zl });
      out.push({ phase: "Lutealphase", start: iso(ov + 2 * DAY), ende: iso(next - DAY), prognose: prog, zyklus_start: zs, zyklus_laenge: zl });
    }
    return out;
  }
  const phaseOn = (dateStr) => { const p = C.phasen.find((x) => x.start <= dateStr && dateStr <= x.ende); return p ? p.phase : null; };

  function zyklusHeute() {
    const t = todayUTC(), ti = iso(t);
    const cur = C.phasen.find((p) => p.start <= ti && ti <= p.ende);
    const cyc = C.phasen.filter((p) => p.phase === "Periode" && !p.prognose && p.start <= ti).pop() || C.phasen.filter((p) => p.phase === "Periode" && p.start <= ti).pop();
    const nxt = C.phasen.find((p) => p.phase === "Periode" && p.start > ti);
    if (!cur || !cyc) return null;
    const day = Math.round((t - pd(cyc.start)) / DAY) + 1;
    const len = cyc.zyklus_laenge;
    return { day, len, phase: cur.phase, next: nxt ? Math.round((pd(nxt.start) - t) / DAY) : null, overdue: !!(nxt && nxt.prognose && day > 35) };
  }

  const weekStart = (dateStr) => { const d = pd(dateStr); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); };

  // ---------- Bausteine ----------
  function niceTicks(lo, hi, n = 4) { const s = d3.scaleLinear([lo, hi], [0, 1]).nice(n); return { domain: s.domain(), ticks: s.ticks(n) }; }

  function bands(withPhases) {
    const out = [];
    if (withPhases) C.phasen.forEach((p) => out.push({ a: +pd(p.start), b: +pd(p.ende) + DAY, color: BANDC[p.phase], op: p.prognose && p.phase !== "Eisprung" ? 0.1 : 0.18, name: p.phase }));
    (C.befinden || []).forEach((r) => { if (r.datum_von && r.status !== "gut") out.push({ a: +pd(r.datum_von), b: (r.datum_bis ? +pd(r.datum_bis) : +todayUTC()) + DAY, color: SICK, name: "Krank", sick: true }); });
    return out;
  }

  function tipOf(el) {
    const tip = d3.select(el).append("div").attr("class", "c-tip").style("display", "none");
    let timer;
    return {
      show(ev, head, lines) {
        tip.style("display", null).html("");
        tip.append("div").attr("class", "d").text(head);
        lines.forEach((l) => { const d = tip.append("div"); if (l.color) d.append("i").style("background", l.color); d.append("span").text(l.text); });
        const r = el.getBoundingClientRect(), w = tip.node().offsetWidth;
        let lx = ev.clientX - r.left + 12; if (lx + w > r.width) lx = Math.max(0, ev.clientX - r.left - w - 12);
        tip.style("left", lx + "px").style("top", Math.max(0, ev.clientY - r.top - 44) + "px");
        clearTimeout(timer); timer = setTimeout(() => tip.style("display", "none"), 3500);
      },
      hide() { tip.style("display", "none"); },
    };
  }
  const onTip = (sel, T, fn) => sel.on("pointerdown pointermove", (ev, d) => fn(ev, d)).on("pointerleave", T.hide);

  function legend(el, items) {
    const lg = E("div", "c-legend");
    items.forEach(([color, text, op]) => { const s = E("span"); const i = E("i"); i.style.background = color; if (op) i.style.opacity = op; s.append(i, E("span", "", text)); lg.appendChild(s); });
    el.appendChild(lg);
  }

  // o: {kind:'line'|'bar', series:[{name,color,axis,pts:[{d,v,label}]}], left:{domain,ticks,fmt}, right?, refs?, phases?, h?, weekLabels?}
  function chart(el, o) {
    el.replaceChildren();
    const W = Math.max(280, Math.round(el.clientWidth) || 360), H = o.h || 210;
    const svg = d3.select(el).append("svg").attr("width", "100%").attr("viewBox", `0 0 ${W} ${H}`);
    const meas = (txts) => { const t = svg.append("text").attr("font-size", 11); let m = 0; txts.forEach((s) => { t.text(s); m = Math.max(m, t.node().getComputedTextLength()); }); t.remove(); return m; };
    const L = o.left, R = o.right || null;
    const m = { t: 16, r: R ? meas(R.ticks.map(R.fmt)) + 12 : 10, b: 24, l: meas(L.ticks.map(L.fmt)) + 10 };
    const all = o.series.flatMap((s) => s.pts), today = todayUTC();
    const pad = o.kind === "line" ? 2 : 4;
    const x0 = new Date(Math.min(d3.min(all, (p) => p.d), +today - 35 * DAY) - (o.kind === "line" ? 0 : 3 * DAY)), x1 = new Date(Math.max(d3.max(all, (p) => p.d), +today) + pad * DAY);
    const x = d3.scaleUtc([x0, x1], [m.l, W - m.r]);
    const yL = d3.scaleLinear(L.domain, [H - m.b, m.t]), yR = R ? d3.scaleLinear(R.domain, [H - m.b, m.t]) : null;
    const used = new Map();
    bands(o.phases).forEach((b) => {
      const a = Math.max(b.a, +x0), z = Math.min(b.b, +x1); if (z <= a) return;
      if (b.sick) { svg.append("line").attr("x1", x(new Date(a)) + 4).attr("x2", Math.max(x(new Date(a)) + 4.1, x(new Date(z)) - 4)).attr("y1", m.t - 9).attr("y2", m.t - 9).style("stroke", SICK).attr("stroke-width", 6).attr("stroke-linecap", "round").attr("stroke-dasharray", "0.1 10"); used.set(b.name, b.color); return; }
      svg.append("rect").attr("x", x(new Date(a))).attr("y", m.t).attr("width", x(new Date(z)) - x(new Date(a))).attr("height", H - m.b - m.t).style("fill", b.color).style("opacity", b.op * 1.6);
      used.set(b.name, b.color);
    });
    const txt = (sel) => sel.attr("class", "c-axis");
    L.ticks.forEach((t) => svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", yL(t)).attr("y2", yL(t)).attr("class", "c-grid"));
    L.ticks.forEach((t) => txt(svg.append("text").attr("x", m.l - 6).attr("y", yL(t)).attr("dy", "0.32em").attr("text-anchor", "end").text(L.fmt(t))));
    if (R) R.ticks.forEach((t) => txt(svg.append("text").attr("x", W - m.r + 6).attr("y", yR(t)).attr("dy", "0.32em").attr("text-anchor", "start").text(R.fmt(t))));
    if (o.weekLabels) {
      const wk = [...new Set(all.map((p) => +p.d))].sort((a, b) => a - b);
      const ppw = (W - m.l - m.r) / Math.max(1, (x1 - x0) / (7 * DAY));
      const every = Math.max(1, Math.ceil(44 / Math.max(1, ppw)));
      wk.forEach((dt, i) => { if ((wk.length - 1 - i) % every) return; txt(svg.append("text").attr("x", x(new Date(dt))).attr("y", H - 6).attr("text-anchor", "middle").text("Mo " + dm(dt - 3 * DAY))); });
    } else x.ticks(Math.max(2, Math.floor((W - m.l - m.r) / 70))).forEach((t) => txt(svg.append("text").attr("x", x(t)).attr("y", H - 6).attr("text-anchor", "middle").text(fmtD(t))));
    (o.refs || []).forEach((r) => {
      svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", yL(r.v)).attr("y2", yL(r.v)).attr("class", "c-ref");
      txt(svg.append("text").attr("x", W - m.r - 4).attr("y", yL(r.v) - 5).attr("text-anchor", "end").text(r.label));
    });
    svg.append("line").attr("x1", x(today)).attr("x2", x(today)).attr("y1", m.t).attr("y2", H - m.b).attr("class", "c-today");
    const T = tipOf(el);
    const ppd = (W - m.l - m.r) / ((x1 - x0) / DAY), bw = Math.max(5, Math.min(34, ppd * (o.barDays || 4.5)));
    o.series.forEach((s) => {
      const y = s.axis === "right" ? yR : yL, pts = [...s.pts].sort((a, b) => a.d - b.d);
      if (o.kind === "bar") {
        const base = y(y.domain()[0]);
        onTip(svg.append("g").selectAll("rect").data(pts).join("rect").attr("x", (p) => x(p.d) - bw / 2).attr("width", bw).attr("y", (p) => y(p.v)).attr("height", (p) => Math.max(0, base - y(p.v))).attr("rx", 4).style("fill", s.color),
          T, (ev, p) => T.show(ev, o.weekLabels ? "Woche ab " + fmtD(+p.d - 3 * DAY) : fmtD(p.d), [{ color: s.color, text: s.name + ": " + p.label }]));
      } else {
        if (pts.length > 1) svg.append("path").datum(pts).attr("d", d3.line().curve(d3.curveMonotoneX).x((p) => x(p.d)).y((p) => y(p.v))).style("fill", "none").style("stroke", s.color).attr("stroke-width", 2.2).attr("stroke-linecap", "round");
        const g = svg.append("g").selectAll("g").data(pts).join("g");
        g.append("circle").attr("cx", (p) => x(p.d)).attr("cy", (p) => y(p.v)).attr("r", 4).style("fill", s.color).attr("class", "c-dot");
        onTip(g.append("circle").attr("cx", (p) => x(p.d)).attr("cy", (p) => y(p.v)).attr("r", 14).style("fill", "transparent"), T, (ev, p) => T.show(ev, fmtD(p.d), [{ color: s.color, text: s.name + ": " + p.label }]));
      }
    });
    const li = [];
    if (o.series.length > 1) o.series.forEach((s) => li.push([s.color, s.name]));
    used.forEach((c, n) => li.push([c, n, n === "Krank" ? 1 : 0.6]));
    if (li.length) legend(el, li);
  }

  function card(parent, title, note) {
    const c = E("div", "glass c-card");
    c.appendChild(E("h3", "c-title", title));
    if (note) c.appendChild(E("p", "c-note", note));
    const body = E("div", "c-body");
    c.appendChild(body);
    parent.appendChild(c);
    return body;
  }
  const empty = (el, text) => el.appendChild(E("p", "c-empty", text));

  // ---------- Heute: Trainingstage pro Woche ----------
  function wochenUebersicht(el) {
    const sports = ["Bouldern", "Kraft", "Laufen", "Rad"], src = { Bouldern: "bouldern", Kraft: "kraft", Laufen: "laufen", Rad: "rad" };
    const dates = sports.flatMap((s) => (C[src[s]] || []).map((r) => r.datum)).filter(Boolean).sort();
    if (!dates.length) return empty(el, "Erscheint mit dem ersten Eintrag.");
    const today = +todayUTC(), ws = (t) => t - ((new Date(t).getUTCDay() + 6) % 7) * DAY;
    const W = Math.max(280, Math.round(el.clientWidth) || 360);
    let weeks = []; for (let w = ws(+pd(dates[0])); w <= ws(today); w += 7 * DAY) weeks.push(w);
    const maxW = Math.max(2, Math.floor((W - 8) / 80)); if (weeks.length > maxW) weeks = weeks.slice(-maxW);
    const done = new Map(); sports.forEach((s) => (C[src[s]] || []).forEach((r) => { if (!r.datum) return; const k = +pd(r.datum); if (!done.has(k)) done.set(k, new Set()); done.get(k).add(s); }));
    const sick = (t) => (C.befinden || []).some((r) => r.status !== "gut" && r.datum_von && t >= +pd(r.datum_von) && t <= (r.datum_bis ? +pd(r.datum_bis) : today));
    const phaseAt = (t) => phaseOn(iso(t));
    const gapW = 10, m = { t: 12, b: 32, l: 2, r: 2 }, H = 180;
    const colW = (W - m.l - m.r - gapW * (weeks.length - 1)) / (weeks.length * 7), cw = Math.max(4, colW - 3);
    const unit = (H - m.t - m.b) / 4;
    const svg = d3.select(el).append("svg").attr("width", "100%").attr("viewBox", `0 0 ${W} ${H}`);
    const T = tipOf(el), wd = ["M", "D", "M", "D", "F", "S", "S"], wdl = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
    const base = H - m.b, usedPh = new Set();
    let anySick = false;
    weeks.forEach((w, wi) => {
      const gx = m.l + wi * (7 * colW + gapW);
      for (let i = 0; i < 7; i++) {
        const t = w + i * DAY, x0 = gx + i * colW, x = x0 + (colW - cw) / 2, s = done.get(t), fut = t > today, ph = phaseAt(t);
        if (ph) { svg.append("rect").attr("x", x0).attr("width", colW).attr("y", m.t).attr("height", base - m.t).style("fill", BANDC[ph]).style("opacity", 0.2); usedPh.add(ph); }
        if (sick(t) && !fut) { svg.append("rect").attr("x", x).attr("width", cw).attr("y", m.t).attr("height", 6).attr("rx", 3).style("fill", SICK); anySick = true; }
        if (t === today) svg.append("rect").attr("x", x - 1).attr("width", cw + 2).attr("y", m.t).attr("height", base - m.t).attr("rx", 3).attr("class", "c-todaybox");
        let k = 0; sports.forEach((sp) => { if (s && s.has(sp)) { svg.append("rect").attr("x", x).attr("width", cw).attr("y", base - (k + 1) * unit + 1).attr("height", unit - 2).attr("rx", 3).style("fill", SPORTC[sp]); k++; } });
        if (!fut) onTip(svg.append("rect").attr("x", x0).attr("width", colW).attr("y", m.t).attr("height", base - m.t).style("fill", "transparent"), T,
          (ev) => T.show(ev, wdl[i] + " " + dm(t) + (ph ? " · " + ph : ""), s ? [...s].map((sp) => ({ color: SPORTC[sp], text: sp })) : [{ text: sick(t) ? "Krank, kein Training" : "Kein Training" }]));
        svg.append("text").attr("x", x0 + colW / 2).attr("y", base + 13).attr("text-anchor", "middle").attr("class", "c-axis").style("opacity", fut ? 0.45 : 1).text(wd[i]);
      }
      svg.append("text").attr("x", gx + 3.5 * colW).attr("y", H - 4).attr("text-anchor", "middle").attr("class", "c-axis").text("ab " + dm(w));
    });
    const li = sports.map((s) => [SPORTC[s], s]);
    if (anySick) li.push([SICK, "Krank"]);
    PHASES.filter((p) => usedPh.has(p)).forEach((p) => li.push([BANDC[p], p, 0.5]));
    legend(el, li);
  }

  // ---------- Bouldern ----------
  function bGrad(el) {
    const rows = (C.bouldern || []).filter((r) => GRADES.includes(String(r.max_grad || "").trim()));
    if (!rows.length) return empty(el, "Noch keine Boulder-Session mit Grad eingetragen.");
    const idx = rows.map((r) => GRADES.indexOf(String(r.max_grad).trim()));
    const lo = Math.max(0, Math.min(...idx, GRADES.indexOf("6c")) - 1), hi = Math.min(GRADES.length - 1, Math.max(...idx, GRADES.indexOf("7b")) + 1);
    const ticks = d3.range(lo, hi + 1).filter((v, i, a) => a.length <= 7 || i % 2 === 0);
    chart(el, { kind: "line", phases: true, left: { domain: [lo, hi], ticks, fmt: (i) => GRADES[i] }, series: [{ name: "Schwerster", color: SPORTC.Bouldern, pts: rows.map((r) => ({ d: pd(r.datum), v: GRADES.indexOf(String(r.max_grad).trim()), label: String(r.max_grad).trim() })) }] });
  }
  function bWoche(el) {
    const m = new Map(); (C.bouldern || []).forEach((r) => { const k = weekStart(r.datum); m.set(k, (m.get(k) || 0) + 1); });
    const w = [...m].sort();
    if (!w.length) return empty(el, "Erscheint mit der ersten Session.");
    const top = Math.max(6, d3.max(w, (r) => r[1]));
    chart(el, { kind: "bar", weekLabels: true, barDays: 4.5, left: { domain: [0, top], ticks: d3.range(0, top + 1, 2), fmt: d3.format("d") }, refs: [{ v: 4, label: "Ziel ab 4" }],
      series: [{ name: "Sessions", color: SPORTC.Bouldern, pts: w.map(([wk, n]) => ({ d: new Date(+pd(wk) + 3 * DAY), v: n, label: String(n) })) }] });
  }

  // ---------- Kraft ----------
  const BW = 75; // Körpergewicht für die Klimmzug-Schätzung
  const ATH = "Vergleich: Kraftsportlerinnen (Strength Level, 75 kg Körpergewicht), nicht Frauen allgemein. Band = „Intermediate“ (etwa die Mitte) bis „Advanced“ (etwa die stärksten 20 %).";
  const NORMS = {
    "Bankdrücken": { lo: 49, hi: 58, color: "#7fc79a", who: "Frauen 20–29 allgemein, 75 kg", hint: "Vergleich: Cooper Institute, Frauen 20–29 aus Gesundheitschecks (gemessen am Gerät, nicht mit Langhantel)." },
    "Kniebeugen": { lo: 84, hi: 113, color: "#e58aa8", who: "Kraftsportlerinnen", hint: ATH },
    "Rumänisches Kreuzheben": { lo: 73, hi: 98, color: "#e58aa8", who: "Kraftsportlerinnen", hint: ATH },
    "Klimmzug": { lo: 8, hi: 24, bw: true, color: "#e58aa8", who: "Kraftsportlerinnen, Zusatzgewicht", hint: ATH + " Werte beziehen sich auf das Zusatzgewicht." },
  };
  const NOCMP = new Set(["Kniebeugen", "Rumänisches Kreuzheben", "Klimmzug"]);
  const e1rm = (w, r) => w * (1 + r / 30);

  function setChart(el, u, rows, mode) {
    const norm = mode === "kg" ? NORMS[u] : null;
    const val = (r) => mode === "sec" ? Number(r.dauer_s) || 0 : mode === "kg" ? Number(r.gewicht_kg) || 0 : Number(r.wdh) || 0;
    let dates = [...new Set(rows.map((r) => r.datum))].sort();
    const cut = dates.length > 8; if (cut) dates = dates.slice(-8);
    const groups = dates.map((d) => {
      const rs = rows.filter((r) => r.datum === d).sort((a, b) => Number(a.satz) - Number(b.satz));
      let est = null;
      if (norm) { const c = rs.filter((r) => Number(r.wdh) > 0 && Number(r.wdh) <= 12).map((r) => norm.bw ? e1rm((Number(r.gewicht_kg) || 0) + BW, Number(r.wdh)) - BW : e1rm(Number(r.gewicht_kg) || 0, Number(r.wdh))); if (c.length) est = Math.round(d3.max(c)); }
      return { d, date: pd(d), rs, est };
    });
    const nMax = d3.max(groups, (g) => g.rs.length) || 1, need = (nMax * 24 + (nMax - 1) * 3 + (norm ? 22 : 0)) / 0.8;
    // Die Achse links bleibt stehen, auch wenn man die Balken seitlich wischt
    const AX = 36, W0 = Math.max(244, (Math.round(el.clientWidth) || 360) - AX), W = Math.max(W0, Math.ceil(10 + dates.length * need)), H = 230;
    const vmax = d3.max([...groups.flatMap((g) => g.rs.map(val)), ...groups.map((g) => g.est || 0), norm ? norm.hi : 0]) || 1;
    const t = niceTicks(0, vmax * 1.2);
    const row = d3.select(el).append("div").attr("class", "c-yrow");
    const ax = row.append("svg").attr("class", "c-yaxis").attr("width", AX).attr("height", H).attr("viewBox", `0 0 ${AX} ${H}`);
    const wrap = row.append("div").attr("class", "c-scroll");
    const svg = wrap.append("svg").attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);
    if (W > W0) requestAnimationFrame(() => { wrap.node().scrollLeft = W; });
    const m = { t: 24, r: 6, b: 26, l: 2 };
    const y = d3.scaleLinear(t.domain, [H - m.b, m.t]);
    const x = d3.scaleBand(dates, [m.l, W - m.r]).paddingInner(0.2).paddingOuter(0.06);
    t.ticks.forEach((v) => { svg.append("line").attr("x1", m.l).attr("x2", W - m.r).attr("y1", y(v)).attr("y2", y(v)).attr("class", "c-grid"); ax.append("text").attr("x", AX - 5).attr("y", y(v)).attr("dy", "0.32em").attr("text-anchor", "end").attr("class", "c-axis").text(fnum(v)); });
    ax.append("text").attr("x", AX - 5).attr("y", 9).attr("text-anchor", "end").attr("class", "c-axis c-unit").text(mode === "kg" ? "kg" : mode === "sec" ? "Sek." : "Wdh.");
    if (norm) svg.append("rect").attr("x", m.l).attr("width", W - m.r - m.l).attr("y", y(norm.hi)).attr("height", y(norm.lo) - y(norm.hi)).style("fill", norm.color).style("opacity", 0.18);
    const T = tipOf(el), base = y(0);
    let anySick = false;
    groups.forEach((g) => {
      const gx = x(g.d), gw = x.bandwidth(), n = g.rs.length, res = g.est != null ? 22 : 0;
      const bw = Math.min(38, Math.max(13, (gw - res - (n - 1) * 3) / n)), off = gx + (gw - res - (n * bw + (n - 1) * 3)) / 2, right = off + n * bw + (n - 1) * 3;
      const ph = phaseOn(g.d);
      g.rs.forEach((r, i) => {
        const v = val(r), bx = off + i * (bw + 3), sn = Number(r.satz) || i + 1, col = SETC[(sn - 1) % SETC.length];
        const line = mode === "sec" ? r.dauer_s + " s" + (r.gewicht_kg ? " mit " + r.gewicht_kg + " kg" : "") : mode === "kg" ? r.wdh + " × " + r.gewicht_kg + " kg" : r.wdh + " Wdh";
        onTip(svg.append("rect").attr("x", bx).attr("width", bw).attr("y", y(v)).attr("height", Math.max(0, base - y(v))).attr("rx", 3).style("fill", col), T,
          (ev) => T.show(ev, fmtD(g.date) + (ph ? " · " + ph : ""), [{ color: col, text: "Satz " + sn + ": " + line }]));
        const top = mode === "kg" ? (r.wdh ? r.wdh + "×" : "") : mode === "sec" ? r.dauer_s + "s" : r.wdh + "×";
        const sub = mode === "kg" ? fnum(r.gewicht_kg) : "";
        svg.append("text").attr("x", bx + bw / 2).attr("y", y(v) - (sub ? 14 : 4)).attr("text-anchor", "middle").attr("class", "c-val").text(top);
        if (sub) svg.append("text").attr("x", bx + bw / 2).attr("y", y(v) - 3).attr("text-anchor", "middle").attr("class", "c-axis").text(sub);
      });
      if (g.est != null) {
        const cx = right + 12, cy = y(g.est);
        onTip(svg.append("path").attr("d", `M${cx},${cy - 5}L${cx + 5},${cy}L${cx},${cy + 5}L${cx - 5},${cy}Z`).attr("class", "c-est"), T,
          (ev) => T.show(ev, fmtD(g.date), [{ text: "Geschätztes Max: " + (norm.bw ? "+" : "") + g.est + " kg" + (norm.bw ? " Zusatzgewicht" : "") }]));
      }
      // Datum und Zyklusphase als kleine Pille darunter
      if (ph) svg.append("rect").attr("x", gx + gw / 2 - 26).attr("y", H - 19).attr("width", 52).attr("height", 16).attr("rx", 8).style("fill", BANDC[ph]).style("opacity", 0.35);
      svg.append("text").attr("x", gx + gw / 2).attr("y", H - 7).attr("text-anchor", "middle").attr("class", "c-axis").text(fmtD(g.date));
      if ((C.befinden || []).some((r) => r.status !== "gut" && r.datum_von && g.d >= r.datum_von && (!r.datum_bis || g.d <= r.datum_bis))) {
        anySick = true;
        svg.append("line").attr("x1", gx + 4).attr("x2", gx + gw - 4).attr("y1", 6).attr("y2", 6).style("stroke", SICK).attr("stroke-width", 6).attr("stroke-linecap", "round").attr("stroke-dasharray", "0.1 10");
      }
    });
    const li = [];
    d3.range(1, nMax + 1).forEach((sn) => li.push([SETC[(sn - 1) % SETC.length], "Satz " + sn]));
    if (anySick) li.push([SICK, "Krank"]);
    if (norm) { const pl = norm.bw ? "+" : ""; li.push(["var(--text)", "Geschätztes Max"]); li.push([norm.color, norm.who + ": " + pl + norm.lo + "–" + pl + norm.hi + " kg", 0.5]); }
    legend(el, li);
    const note = (s) => el.appendChild(E("p", "c-hint", s));
    if (cut) note("Die letzten 8 Termine. Wischen zeigt mehr.");
    if (!norm && NOCMP.has(u)) note("Für Frauen allgemein gibt es keine verlässlichen Vergleichswerte, nur für Kraftsportlerinnen.");
    if (norm) note(norm.hint);
  }

  function kUebungen(parent) {
    const rows = C.kraft || [];
    if (!rows.length) return;
    // Feste Reihenfolge (Wunsch 21.11.), alle anderen Übungen danach in der Reihenfolge, in der sie dazukamen
    const ORDER = ["Bankdrücken", "Rumänisches Kreuzheben", "Klimmzug", "Beine anziehen im Liegestütz", "Kniebeugen"];
    const firstSeen = new Map(); [...rows].sort((a, b) => a.datum.localeCompare(b.datum)).forEach((r) => { if (!firstSeen.has(r.uebung)) firstSeen.set(r.uebung, r.datum); });
    const rank = (u) => { const i = ORDER.indexOf(u); return i < 0 ? ORDER.length : i; };
    const ulist = [...firstSeen.keys()].sort((a, b) => rank(a) - rank(b)); // stabil: Rest bleibt nach erstem Auftauchen
    const todo = [];
    ulist.forEach((u) => {
      const rs = rows.filter((r) => r.uebung === u), sec = rs.some((r) => Number(r.dauer_s) > 0 && !Number(r.wdh)), kg = !sec && rs.some((r) => Number(r.gewicht_kg) > 0);
      const body = card(parent, u, sec ? "Säulenhöhe = Haltezeit in Sekunden" : kg ? "Säulenhöhe = Gewicht, darüber Wdh. und kg" : "Säulenhöhe = Wiederholungen");
      todo.push([body, u, rs, sec ? "sec" : kg ? "kg" : "wdh"]);
    });
    todo.forEach((a) => setChart(...a));
  }
  function kVol(el) {
    const m = new Map(); (C.kraft || []).forEach((r) => m.set(r.datum, (m.get(r.datum) || 0) + (Number(r.gewicht_kg) || 0) * (Number(r.wdh) || 0)));
    const byDay = [...m].filter(([, v]) => v > 0);
    if (!byDay.length) return empty(el, "Erscheint mit dem ersten Training mit Gewicht.");
    const t = niceTicks(0, d3.max(byDay, (r) => r[1]) * 1.1);
    chart(el, { kind: "bar", phases: true, barDays: 1.6, left: { domain: t.domain, ticks: t.ticks, fmt: d3.format("~s") },
      series: [{ name: "Volumen", color: SPORTC.Kraft, pts: byDay.map(([d, v]) => ({ d: pd(d), v, label: fnum(Math.round(v)) + " kg" })) }] });
  }

  // ---------- Laufen ----------
  function lPace(el) {
    const rows = (C.laufen || []).filter((r) => Number(r.pace_s_km));
    if (!rows.length) return empty(el, "Noch kein Lauf mit Distanz und Dauer eingetragen.");
    const ps = rows.map((r) => Number(r.pace_s_km)), hs = rows.filter((r) => Number(r.avg_hf)).map((r) => Number(r.avg_hf));
    const pLo = Math.floor((Math.min(...ps) - 30) / 30) * 30, pHi = Math.ceil((Math.max(...ps) + 30) / 30) * 30;
    const hLo = Math.floor((Math.min(...hs, 140) - 5) / 10) * 10, hHi = Math.ceil((Math.max(...hs, 160) + 5) / 10) * 10;
    const thin = (a) => a.filter((v, i) => a.length <= 6 || i % 2 === 0);
    chart(el, { kind: "line", phases: true, left: { domain: [pHi, pLo], ticks: thin(d3.range(pLo, pHi + 1, 30)), fmt: mmss }, right: { domain: [hLo, hHi], ticks: thin(d3.range(hLo, hHi + 1, 10)), fmt: d3.format("d") },
      series: [{ name: "Pace", color: SPORTC.Laufen, pts: rows.map((r) => ({ d: pd(r.datum), v: Number(r.pace_s_km), label: mmss(Number(r.pace_s_km)) + " /km" })) },
               { name: "Ø Puls", color: "#e58aa8", axis: "right", pts: rows.filter((r) => Number(r.avg_hf)).map((r) => ({ d: pd(r.datum), v: Number(r.avg_hf), label: r.avg_hf + " bpm" })) }] });
  }
  function lEff(el) {
    const ef = (C.laufen || []).filter((r) => Number(r.pace_s_km) && Number(r.avg_hf)).map((r) => ({ d: r.datum, v: Math.round((60000 / Number(r.pace_s_km)) / Number(r.avg_hf) * 100) / 100 }));
    if (!ef.length) return empty(el, "Erscheint mit dem ersten Lauf mit Pulsdaten.");
    const vs = ef.map((r) => r.v), lo = Math.floor((Math.min(...vs) - 0.1) * 10) / 10, hi = Math.ceil((Math.max(...vs) + 0.1) * 10) / 10;
    chart(el, { kind: "line", phases: true, left: { domain: [lo, hi], ticks: d3.ticks(lo, hi, 4), fmt: d3.format(".2f") },
      series: [{ name: "m pro Schlag", color: SPORTC.Laufen, pts: ef.map((r) => ({ d: pd(r.d), v: r.v, label: String(r.v).replace(".", ",") + " m pro Schlag" })) }] });
  }

  // ---------- Rad ----------
  function rWoche(el) {
    const m = new Map(); (C.rad || []).forEach((r) => { const k = weekStart(r.datum); const o = m.get(k) || { min: 0, km: 0 }; o.min += (Number(r.dauer_s) || 0) / 60; o.km += Number(r.distanz_km) || 0; m.set(k, o); });
    const w = [...m].sort();
    if (!w.length) return empty(el, "Noch keine Radfahrt eingetragen.");
    const t = niceTicks(0, Math.max(10, d3.max(w, (r) => r[1].min)) * 1.1);
    chart(el, { kind: "bar", phases: true, weekLabels: true, barDays: 4.5, left: { domain: t.domain, ticks: t.ticks, fmt: d3.format("d") },
      series: [{ name: "Minuten", color: SPORTC.Rad, pts: w.map(([wk, o]) => ({ d: new Date(+pd(wk) + 3 * DAY), v: Math.round(o.min), label: Math.round(o.min) + " min" + (o.km ? ", " + fnum(Math.round(o.km * 10) / 10) + " km" : "") })) }] });
  }
  function rPuls(el) {
    const rows = (C.rad || []).filter((x) => Number(x.avg_hf));
    if (!rows.length) return empty(el, "Erscheint mit der ersten Fahrt mit Pulsdaten.");
    const t = niceTicks(Math.max(0, d3.min(rows, (x) => Number(x.avg_hf)) - 10), d3.max(rows, (x) => Number(x.avg_hf)) + 10);
    chart(el, { kind: "line", phases: true, left: { domain: t.domain, ticks: t.ticks, fmt: d3.format("d") },
      series: [{ name: "Ø Puls", color: SPORTC.Rad, pts: rows.map((x) => ({ d: pd(x.datum), v: Number(x.avg_hf), label: x.avg_hf + " bpm" + (x.uhrzeit ? " (" + String(x.uhrzeit).slice(0, 5) + " Uhr)" : "") })) }] });
  }

  // ---------- Zyklus ----------
  const PHASE_INFO = {
    Periode: { titel: "Periode", stark: ["Lockeres Bouldern und Technik", "Mobility und Dehnen", "Ruhige, kurze Läufe"], achte: ["Energie ist oft niedriger", "Intensität nach Gefühl wählen", "Genug trinken und eisenreich essen"], essen: "Eisenreich essen (Linsen, Haferflocken, Fleisch) mit Vitamin C dazu. Magnesium am Abend kann bei Krämpfen helfen.", tipp: "Bewegung ja, Druck nein." },
    Follikelphase: { titel: "Follikelphase", stark: ["Projekte und Maximalversuche (Zeit für 7b)", "Schwere Sätze und neue Bestgewichte", "Intervalle, du erholst dich schneller"], achte: ["Genug essen, damit die Kraft ankommt", "Nicht alles in eine Woche packen"], essen: "Kohlenhydrate rund um harte Einheiten, damit Power da ist.", tipp: "Jetzt die harten Boulder probieren." },
    Eisprung: { titel: "Rund um den Eisprung", stark: ["Kraft und Power oft am höchsten", "Dynamische Züge und Maximalkraft"], achte: ["Bänder können lockerer sein", "Gründlich aufwärmen, Sprünge kontrolliert landen"], essen: "Normal weiter, Protein über den Tag verteilt.", tipp: "Power ja, aber erst sauber aufwärmen." },
    Lutealphase: { titel: "Lutealphase", stark: ["Volumen und Ausdauer", "Technik und Wiederholen von Bekanntem", "Lockere Läufe nach Puls"], achte: ["Ruhepuls und Temperatur sind höher, gleiche Pace fühlt sich härter an", "Mehr Pausen, gegen Ende sinkt die Energie oft"], essen: "Der Körper verbraucht etwas mehr: Protein eher am oberen Ende, mehr trinken. Mehr Hunger ist normal.", tipp: "Pace nach Puls statt nach Uhr, Volumen statt Maximalversuche." },
  };
  function zyklusKarten(parent) {
    const ti = iso(todayUTC());
    const cur = C.phasen.find((p) => p.start <= ti && ti <= p.ende);
    const cyc = C.phasen.filter((p) => p.phase === "Periode" && p.start <= ti).pop();
    const z = zyklusHeute();
    if (z && z.overdue) parent.appendChild(E("p", "glass c-alert", `Deine Periode lässt auf sich warten (Zyklustag ${z.day}). Bis du sie einträgst, läuft hier die Lutealphase weiter.`));
    const head = E("h3", "section-h", "Training und Essen je Phase"); parent.appendChild(head);
    PHASES.forEach((P) => {
      const info = PHASE_INFO[P], on = cur && cur.phase === P;
      const c = E("details", "glass c-phase" + (on ? " on" : ""));
      c.open = on;
      c.style.setProperty("--ph", BANDC[P]);
      const sm = E("summary"); const h = E("h3", "c-title", info.titel); if (on) h.appendChild(E("span", "c-now", "Jetzt")); sm.appendChild(h); sm.appendChild(E("span", "c-tipp-kurz", info.tipp)); c.appendChild(sm);
      const r = cyc ? C.phasen.find((p) => p.phase === P && p.zyklus_start === cyc.start) : null;
      if (r) { const a = Math.round((pd(r.start) - pd(cyc.start)) / DAY) + 1, e = Math.round((pd(r.ende) - pd(cyc.start)) / DAY) + 1; c.appendChild(E("p", "c-note", "Zyklustag " + a + (e > a ? "–" + e : "") + " · " + fmtD(pd(r.start)) + (e > a ? " bis " + fmtD(pd(r.ende)) : ""))); }
      const list = (lbl, items) => { c.appendChild(E("span", "c-lbl", lbl)); const ul = E("ul"); items.forEach((i) => ul.appendChild(E("li", "", i))); c.appendChild(ul); };
      list("Stark in", info.stark); list("Achte auf", info.achte);
      c.appendChild(E("span", "c-lbl", "Essen")); c.appendChild(E("p", "c-text", info.essen));
      c.appendChild(E("p", "c-tipp", "Tipp: " + info.tipp));
      parent.appendChild(c);
    });
    // Zahlen je Phase
    const body = card(parent, "Deine Zahlen je Phase", "Wird mit jedem Eintrag genauer. Aussagekräftig nach etwa zwei Zyklen.");
    const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const rows = PHASES.map((P) => {
      const b = (C.bouldern || []).filter((r) => phaseOn(r.datum) === P);
      const gi = b.map((r) => GRADES.indexOf(String(r.max_grad || "").trim())).filter((i) => i >= 0);
      const kd = new Map(); (C.kraft || []).filter((r) => phaseOn(r.datum) === P && Number(r.gewicht_kg) > 0).forEach((r) => kd.set(r.datum, Math.max(kd.get(r.datum) || 0, Number(r.gewicht_kg))));
      const l = (C.laufen || []).filter((r) => phaseOn(r.datum) === P && Number(r.pace_s_km) && Number(r.avg_hf)).map((r) => (60000 / Number(r.pace_s_km)) / Number(r.avg_hf));
      const ag = avg(gi), ak = avg([...kd.values()]), al = avg(l);
      return [P, b.length, ag === null ? "–" : GRADES[Math.round(ag)], ak === null ? "–" : Math.round(ak) + " kg", al === null ? "–" : al.toFixed(2).replace(".", ",")];
    });
    const tbl = E("table", "c-table");
    const th = E("tr"); ["Phase", "Boulder-Sessions", "Ø schwerster Boulder", "Ø schwerster Kraftsatz", "Lauf m/Schlag"].forEach((h) => th.appendChild(E("th", "", h)));
    tbl.appendChild(th);
    rows.forEach((r) => { const tr = E("tr"); r.forEach((v, i) => { const td = E("td", "", String(v)); if (i === 0) { const dot = E("i"); dot.style.background = BANDC[v]; td.prepend(dot); } tr.appendChild(td); }); tbl.appendChild(tr); });
    const wrap = E("div", "c-scroll"); wrap.appendChild(tbl); body.appendChild(wrap);
  }

  // ---------- Ernährung: Tagesziel ----------
  // Leichtes Defizit (Entscheidung 21.11.2026): Grundumsatz Waage 1.681 kcal, fettfreie Masse 60,7 kg
  const FOOD = { train: { kcal: 2300, p: 130, f: 70, kh: 290 }, rest: { kcal: 2000, p: 130, f: 70, kh: 210 } };
  function tagesziel(parent) {
    const ti = iso(todayUTC());
    const trained = ["bouldern", "kraft", "laufen", "rad"].some((t) => (C[t] || []).some((r) => r.datum === ti));
    const sick = (C.befinden || []).find((r) => r.status === "krank" && r.datum_von <= ti && (!r.datum_bis || ti <= r.datum_bis));
    const cur = C.phasen.find((p) => p.start <= ti && ti <= p.ende);
    const base = { ...(trained ? FOOD.train : FOOD.rest) };
    let why = trained ? "Trainingstag" : "Ruhetag, wird zum Trainingstag, sobald du Training einträgst";
    if (sick) { Object.assign(base, { kcal: 2400, kh: 310 }); why = "Krank: auf Erhaltung essen, kein Defizit, viel trinken"; }
    else if (cur && cur.phase === "Periode") { base.kcal = trained ? 2500 : 2200; base.kh += 50; why += " · Periode: auf Erhaltung"; }
    else if (cur && cur.phase === "Lutealphase") { base.kcal += 150; base.kh += 25; why += " · Lutealphase: +150 kcal"; }
    const eat = (C.ernaehrung || []).filter((r) => r.datum === ti);
    const sum = (k) => Math.round(d3.sum(eat, (r) => Number(r[k]) || 0) * 10) / 10;
    const kc = Math.round(sum("kcal")), pr = Math.round(sum("protein_g"));
    // Richtwerte: gesättigte Fette höchstens 10 % der Energie, Zucker höchstens etwa 50 g, Ballaststoffe mind. 30 g (DGE/WHO)
    const satMax = Math.round((base.kcal * 0.1) / 9), sugMax = 50, fibMin = 30;
    const body = card(parent, "Heutiges Ziel", why);
    body.appendChild(E("div", "c-big", fnum(base.kcal) + " kcal"));
    const bar = (lbl, have, goal, unit, kind) => {
      const r = E("div", "c-bar" + (kind === "max" && have > goal ? " over" : "")), t = E("div", "t");
      t.append(E("b", "", lbl), E("span", "", fnum(have) + (kind === "max" ? " von max. " : kind === "min" ? " von mind. " : " von ") + fnum(goal) + " " + unit));
      const tr = E("div", "c-track"), f = E("i"); f.style.width = Math.min(100, (have / goal) * 100) + "%"; tr.appendChild(f); r.append(t, tr); return r;
    };
    const fett = sum("fett_g"), ges = sum("fett_ges_g");
    body.append(
      bar("Energie", kc, base.kcal, "kcal"),
      bar("Eiweiß", pr, base.p, "g"),
      bar("Kohlenhydrate", sum("kh_g"), base.kh, "g"),
      bar("· davon Zucker", sum("zucker_g"), sugMax, "g", "max"),
      bar("Fett", fett, base.f, "g"),
      bar("· gesättigt", ges, satMax, "g", "max"),
      bar("· ungesättigt", Math.max(0, Math.round((fett - ges) * 10) / 10), base.f - satMax, "g"),
      bar("Ballaststoffe", sum("ballast_g"), fibMin, "g", "min"),
    );
    const ok = Math.max(0, base.kcal - kc), op = Math.max(0, base.p - pr);
    const ohne = eat.length && eat.some((r) => r.kcal != null && r.kh_g == null) ? " Bei manchen Einträgen fehlen Kohlenhydrate und Fett, die zählen dort noch nicht mit." : "";
    body.appendChild(E("p", "c-hint", eat.length ? (ok || op ? "Noch offen: " + fnum(ok) + " kcal und " + op + " g Eiweiß. Werte sind geschätzt." : "Ziel für heute erreicht.") + ohne : "Noch nichts eingetragen."));
    body.appendChild(E("p", "c-hint", "Für dich berechnet: 26 Jahre, 175 cm, 74 kg, etwa 18 % Körperfett (Waage), viel Training. Leichtes Defizit, damit Kraft und Zyklus nicht leiden. Gesättigte Fette höchstens 10 % der Energie, Ballaststoffe mindestens 30 g."));
  }

  // ---------- Verteilen auf die Tabs ----------
  function render(cache, view, sport) {
    if (!window.d3) return;
    C = { ...cache, phasen: phasen(cache.zyklus) };
    const box = document.querySelector(`[data-charts="${view}"]`);
    if (!box || box.closest("[hidden]")) return;
    box.replaceChildren();
    const P = window.TBPlan;
    if (view === "heute" && P) P.woche(box, cache);
    if (view === "heute") wochenUebersicht(card(box, "Trainingstage pro Woche", "Eine Spalte pro Tag, ein Block pro Sportart. Tippen zeigt Details."));
    if (view === "training") {
      if (sport === "bouldern") { bGrad(card(box, "Schwerster Boulder pro Session")); bWoche(card(box, "Sessions pro Woche")); }
      if (sport === "kraft" && P) P.kraft(box, cache);
      if (sport === "laufen" && P) P.laufen(box, cache);
      if (sport === "kraft") { kUebungen(box); kVol(card(box, "Volumen pro Training", "Summe aus Wiederholungen mal Gewicht über alle Sätze, in kg.")); }
      if (sport === "laufen") { lPace(card(box, "Pace und Puls")); lEff(card(box, "Meter pro Herzschlag", "Steigt der Wert, läufst du schneller bei gleichem Puls.")); }
      if (sport === "rad") { rWoche(card(box, "Radminuten pro Woche")); rPuls(card(box, "Puls pro Fahrt")); }
    }
    if (view === "zyklus") zyklusKarten(box);
    if (view === "ernaehrung") tagesziel(box);
  }

  window.TBCharts = { render, phasen, zyklusHeute: (cache) => { C = { ...cache, phasen: phasen(cache.zyklus) }; return zyklusHeute(); } };
})();
