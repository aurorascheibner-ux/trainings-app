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
    const head = last === t ? `Heute erledigt: Tag ${was} ✓ · als Nächstes Tag ${next}` : `Als Nächstes: Tag ${next}`;
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
      <button type="button" class="btn small-btn p-start">Tag ${next} eintragen</button>
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
      <p class="c-hint">Als Nächstes beim Krafttraining: Tag ${next}. Details unter Training.</p>`);
  }

  window.TBPlan = { kraft, laufen, woche, PLAN };
})();
