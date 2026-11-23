// Trainingsbuch – Trainingsplan (Stand 21.11.2026, mit Aurora abgestimmt)
// Kraft 3× pro Woche im Wechsel Tag A / Tag B, Laufen 2× pro Woche locker.
// Steigerung: Wiederholungsbereich je Übung. Schaffst du an einem Gewicht in allen Sätzen die obere Zahl,
// schlägt die App beim nächsten Mal den nächsten Gewichtsschritt vor (Gym hat nur 5-kg-Schritte).
// In der Lutealphase und während der Periode wird nicht gesteigert, nur gehalten.

(function () {
  const PLAN = {
    A: [
      { u: "Bankdrücken", lo: 6, hi: 10, start: 45, step: 5 },
      { u: "Kniebeugen", lo: 6, hi: 10, start: 55, step: 5 },
      { u: "Klimmzug", lo: 3, hi: 6, start: 12, step: 4, extra: true, hint: "Bei Ziehen im Ringband eine Stufe zurück." },
      { u: "Beine anziehen im Liegestütz", lo: 8, hi: 15, bw: true },
    ],
    B: [
      { u: "Rumänisches Kreuzheben", lo: 6, hi: 10, start: 70, step: 5 },
      { u: "Ausfallschritt", lo: 8, hi: 12, start: 40, step: 5, side: true },
      { u: "Trizeps-Dips", lo: 5, hi: 10, bw: true },
      { u: "Beine anziehen im Liegestütz", lo: 8, hi: 15, bw: true },
    ],
  };
  const KRAFT_PRO_WOCHE = 3, LAUF_PRO_WOCHE = 2, PULS_MAX = 140, LAUF_ZIEL_MIN = 45;

  const DAY = 864e5;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const todayISO = () => { const n = new Date(); return iso(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); };
  const weekStart = (s) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); };
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const de = (n) => Number(n).toLocaleString("de-DE");
  // Zwei Trainings im Wechsel (intern A und B), damit jede Übung genug Pause bekommt
  const kg = (ex, w) => (ex.extra ? "+" : "") + de(w) + " kg";

  // Welcher Tag ist dran? Nach dem letzten Krafttraining der andere.
  function nextDay(kraft) {
    const dates = [...new Set(kraft.map((r) => r.datum))].sort();
    if (!dates.length) return { next: "A", last: null };
    const last = dates[dates.length - 1];
    const us = new Set(kraft.filter((r) => r.datum === last).map((r) => r.uebung));
    const score = (k) => PLAN[k].filter((e) => !PLAN[k === "A" ? "B" : "A"].some((x) => x.u === e.u) && us.has(e.u)).length;
    const was = score("B") > score("A") ? "B" : "A";
    return { next: was === "A" ? "B" : "A", was, last };
  }

  // Ziel für eine Übung aus dem letzten Training
  function target(ex, kraft, hold) {
    const rows = kraft.filter((r) => r.uebung === ex.u);
    if (!rows.length) return { w: ex.bw ? null : ex.start, aim: ex.lo, info: "Noch nicht eingetragen, Startwert." };
    const d = rows.reduce((m, r) => (r.datum > m ? r.datum : m), "");
    const sets = rows.filter((r) => r.datum === d).sort((a, b) => (a.satz ?? 0) - (b.satz ?? 0));
    const reps = (r) => Number(r.wdh) || 0, wt = (r) => Number(r.gewicht_kg) || 0;
    const info = "Zuletzt: " + sets.map((r) => reps(r) + "×" + (wt(r) ? " " + de(wt(r)) : "")).join(", ");
    if (ex.bw && !sets.some(wt)) {
      const rs = sets.map(reps);
      if (rs.length >= 2 && rs.every((x) => x >= ex.hi)) return { w: null, aim: ex.hi, up: !hold, info, upText: "Alle Sätze geschafft: langsamer ausführen oder etwas Gewicht dazu." };
      return { w: null, aim: Math.min(ex.hi, Math.max(ex.lo, Math.min(...rs) + 1)), info };
    }
    const ok = sets.filter((r) => reps(r) >= ex.lo);
    let w = ok.length ? Math.max(...ok.map(wt)) : Math.min(...sets.map(wt));
    const atW = sets.filter((r) => wt(r) === w).map(reps);
    const done = atW.length >= 2 && atW.every((x) => x >= ex.hi);
    if (done && !hold) return { w: w + (ex.step || 5), aim: ex.lo, up: true, info };
    if (done) return { w, aim: ex.hi, info, holdText: "Steigerung nach der Periode." };
    return { w, aim: Math.min(ex.hi, Math.max(ex.lo, Math.min(...atW) + 1)), info };
  }

  // Zyklus: in Lutealphase und Periode halten statt steigern (nicht, wenn die Periode überfällig ist)
  function zyklusHalt(cache) {
    const z = window.TBCharts && window.TBCharts.zyklusHeute(cache);
    if (!z || z.overdue) return { hold: false, text: "" };
    if (z.phase === "Follikelphase" || z.phase === "Eisprung") return { hold: false, text: `${z.phase}: guter Moment zum Steigern.` };
    return { hold: true, text: `${z.phase}: Gewicht halten und sauber trainieren, keine Steigerung.` };
  }
  function krank(cache) {
    const t = todayISO();
    return (cache.befinden || []).find((r) => r.status !== "gut" && r.datum_von <= t && (!r.datum_bis || t <= r.datum_bis));
  }

  function card(parent, title, note) {
    const c = document.createElement("div");
    c.className = "glass c-card plan";
    c.innerHTML = `<h3 class="c-title">${esc(title)}</h3>${note ? `<p class="c-note">${esc(note)}</p>` : ""}`;
    parent.appendChild(c);
    return c;
  }
  const dots = (n, of) => `<span class="p-dots" aria-label="${n} von ${of}">${Array.from({ length: of }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;

  function kraft(parent, cache) {
    const rows = cache.kraft || [];
    const t = todayISO(), wk = weekStart(t);
    const n = new Set(rows.filter((r) => r.datum >= wk).map((r) => r.datum)).size;
    const { next, was, last } = nextDay(rows);
    const z = zyklusHalt(cache), sick = krank(cache);
    const head = last === t ? "Heute erledigt ✓ · das ist beim nächsten Mal dran:" : "Das ist beim nächsten Krafttraining dran:";
    const c = card(parent, "Dein Plan", head);
    const items = PLAN[next].map((ex) => {
      const g = target(ex, rows, z.hold);
      const goal = `${ex.side ? "3 × " + g.aim + " pro Seite" : "3 × " + g.aim}${g.w != null ? " · " + kg(ex, g.w) : ""}`;
      const tag = g.up ? `<span class="p-up">${g.w != null ? "↑ schwerer" : "↑ schaffst du"}</span>` : "";
      const sub = [g.info, g.upText, g.holdText, ex.hint].filter(Boolean).join(" ");
      return { ex, g, html: `<div class="p-row"><div class="p-top"><b>${esc(ex.u)}</b>${tag}</div><div class="p-goal">${esc(goal)}</div><div class="p-sub">${esc(sub)}</div></div>` };
    });
    c.insertAdjacentHTML("beforeend", `
      <div class="p-week">Krafttraining diese Woche ${dots(n, KRAFT_PRO_WOCHE)} <span>${n} von ${KRAFT_PRO_WOCHE}</span></div>
      ${sick ? `<p class="p-warn">Du hast gerade „${esc(sick.status)}“ eingetragen: nur leicht trainieren oder Pause.</p>` : ""}
      ${z.text ? `<p class="c-note">${esc(z.text)}</p>` : ""}
      ${items.map((i) => i.html).join("")}
      <button type="button" class="btn small-btn p-start">Training eintragen</button>
      <p class="c-hint">Bereich je Übung: erst alle Sätze bis zur oberen Zahl, dann schwerer und wieder unten anfangen.</p>`);
    c.querySelector(".p-start").addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("tb-plan", { detail: items.map((i) => ({ u: i.ex.u, w: i.g.w })) }));
    });
  }

  function laufen(parent, cache) {
    const rows = (cache.laufen || []).slice().sort((a, b) => a.datum.localeCompare(b.datum));
    const wk = weekStart(todayISO());
    const n = rows.filter((r) => r.datum >= wk).length;
    const last = rows[rows.length - 1];
    const lastMin = last && last.dauer_s ? Math.round(last.dauer_s / 60) : null;
    const next = lastMin == null ? 30 : Math.min(LAUF_ZIEL_MIN, Math.max(20, lastMin + 5));
    const hf = last && Number(last.avg_hf);
    const c = card(parent, "Dein Plan", "Laufen: locker, damit du bei gleichem Puls schneller wirst");
    c.insertAdjacentHTML("beforeend", `
      <div class="p-week">Läufe diese Woche ${dots(Math.min(n, LAUF_PRO_WOCHE), LAUF_PRO_WOCHE)} <span>${n} von ${LAUF_PRO_WOCHE}</span></div>
      <div class="p-row"><div class="p-top"><b>Nächster Lauf</b></div><div class="p-goal">${next} Min. · Puls unter ${PULS_MAX}</div>
      <div class="p-sub">${lastMin != null ? `Zuletzt ${lastMin} Min.${hf ? `, Ø ${hf} bpm` : ""}. ` : ""}${hf && hf > PULS_MAX ? "Der Puls war etwas hoch: öfter kurz gehen, bis er wieder unten ist." : next >= LAUF_ZIEL_MIN ? "45 Minuten erreicht: Dauer halten, das Tempo kommt von selbst." : "Jede Woche etwa 5 Minuten länger, bis 45 Minuten."}</div></div>
      <p class="c-hint">Am besten an Tagen ohne Krafttraining. Die Grafik „Meter pro Herzschlag“ zeigt, ob du bei gleichem Puls schneller wirst.</p>`);
  }

  function woche(parent, cache) {
    const wk = weekStart(todayISO());
    const k = new Set((cache.kraft || []).filter((r) => r.datum >= wk).map((r) => r.datum)).size;
    const l = (cache.laufen || []).filter((r) => r.datum >= wk).length;
    const { next } = nextDay(cache.kraft || []);
    const c = card(parent, "Dein Plan diese Woche");
    c.insertAdjacentHTML("beforeend", `
      <div class="p-week">Kraft ${dots(Math.min(k, KRAFT_PRO_WOCHE), KRAFT_PRO_WOCHE)} <span>${k} von ${KRAFT_PRO_WOCHE}</span></div>
      <div class="p-week">Laufen ${dots(Math.min(l, LAUF_PRO_WOCHE), LAUF_PRO_WOCHE)} <span>${l} von ${LAUF_PRO_WOCHE}</span></div>
      <p class="c-hint">Als Nächstes: ${esc(PLAN[next].map((e) => e.u.replace(" im Liegestütz", "")).join(", "))}. Antippen für deinen Plan ›</p>`);
    // Ganze Karte führt zum Plan unter Training → Kraft
    c.classList.add("p-link");
    c.setAttribute("role", "link");
    c.addEventListener("click", () => {
      location.hash = "#training";
      setTimeout(() => document.querySelector('.chip[data-sport="kraft"]')?.click(), 0);
    });
  }

  // ---------- Deine Ziele: was wann erreicht werden soll ----------
  // Tempo je Übung aus deinem Verlauf (Wochen pro 5-kg-Schritt), sonst übliche Werte für Fortgeschrittene-Anfängerinnen
  const WOCHEN_PRO_SCHRITT = { "Bankdrücken": 4, "Kniebeugen": 4, "Rumänisches Kreuzheben": 4, "Ausfallschritt": 4, "Klimmzug": 4 };
  const MONATE = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];
  function wann(weeks) {
    if (weeks <= 0.5) return "nächstes Training";
    const d = new Date(Date.now() + weeks * 7 * DAY), day = d.getDate();
    const teil = day <= 10 ? "Anfang" : day <= 20 ? "Mitte" : "Ende";
    return `${teil} ${MONATE[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? " ’" + String(d.getFullYear()).slice(2) : ""}`;
  }
  function arbeitsgewicht(ex, rows, d) {
    const sets = rows.filter((r) => r.datum === d), wt = (r) => Number(r.gewicht_kg) || 0;
    const ok = sets.filter((r) => (Number(r.wdh) || 0) >= ex.lo);
    return ok.length ? Math.max(...ok.map(wt)) : Math.max(...sets.map(wt));
  }
  function tempo(ex, kraft) {
    const rows = kraft.filter((r) => r.uebung === ex.u && Number(r.gewicht_kg) > 0);
    const dates = [...new Set(rows.map((r) => r.datum))].sort();
    const def = WOCHEN_PRO_SCHRITT[ex.u] || 4;
    if (dates.length < 3) return def;
    const w0 = arbeitsgewicht(ex, rows, dates[0]), w1 = arbeitsgewicht(ex, rows, dates[dates.length - 1]);
    const weeks = (new Date(dates[dates.length - 1]) - new Date(dates[0])) / (7 * DAY);
    const steps = (w1 - w0) / (ex.step || 5);
    if (steps <= 0 || weeks < 2) return def;
    return Math.min(6, Math.max(4, weeks / steps)); // höchstens alle 4 Wochen einplanen: in Lutealphase und Periode wird ja gehalten
  }
  const ZIEL_WOCHEN = 13; // etwa 3 Monate

  function ziele(parent, cache) {
    const kr = cache.kraft || [];
    const z = zyklusHalt(cache);
    const seen = new Set(), exs = [];
    ["A", "B"].forEach((k) => PLAN[k].forEach((e) => { if (!seen.has(e.u)) { seen.add(e.u); exs.push(e); } }));
    const end = new Date(Date.now() + ZIEL_WOCHEN * 7 * DAY);
    const c = card(parent, "Deine Ziele", `Wo du jetzt stehst, der nächste Schritt und wo du ${wann(ZIEL_WOCHEN)} sein kannst (Termine ungefähr)`);
    const rows = exs.map((ex) => {
      const g = target(ex, kr, false);
      if (ex.bw) {
        const last = kr.filter((r) => r.uebung === ex.u);
        const now = last.length ? Math.max(1, g.aim - (g.up ? 0 : 1)) : null;
        const goal = ex.hi, wk = now == null ? 4 : Math.max(0, goal - now); // etwa 1 Wiederholung pro Woche
        return { u: ex.u, now: now == null ? "noch offen" : `3 × ${now}`, next: `3 × ${goal}`, nextWhen: wann(wk), end: goal <= now ? "dann langsamer oder mit Gewicht" : "", endWhen: "" };
      }
      const step = ex.step || 5, wps = tempo(ex, kr);
      const now = g.up ? g.w - step : g.w;
      const firstIn = g.up ? 0 : wps;
      const n = Math.max(1, 1 + Math.floor((ZIEL_WOCHEN - firstIn) / wps));
      return { u: ex.u, now: kg(ex, now), next: kg(ex, now + step), nextWhen: wann(firstIn), end: kg(ex, now + n * step), endWhen: wann(firstIn + (n - 1) * wps) };
    });
    const lauf = (cache.laufen || []).slice().sort((a, b) => a.datum.localeCompare(b.datum));
    const lm = lauf.length && lauf[lauf.length - 1].dauer_s ? Math.round(lauf[lauf.length - 1].dauer_s / 60) : null;
    const lw = lm == null ? 3 : Math.max(0, Math.ceil((LAUF_ZIEL_MIN - lm) / 5));
    c.insertAdjacentHTML("beforeend", `
      <div class="z-head"><span></span><span>jetzt</span><span>nächster Schritt</span><span>Ziel</span></div>
      ${rows.map((r) => `<div class="z-row"><b>${esc(r.u.replace(" im Liegestütz", ""))}</b>
        <span class="z-now">${esc(r.now)}</span>
        <span>${esc(r.next)}<small>${esc(r.nextWhen)}</small></span>
        <span class="z-end">${esc(r.end)}<small>${esc(r.endWhen)}</small></span></div>`).join("")}
      <div class="z-row"><b>Laufen</b><span class="z-now">${lm != null ? lm + " Min." : "noch offen"}</span>
        <span>${LAUF_ZIEL_MIN} Min. locker<small>${esc(wann(lw))}</small></span><span class="z-end">schneller bei gleichem Puls<small>2× pro Woche, Puls unter ${PULS_MAX}</small></span></div>
      <p class="c-hint">Die Termine sind Schätzungen aus deinem bisherigen Tempo und passen sich an, wenn du schneller oder langsamer bist.${z.hold ? " Gerade ist Halten dran, das verschiebt die Termine etwas." : ""} Bouldern-Ziele kommen dazu, sobald die Ringbänder wieder ganz okay sind.</p>`);
  }

  window.TBPlan = { kraft, laufen, woche, ziele, PLAN };
})();
