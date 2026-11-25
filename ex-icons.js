// Piktogramme je Kraftübung, im Stil von Sport-Piktogrammen: Körper kräftig, Gerät in Akzentfarbe (Wunsch 24./25.11.)
(() => {
  // Körper: dicke runde Linien, Kopf gefüllt
  const H = (x, y) => `<circle cx="${x}" cy="${y}" r="3.1" class="ex-b-fill"/>`;
  const B = (...p) => `<polyline class="ex-b" points="${p.join(" ")}"/>`;
  // Gerät: Stange + Scheiben (gefüllt) in Akzentfarbe
  const BAR = (x1, x2, y) => `<line class="ex-g" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><rect class="ex-g-fill" x="${x1 - 1}" y="${y - 4.5}" width="3" height="9" rx="1"/><rect class="ex-g-fill" x="${x2 - 2}" y="${y - 4.5}" width="3" height="9" rx="1"/>`;
  const DB = (x, y) => `<rect class="ex-g-fill" x="${x - 3.5}" y="${y - 1.2}" width="7" height="2.4" rx="1"/><rect class="ex-g-fill" x="${x - 4.5}" y="${y - 2.6}" width="2.2" height="5.2" rx=".8"/><rect class="ex-g-fill" x="${x + 2.3}" y="${y - 2.6}" width="2.2" height="5.2" rx=".8"/>`;
  const LINE = (x1, y1, x2, y2) => `<line class="ex-g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  const P = {
    // liegt auf der Bank, Arme strecken die Stange nach oben
    "Bankdrücken": LINE(4, 22.5, 25, 22.5) + LINE(7, 22.5, 7, 28) + LINE(22, 22.5, 22, 28) + H(6.5, 17.5) + B("10,19", "21,19") + B("21,19", "25,23", "27,28") + B("12,19", "12,13", "12,8") + BAR(4, 20, 8),
    // tiefe Hocke, Stange auf den Schultern
    "Kniebeugen": BAR(5, 27, 9) + H(16, 5) + B("16,9", "15,17") + B("15,17", "22,19", "21,28") + B("12,9", "14,12") + B("20,9", "18,12") + LINE(18, 28, 25, 28),
    // Hüfte nach hinten, Rücken gerade, Stange vor den Knien
    "Rumänisches Kreuzheben": H(8, 9) + B("11,11", "22,14") + B("22,14", "21,21", "22,28") + B("13,12", "14,21") + BAR(8, 21, 22),
    // hängt an der Stange, Kinn auf Höhe der Stange
    "Klimmzug": BAR(4, 28, 5) + B("10,5", "11,11", "15,13") + B("22,5", "21,11", "17,13") + H(16, 8.8) + B("16,13", "16,21") + B("16,21", "13,26", "12,30") + B("16,21", "19,26", "20,30"),
    // Liegestütz, ein Knie zur Brust
    "Beine anziehen im Liegestütz": H(5.5, 13) + B("8,15", "9,26") + B("8,15", "21,19") + B("21,19", "29,26") + B("21,19", "15,21", "17,26") + LINE(3, 27.5, 30, 27.5),
    // Ausfallschritt mit Kurzhanteln
    "Ausfallschritt": H(15, 4.5) + B("15,8", "15,17") + B("15,17", "22,19", "22,28") + B("15,17", "11,23", "5,26") + B("15,10", "12,15", "11,19") + DB(11, 20) + LINE(19, 28.5, 26, 28.5),
    // Dips zwischen zwei Holmen
    "Trizeps-Dips": LINE(5, 14, 5, 30) + LINE(27, 14, 27, 30) + LINE(3, 14, 10, 14) + LINE(22, 14, 29, 14) + H(16, 6.5) + B("16,10", "16,20") + B("16,11", "11,17", "8,14") + B("16,11", "21,17", "24,14") + B("16,20", "13,25", "15,30") + B("16,20", "19,25", "17,30"),
  };
  const GEN = BAR(5, 27, 16) + `<rect class="ex-g-fill" x="7" y="11" width="3" height="10" rx="1"/><rect class="ex-g-fill" x="22" y="11" width="3" height="10" rx="1"/>`;
  // Icons für das Eintragen-Menü
  const PICK = {
    // kletternde Figur an Griffen: ein Arm hoch, ein Bein hoch angetreten
    bouldern: `<circle class="ex-g-fill" cx="23" cy="4" r="2.4"/><circle class="ex-g-fill" cx="8" cy="13" r="2.2"/><circle class="ex-g-fill" cx="21" cy="21" r="2.2"/><circle class="ex-g-fill" cx="11" cy="29" r="2.2"/>` + H(15.5, 8.5) + B("17,12", "22,5") + B("15,12", "9,13") + B("16,12", "15,20") + B("15,20", "20,21") + B("15,20", "13,25", "11,28"),
    kraft: GEN,
    laufen: H(19, 5) + B("18,9", "15,17") + B("17,11", "12,13", "9,11") + B("17,11", "21,15", "25,13") + B("15,17", "20,21", "18,28") + B("15,17", "11,22", "6,22"),
    rad: `<circle class="ex-g" cx="8" cy="21" r="5.5"/><circle class="ex-g" cx="24" cy="21" r="5.5"/>` + B("8,21", "13,12", "21,12", "24,21") + B("13,12", "16,21", "21,12") + B("11,9", "15,9") + B("20,9", "22,8"),
    koerper: `<rect class="ex-g" x="5" y="7" width="22" height="20" rx="4"/>` + B("11,13", "21,13") + B("16,13", "18,10"),
  };
  const SYM = { ernaehrung: "i-ernaehrung", zyklus: "i-zyklus", befinden: "i-befinden" };
  window.TBPickIcon = (k) => SYM[k] ? `<svg class="ico pick-ico" aria-hidden="true"><use href="#${SYM[k]}"/></svg>` : `<svg class="ex-ico pick-ico" viewBox="0 0 32 32" aria-hidden="true">${PICK[k] || GEN}</svg>`;
  window.TBExIcon = (u) => `<svg class="ex-ico" viewBox="0 0 32 32" aria-hidden="true">${P[u] || GEN}</svg>`;
})();
