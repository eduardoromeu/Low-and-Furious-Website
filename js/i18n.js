/**
 * Site-wide PT/EN language switcher.
 * Uses .lang-pt / .lang-en (+ .show) and persists in localStorage.
 */
(function () {
  const STORAGE_KEY = "laf-site-lang";

  function getStoredLang() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "pt" || stored === "en") return stored;
    } catch (_) { /* ignore */ }
    const nav = (navigator.language || "pt").toLowerCase();
    return nav.startsWith("en") ? "en" : "pt";
  }

  function applyInRoot(root, lang) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll(".lang-pt").forEach((el) => {
      el.classList.toggle("show", lang === "pt");
    });
    root.querySelectorAll(".lang-en").forEach((el) => {
      el.classList.toggle("show", lang === "en");
    });
    root.querySelectorAll(".lang-switch button").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.lang === lang);
    });
  }

  function toggleLanguage(lang) {
    if (lang !== "pt" && lang !== "en") lang = "pt";

    applyInRoot(document, lang);

    document.querySelectorAll("page-nav").forEach((nav) => {
      if (typeof nav.applyLanguage === "function") nav.applyLanguage(lang);
      else if (nav.shadowRoot) applyInRoot(nav.shadowRoot, lang);
    });

    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
    document.documentElement.setAttribute("data-lang", lang);

    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) { /* ignore */ }

    window.dispatchEvent(new CustomEvent("laf:langchange", { detail: { lang } }));
  }

  function initLanguage() {
    toggleLanguage(getStoredLang());
  }

  window.toggleLanguage = toggleLanguage;
  window.initLanguage = initLanguage;
  window.getLafLang = getStoredLang;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLanguage);
  } else {
    initLanguage();
  }
})();
