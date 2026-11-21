// Trainingsbuch – Krafttraining aus diktiertem oder eingefügtem Text
// Beispiele, die verstanden werden:
//   "3x 55kg, 9x 45kg, 3x 55kg Bankdrücken"            (Sätze vor dem Namen, wie in Auroras Notizen)
//   "Bankdrücken 3 mal 55, 9 mal 45. Kniebeuge 10 mal 50 Kilo"   (diktiert, Name zuerst)
//   "Beine anziehen 10, 8, 9"  ·  "Pinch 30 Sekunden mit 20 kg"  ·  "5 Wiederholungen Dips"
// Jede Übung bekommt ihre Sätze; Text ohne Übungsnamen hängt an der Übung davor.

(function () {
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");
  // Umgangssprachliche Namen → Name in der App
  const ALIAS = [
    [/ruman\w*( kreuzheben)?|romanian\w*|rdl|kreuzheben/, "Rumänisches Kreuzheben"],
    [/bankdruck\w*|bench/, "Bankdrücken"],
    [/kniebeuge\w*|squat\w*/, "Kniebeugen"],
    [/klimmz\w*|pull ?ups?/, "Klimmzug"],
    [/beine anziehen\w*|bauchtraining|knee tucks?/, "Beine anziehen im Liegestütz"],
    [/(trizeps[- ]?)?dips/, "Trizeps-Dips"],
    [/ausfallschritt\w*|lunges?/, "Ausfallschritt"],
    [/zehen heben\w*( seitlich)?/, "Zehen heben seitlich"],
    [/beinheben\w*( hangend)?/, "Beinheben hängend"],
  ];
  const ZAHL = { eins: 1, ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, funf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwolf: 12, dreizehn: 13, vierzehn: 14, funfzehn: 15, zwanzig: 20 };

  function parse(text, known = []) {
    let t = norm(text)
      .replace(/\b(eins|ein|eine|einen|zwei|drei|vier|funf|sechs|sieben|acht|neun|zehn|elf|zwolf|dreizehn|vierzehn|funfzehn|zwanzig)\b/g, (w) => ZAHL[w])
      .replace(/(\d),(\d)/g, "$1.$2"); // 2,5 kg → 2.5
    // Namen finden: erst bekannte Übungen aus deinem Verlauf, dann Aliasse
    const names = [];
    const mark = (re, name) => { for (const m of t.matchAll(new RegExp(re.source, "g"))) names.push({ i: m.index, end: m.index + m[0].length, name }); };
    known.forEach((k) => { const n = norm(k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); if (n.length > 2) mark(new RegExp(n), k); });
    ALIAS.forEach(([re, name]) => mark(new RegExp("\\b(?:" + re.source + ")"), name)); // nur am Wortanfang ("lunge" nicht in "Wiederholungen")
    names.sort((a, b) => a.i - b.i || b.end - a.end);
    const hits = []; // Überlappungen entfernen (längster Treffer gewinnt)
    for (const h of names) if (!hits.length || h.i >= hits[hits.length - 1].end) hits.push(h);

    // Text in Abschnitte teilen: Zeilen und Satzenden
    const parts = [];
    let pos = 0;
    t.split(/(\n|[.;!?](?=\s|$))/).forEach((p) => { if (p.trim() && !/^[\n.;!?]$/.test(p)) parts.push({ s: pos, txt: p }); pos += p.length; });

    const out = [];
    let cur = null;
    const unknown = [];
    for (const part of parts) {
      const ps = part.s, pe = ps + part.txt.length;
      const inPart = hits.filter((h) => h.i >= ps && h.i < pe);
      // Abschnitt an jedem Namen teilen; Sätze vor dem ersten Namen gehören zu diesem Namen, wenn danach keine mehr kommen (Notiz-Stil)
      const cuts = inPart.length ? inPart : [null];
      cuts.forEach((h, k) => {
        const from = h ? (k === 0 ? ps : h.i) : ps;
        const to = k + 1 < cuts.length ? cuts[k + 1].i : pe;
        let seg = t.slice(from, to);
        if (h) seg = seg.slice(0, h.i - from) + " " + seg.slice(h.end - from);
        const sets = setsIn(seg);
        if (h) {
          cur = out.find((o) => o.u === h.name && !o.sets.length) || { u: h.name, sets: [] };
          if (!out.includes(cur)) out.push(cur);
          cur.sets.push(...sets);
        } else if (sets.length && cur) cur.sets.push(...sets);
        else if (sets.length || seg.trim().length > 3) unknown.push(part.txt.trim());
      });
    }
    // Übungen, die zweimal vorkamen, zusammenlegen
    const merged = [];
    out.forEach((o) => { const m = merged.find((x) => x.u === o.u); if (m) m.sets.push(...o.sets); else merged.push(o); });
    return { uebungen: merged.filter((o) => o.sets.length), ohneSaetze: merged.filter((o) => !o.sets.length).map((o) => o.u), unklar: unknown };
  }

  // Sätze in einem Textstück: "10x 50kg", "10 mal 50", "10 x", "30 sekunden mit 20 kg", "10 wiederholungen mit 50 kilo", "10, 8, 9"
  function setsIn(seg) {
    const sets = [];
    const re = /(\d+)\s*(?:x|×|\*|mal|wiederholungen|wdh\.?|reps?)\s*(?:(?:mit|a|à|@|bei)\s*)?(?:\+?\s*(\d+(?:\.\d+)?)\s*(?:kg|kilo(?:gramm)?)?(?![\d.]*\s*(?:x|×|mal|sek|s\b)))?|(\d+)\s*(?:sek(?:unden)?|s)\b(?:\s*(?:mit|a|@)?\s*\+?\s*(\d+(?:\.\d+)?)\s*(?:kg|kilo(?:gramm)?))?/g;
    let m, any = false;
    while ((m = re.exec(seg))) {
      any = true;
      if (m[3]) sets.push({ wdh: "", gewicht_kg: m[4] || "", dauer_s: m[3] });
      else sets.push({ wdh: m[1], gewicht_kg: m[2] || "", dauer_s: "" });
    }
    // Nur Zahlenliste ohne x/mal, z. B. "beine anziehen 10, 8, 9": jede Zahl ist ein Satz
    if (!any) {
      const nums = seg.match(/\b\d{1,2}\b/g);
      if (nums && nums.length <= 8 && !/kg|kilo/.test(seg)) nums.forEach((n) => sets.push({ wdh: n, gewicht_kg: "", dauer_s: "" }));
    }
    return sets.map((s) => ({ ...s, gewicht_kg: String(s.gewicht_kg).replace(".", ",") }));
  }

  window.TBDiktat = { parse };
})();
