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
// Die Farbe heißt „design-name“ (z. B. "papier-salbei"). styles.css enthält nur noch die Grundwerte.
const DESIGNS = [
  { id: "papier", name: "Papier", desc: "Ruhig und edel wie ein Magazin, feine Linien", font: "Newsreader", radius: 2 },
  { id: "beton",  name: "Beton",  desc: "Roh und laut, dicke Rahmen, Signalfarben", font: "Space Grotesk", radius: 0 },
  { id: "bauhaus", name: "Bauhaus", desc: "Große Formen in Rot, Gelb und Blau", font: "Syne", radius: 0 },
  { id: "terminal", name: "Terminal", desc: "Leuchtschrift wie ein alter Computer", font: "VT323", radius: 0 },
  { id: "kreide",   name: "Kreide",   desc: "Boulderhalle: Wand, Kreide, Routen-Tape", font: "Archivo", radius: 10 },
  { id: "kaugummi", name: "Kaugummi", desc: "Sticker in Bonbonfarben, für Teenager", font: "Fredoka", radius: 28 },
  { id: "klartext", name: "Klartext", desc: "Groß und kontrastreich, leicht zu lesen", font: "Atkinson Hyperlegible", radius: 12 },
];
const THEMES = [
  { id: "papier-klassisch", d: "papier", name: "Klassisch",       desc: "Papierweiß, Schwarz, Rostrot", bg1: "#f4f0e8", bg2: "#e4ddd0", hi: "#a4442a", c2: "#1c1a17" },
  { id: "papier-salbei",    d: "papier", name: "Leinen & Salbei", desc: "Leinen, Tannengrün",          bg1: "#eceee6", bg2: "#dde1d5", hi: "#4f7357", c2: "#1f2a24" },
  { id: "papier-rose",      d: "papier", name: "Rosé",            desc: "zartes Rosé, Beere",          bg1: "#f6ece8", bg2: "#ead9d2", hi: "#b0566a", c2: "#2b1d1d" },
  { id: "papier-dunkel",    d: "papier", name: "Dunkles Papier",  desc: "dunkel, Creme, Kupfer",       bg1: "#262421", bg2: "#1b1a18", hi: "#d6925e", c2: "#eee8dc" },
  { id: "beton-signal", d: "beton", name: "Signal", desc: "Orange, Mint, Lila, Gelb",   bg1: "#ff5c39", bg2: "#7cf0c0", hi: "#000", c2: "#ffe14d" },
  { id: "beton-pink",   d: "beton", name: "Pink",   desc: "Pink, Himmelblau, Limette",  bg1: "#ff4fa0", bg2: "#9ad8ff", hi: "#000", c2: "#b4f06c" },
  { id: "beton-nacht",  d: "beton", name: "Nacht",  desc: "dunkel mit hellen Rahmen",   bg1: "#141414", bg2: "#ff5c39", hi: "#ffe14d", c2: "#7cf0c0" },
  { id: "bauhaus-klassisch", d: "bauhaus", name: "Klassisch", desc: "Rot, Gelb, Blau auf Creme", bg1: "#efe7d6", bg2: "#1f4e9c", hi: "#e63b2e", c2: "#f2b705" },
  { id: "bauhaus-pastell",   d: "bauhaus", name: "Pastell",   desc: "dieselben Farben, sanfter",  bg1: "#f3ede2", bg2: "#6f93c4", hi: "#e2826f", c2: "#f1c96a" },
  { id: "bauhaus-nacht",     d: "bauhaus", name: "Nacht",     desc: "Primärfarben auf Schwarz",   bg1: "#151515", bg2: "#2d63c4", hi: "#e63b2e", c2: "#f2b705" },
  { id: "terminal-gruen",     d: "terminal", name: "Grün",      desc: "klassischer grüner Bildschirm", bg1: "#050a06", bg2: "#0b1a0e", hi: "#5dff8f", c2: "#2fae5b" },
  { id: "terminal-bernstein", d: "terminal", name: "Bernstein", desc: "warmes Orange",                bg1: "#0d0800", bg2: "#1a1000", hi: "#ffb000", c2: "#a87400" },
  { id: "terminal-eis",       d: "terminal", name: "Eis",       desc: "kühles Hellblau",              bg1: "#020812", bg2: "#081a2c", hi: "#7fd4ff", c2: "#3d82a8" },
  { id: "kreide-halle", d: "kreide", name: "Halle", desc: "graue Wand, bunte Griffe",   bg1: "#353a40", bg2: "#ff5d8f", hi: "#ffd23f", c2: "#3ddc97" },
  { id: "kreide-fels",  d: "kreide", name: "Fels",  desc: "Sandstein, Rost, Moos",      bg1: "#f3ebdd", bg2: "#3f6e8c", hi: "#b4532a", c2: "#6b7f3a" },
  { id: "kreide-kalk",  d: "kreide", name: "Kalk",  desc: "weiß wie Kreide, klare Tapes", bg1: "#ffffff", bg2: "#e5383b", hi: "#1c4fd6", c2: "#14a44d" },
  { id: "kreide-uv",    d: "kreide", name: "UV",    desc: "Schwarzlicht-Boulderhalle",  bg1: "#1c1836", bg2: "#ff3df5", hi: "#c6ff3d", c2: "#3dfff0" },
  { id: "kaugummi-bubble", d: "kaugummi", name: "Bubble",  desc: "Rosa, Flieder, Minze",   bg1: "#fff7fb", bg2: "#b9a2ff", hi: "#ff4fa3", c2: "#8ff0d8" },
  { id: "kaugummi-limo",   d: "kaugummi", name: "Limo",    desc: "Limette, Zitrone, Himmel", bg1: "#fffff4", bg2: "#ffe25c", hi: "#3fb618", c2: "#7fe3ff" },
  { id: "kaugummi-ozean",  d: "kaugummi", name: "Ozean",   desc: "Aqua, Pfirsich, Lila",   bg1: "#f5fdff", bg2: "#ffd6a5", hi: "#0a84ff", c2: "#c3b5ff" },
  { id: "kaugummi-party",  d: "kaugummi", name: "Party",   desc: "Neon auf Dunkellila",    bg1: "#2a1846", bg2: "#ff4fd8", hi: "#ffe24f", c2: "#4fe3ff" },
  { id: "klartext-hell",     d: "klartext", name: "Hell",     desc: "Schwarz auf Weiß, Dunkelblau", bg1: "#ffffff", bg2: "#000000", hi: "#0b3d91", c2: "#1d6b2f" },
  { id: "klartext-warm",     d: "klartext", name: "Warm",     desc: "Creme, Braun, Tannengrün",     bg1: "#fffaf1", bg2: "#1e1408", hi: "#1f5a3a", c2: "#8a4b0f" },
  { id: "klartext-kontrast", d: "klartext", name: "Kontrast", desc: "Gelb auf Schwarz",             bg1: "#000000", bg2: "#ffffff", hi: "#ffe600", c2: "#5cff8a" },
  { id: "klartext-dunkel",   d: "klartext", name: "Dunkel",   desc: "Weiß auf Dunkelgrau",          bg1: "#262a30", bg2: "#ffffff", hi: "#8cc8ff", c2: "#8fe0a8" },
];
// Hintergrundfarbe des Handys (Statusleiste) je Farbe
const PAGE_BG = { "papier-klassisch": "#f4f0e8", "papier-salbei": "#eceee6", "papier-rose": "#f6ece8", "papier-dunkel": "#1b1a18",
  "beton-signal": "#f1ede4", "beton-pink": "#fde8f1", "beton-nacht": "#141414",
  "bauhaus-klassisch": "#efe7d6", "bauhaus-pastell": "#f3ede2", "bauhaus-nacht": "#151515",
  "terminal-gruen": "#050a06", "terminal-bernstein": "#0d0800", "terminal-eis": "#020812",
  "kreide-halle": "#2a2e33", "kreide-fels": "#e8dcc7", "kreide-kalk": "#f4f4f1", "kreide-uv": "#120f24",
  "kaugummi-bubble": "#ffe3f1", "kaugummi-limo": "#f6ffd6", "kaugummi-ozean": "#dcf7ff", "kaugummi-party": "#1b0f2e",
  "klartext-hell": "#ffffff", "klartext-warm": "#f6efe2", "klartext-kontrast": "#000000", "klartext-dunkel": "#1c1f24" };
