// Trainingsbuch – App-Hülle
// Wechselt zwischen den Bereichen über die Adresse (#heute, #training …).

const TITLES = {
  heute: "Heute",
  training: "Training",
  ernaehrung: "Ernährung",
  zyklus: "Zyklus",
  befinden: "Befinden",
};

function showView() {
  const name = location.hash.replace("#", "") || "heute";
  const view = TITLES[name] ? name : "heute";

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
