(function initializeSehatLineInstallExperience() {
  "use strict";

  const config = {
    id: document.body.dataset.pwaId || "sehatline",
    name: document.body.dataset.pwaName || "SehatLine",
    icon: document.body.dataset.pwaIcon || "/assets/logos/sehatline-care-mark-animated.svg?v=2"
  };
  const standaloneQuery = window.matchMedia("(display-mode: standalone)");
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isAndroid = /android/i.test(navigator.userAgent);
  const dismissedKey = `sehatline-pwa-${config.id}-dismissed`;
  let deferredInstallPrompt = null;

  const isStandalone = () => standaloneQuery.matches || navigator.standalone === true;
  if (isStandalone()) {
    document.documentElement.classList.add("pwa-standalone");
    return;
  }

  const root = document.createElement("div");
  root.className = "pwa-install-ui";
  root.innerHTML = `
    <aside class="pwa-install-card" id="pwaInstallCard" aria-label="Install ${config.name}" hidden>
      <img class="pwa-install-icon" src="${config.icon}" alt="">
      <div class="pwa-install-copy">
        <strong>Add ${config.name} to your Home Screen</strong>
        <span>Open faster in a full-screen app experience.</span>
      </div>
      <button class="pwa-install-primary" id="pwaInstallPrimary" type="button">Install</button>
      <button class="pwa-install-dismiss" id="pwaInstallDismiss" type="button" aria-label="Dismiss install suggestion">×</button>
    </aside>
    <button class="pwa-install-launcher" id="pwaInstallLauncher" type="button" aria-label="Install ${config.name}">
      <span aria-hidden="true">↓</span> Install app
    </button>
    <div class="pwa-install-backdrop" id="pwaInstallBackdrop" hidden>
      <section class="pwa-install-guide" role="dialog" aria-modal="true" aria-labelledby="pwaInstallTitle">
        <button class="pwa-guide-close" id="pwaGuideClose" type="button" aria-label="Close installation guide">×</button>
        <img class="pwa-guide-icon" src="${config.icon}" alt="">
        <span class="pwa-guide-kicker">INSTALL WEB APP</span>
        <h2 id="pwaInstallTitle">Add ${config.name} to your Home Screen</h2>
        <ol id="pwaInstallSteps"></ol>
        <p>After installation it opens like a normal app and remains available from your Home Screen.</p>
      </section>
    </div>`;
  document.body.appendChild(root);

  const card = root.querySelector("#pwaInstallCard");
  const launcher = root.querySelector("#pwaInstallLauncher");
  const primary = root.querySelector("#pwaInstallPrimary");
  const dismiss = root.querySelector("#pwaInstallDismiss");
  const backdrop = root.querySelector("#pwaInstallBackdrop");
  const closeGuide = root.querySelector("#pwaGuideClose");
  const steps = root.querySelector("#pwaInstallSteps");

  function setInstallSteps() {
    const instructions = isIos
      ? ["Open this page in Safari.", "Tap the Share button in the browser toolbar.", "Choose ‘Add to Home Screen’, then tap ‘Add’. "]
      : isAndroid
        ? ["Open the browser menu (⋮).", "Choose ‘Install app’ or ‘Add to Home screen’. ", "Confirm by tapping ‘Install’ or ‘Add’. "]
        : ["Open your browser menu or the install icon in the address bar.", `Choose ‘Install ${config.name}’.`, "Confirm the installation."];
    steps.innerHTML = instructions.map((instruction, index) => `<li><b>${index + 1}</b><span>${instruction}</span></li>`).join("");
  }

  function showGuide() {
    setInstallSteps();
    backdrop.hidden = false;
    document.body.classList.add("pwa-guide-open");
    closeGuide.focus();
  }

  function hideGuide() {
    backdrop.hidden = true;
    document.body.classList.remove("pwa-guide-open");
    launcher.focus();
  }

  function showInstallOption({ suggest = false } = {}) {
    if (isStandalone()) return;
    launcher.hidden = false;
    const dismissedAt = Number(localStorage.getItem(dismissedKey) || 0);
    const dismissedRecently = Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000;
    if (suggest && !dismissedRecently) card.hidden = false;
  }

  async function requestInstall() {
    if (!deferredInstallPrompt) {
      showGuide();
      return;
    }
    primary.disabled = true;
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === "accepted") {
        card.hidden = true;
        launcher.hidden = true;
      }
    } finally {
      deferredInstallPrompt = null;
      primary.disabled = false;
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    primary.textContent = "Install";
    showInstallOption({ suggest: true });
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    root.hidden = true;
    localStorage.removeItem(dismissedKey);
    document.documentElement.classList.add("pwa-standalone");
  });

  standaloneQuery.addEventListener?.("change", event => {
    if (event.matches) root.hidden = true;
  });

  primary.addEventListener("click", requestInstall);
  launcher.addEventListener("click", requestInstall);
  dismiss.addEventListener("click", () => {
    card.hidden = true;
    localStorage.setItem(dismissedKey, String(Date.now()));
  });
  closeGuide.addEventListener("click", hideGuide);
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) hideGuide();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !backdrop.hidden) hideGuide();
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }

  launcher.hidden = false;
  if (isIos) window.setTimeout(() => showInstallOption({ suggest: true }), 900);
})();
