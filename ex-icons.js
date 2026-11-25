// Piktogramme je Kraftübung: Strichfigur in der typischen Position (Wunsch 24.11.)
(() => {
  const H = (x, y) => `<circle cx="${x}" cy="${y}" r="2.6" class="ex-head"/>`;
  const L = (...p) => `<polyline points="${p.join(" ")}"/>`;
  const BAR = (x1, x2, y) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><line x1="${x1}" y1="${y - 3}" x2="${x1}" y2="${y + 3}" class="ex-plate"/><line x1="${x2}" y1="${y - 3}" x2="${x2}" y2="${y + 3}" class="ex-plate"/>`;
  const P = {
    "Bankdrücken": H(7, 19) + L("10,20", "22,20", "25,26") + L("12,20", "12,11") + L("19,20", "19,11") + BAR(6, 25, 11) + L("5,23", "27,23") + L("8,23", "8,28") + L("24,23", "24,28"),
    "Kniebeugen": H(15, 5) + BAR(5, 27, 10) + L("12,10", "14,9", "15,17") + L("15,17", "22,19", "20,28") + L("15,17", "21,20", "18,28") + L("16,28", "23,28"),
    "Rumänisches Kreuzheben": H(7, 9) + L("10,11", "21,14") + L("21,14", "22,28") + L("21,14", "20,28") + L("11,12", "12,21") + BAR(6, 18, 21) + L("19,28", "25,28"),
    "Klimmzug": BAR(4, 28, 5) + L("11,5", "13,13", "16,14") + L("21,5", "19,13", "16,14") + H(16, 10) + L("16,14", "16,22") + L("16,22", "14,29") + L("16,22", "18,29"),
    "Beine anziehen im Liegestütz": H(6, 13) + L("9,15", "9,27") + L("9,15", "22,19") + L("22,19", "28,27") + L("22,19", "15,22", "18,27") + L("4,27", "30,27"),
    "Ausfallschritt": H(16, 5) + L("16,8", "16,17") + L("16,17", "23,20", "23,28") + L("16,17", "11,24", "5,27") + L("16,10", "13,17") + L("16,10", "19,17") + L("21,28", "26,28"),
    "Trizeps-Dips": L("6,13", "6,29") + L("26,13", "26,29") + L("4,13", "9,13") + L("23,13", "28,13") + H(16, 8) + L("16,11", "16,20") + L("16,12", "10,17", "7,13") + L("16,12", "22,17", "25,13") + L("16,20", "13,26", "15,30") + L("16,20", "19,26", "17,30"),
  };
  const GEN = BAR(5, 27, 16) + L("9,12", "9,20") + L("23,12", "23,20");
  // Icons für das Eintragen-Menü (Usability 25.11.)
  const PICK = {
    bouldern: `<path d="M9 22c-3-4 0-11 6-13 5-2 10 1 10 6 0 6-6 10-11 10-2 0-4-1-5-3z"/><circle cx="17" cy="16" r="2" class="ex-head"/>`,
    kraft: GEN,
    laufen: H(19, 5) + L("18,9", "15,17") + L("17,11", "12,13", "9,11") + L("17,11", "21,14", "24,12") + L("15,17", "19,21", "17,27") + L("15,17", "11,22", "6,22"),
    rad: `<circle cx="8" cy="21" r="5.5"/><circle cx="24" cy="21" r="5.5"/>` + L("8,21", "13,12", "21,12", "24,21") + L("13,12", "16,21", "21,12") + L("11,9", "15,9") + L("20,9", "22,8"),
    koerper: `<rect x="5" y="7" width="22" height="20" rx="4"/>` + L("11,13", "21,13") + L("16,13", "18,10"),
  };
  const SYM = { ernaehrung: "i-ernaehrung", zyklus: "i-zyklus", befinden: "i-befinden" };
  window.TBPickIcon = (k) => SYM[k] ? `<svg class="ico pick-ico" aria-hidden="true"><use href="#${SYM[k]}"/></svg>` : `<svg class="ex-ico pick-ico" viewBox="0 0 32 32" aria-hidden="true">${PICK[k] || GEN}</svg>`;
  window.TBExIcon = (u) => `<svg class="ex-ico" viewBox="0 0 32 32" aria-hidden="true">${P[u] || GEN}</svg>`;
})();
