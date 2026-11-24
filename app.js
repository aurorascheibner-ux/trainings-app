// Trainingsbuch – App-Hülle
// Wechselt zwischen den Bereichen über die Adresse (#heute, #training …).

const TITLES = {
  heute: "Heute",
  training: "Training",
  ernaehrung: "Ernährung",
  zyklus: "Zyklus",
  befinden: "Körper",
};

// ---------- Optik: Design und Farbe ----------
// Design = Form und Schrift, Farbe = Farbwerte. Werte stehen in styles.css (Glas) und designs.css.
// Die Farbe heißt „design-name“ (z. B. "papier-salbei"); Glas-Farben haben keinen Vorsatz.
const DESIGNS = [
  { id: "glas",   name: "Glas",   desc: "Schimmernde Glaskacheln, die bisherige Optik", font: "Fraunces", radius: 14 },
  { id: "papier", name: "Papier", desc: "Ruhig und edel wie ein Magazin, feine Linien", font: "Newsreader", radius: 2 },
  { id: "stein",  name: "Stein",  desc: "Weich und ruhig, runde Formen, sanfte Schatten", font: "DM Serif Display", radius: 18 },
  { id: "tinte",  name: "Tinte",  desc: "Elegant und präzise, Zahlen wie ein Messgerät", font: "Instrument Serif", radius: 3 },
  { id: "bento",  name: "Bento",  desc: "Modern und freundlich, farbige Kacheln", font: "Bricolage Grotesque", radius: 14 },
  { id: "beton",  name: "Beton",  desc: "Roh und laut, dicke Rahmen, Signalfarben", font: "Space Grotesk", radius: 0 },
  { id: "bauhaus", name: "Bauhaus", desc: "Große Formen in Rot, Gelb und Blau", font: "Jost", radius: 0 },
  { id: "terminal", name: "Terminal", desc: "Leuchtschrift wie ein alter Computer", font: "VT323", radius: 0 },
];
const THEMES = [
  { id: "moos",     d: "glas", name: "Moos & Bernstein",    desc: "mattes Olivgrün, Amber",   bg1: "#3f4430", bg2: "#2c3022", hi: "#e3a04a", c2: "#b9c48e" },
  { id: "tiefsee",  d: "glas", name: "Tiefsee & Messing",   desc: "Nachtblau, Messinggold",   bg1: "#24344a", bg2: "#172233", hi: "#d1ad6e", c2: "#9fbcd3" },
  { id: "salbei",   d: "glas", name: "Salbei & Terrakotta", desc: "Salbeigrün, Terrakotta",   bg1: "#5a6a57", bg2: "#3d4a3d", hi: "#e09a74", c2: "#efd3a8" },
  { id: "petrol",   d: "glas", name: "Petrol & Pfirsich",   desc: "tiefes Petrol, Pfirsich",  bg1: "#24474a", bg2: "#163033", hi: "#f0ad8a", c2: "#a7d3c3" },
  { id: "schiefer", d: "glas", name: "Schiefer & Lavendel", desc: "Schieferblau, Flieder",    bg1: "#3b4659", bg2: "#262e3d", hi: "#bfa9de", c2: "#dba3b1" },
  { id: "papier-klassisch", d: "papier", name: "Klassisch",       desc: "Papierweiß, Schwarz, Rostrot", bg1: "#f4f0e8", bg2: "#e4ddd0", hi: "#a4442a", c2: "#1c1a17" },
  { id: "papier-salbei",    d: "papier", name: "Leinen & Salbei", desc: "Leinen, Tannengrün",          bg1: "#eceee6", bg2: "#dde1d5", hi: "#4f7357", c2: "#1f2a24" },
  { id: "papier-rose",      d: "papier", name: "Rosé",            desc: "zartes Rosé, Beere",          bg1: "#f6ece8", bg2: "#ead9d2", hi: "#b0566a", c2: "#2b1d1d" },
  { id: "papier-dunkel",    d: "papier", name: "Dunkles Papier",  desc: "dunkel, Creme, Kupfer",       bg1: "#262421", bg2: "#1b1a18", hi: "#d6925e", c2: "#eee8dc" },
  { id: "stein-sand",   d: "stein", name: "Sand",       desc: "Sand, Ton, Salbei",          bg1: "#f7f3ed", bg2: "#b8a48c", hi: "#8a9a78", c2: "#efdccb" },
  { id: "stein-salbei", d: "stein", name: "Salbei",     desc: "Salbeigrün, Hafer",          bg1: "#f5f7f2", bg2: "#7f9277", hi: "#5e7357", c2: "#efe3d6" },
  { id: "stein-ton",    d: "stein", name: "Ton & Rosé", desc: "Terrakotta, Rosé, Flieder",  bg1: "#fbf6f3", bg2: "#c29285", hi: "#b2766a", c2: "#e7e1ec" },
  { id: "stein-abend",  d: "stein", name: "Abend",      desc: "dunkel, warmes Braun",       bg1: "#332f2a", bg2: "#8c7660", hi: "#a9b58f", c2: "#3d3530" },
  { id: "tinte-nachtblau", d: "tinte", name: "Nachtblau & Gold",  desc: "tiefes Blau, Creme, Gold", bg1: "#1b2d48", bg2: "#0f1b2d", hi: "#c9a96e", c2: "#ece4d4" },
  { id: "tinte-tanne",     d: "tinte", name: "Tanne & Kupfer",    desc: "Tannengrün, Kupfer",       bg1: "#1b3a30", bg2: "#0f1f1a", hi: "#d4915e", c2: "#ebe5d8" },
  { id: "tinte-aubergine", d: "tinte", name: "Aubergine & Rosé",  desc: "Aubergine, Altrosa",       bg1: "#36223f", bg2: "#1d1422", hi: "#e0a3a9", c2: "#f1e6e8" },
  { id: "tinte-creme",     d: "tinte", name: "Creme & Tinte",     desc: "hell, Tintenblau, Ocker",  bg1: "#f8f5ee", bg2: "#e7dfcf", hi: "#9a6f2e", c2: "#14233a" },
  { id: "bento-pastell", d: "bento", name: "Pastell", desc: "Mint, Rosa, Flieder, Butter", bg1: "#c9e8d4", bg2: "#d9d2fb", hi: "#1b1b1a", c2: "#ffe7a6" },
  { id: "bento-erde",    d: "bento", name: "Erde",    desc: "Oliv, Terrakotta, Sand",      bg1: "#dfe2c8", bg2: "#f0cdb8", hi: "#2a221c", c2: "#f3dfae" },
  { id: "bento-kuehl",   d: "bento", name: "Kühl",    desc: "Eisblau, Mint, Lavendel",     bg1: "#cde8e6", bg2: "#dbe1f7", hi: "#1d2a3a", c2: "#d6ecf6" },
  { id: "bento-dunkel",  d: "bento", name: "Dunkel",  desc: "fast schwarz, kräftige Kacheln", bg1: "#1e2024", bg2: "#8fc4a5", hi: "#ffd66b", c2: "#a99fdb" },
  { id: "beton-signal", d: "beton", name: "Signal", desc: "Orange, Mint, Lila, Gelb",   bg1: "#ff5c39", bg2: "#7cf0c0", hi: "#000", c2: "#ffe14d" },
  { id: "beton-pink",   d: "beton", name: "Pink",   desc: "Pink, Himmelblau, Limette",  bg1: "#ff4fa0", bg2: "#9ad8ff", hi: "#000", c2: "#b4f06c" },
  { id: "beton-nacht",  d: "beton", name: "Nacht",  desc: "dunkel mit hellen Rahmen",   bg1: "#141414", bg2: "#ff5c39", hi: "#ffe14d", c2: "#7cf0c0" },
  { id: "bauhaus-klassisch", d: "bauhaus", name: "Klassisch", desc: "Rot, Gelb, Blau auf Creme", bg1: "#efe7d6", bg2: "#1f4e9c", hi: "#e63b2e", c2: "#f2b705" },
  { id: "bauhaus-pastell",   d: "bauhaus", name: "Pastell",   desc: "dieselben Farben, sanfter",  bg1: "#f3ede2", bg2: "#6f93c4", hi: "#e2826f", c2: "#f1c96a" },
  { id: "bauhaus-nacht",     d: "bauhaus", name: "Nacht",     desc: "Primärfarben auf Schwarz",   bg1: "#151515", bg2: "#2d63c4", hi: "#e63b2e", c2: "#f2b705" },
  { id: "terminal-gruen",     d: "terminal", name: "Grün",      desc: "klassischer grüner Bildschirm", bg1: "#050a06", bg2: "#0b1a0e", hi: "#5dff8f", c2: "#2fae5b" },
  { id: "terminal-bernstein", d: "terminal", name: "Bernstein", desc: "warmes Orange",                bg1: "#0d0800", bg2: "#1a1000", hi: "#ffb000", c2: "#a87400" },
  { id: "terminal-eis",       d: "terminal", name: "Eis",       desc: "kühles Hellblau",              bg1: "#020812", bg2: "#081a2c", hi: "#7fd4ff", c2: "#3d82a8" },
];
// Hintergrundfarbe des Handys (Statusleiste) je Farbe
const PAGE_BG = { "papier-klassisch": "#f4f0e8", "papier-salbei": "#eceee6", "papier-rose": "#f6ece8", "papier-dunkel": "#1b1a18",
  "stein-sand": "#ece6dd", "stein-salbei": "#e5e9e1", "stein-ton": "#f1e7e3", "stein-abend": "#26231f",
  "tinte-nachtblau": "#0f1b2d", "tinte-tanne": "#0f1f1a", "tinte-aubergine": "#1d1422", "tinte-creme": "#f3efe6",
  "bento-pastell": "#efefec", "bento-erde": "#efe9e1", "bento-kuehl": "#eceff2", "bento-dunkel": "#111214",
  "beton-signal": "#f1ede4", "beton-pink": "#fde8f1", "beton-nacht": "#141414",
  "bauhaus-klassisch": "#efe7d6", "bauhaus-pastell": "#f3ede2", "bauhaus-nacht": "#151515",
  "terminal-gruen": "#050a06", "terminal-bernstein": "#0d0800", "terminal-eis": "#020812" };
