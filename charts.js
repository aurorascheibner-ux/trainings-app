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
  // Symbole für die Nährwerte (Essen, nach Zweck sortiert)
  const NICO = {
    kcal: '<path d="M12 3c1 3 4 5 4 9a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 0-8z"/>',
    eiweiss: '<path d="M12 3c3.5 0 6 4.5 6 9a6 6 0 0 1-12 0c0-4.5 2.5-9 6-9z"/>',
    kh: '<path d="M12 21V8M12 8c-2-1-3-3-3-5 2 0 3 1 3 3M12 8c2-1 3-3 3-5-2 0-3 1-3 3M12 13c-2-1-3-3-3-5M12 13c2-1 3-3 3-5M12 18c-2-1-3-3-3-5M12 18c2-1 3-3 3-5"/>',
    zucker: '<path d="M5 9l7-4 7 4v7l-7 4-7-4z"/><path d="M5 9l7 4 7-4M12 13v7"/>',
    fett: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
    ges: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M9 14h6"/>',
    ballast: '<path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z"/><path d="M5 19l8-8"/>',
  };
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
    const m = new Map();
    (C.bouldern || []).forEach((r) => { const k = weekStart(r.datum); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    let w = [...m].sort((a, b) => a[0].localeCompare(b[0]));
    if (!w.length) return empty(el, "Erscheint mit der ersten Session.");
    const W = Math.max(280, Math.round(el.clientWidth) || 360), H = 220, mg = { t: 26, r: 8, b: 26, l: 22 };
    const maxW = Math.max(4, Math.floor((W - mg.l - mg.r) / 34)); if (w.length > maxW) w = w.slice(-maxW);
    const top = Math.max(6, d3.max(w, (x) => x[1].length));
    const x = d3.scaleBand(w.map((x) => x[0]), [mg.l, W - mg.r]).padding(0.28), y = d3.scaleLinear([0, top], [H - mg.b, mg.t]);
    const svg = d3.select(el).append("svg").attr("width", "100%").attr("viewBox", `0 0 ${W} ${H}`);
    d3.range(0, top + 1, 2).forEach((v) => { svg.append("line").attr("x1", mg.l).attr("x2", W - mg.r).attr("y1", y(v)).attr("y2", y(v)).attr("class", "c-grid"); svg.append("text").attr("x", mg.l - 6).attr("y", y(v)).attr("dy", "0.32em").attr("text-anchor", "end").attr("class", "c-axis").text(v); });
    svg.append("line").attr("x1", mg.l).attr("x2", W - mg.r).attr("y1", y(4)).attr("y2", y(4)).attr("class", "c-ref");
    svg.append("text").attr("x", W - mg.r - 2).attr("y", y(4) - 4).attr("text-anchor", "end").attr("class", "c-axis").text("Ziel 4");
    const T = tipOf(el), gi = (r) => GRADES.indexOf(String(r.max_grad || "").trim());
    w.forEach(([wk, rs]) => {
      rs = rs.slice().sort((a, b) => a.datum.localeCompare(b.datum));
      const bx = x(wk), bw = x.bandwidth(), u = y(0) - y(1);
      rs.forEach((r, i) => {
        const ph = phaseOn(r.datum);
        onTip(svg.append("rect").attr("x", bx).attr("width", bw).attr("y", y(i + 1) + 1.5).attr("height", Math.max(2, u - 3)).attr("rx", 3).style("fill", SPORTC.Bouldern), T,
          (ev) => T.show(ev, fmtD(pd(r.datum)) + (ph ? " · " + ph : ""), [{ color: SPORTC.Bouldern, text: "Session" + (r.max_grad ? " bis " + r.max_grad : "") }]));
      });
      const best = rs.reduce((m, r) => (gi(r) > gi(m) ? r : m), rs[0]);
      if (gi(best) >= 0) svg.append("text").attr("x", bx + bw / 2).attr("y", y(rs.length) - 6).attr("text-anchor", "middle").attr("class", "c-val").text(String(best.max_grad).trim());
      svg.append("text").attr("x", bx + bw / 2).attr("y", H - 8).attr("text-anchor", "middle").attr("class", "c-axis").text(dm(+pd(wk)));
    });
    el.appendChild(E("p", "c-hint", "Ein Stück pro Session, oben der schwerste Boulder der Woche. Woche ab Montag."));
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
    // Zyklusphase als farbige Fläche hinter jedem Termin, wie bei den anderen Grafiken
    const usedPh = new Set();
    groups.forEach((g) => {
      const ph = phaseOn(g.d); if (!ph) return;
      usedPh.add(ph);
      const pad = (x.step() - x.bandwidth()) / 2;
      svg.append("rect").attr("x", x(g.d) - pad).attr("width", x.step()).attr("y", y(t.ticks[t.ticks.length - 1])).attr("height", y(0) - y(t.ticks[t.ticks.length - 1])).style("fill", BANDC[ph]).style("opacity", 0.22);
    });
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
        svg.append("text").attr("x", cx).attr("y", cy - 8).attr("text-anchor", "middle").attr("class", "c-val c-est-val").text((norm.bw ? "+" : "") + g.est);
      }
      // Datum und Zyklusphase als kleine Pille darunter
      if (ph) svg.append("rect").attr("x", gx + gw / 2 - 26).attr("y", H - 19).attr("width", 52).attr("height", 16).attr("rx", 8).style("fill", BANDC[ph]).style("opacity", 0.6);
      svg.append("text").attr("x", gx + gw / 2).attr("y", H - 7).attr("text-anchor", "middle").attr("class", "c-axis").text(fmtD(g.date));
      if ((C.befinden || []).some((r) => r.status !== "gut" && r.datum_von && g.d >= r.datum_von && (!r.datum_bis || g.d <= r.datum_bis))) {
        anySick = true;
        svg.append("line").attr("x1", gx + 4).attr("x2", gx + gw - 4).attr("y1", 6).attr("y2", 6).style("stroke", SICK).attr("stroke-width", 6).attr("stroke-linecap", "round").attr("stroke-dasharray", "0.1 10");
      }
    });
    const li = [];
    d3.range(1, nMax + 1).forEach((sn) => li.push([SETC[(sn - 1) % SETC.length], "Satz " + sn]));
    if (anySick) li.push([SICK, "Krank"]);
    PHASES.filter((p) => usedPh.has(p)).forEach((p) => li.push([BANDC[p], p, 0.6]));
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
    const termine = (u) => new Set(rows.filter((r) => r.uebung === u).map((r) => r.datum)).size;
    const selten = ulist.filter((u) => termine(u) < 3);
    let fold = null;
    if (selten.length) { fold = E("details", "glass c-card k-selten"); const sm = E("summary"); sm.append(E("span", "c-title", "Seltene Übungen"), E("span", "k-cnt", selten.length + " ⌄")); fold.appendChild(sm); fold.appendChild(E("p", "c-note", "Weniger als 3 Termine: " + selten.join(", "))); }
    ulist.forEach((u) => {
      const rs = rows.filter((r) => r.uebung === u), sec = rs.some((r) => Number(r.dauer_s) > 0 && !Number(r.wdh)), kg = !sec && rs.some((r) => Number(r.gewicht_kg) > 0);
      if (fold && selten.includes(u)) { const h = E("div", "k-selten-item"); h.appendChild(E("h4", "c-title", u)); const b = E("div", "c-body"); h.appendChild(b); fold.appendChild(h); todo.push([b, u, rs, sec ? "sec" : kg ? "kg" : "wdh"]); return; }
      const body = card(parent, u, sec ? "Säulenhöhe = Haltezeit in Sekunden" : kg ? "Säulenhöhe = Gewicht, darüber Wdh. und kg" : "Säulenhöhe = Wiederholungen");
      todo.push([body, u, rs, sec ? "sec" : kg ? "kg" : "wdh"]);
    });
    if (fold) {
      parent.appendChild(fold);
      // Grafiken erst beim Aufklappen zeichnen (vorher ist die Breite 0)
      const late = todo.filter((a) => selten.includes(a[1])), now = todo.filter((a) => !selten.includes(a[1]));
      now.forEach((a) => setChart(...a));
      fold.addEventListener("toggle", () => { if (fold.open && !fold._drawn) { fold._drawn = true; late.forEach((a) => setChart(...a)); } }, { once: false });
      return;
    }
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
  // ---------- Zyklus: deine Form in dieser Phase (eigene Zahlen) ----------
  function formKarte(parent) {
    const z = zyklusHeute(); if (!z) return;
    const P = z.phase, avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    const body = card(parent, "Deine Form in dieser Phase", "Aus deinen eigenen Einträgen, verglichen mit den anderen Phasen.");
    const head = E("div", "zf-head");
    head.append(E("span", "zf-dot"), E("b", "", PHASE_INFO[P].titel), E("span", "zf-tag", "Tag " + z.day));
    head.firstChild.style.background = BANDC[P];
    body.appendChild(head);
    const grid = E("div", "zf-grid");
    const tile = (lbl, big, sub, good) => { const t = E("div", "zf-tile"); t.append(E("span", "zf-l", lbl), E("span", "zf-n", big), E("span", "zf-s" + (good === true ? " gut" : good === false ? " schwach" : ""), sub)); grid.appendChild(t); };
    // Bouldern: Ø schwerster Grad in dieser Phase vs. den anderen
    const gi = (r) => GRADES.indexOf(String(r.max_grad || "").trim());
    const bIn = (C.bouldern || []).filter((r) => phaseOn(r.datum) === P && gi(r) >= 0).map(gi);
    const bOut = (C.bouldern || []).filter((r) => phaseOn(r.datum) && phaseOn(r.datum) !== P && gi(r) >= 0).map(gi);
    if (bIn.length) { const d = bOut.length ? avg(bIn) - avg(bOut) : 0, st = Math.round(d * 2) / 2;
      tile("Ø schwerster Boulder", GRADES[Math.round(avg(bIn))], !bOut.length ? bIn.length + " Sessions" : Math.abs(st) < 0.5 ? "wie in den anderen Phasen" : (st > 0 ? "▲ " : "▼ ") + fnum(Math.abs(st)) + (Math.abs(st) === 1 ? " Stufe" : " Stufen") + (st > 0 ? " höher" : " tiefer"), Math.abs(st) < 0.5 ? null : st > 0);
    } else tile("Ø schwerster Boulder", "–", "noch keine Session in dieser Phase");
    // Kraft: schwerster Satz je Training im Verhältnis zum Schnitt dieser Übung
    const best = new Map(); (C.kraft || []).filter((r) => Number(r.gewicht_kg) > 0).forEach((r) => { const k = r.datum + "|" + r.uebung; best.set(k, Math.max(best.get(k) || 0, Number(r.gewicht_kg))); });
    const perU = new Map(); best.forEach((v, k) => { const u = k.split("|")[1]; if (!perU.has(u)) perU.set(u, []); perU.get(u).push(v); });
    const rel = [...best].filter(([k]) => phaseOn(k.split("|")[0]) === P).map(([k, v]) => v / avg(perU.get(k.split("|")[1])));
    if (rel.length) { const pc = Math.round((avg(rel) - 1) * 100); tile("Kraft, schwerster Satz", (pc > 0 ? "+" : pc < 0 ? "−" : "±") + Math.abs(pc) + " %", Math.abs(pc) < 2 ? "wie dein Schnitt" : pc > 0 ? "mehr als dein Schnitt" : "weniger als dein Schnitt", Math.abs(pc) < 2 ? null : pc > 0); }
    else tile("Kraft, schwerster Satz", "–", "noch kein Krafttraining in dieser Phase");
    // Energie aus allen Einträgen mit Energie
    const en = ["bouldern", "laufen", "befinden"].flatMap((t) => (C[t] || []).filter((r) => r.energie_1_5 != null && phaseOn(r.datum || r.datum_von) === P).map((r) => Number(r.energie_1_5)));
    tile("Energie", en.length ? fnum(Math.round(avg(en) * 10) / 10) + " / 5" : "–", en.length ? "aus " + en.length + (en.length === 1 ? " Eintrag" : " Einträgen") : "trag Energie beim Training ein");
    // Beschwerden aus dem Tages-Check
    const sym = new Map(); let tage = 0;
    (C.zyklus_tag || []).filter((r) => phaseOn(r.datum) === P).forEach((r) => { tage++; (r.symptome || []).forEach((s) => sym.set(s, (sym.get(s) || 0) + 1)); });
    const top = [...sym].sort((a, b) => b[1] - a[1]).slice(0, 2);
    tile("Beschwerden", top.length ? top.map(([s, n]) => s + " " + n + "×").join(", ") : tage ? "kaum" : "–", tage ? "aus " + tage + " Tages-Checks" : "noch kein Tages-Check");
    body.appendChild(grid);
    const tipp = E("p", "zf-tipp"); tipp.append(E("b", "", "Heute passt: "), document.createTextNode(PHASE_INFO[P].stark[0] + ". " + PHASE_INFO[P].tipp));
    body.appendChild(tipp);
    if ((C.bouldern || []).length + (C.kraft || []).length < 15) body.appendChild(E("p", "c-hint", "Wird mit jedem Zyklus genauer, richtig aussagekräftig nach etwa zwei bis drei Zyklen."));
  }

  // ---------- Zyklus: Hormon-Kurve (vereinfacht) ----------
  const HORMON = {
    Periode: ["Hormone sind niedrig", "Östrogen und Progesteron sind am Tiefpunkt. Deshalb ist die Energie oft geringer, das ist normal."],
    Follikelphase: ["Östrogen steigt", "Das macht dich kräftiger und belastbarer, du erholst dich schneller."],
    Eisprung: ["Östrogen auf dem Höhepunkt", "Kraft und Power sind oft am höchsten. Östrogen macht aber auch Bänder etwas lockerer."],
    Lutealphase: ["Progesteron ist hoch", "Es hebt Ruhepuls und Körpertemperatur leicht an und kostet etwas mehr Energie. Gleiche Pace fühlt sich härter an."],
  };
  function hormonKarte(parent) {
    const z = zyklusHeute(); if (!z) return;
    let [titel, text] = HORMON[z.phase];
    if (z.overdue) { titel = "Periode lässt auf sich warten"; text = "Ohne neue Periode weiß die App nicht, wann dein Eisprung war. Oft kam er einfach später. Die Kurve zeigt deshalb nur den typischen Verlauf."; }
    else if (z.phase === "Lutealphase" && z.len - z.day <= 3) { titel = "Hormone fallen ab"; text = "Progesteron und Östrogen sinken, die Periode kommt bald. Energie und Laune können jetzt tiefer sein."; }
    const body = card(parent, titel, text);
    const L = z.overdue ? 28 : Math.max(21, z.len), ov = L - 14, day = Math.min(z.day, L);
    const est = (d) => 0.22 + 0.68 * Math.exp(-(((d - ov + 1) / 2.6) ** 2)) + 0.3 * Math.exp(-(((d - ov - 7) / 3.5) ** 2));
    const prog = (d) => 0.05 + 0.85 * Math.exp(-(((d - ov - 7) / 3.6) ** 2));
    const W = 340, H = 130, b = 18, X = (d) => ((d - 1) / (L - 1)) * W, Y = (v) => H - b - v * (H - b - 14);
    const path = (f) => d3.range(0, 101).map((i) => { const d = 1 + (i / 100) * (L - 1); return (i ? "L" : "M") + X(d).toFixed(1) + "," + Y(f(d)).toFixed(1); }).join("");
    const cyc = C.phasen.filter((p) => p.phase === "Periode" && p.start <= iso(todayUTC())).pop();
    let bands = "";
    const band = (a, e, ph) => { bands += `<rect x="${X(Math.max(1, a - 0.5)).toFixed(1)}" y="0" width="${Math.max(0, X(Math.min(L, e + 0.5)) - X(Math.max(1, a - 0.5))).toFixed(1)}" height="${H - b}" style="fill:${BANDC[ph]}" opacity=".16"/>`; };
    if (z.overdue) { band(1, 5, "Periode"); band(6, ov - 2, "Follikelphase"); band(ov - 1, ov + 1, "Eisprung"); band(ov + 2, L, "Lutealphase"); }
    else if (cyc) C.phasen.filter((p) => p.zyklus_start === cyc.start).forEach((p) => {
      const a = Math.round((pd(p.start) - pd(cyc.start)) / DAY) + 1, e = Math.round((pd(p.ende) - pd(cyc.start)) / DAY) + 1;
      bands += `<rect x="${X(Math.max(1, a - 0.5)).toFixed(1)}" y="0" width="${Math.max(0, X(Math.min(L, e + 0.5)) - X(Math.max(1, a - 0.5))).toFixed(1)}" height="${H - b}" style="fill:${BANDC[p.phase]}" opacity=".16"/>`;
    });
    const tx = X(day);
    const svg = `<svg class="zh-svg" viewBox="0 0 ${W} ${H}" width="100%">${bands}
      <path d="${path(est)}" fill="none" style="stroke:var(--c1)" stroke-width="2.6"/><path d="${path(prog)}" fill="none" style="stroke:var(--c4)" stroke-width="2.6"/>
      ${z.overdue ? "" : `<line x1="${tx}" x2="${tx}" y1="0" y2="${H - b}" style="stroke:var(--text)" stroke-dasharray="3 3"/>
      <circle cx="${tx}" cy="${Y(z.phase === "Lutealphase" ? prog(day) : est(day)).toFixed(1)}" r="5" style="fill:${z.phase === "Lutealphase" ? "var(--c4)" : "var(--c1)"};stroke:var(--card)" stroke-width="2"/>
      <text x="${tx + (tx > W - 50 ? -6 : 6)}" y="11" class="c-axis" text-anchor="${tx > W - 50 ? "end" : "start"}" style="font-weight:700">heute</text>`}
      <text x="2" y="${H - 3}" class="c-axis">Tag 1</text><text x="${X(ov)}" y="${H - 3}" class="c-axis" text-anchor="middle">Eisprung</text><text x="${W - 2}" y="${H - 3}" class="c-axis" text-anchor="end">Tag ${L}</text></svg>`;
    const wrap = E("div"); wrap.innerHTML = svg; body.appendChild(wrap);
    legend(body, [["var(--c1)", "Östrogen"], ["var(--c4)", "Progesteron"]]);
    const row = E("div", "zf-grid");
    const mini = (l, t) => { const m = E("div", "zf-tile"); m.append(E("span", "zf-l", l), E("span", "zf-t", t)); row.appendChild(m); };
    mini("Jetzt gut für", PHASE_INFO[z.phase].stark[0]); mini("Achte auf", PHASE_INFO[z.phase].achte[0]);
    body.appendChild(row);
    body.appendChild(E("p", "c-hint", z.overdue ? "Typischer 28-Tage-Zyklus, vereinfacht und nicht gemessen. Bleibt die Periode länger als 3 Monate aus, lohnt sich ein Termin bei der Frauenärztin." : "Typischer Verlauf, vereinfacht und nicht gemessen. Dein Zyklus kann davon abweichen."));
  }

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
      return [P, b.length, ag === null ? "–" : GRADES[Math.round(ag)], ak === null ? "–" : Math.round(ak) + " kg", al === null ? "–" : al.toFixed(2).replace(".", ","), [b.length / Math.max(1, C.phasen.filter((p) => p.phase === P && !p.prognose).length), ag, ak, al]];
    });
    // bester Wert je Spalte (Sessions: pro Phase-Durchgang, damit kurze Phasen fair sind)
    const best = [0, 1, 2, 3].map((j) => { const vs = rows.map((r) => r[5][j]).filter((v) => v != null && v > 0); return vs.length > 1 ? Math.max(...vs) : null; });
    const tbl = E("table", "c-table");
    const th = E("tr"); ["Phase", "Boulder-Sessions", "Ø schwerster Boulder", "Ø schwerster Kraftsatz", "Lauf m/Schlag"].forEach((h) => th.appendChild(E("th", "", h)));
    tbl.appendChild(th);
    rows.forEach((r) => { const tr = E("tr"); r.slice(0, 5).forEach((v, i) => { const td = E("td", "", String(v)); if (i === 0) { const dot = E("i"); dot.style.background = BANDC[v]; td.prepend(dot); } else if (best[i - 1] != null && r[5][i - 1] === best[i - 1]) td.className = "c-best"; tr.appendChild(td); }); tbl.appendChild(tr); });
    const wrap = E("div", "c-scroll"); wrap.appendChild(tbl); body.appendChild(wrap);
  }

  // ---------- Ernährung: Tagesziel ----------
  // Leichtes Defizit (Entscheidung 21.11.2026): Grundumsatz Waage 1.681 kcal, fettfreie Masse 60,7 kg
  const FOOD = { train: { kcal: 2300, p: 130, f: 70, kh: 290 }, rest: { kcal: 2000, p: 130, f: 70, kh: 210 } };
  // Ziel für einen beliebigen Tag: Trainingstag, Krankheit und Zyklusphase an genau diesem Tag
  function zielFuer(ti) {
    const trained = ["bouldern", "kraft", "laufen", "rad"].some((t) => (C[t] || []).some((r) => r.datum === ti));
    const sick = (C.befinden || []).find((r) => r.status === "krank" && r.datum_von <= ti && (!r.datum_bis || ti <= r.datum_bis));
    const cur = C.phasen.find((p) => p.start <= ti && ti <= p.ende);
    const base = { ...(trained ? FOOD.train : FOOD.rest), b: 30 };
    // Gerechnet wurde mit 74 kg; pro kg mehr oder weniger etwa 15 kcal (gedeckelt auf ±150)
    const w = letzteWaage();
    if (w) base.kcal += Math.max(-150, Math.min(150, Math.round((15 * (Number(w.gewicht_kg) - 74)) / 10) * 10));
    let why = trained ? "Trainingstag" : ti === iso(todayUTC()) ? "Ruhetag, wird zum Trainingstag, sobald du Training einträgst" : "Ruhetag";
    if (sick) { Object.assign(base, { kcal: 2400, kh: 310 }); why = "Krank: auf Erhaltung essen, kein Defizit, viel trinken"; }
    else if (cur && cur.phase === "Periode") { base.kcal = trained ? 2500 : 2200; base.kh += 50; why += " · Periode: auf Erhaltung"; }
    else if (cur && cur.phase === "Lutealphase") { base.kcal += 150; base.kh += 25; why += " · Lutealphase: +150 kcal"; }
    return { base, why };
  }
  const tagSumme = (ti) => {
    const eat = (C.ernaehrung || []).filter((r) => r.datum === ti);
    const sum = (k) => Math.round(d3.sum(eat, (r) => Number(r[k]) || 0) * 10) / 10;
    return { eat, sum };
  };
  // Welcher Tag ist oben gewählt (null = heute)? Bleibt beim Neuzeichnen erhalten.
  let foodDay = null, foodMetric = "kcal", lastArgs = null;
  const rerender = () => { if (lastArgs) render(...lastArgs); };
  const tagName = (ti) => {
    const t = iso(todayUTC()), y = iso(+todayUTC() - DAY);
    if (ti === t) return "Heute";
    if (ti === y) return "Gestern";
    return pd(ti).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  };

  function tagesziel(parent) {
    const today = iso(todayUTC());
    const ti = foodDay && foodDay < today ? foodDay : today;
    const isToday = ti === today;
    const { base, why } = zielFuer(ti);
    const { eat, sum } = tagSumme(ti);
    const kc = Math.round(sum("kcal")), pr = Math.round(sum("protein_g"));
    // Richtwerte: gesättigte Fette höchstens 10 % der Energie, Zucker höchstens etwa 50 g, Ballaststoffe mind. 30 g (DGE/WHO)
    const satMax = Math.round((base.kcal * 0.1) / 9), sugMax = 50, fibMin = 30;
    const body = card(parent, isToday ? "Heutiges Ziel" : tagName(ti) === "Gestern" ? "Ziel gestern" : "Ziel am " + tagName(ti), why);
    // Tage blättern
    const nav = E("div", "f-nav");
    const prev = E("button", "icon-btn f-prev", "‹"), next = E("button", "icon-btn f-next", "›"), lbl = E("span", "f-day", tagName(ti));
    prev.type = next.type = "button"; prev.setAttribute("aria-label", "Tag davor"); next.setAttribute("aria-label", "Tag danach");
    next.disabled = isToday;
    prev.addEventListener("click", () => { foodDay = iso(+pd(ti) - DAY); rerender(); });
    next.addEventListener("click", () => { const n = iso(+pd(ti) + DAY); foodDay = n >= today ? null : n; rerender(); });
    nav.append(prev, lbl, next);
    if (!isToday) { const back = E("button", "btn ghost small-btn f-today", "Zu heute"); back.type = "button"; back.addEventListener("click", () => { foodDay = null; rerender(); }); nav.appendChild(back); }
    body.appendChild(nav);
    const rest = base.kcal - kc;
    body.appendChild(E("div", "c-big" + (rest < 0 ? " over" : ""), rest >= 0 ? fnum(rest) + (isToday ? " kcal übrig" : " kcal unter Ziel") : fnum(-rest) + " kcal drüber"));
    body.appendChild(E("p", "c-sub", "Ziel " + (isToday ? "heute " : "") + fnum(base.kcal) + " kcal · gegessen " + fnum(kc) + " kcal"));
    // Nach Zweck sortiert, mit Symbolen (Auroras Wahl 24.11.: Aufbauen / Energie / Begrenzen)
    const row = (ico, col, lbl, have, goal, unit, kind, sub) => {
      const over = kind === "max" && have > goal;
      const r = E("div", "n-row" + (over ? " over" : "") + (sub ? " sub" : "")); r.style.setProperty("--nc", col);
      if (!sub) r.innerHTML = `<span class="n-ico"><svg viewBox="0 0 24 24" aria-hidden="true">${NICO[ico]}</svg></span>`;
      const t = E("div", "n-t"), top = E("div", "n-top");
      const rest = goal - have;
      const txt = kind === "max" ? fnum(have) + " von max. " + fnum(goal) + " " + unit : fnum(have) + " / " + fnum(goal) + " " + unit + (isToday && rest > 0 && kind === "min" ? " · noch " + fnum(Math.round(rest)) : "");
      top.append(E("b", "", lbl), E("span", "", txt));
      const tr = E("div", "n-track"), f = E("i"); f.style.width = Math.min(100, goal ? (have / goal) * 100 : 0) + "%"; tr.appendChild(f);
      t.append(top, tr); r.appendChild(t); return r;
    };
    const grp = (name) => E("div", "n-grp", name);
    const fett = sum("fett_g"), ges = sum("fett_ges_g");
    body.append(
      grp("Aufbauen"),
      row("eiweiss", "var(--c2)", "Eiweiß", pr, base.p, "g", "min"),
      row("ballast", "var(--c4)", "Ballaststoffe", sum("ballast_g"), fibMin, "g", "min"),
      grp("Energie"),
      row("kcal", "var(--c1)", "Energie", kc, base.kcal, "kcal"),
      row("kh", "color-mix(in srgb, var(--c1) 45%, #d9a23a)", "Kohlenhydrate", sum("kh_g"), base.kh, "g"),
      row("fett", "var(--c3)", "Fett", fett, base.f, "g"),
      row("", "var(--c3)", "davon ungesättigt", Math.max(0, Math.round((fett - ges) * 10) / 10), base.f - satMax, "g", "", true),
      grp("Begrenzen"),
      row("zucker", "var(--muted)", "Zucker", sum("zucker_g"), sugMax, "g", "max"),
      row("ges", "var(--muted)", "Gesättigte Fette", ges, satMax, "g", "max"),
    );
    const ok = Math.max(0, base.kcal - kc), op = Math.max(0, base.p - pr);
    const ohne = eat.length && eat.some((r) => r.kcal != null && r.kh_g == null) ? " Bei manchen Einträgen fehlen Kohlenhydrate und Fett, die zählen dort noch nicht mit." : "";
    if (isToday) body.appendChild(E("p", "c-hint", eat.length ? (ok || op ? "Noch offen: " + fnum(ok) + " kcal und " + op + " g Eiweiß. Werte sind geschätzt." : "Ziel für heute erreicht.") + ohne : "Noch nichts eingetragen."));
    else {
      body.appendChild(E("p", "c-hint", (eat.length ? eat.length + (eat.length === 1 ? " Eintrag" : " Einträge") + " an diesem Tag. Antippen in der Liste unten zum Ändern." : "An diesem Tag ist nichts eingetragen.") + ohne));
      const add = E("button", "btn small-btn", "+ Essen für " + (tagName(ti) === "Gestern" ? "gestern" : tagName(ti)) + " nachtragen"); add.type = "button";
      add.addEventListener("click", () => window.dispatchEvent(new CustomEvent("tb-add", { detail: { table: "ernaehrung", datum: ti } })));
      body.appendChild(add);
    }
    const ret = isToday ? { kcal: base.kcal - kc, p: base.p - pr, b: fibMin - sum("ballast_g"), heute: eat } : null;
    const wg = letzteWaage();
    const kTxt = wg ? kfmt(wg.gewicht_kg, 1) + " kg" + (wg.koerperfett_pct != null ? ", " + kfmt(wg.koerperfett_pct, 1) + " % Körperfett" : "") + " (Waage vom " + dm(+pd(wg.datum)) + ")" : "74 kg, etwa 18 % Körperfett (Waage)";
    if (isToday) body.appendChild(E("p", "c-hint", "Für dich berechnet: 26 Jahre, 175 cm, " + kTxt + ", viel Training. Leichtes Defizit, damit Kraft und Zyklus nicht leiden. Gesättigte Fette höchstens 10 % der Energie, Ballaststoffe mindestens 30 g."));
    return ret;
  }

  // ---------- Essen: die letzten 14 Tage ----------
  const METRIKEN = [
    { k: "kcal", lbl: "kcal", unit: "kcal", col: "kcal", ziel: (b) => b.kcal },
    { k: "p", lbl: "Eiweiß", unit: "g", col: "protein_g", ziel: (b) => b.p },
    { k: "b", lbl: "Ballaststoffe", unit: "g", col: "ballast_g", ziel: (b) => b.b, min: true },
    { k: "kh", lbl: "KH", unit: "g", col: "kh_g", ziel: (b) => b.kh },
    { k: "f", lbl: "Fett", unit: "g", col: "fett_g", ziel: (b) => b.f },
  ];
  function essenVerlauf(parent) {
    const body = card(parent, "Letzte 14 Tage", "Säule = gegessen, Strich = dein Ziel an dem Tag. Antippen zeigt den Tag oben.");
    const chips = E("div", "chips f-chips");
    METRIKEN.forEach((m) => { const c = E("button", "chip" + (m.k === foodMetric ? " active" : ""), m.lbl); c.type = "button"; c.addEventListener("click", () => { foodMetric = m.k; rerender(); }); chips.appendChild(c); });
    body.appendChild(chips);
    const M = METRIKEN.find((m) => m.k === foodMetric);
    const t0 = +todayUTC(), sel = foodDay || iso(t0);
    const days = d3.range(13, -1, -1).map((i) => {
      const ti = iso(t0 - i * DAY), { eat, sum } = tagSumme(ti);
      return { ti, has: eat.length > 0, v: Math.round(sum(M.col) * 10) / 10, z: M.ziel(zielFuer(ti).base) };
    });
    const withData = days.filter((d) => d.has);
    if (!withData.length) { body.appendChild(E("p", "c-text", "In den letzten 14 Tagen ist noch nichts eingetragen.")); return; }
    const W = 360, H = 190, mL = 34, mR = 6, mT = 16, mB = 34;
    const x = d3.scaleBand(days.map((d) => d.ti), [mL, W - mR]).padding(0.25);
    const top = d3.max(days, (d) => Math.max(d.v, d.z)) * 1.12;
    const tk = niceTicks(0, top);
    const y = d3.scaleLinear(tk.domain, [H - mB, mT]);
    const svg = d3.select(body).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "c-svg f-svg");
    tk.ticks.forEach((v) => { svg.append("line").attr("x1", mL).attr("x2", W - mR).attr("y1", y(v)).attr("y2", y(v)).attr("class", "c-grid"); svg.append("text").attr("x", mL - 4).attr("y", y(v) + 3).attr("text-anchor", "end").attr("class", "c-axis").text(fnum(v)); });
    const T = tipOf(body);
    days.forEach((d) => {
      const bx = x(d.ti), bw = x.bandwidth();
      const g = svg.append("g").attr("class", "f-col" + (d.ti === sel ? " sel" : "")).style("cursor", "pointer");
      g.append("rect").attr("x", bx - 2).attr("width", bw + 4).attr("y", mT).attr("height", H - mB - mT).attr("class", "f-hit");
      if (d.has) {
        const off = M.min ? d.v < d.z * 0.9 : d.v > d.z * 1.1;
        g.append("rect").attr("x", bx).attr("width", bw).attr("y", y(d.v)).attr("height", Math.max(1, y(0) - y(d.v))).attr("rx", 3).attr("class", "f-bar" + (off ? " off" : ""));
      }
      g.append("line").attr("x1", bx - 2).attr("x2", bx + bw + 2).attr("y1", y(d.z)).attr("y2", y(d.z)).attr("class", "f-ziel");
      const dd = pd(d.ti);
      g.append("text").attr("x", bx + bw / 2).attr("y", H - mB + 13).attr("text-anchor", "middle").attr("class", "c-axis").text(["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][dd.getUTCDay()]);
      g.append("text").attr("x", bx + bw / 2).attr("y", H - mB + 25).attr("text-anchor", "middle").attr("class", "c-axis").text(dd.getUTCDate() + ".");
      g.on("click", () => { foodDay = d.ti === iso(t0) ? null : d.ti; rerender(); });
      onTip(g, T, (ev) => T.show(ev, tagName(d.ti), [{ text: d.has ? `${fnum(d.v)} von ${M.min ? "mind. " : ""}${fnum(d.z)} ${M.unit}` : "nichts eingetragen" }]));
    });
    const avg = Math.round(d3.mean(withData, (d) => d.v)), avgZ = Math.round(d3.mean(withData, (d) => d.z));
    const treffer = withData.filter((d) => M.min ? d.v >= d.z * 0.9 : Math.abs(d.v - d.z) <= d.z * 0.1).length;
    body.appendChild(E("p", "c-text", `Ø ${fnum(avg)} ${M.unit} pro Tag (Ziel Ø ${fnum(avgZ)}), an ${withData.length} Tagen mit Einträgen. ${M.min ? "Mindestens" : "Im Ziel (±10 %)"}: ${treffer} von ${withData.length} Tagen.`));
    legend(body, [["var(--hi)", M.min ? "genug (ab 90 %)" : "bis Ziel +10 %"], ["#e07a5f", M.min ? "zu wenig" : "mehr als 10 % drüber"], ["var(--text)", "Ziel"]]);
    if (foodMetric !== "kcal" && withData.some((d) => d.v === 0)) body.appendChild(E("p", "c-hint", "Bei älteren Einträgen fehlen manche Nährwerte, die Säulen sind dort zu niedrig."));
  }

  // ---------- Essen: was heute noch gut passt ----------
  // Bewährte Klassiker (Portion, ca.-Werte), falls dein Verlauf nicht genug hergibt
  const KLASSIKER = [
    { n: "Magerquark", m: "250 g", kcal: 170, p: 30, b: 0 },
    { n: "Skyr natur", m: "250 g", kcal: 160, p: 27, b: 0 },
    { n: "Hüttenkäse", m: "200 g", kcal: 190, p: 24, b: 0 },
    { n: "Linsen, gekocht", m: "200 g", kcal: 230, p: 18, b: 16 },
    { n: "Edamame", m: "150 g", kcal: 180, p: 17, b: 8 },
    { n: "Kichererbsen, gekocht", m: "150 g", kcal: 180, p: 10, b: 9 },
    { n: "Haferflocken", m: "60 g", kcal: 220, p: 8, b: 6 },
    { n: "Leinsamen, geschrotet", m: "2 EL (15 g)", kcal: 80, p: 3, b: 4 },
    { n: "Himbeeren", m: "150 g", kcal: 60, p: 2, b: 7 },
    { n: "Vollkornbrot", m: "2 Scheiben", kcal: 200, p: 7, b: 7 },
    { n: "Eier", m: "2 Stück", kcal: 160, p: 13, b: 0 },
  ];
  function vorschlaege(parent, g) {
    const needP = g.p > 5, needB = g.b > 3, kc = g.kcal;
    const body = card(parent, "Passt noch heute", "Aus dem, was du sonst isst, passend zu dem, was heute noch fehlt");
    if (!needP && !needB) { body.appendChild(E("p", "c-text", kc > 150 ? `Eiweiß und Ballaststoffe sind gedeckt. Die restlichen ${fnum(Math.round(kc))} kcal kannst du frei nutzen.` : "Für heute bist du gut versorgt.")); return; }
    // Deine Lebensmittel: je Name der letzte Eintrag mit Werten, wie oft gegessen
    const map = new Map(), heute = new Set(g.heute.map((r) => String(r.lebensmittel || "").toLowerCase()));
    (C.ernaehrung || []).slice().sort((a, b) => String(a.datum).localeCompare(String(b.datum))).forEach((r) => {
      const name = String(r.lebensmittel || "").trim(), key = name.toLowerCase();
      if (!name || r.kcal == null || Number(r.kcal) <= 0 || heute.has(key)) return;
      const o = map.get(key) || { n: name, anzahl: 0 };
      Object.assign(o, { m: r.menge || "", kcal: Number(r.kcal), p: Number(r.protein_g) || 0, b: Number(r.ballast_g) || 0, eigen: true });
      o.anzahl++; map.set(key, o);
    });
    const room = Math.max(kc, 0);
    const score = (f) => {
      const gain = (needP ? Math.min(f.p, g.p) / g.p : 0) + (needB ? Math.min(f.b, g.b) / g.b : 0);
      if (gain < 0.08) return 0;
      const zuviel = room > 0 ? Math.max(0, f.kcal - room) / room : f.kcal / 150; // passt es noch ins Budget?
      return gain / (f.kcal / 400 + 0.3) / (1 + 2 * zuviel) * (f.eigen ? 1 + Math.min(f.anzahl, 5) * 0.1 : 1);
    };
    const eigene = [...map.values()].map((f) => ({ ...f, s: score(f) })).filter((f) => f.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
    const names = new Set(eigene.map((f) => f.n.toLowerCase()));
    const extra = KLASSIKER.filter((f) => !names.has(f.n.toLowerCase())).map((f) => ({ ...f, s: score(f) })).filter((f) => f.s > 0).sort((a, b) => b.s - a.s).slice(0, Math.max(2, 5 - eigene.length));
    const fehlt = [needP && `${fnum(Math.round(g.p))} g Eiweiß`, needB && `${fnum(Math.round(g.b))} g Ballaststoffe`].filter(Boolean).join(" und ");
    body.appendChild(E("p", "c-text", `Dir fehlen noch ${fehlt}${room > 0 ? `, bei ${fnum(Math.round(room))} kcal übrig` : ", die kcal sind aber schon erreicht, also eher leichte Sachen"}.`));
    const list = E("div", "v-list");
    const row = (f, tag) => {
      const r = E("div", "v-row"), top = E("div", "v-top");
      top.append(E("b", "", f.n), E("span", "v-tag", tag));
      const gains = [f.p >= 1 && `+${fnum(Math.round(f.p))} g Eiweiß`, f.b >= 1 && `+${fnum(Math.round(f.b))} g Ballaststoffe`, `${fnum(Math.round(f.kcal))} kcal`].filter(Boolean).join(" · ");
      r.append(top, E("div", "v-sub", (f.m ? f.m + ": " : "") + gains));
      list.appendChild(r);
    };
    eigene.forEach((f) => row(f, f.anzahl > 1 ? `${f.anzahl}× gegessen` : "schon gegessen"));
    extra.forEach((f) => row(f, "Idee"));
    body.appendChild(list);
    body.appendChild(E("p", "c-hint", "Mengen wie bei deinem letzten Eintrag. „Idee“ sind Klassiker mit viel Eiweiß oder Ballaststoffen, Werte ungefähr."));
  }

  // ---------- Körper: Werte der Waage ----------
  // dir: 1 = mehr ist besser, -1 = weniger ist besser, 0 = neutral. noise: kleiner ist Messrauschen.
  const KW = [
    { k: "gewicht_kg", l: "Gewicht", u: "kg", d: 2, dir: 0, noise: 0.4,
      t: "Dein Gesamtgewicht. Es schwankt im Lauf eines Tages und im Zyklus oft um 1 bis 2 kg, vor allem durch Wasser. Vor der Periode ist es meist am höchsten.",
      r: "Aussagekräftig ist der Verlauf über Wochen, nicht der einzelne Tag." },
    { k: "bmi", l: "BMI", u: "", d: 1, dir: 0, noise: 0.2,
      t: "Gewicht geteilt durch Größe zum Quadrat. Der BMI unterscheidet nicht zwischen Muskeln und Fett, bei viel Muskeln ist er deshalb höher, ohne dass das schlecht ist.",
      r: "Üblicher Bereich: 18,5 bis 24,9." },
    { k: "koerperfett_pct", l: "Körperfett", u: "%", d: 1, dir: -1, noise: 0.6,
      t: "Wie viel Prozent deines Gewichts Fett ist. Fett ist nötig: für Hormone, den Zyklus und als Energiespeicher. Sinkt es zu stark, kann die Periode ausbleiben.",
      r: "Frauen um 26: gesund etwa 21 bis 32 %, sportlich etwa 16 bis 24 %. Unter etwa 15 % wird es für den Zyklus kritisch." },
    { k: "muskelrate_pct", l: "Muskelrate", u: "%", d: 1, dir: 1, noise: 0.6,
      t: "Anteil aller Muskeln am Gewicht, samt dem Wasser in den Muskeln. Steigt, wenn Muskeln wachsen oder Fett weniger wird.",
      r: "Die Waage rechnet das selbst aus, deshalb zählt vor allem dein eigener Verlauf." },
    { k: "fettfrei_kg", l: "Fettfreies Gewicht", u: "kg", d: 1, dir: 1, noise: 0.5,
      t: "Alles außer Fett: Muskeln, Knochen, Organe und Wasser. Daraus wird auch dein Grundumsatz und dein Kalorienziel berechnet.",
      r: "Steigt es bei gleichem Gewicht, hast du Muskeln auf- und Fett abgebaut." },
    { k: "unterhautfett_pct", l: "Unterhautfett", u: "%", d: 1, dir: -1, noise: 0.6,
      t: "Der Teil des Körperfetts direkt unter der Haut. Gesundheitlich eher harmlos. Für ein sichtbares Sixpack ist er der entscheidende Wert, weil er über den Bauchmuskeln liegt.",
      r: "Er macht den größten Teil deines Körperfetts aus und sinkt mit ihm." },
    { k: "viszeral", l: "Viszerales Fett", u: "", d: 1, dir: -1, noise: 0.5,
      t: "Fett im Bauchraum um die Organe. Davon zu viel ist ungünstig für Herz und Stoffwechsel. Die Zahl ist eine Stufe, keine Kilo oder Prozent.",
      r: "Stufe 1 bis 9 gilt als gesund, ab 10 als erhöht." },
    { k: "wasser_pct", l: "Körperwasser", u: "%", d: 1, dir: 1, noise: 1,
      t: "Anteil Wasser im Körper. Muskeln enthalten viel Wasser, Fett wenig. Der Wert schwankt mit Trinken, Salz, Training und Zyklus. Die Waage misst übrigens über das Wasser, deshalb wackeln an einem „Wassertag“ auch Fett und Muskeln mit.",
      r: "Frauen: üblich etwa 45 bis 60 %." },
    { k: "skelettmuskel_pct", l: "Skelettmuskeln", u: "%", d: 1, dir: 1, noise: 0.6,
      t: "Die Muskeln, die du bewegst und trainierst, also ohne Herz und Darm. Der beste Wert, um zu sehen, ob Krafttraining und Bouldern Muskeln aufbauen.",
      r: "Waagen rechnen das sehr unterschiedlich. Vergleich nur mit deinen eigenen Messungen." },
    { k: "muskelmasse_kg", l: "Muskelmasse", u: "kg", d: 1, dir: 1, noise: 0.5,
      t: "Gewicht aller Muskeln samt Wasser darin. Muskelaufbau geht langsam, realistisch sind bei Frauen etwa 0,25 bis 0,5 kg im Monat.",
      r: "Kurze Sprünge nach oben oder unten sind meist Wasser." },
    { k: "knochen_kg", l: "Knochenmasse", u: "kg", d: 1, dir: 0, noise: 0.2,
      t: "Geschätztes Gewicht der Knochenmineralien. Die Waage leitet das vor allem aus deinem Gewicht ab, es ändert sich kaum.",
      r: "Für echte Knochendichte braucht es eine Messung beim Arzt." },
    { k: "protein_pct", l: "Proteine", u: "%", d: 1, dir: 1, noise: 0.4,
      t: "Geschätzter Eiweißanteil im Körper, vor allem in Muskeln. Hängt eng mit der Muskelmasse zusammen.",
      r: "Waagen werten etwa 16 bis 20 % als normal." },
    { k: "grundumsatz_kcal", l: "Grundumsatz", u: "kcal", d: 0, dir: 0, noise: 15,
      t: "Was dein Körper in völliger Ruhe am Tag verbraucht. Steigt mit mehr Muskeln. Training und Alltag kommen obendrauf.",
      r: "Die App nutzt deine Werte für das Kalorienziel." },
    { k: "bio_alter", l: "Biologisches Alter", u: "Jahre", d: 0, dir: -1, noise: 1,
      t: "Eine grobe Schätzung der Waage aus Fett, Muskeln und Grundumsatz. Eher Spielerei als Medizin.",
      r: "Liegt es unter deinem echten Alter, sieht es gut aus." },
  ];
  let kwSel = "gewicht_kg", kwInfo = null;
  const kfmt = (v, d) => Number(v).toLocaleString("de-DE", { minimumFractionDigits: d, maximumFractionDigits: d });

  const HAUPT = ["gewicht_kg", "koerperfett_pct", "muskelmasse_kg"];
  const spark = (vals, col) => {
    if (vals.length < 2) return "";
    const w = 96, h = 24, lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
    const pts = vals.map((v, i) => [(i / (vals.length - 1)) * (w - 4) + 2, h - 3 - ((v - lo) / r) * (h - 6)]);
    const l = pts[pts.length - 1];
    return `<svg class="k-spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ")}" fill="none" style="stroke:${col}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${l[0].toFixed(1)}" cy="${l[1].toFixed(1)}" r="2.6" style="fill:${col}"/></svg>`;
  };
  function koerper(box, missing) {
    if (missing) return; // Hinweis auf die SQL-Datei steht in der Liste darunter
    const rows = (C.koerper || []).slice().sort((a, b) => a.datum.localeCompare(b.datum) || String(a.created_at).localeCompare(String(b.created_at)));
    if (!rows.length) {
      const b = card(box, "Körperwerte");
      b.appendChild(E("p", "c-hint", "Noch keine Messung. Tipp auf + oder schick mir einen Screenshot deiner Waage."));
      return;
    }
    const last = rows[rows.length - 1];
    const series = (k) => rows.filter((r) => r[k] != null);
    const delta = (m) => {
      const s = series(m.k); if (s.length < 2) return { txt: "erste Messung", cls: "" };
      const v = Number(s[s.length - 1][m.k]), diff = v - Number(s[s.length - 2][m.k]);
      if (Math.abs(diff) < m.noise) return { txt: "≈ gleich", cls: "" };
      return { txt: (diff > 0 ? "▲ " : "▼ ") + kfmt(Math.abs(diff), m.d), cls: m.dir && Math.sign(diff) === m.dir ? " gut" : "" };
    };
    const lastOf = (k) => { const s = series(k); return s.length ? s[s.length - 1] : null; };

    // 1) Letzte Messung: drei Hauptwerte mit Mini-Verlauf
    const body = card(box, "Letzte Messung");
    const ph = phaseOn(last.datum);
    const meta = E("p", "k-meta", pd(last.datum).toLocaleDateString("de-DE", { day: "numeric", month: "long", timeZone: "UTC" }));
    if (ph) { const i = E("i"); i.style.background = BANDC[ph]; meta.append(" · ", i, " " + ph); }
    body.appendChild(meta);
    const big = E("div", "k-big3");
    HAUPT.map((k) => KW.find((m) => m.k === k)).forEach((m) => {
      const r = lastOf(m.k);
      const t = E("button", "k-b3" + (kwSel === m.k ? " on" : "")); t.type = "button";
      if (!r) { t.append(E("span", "k-l", m.l), E("span", "k-n", "–")); big.appendChild(t); return; }
      const d = delta(m);
      t.innerHTML = `<span class="k-l">${m.l === "Muskelmasse" ? "Muskeln" : m.l}</span><span class="k-n">${kfmt(r[m.k], m.k === "gewicht_kg" ? 1 : m.d)}<small>${m.u}</small></span><span class="k-d${d.cls}">${d.txt}</span>${spark(series(m.k).map((x) => Number(x[m.k])), d.cls ? "var(--c2)" : "var(--muted)")}`;
      t.addEventListener("click", () => { kwSel = m.k; rerender(); });
      big.appendChild(t);
    });
    body.appendChild(big);

    // 2) Eine Grafik mit Umschalter
    const m = KW.find((x) => x.k === kwSel) || KW[0];
    const seg = E("div", "k-seg");
    HAUPT.forEach((k) => { const x = KW.find((y) => y.k === k); const s = E("button", x.k === kwSel ? "on" : "", x.l === "Muskelmasse" ? "Muskeln" : x.l); s.type = "button"; s.addEventListener("click", () => { kwSel = x.k; rerender(); }); seg.appendChild(s); });
    body.appendChild(seg);
    if (!HAUPT.includes(m.k)) body.appendChild(E("p", "k-seltitle", m.l));
    const pts = series(m.k).map((r) => ({ d: pd(r.datum), v: Number(r[m.k]), label: kfmt(r[m.k], m.d) + (m.u ? " " + m.u : "") + (phaseOn(r.datum) ? " · " + phaseOn(r.datum) : "") }));
    const plot = E("div"); body.appendChild(plot);
    if (pts.length) {
      const vs = pts.map((p) => p.v), span = Math.max(m.noise * 4, Math.max(...vs) - Math.min(...vs));
      const mid = (Math.max(...vs) + Math.min(...vs)) / 2, nt = niceTicks(mid - span * 0.65, mid + span * 0.65);
      chart(plot, { kind: "line", phases: true, h: 170, left: { domain: nt.domain, ticks: nt.ticks, fmt: (t) => kfmt(t, Number.isInteger(t) ? 0 : 1) }, series: [{ name: m.l, color: "var(--c2)", pts }] });
    }
    const info = E("details", "k-why"); info.appendChild(E("summary", "", "ⓘ Was ist " + m.l + "?"));
    info.appendChild(E("p", "", m.t)); info.appendChild(E("p", "k-r", m.r)); body.appendChild(info);

    // 3) Alle Werte, eingeklappt
    const all = E("details", "glass c-card k-all"); all.open = kwAll;
    all.addEventListener("toggle", () => { kwAll = all.open; });
    const sm = E("summary"); sm.append(E("span", "c-title", "Alle Werte"), E("span", "k-cnt", KW.filter((x) => lastOf(x.k)).length + " Werte ⌄")); all.appendChild(sm);
    KW.filter((x) => lastOf(x.k)).forEach((x) => {
      const d = delta(x), row = E("button", "k-row" + (x.k === kwSel ? " on" : "")); row.type = "button";
      row.innerHTML = `<span class="k-rn">${x.l}</span>${spark(series(x.k).map((r) => Number(r[x.k])), "var(--muted)")}<span class="k-rv">${kfmt(lastOf(x.k)[x.k], x.d)}${x.u && x.u !== "Jahre" ? " " + x.u : ""}</span><span class="k-d${d.cls}">${d.txt}</span>`;
      row.addEventListener("click", () => { kwSel = x.k; rerender(); box.scrollIntoView({ behavior: "smooth", block: "start" }); });
      all.appendChild(row);
    });
    box.appendChild(all);
  }
  let kwAll = false;

  // Letzte Messung mit Gewicht (für Kalorienziel), höchstens 60 Tage alt
  function letzteWaage() {
    const lim = iso(+todayUTC() - 60 * DAY);
    return (C.koerper || []).filter((r) => r.gewicht_kg != null && r.datum >= lim).sort((a, b) => b.datum.localeCompare(a.datum))[0] || null;
  }

  // ---------- Verteilen auf die Tabs ----------
  function render(cache, view, sport) {
    if (!window.d3) return;
    lastArgs = [cache, view, sport];
    C = { ...cache, phasen: phasen(cache.zyklus) };
    const box = document.querySelector(`[data-charts="${view}"]`);
    if (!box || box.closest("[hidden]")) return;
    box.replaceChildren();
    const P = window.TBPlan;
    if (view === "heute" && P) P.woche(box, cache);
    if (view === "heute") wochenUebersicht(card(box, "Trainingstage pro Woche", "Eine Spalte pro Tag, ein Block pro Sportart. Tippen zeigt Details."));
    if (view === "training") {
      if (sport === "bouldern") { bGrad(card(box, "Schwerster Boulder pro Session")); bWoche(card(box, "Sessions pro Woche")); }
      if ((sport === "kraft" || sport === "laufen") && P && P.ziele) P.ziele(box, cache);
      if (sport === "kraft" && P) P.kraft(box, cache);
      if (sport === "laufen" && P) P.laufen(box, cache);
      if (sport === "kraft") { kUebungen(box); kVol(card(box, "Volumen pro Training", "Summe aus Wiederholungen mal Gewicht über alle Sätze, in kg.")); }
      if (sport === "laufen") { lPace(card(box, "Pace und Puls")); lEff(card(box, "Meter pro Herzschlag", "Steigt der Wert, läufst du schneller bei gleichem Puls.")); }
      if (sport === "rad") { rWoche(card(box, "Radminuten pro Woche")); rPuls(card(box, "Puls pro Fahrt")); }
    }
    if (view === "zyklus") zyklusKarten(box);
    if (view === "ernaehrung") { const g = tagesziel(box); if (g) vorschlaege(box, g); essenVerlauf(box); }
    if (view === "befinden") koerper(box, cache._missing && cache._missing.koerper);
  }

  // Für die Karte „Essen heute“ auf der Startseite
  function essenHeute(cache) {
    C = { ...cache, phasen: phasen(cache.zyklus) };
    const ti = iso(todayUTC());
    const { base, why } = zielFuer(ti);
    const { eat, sum } = tagSumme(ti);
    return { ziel: base, why, n: eat.length, kcal: Math.round(sum("kcal")), p: Math.round(sum("protein_g")), b: Math.round(sum("ballast_g")) };
  }

  // ---------- Heute: Zyklus-Uhr als Punktekranz ----------
  const KURZ = { Periode: "Periode", Follikelphase: "Follikel", Eisprung: "Eisprung", Lutealphase: "Luteal" };
  const UHR_TIPP = {
    Periode: ["Nach Gefühl: Technik, locker, kurz", "Auf Erhaltung, eisenreich", "Weniger Energie ist normal"],
    Follikelphase: ["Schwer heben, Projekte", "Normal nach Plan", "Viel Energie, schnelle Erholung"],
    Eisprung: ["Power hoch, gründlich aufwärmen", "Normal, Eiweiß verteilen", "Bänder etwas lockerer"],
    Lutealphase: ["Volumen und Technik, Läufe nach Puls", "Etwa 150 kcal mehr", "Mehr Hunger und Wasser sind normal"],
  };
  function heuteUhr(el, cache) {
    if (!el) return;
    C = { ...cache, phasen: phasen(cache.zyklus) };
    const z = zyklusHeute();
    if (!z) { el.innerHTML = `<h2 data-sum="zyklus">Noch nichts eingetragen</h2><p class="muted small">Sobald du deinen Zyklus einträgst, siehst du hier, wo du gerade stehst.</p>`; return; }
    const ti = iso(todayUTC()), t0 = todayUTC();
    const cyc = C.phasen.filter((p) => p.phase === "Periode" && !p.prognose && p.start <= ti).pop() || C.phasen.filter((p) => p.phase === "Periode" && p.start <= ti).pop();
    const parts = C.phasen.filter((p) => p.zyklus_start === cyc.start);
    const L = Math.max(z.len, z.day);
    const dayOf = (s) => Math.round((pd(s) - pd(cyc.start)) / DAY) + 1;
    const phaseDay = (d) => { const s = iso(+pd(cyc.start) + (d - 1) * DAY); const p = parts.find((x) => x.start <= s && s <= x.ende); return p ? p.phase : "Lutealphase"; };
    const ov = parts.find((p) => p.phase === "Eisprung"), ovDay = ov ? dayOf(ov.start) + 1 : null;
    // Punkte
    const cx = 100, cy = 100, R = 80, step = (2 * Math.PI * R) / L, rd = Math.max(2.4, Math.min(7, step * 0.36));
    const ang = (d) => ((d - 0.5) / L) * 2 * Math.PI - Math.PI / 2;
    let dots = "";
    for (let d = 1; d <= L; d++) {
      if (d === z.day) continue;
      const a = ang(d), x = (cx + R * Math.cos(a)).toFixed(1), y = (cy + R * Math.sin(a)).toFixed(1), col = BANDC[phaseDay(d)];
      if (d === ovDay) dots += `<text x="${x}" y="${(+y + rd * 1.1).toFixed(1)}" text-anchor="middle" style="fill:${col};font-size:${Math.max(11, rd * 3)}px">★</text>`;
      else if (d < z.day) dots += `<circle cx="${x}" cy="${y}" r="${rd.toFixed(1)}" style="fill:${col}"/>`;
      else dots += `<circle cx="${x}" cy="${y}" r="${(rd - 0.8).toFixed(1)}" fill="none" style="stroke:${col}" stroke-width="${Math.min(2.4, rd * 0.4).toFixed(1)}"/>`;
    }
    const a = ang(z.day), tx = (cx + R * Math.cos(a)).toFixed(1), ty = (cy + R * Math.sin(a)).toFixed(1);
    dots += `<circle cx="${tx}" cy="${ty}" r="12.5" style="fill:${BANDC[z.phase]};stroke:var(--text)" stroke-width="3"/><text x="${tx}" y="${(+ty + 3.6).toFixed(1)}" text-anchor="middle" style="fill:#1c1a17;font-size:${z.day > 99 ? 8 : 10}px;font-weight:700">${z.day}</text>`;
    // Texte
    const tage = (n) => n + (n === 1 ? " Tag" : " Tagen");
    let ovTxt = "";
    if (ovDay) ovTxt = z.day < ovDay - 1 ? "in " + tage(ovDay - z.day) : z.phase === "Eisprung" ? "ungefähr jetzt" : "vor etwa " + tage(z.day - ovDay);
    const starts = (cache.zyklus || []).map((r) => r.periode_start).filter(Boolean).sort();
    const gaps = starts.slice(1).map((s, i) => Math.round((pd(s) - pd(starts[i])) / DAY)).filter((g) => g >= 18 && g <= 45);
    const avgL = gaps.length ? Math.round(gaps.reduce((x, y) => x + y, 0) / gaps.length) : 26;
    const dmy = (t) => new Date(t).toLocaleDateString("de-DE", { day: "numeric", month: "short", timeZone: "UTC" });
    const per = z.overdue
      ? `<b>überfällig</b><span>erwartet war ca. ${dmy(+pd(cyc.start) + avgL * DAY)}</span>`
      : z.next != null ? `<b>in ca. ${tage(z.next)}</b><span>um den ${dmy(+t0 + z.next * DAY)}</span>` : "";
    const sick = (C.befinden || []).find((r) => r.status === "krank" && r.datum_von <= ti && (!r.datum_bis || ti <= r.datum_bis));
    const tp = UHR_TIPP[z.phase].slice();
    if (sick) { tp[0] = "Pause, erst gesund werden"; tp[1] = "Auf Erhaltung, viel trinken"; }
    const center = z.overdue ? `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="zu-c1">${KURZ[z.phase]}</text><text x="${cx}" y="${cy + 17}" text-anchor="middle" class="zu-c2">Tag ${z.day}</text>`
      : `<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="zu-c1">${KURZ[z.phase]}</text><text x="${cx}" y="${cy + 19}" text-anchor="middle" class="zu-c2">Tag ${z.day} von ca. ${avgL}</text>`;
    el.innerHTML = `<div class="zu">
      <svg class="zu-ring" viewBox="0 0 200 200" role="img" aria-label="Zyklustag ${z.day}, ${z.phase}">${dots}${center}</svg>
      <div class="zu-side">
        <div><span class="zu-k">Phase</span><h2 data-sum="zyklus">${z.phase}</h2></div>
        ${ovTxt ? `<div><span class="zu-k">Eisprung</span><b>${ovTxt}</b></div>` : ""}
        ${per ? `<div><span class="zu-k">Periode</span>${per}</div>` : ""}
      </div></div>
      <details class="zu-more"${uhrTipps ? " open" : ""}><summary><span>Tipps für heute</span><span class="zu-chev" aria-hidden="true">⌄</span></summary>
      <div class="zu-tips">${[["Training", tp[0]], ["Essen", tp[1]], ["Körper", tp[2]]].map(([k, v]) => `<div><span class="zu-k">${k}</span><span>${v}</span></div>`).join("")}</div></details>`;
    // Die Karte ist ein Link zur Zyklus-Seite: Aufklappen soll nicht dorthin springen
    const sm = el.querySelector(".zu-more summary");
    if (sm) sm.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); const d = sm.parentElement; d.open = !d.open; uhrTipps = d.open; });
  }
  let uhrTipps = false;
  // Nur der Punktekranz, für die Zyklus-Seite
  function uhrSvg(cache) { const d = document.createElement("div"); heuteUhr(d, cache); const s = d.querySelector("svg"); return s ? s.outerHTML : null; }

  // Für die Zyklus-Seite direkt unter dem Ring
  function zyklusTop(el, cache) {
    if (!window.d3) return;
    C = { ...cache, phasen: phasen(cache.zyklus) };
    el.replaceChildren();
    try { formKarte(el); hormonKarte(el); } catch (e) { console.error("Zyklus-Karten", e); }
  }

  window.TBCharts = { render, phasen, essenHeute, zyklusTop, heuteUhr, uhrSvg, foodDay: () => foodDay, zyklusHeute: (cache) => { C = { ...cache, phasen: phasen(cache.zyklus) }; return zyklusHeute(); } };
})();