const DEFAULT_THEME = "papier-klassisch"; // Glas, Stein, Tinte und Bento sind raus (Wunsch 25.11.)
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

// ⓘ einheitlich (25.11.): runder i-Knopf neben dem Kartentitel, die Erklärung klappt direkt darunter auf
(() => {
  function infoize() {
    document.querySelectorAll("details.z-why:not([data-i]), details.k-why:not([data-i])").forEach((d) => {
      d.dataset.i = "1";
      const card = d.closest(".glass"), title = card && card.querySelector(".c-title"), sum = d.querySelector("summary");
      if (!title || !sum) return;
      const label = sum.textContent.replace("ⓘ", "").trim();
      const b = document.createElement("button");
      b.type = "button"; b.className = "i-btn"; b.textContent = "i";
      b.setAttribute("aria-label", label); b.setAttribute("aria-expanded", String(d.open)); b.classList.toggle("on", d.open);
      b._d = d;
      sum.hidden = true;
      const q = document.createElement("p"); q.className = "i-q"; q.textContent = label; sum.after(q);
      d.classList.add("i-box");
      title.appendChild(b);
      title.after(d);
    });
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".i-btn"); if (!b || !b._d) return;
    b._d.open = !b._d.open; b.classList.toggle("on", b._d.open); b.setAttribute("aria-expanded", String(b._d.open));
  });
  new MutationObserver(infoize).observe(document.body, { childList: true, subtree: true });
  infoize();
})();