const DEFAULT_THEME = "moos";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

function loadTheme() {
  const id = store.get("theme") || DEFAULT_THEME;
  return THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME;
}

function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  const h = document.documentElement;
  if (h.dataset.design !== t.d) {
    const fonts = window.TB_FONTS && window.TB_FONTS[t.d];
    if (fonts) document.getElementById("font-link").href = `https://fonts.googleapis.com/css2?family=${fonts}&display=swap`;
  }
  h.dataset.design = t.d;
  h.dataset.theme = t.id;
  document.querySelector('meta[name="theme-color"]').content = PAGE_BG[t.id] || t.bg2;
  store.set("theme", t.id);
  store.set("theme-" + t.d, t.id); // letzte Farbe je Design merken
}

function buildThemeList() {
  const dList = document.getElementById("design-list");
  const list = document.getElementById("theme-list");
  const draw = () => {
    const cur = THEMES.find((t) => t.id === loadTheme());
    dList.innerHTML = DESIGNS.map((d) => {
      const first = THEMES.find((t) => t.d === d.id);
      return `
      <label class="theme-opt">
        <input type="radio" name="design" value="${d.id}" ${d.id === cur.d ? "checked" : ""}>
        <span class="swatch design-sw" style="--sw-bg1:${first.bg1};--sw-bg2:${first.bg2};--sw-hi:${first.hi};--sw-c2:${first.c2};--sw-r:${d.radius}px;--sw-font:'${d.font}'">Aa</span>
        <span><strong>${d.name}</strong><span class="muted small">${d.desc}</span></span>
        <span class="check">✓</span>
      </label>`;
    }).join("");
    list.innerHTML = THEMES.filter((t) => t.d === cur.d).map((t) => `
      <label class="theme-opt">
        <input type="radio" name="theme" value="${t.id}" ${t.id === cur.id ? "checked" : ""}>
        <span class="swatch" style="--sw-bg1:${t.bg1};--sw-bg2:${t.bg2};--sw-hi:${t.hi};--sw-c2:${t.c2}"></span>
        <span><strong>${t.name}</strong><span class="muted small">${t.desc}</span></span>
        <span class="check">✓</span>
      </label>`).join("");
  };
  dList.addEventListener("change", (e) => {
    const d = e.target.value;
    const last = store.get("theme-" + d);
    applyTheme(THEMES.some((t) => t.id === last && t.d === d) ? last : THEMES.find((t) => t.d === d).id);
    draw();
  });
  list.addEventListener("change", (e) => { applyTheme(e.target.value); draw(); });
  draw();
}

