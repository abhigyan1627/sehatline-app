(() => {
  "use strict";

  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const defaultSelectors = [
    ".metric-card", ".quick-action", ".doctor-card", ".lab-card",
    ".appointment-card", ".summary-card", ".analytics-metric",
    ".person-card", ".compact-item", ".timeline-item", ".table-row",
    ".notification-item", ".patient-mobile-card", ".queue-card", ".portal"
  ];
  const numberFormatter = new Intl.NumberFormat("en-IN");

  function canAnimate() {
    return !reducedQuery.matches;
  }

  function restartClass(node, className) {
    if (!node) return;
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  }

  function enhance(root = document, options = {}) {
    if (!root) return;
    const page = root.matches?.(".view, main, #app")
      ? root
      : root.querySelector?.(".view.active, main, #app");
    if (page) restartClass(page, "motion-page-enter");

    const selector = (options.selectors || defaultSelectors).join(",");
    const items = [...root.querySelectorAll(selector)]
      .filter(node => !node.dataset.motionReady)
      .slice(0, options.limit || 36);

    items.forEach((node, index) => {
      node.dataset.motionReady = "true";
      node.dataset.motionItem = "";
      node.style.setProperty("--motion-index", Math.min(index, 8));
    });

    requestAnimationFrame(() => requestAnimationFrame(() => {
      items.forEach(node => node.classList.add("is-motion-visible"));
    }));
  }

  function setLoading(root, loading) {
    if (!root) return;
    if (loading) {
      root.dataset.motionLoading = "true";
      root.setAttribute("aria-busy", "true");
    } else {
      delete root.dataset.motionLoading;
      root.removeAttribute("aria-busy");
    }
  }

  function highlight(node, type = "change") {
    restartClass(node, type === "success" ? "motion-success" : "motion-value-change");
  }

  function shake(node) {
    restartClass(node, "motion-shake");
    node?.focus?.({ preventScroll: true });
  }

  function openModal(root) {
    if (!root) return;
    root.classList.remove("motion-modal-closing");
    restartClass(root, "motion-modal-open");
    enhance(root, { limit: 12 });
  }

  function closeModal(root, cleanup) {
    if (!root || !canAnimate()) {
      cleanup?.();
      return;
    }
    root.classList.remove("motion-modal-open");
    root.classList.add("motion-modal-closing");
    window.setTimeout(() => {
      root.classList.remove("motion-modal-closing");
      cleanup?.();
    }, 150);
  }

  function animateNumber(node, rawValue, options = {}) {
    if (!node) return;
    const source = String(rawValue ?? node.textContent ?? "");
    const numericSource = source.replace(/[^\d.-]/g, "");
    const numeric = Number(numericSource);
    if (!numericSource || !Number.isFinite(numeric) || !canAnimate()) {
      node.textContent = source;
      return;
    }
    const prefix = options.prefix ?? source.match(/^[^\d-]*/)?.[0] ?? "";
    const suffix = options.suffix ?? source.match(/[^\d.,]*$/)?.[0] ?? "";
    const decimals = (source.split(".")[1]?.match(/^\d+/)?.[0] || "").length;
    const duration = Math.min(options.duration || 700, 900);
    const startedAt = performance.now();

    function frame(now) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = numeric * eased;
      const formatted = decimals
        ? value.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
        : numberFormatter.format(Math.round(value));
      node.textContent = `${prefix}${formatted}${suffix}`;
      if (progress < 1) requestAnimationFrame(frame);
      else node.textContent = source;
    }

    requestAnimationFrame(frame);
  }

  function animateNumbers(root = document, selector = "[data-motion-number]") {
    root.querySelectorAll(selector).forEach(node => {
      if (node.dataset.motionCounted) return;
      node.dataset.motionCounted = "true";
      animateNumber(node, node.textContent);
    });
  }

  document.addEventListener("visibilitychange", () => {
    document.body.classList.toggle("motion-page-hidden", document.hidden);
  });

  window.SehatMotion = Object.freeze({
    canAnimate,
    enhance,
    setLoading,
    highlight,
    shake,
    openModal,
    closeModal,
    animateNumber,
    animateNumbers
  });
})();
