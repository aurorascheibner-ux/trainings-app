// Trainingsbuch – App-Hülle
// Wechselt zwischen den Bereichen über die Adresse (#heute, #training …).

const TITLES = {
  heute: "Heute",
  training: "Training",
  ernaehrung: "Ernährung",
  zyklus: "Zyklus",
  befinden: "Befinden",
};

// ---------- Optik (Farbkonzepte) ----------
// Farben stehen in styles.css; hier nur Name, Beschreibung und Vorschaufarben.
const THEMES = [
  { id: "moos",     name: "Moos & Bernstein",     desc: "mattes Olivgrün, Amber",   bg1: "#3f4430", bg2: "#2c3022", hi: "#e3a04a", c2: "#b9c48e" },
  { id: "tiefsee",  name: "Tiefsee & Messing",    desc: "Nachtblau, Messinggold",   bg1: "#24344a", bg2: "#172233", hi: "#d1ad6e", c2: "#9fbcd3" },
  { id: "salbei",   name: "Salbei & Terrakotta",  desc: "Salbeigrün, Terrakotta",   bg1: "#5a6a57", bg2: "#3d4a3d", hi: "#e09a74", c2: "#efd3a8" },
  { id: "petrol",   name: "Petrol & Pfirsich",    desc: "tiefes Petrol, Pfirsich",  bg1: "#24474a", bg2: "#163033", hi: "#f0ad8a", c2: "#a7d3c3" },
  { id: "schiefer", name: "Schiefer & Lavendel",  desc: "Schieferblau, Flieder",    bg1: "#3b4659", bg2: "#262e3d", hi: "#bfa9de", c2: "#dba3b1" },
];
const DEFAULT_THEME = "moos";

function loadTheme() {
  try { return localStorage.getItem("theme") || DEFAULT_THEME; } catch { return DEFAULT_THEME; }
}

function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  document.documentElement.dataset.theme = t.id;
  document.querySelector('meta[name="theme-color"]').content = t.bg1;
  try { localStorage.setItem("theme", t.id); } catch {}
}

function buildThemeList() {
  const list = document.getElementById("theme-list");
  const current = loadTheme();
  list.innerHTML = THEMES.map((t) => `
    <label class="theme-opt">
      <input type="radio" name="theme" value="${t.id}" ${t.id === current ? "checked" : ""}>
      <span class="swatch" style="--sw-bg1:${t.bg1};--sw-bg2:${t.bg2};--sw-hi:${t.hi};--sw-c2:${t.c2}"></span>
      <span><strong>${t.name}</strong><span class="muted small">${t.desc}</span></span>
      <span class="check">✓</span>
    </label>`).join("");
  list.addEventListener("change", (e) => applyTheme(e.target.value));
}

applyTheme(loadTheme());
buildThemeList();

const settings = document.getElementById("settings");
document.getElementById("open-settings").addEventListener("click", () => settings.showModal());
settings.addEventListener("click", (e) => { if (e.target === settings) settings.close(); });

// ---------- Bereiche ----------
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
  document.getElementById("title").textContent = TITLES[view];
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