applyTheme(loadTheme());
buildThemeList();

const settings = document.getElementById("settings");
document.getElementById("open-settings").addEventListener("click", () => settings.showModal());
settings.addEventListener("click", (e) => { if (e.target === settings) settings.close(); });

// ---------- Bereiche ----------
function gruss() {
  const h = new Date().getHours();
  return (h < 5 ? "Gute Nacht" : h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend") + ", Aurora";
}
function showView() {
  const name = location.hash.replace("#", "") || "heute";
  const view = TITLES[name] ? name : "heute";

  document.documentElement.dataset.page = view;
  document.querySelectorAll(".view").forEach((el) => {
    el.hidden = el.dataset.view !== view;
  });
  document.querySelectorAll(".tabbar a").forEach((el) => {
    el.classList.toggle("active", el.dataset.tab === view);
  });
  document.getElementById("title").textContent = view === "heute" ? gruss() : TITLES[view];
  window.scrollTo(0, 0);
}

document.getElementById("subtitle").textContent = new Date().toLocaleDateString("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

window.addEventListener("hashchange", showView);
showView();

// Damit die App installierbar ist und auch ohne Netz startet.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}

// ---------- Bewegter Hintergrund (Wunsch 24.11.) ----------
// Die Formen hinter den Kacheln wandern beim Scrollen langsamer mit als der Inhalt.
// Bei „Bewegung reduzieren“ im Handy bleibt alles still (CSS).
(() => {
  const root = document.documentElement;
  let ticking = false;
  const set = () => { root.style.setProperty("--sy", String(Math.round(window.scrollY))); ticking = false; };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(set); } }, { passive: true });
  set();
})();
