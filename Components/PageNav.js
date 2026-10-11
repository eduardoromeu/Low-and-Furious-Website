class PageNav extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
        <link href="css/laf-theme.css" rel="stylesheet">
        <style>
          :host { display: block; }
          nav.laf-nav {
            background: #212121 !important;
            border-bottom: 2px solid #e63946;
          }
          .laf-nav .nav-link {
            color: #e0e0e0 !important;
            border-bottom-width: 2px !important;
            transition: color 0.15s, border-color 0.15s;
          }
          .laf-nav .nav-link:hover { color: #ffd700 !important; }
          .laf-nav .nav-link.active-link {
            color: #fff !important;
            border-color: #ffd700 !important;
          }
          .laf-nav .btn-wish {
            background: #0d9f25;
            border: none;
            color: #fff;
            font-weight: 700;
          }
          .laf-nav .btn-wish:hover { background: #0b861f; color: #fff; }
          .laf-nav .btn-android {
            background: #323232;
            border: 1px solid #7d7d7d;
            color: #fff;
          }
          .laf-nav .btn-android:hover {
            border-color: #ffd700;
            color: #ffd700;
          }
          .studio-logo { width: 128px; height: 64px; }
          .studio-logo img { max-width: 100%; }
          .nav-lang-wrap {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
          }
          .lang-switch {
            margin: 0;
            flex-shrink: 0;
          }
        </style>
        `;

    shadow.appendChild(this.build());
    this._bindLangButtons();

    // Re-apply after i18n loads / language changes
    window.addEventListener("laf:langchange", (e) => {
      this.applyLanguage(e.detail.lang);
    });

    // If i18n already ran before this component upgraded
    if (typeof window.getLafLang === "function") {
      this.applyLanguage(window.getLafLang());
    }
  }

  applyLanguage(lang) {
    const root = this.shadowRoot;
    if (!root) return;
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

  _bindLangButtons() {
    this.shadowRoot.querySelectorAll(".lang-switch button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (typeof window.toggleLanguage === "function") {
          window.toggleLanguage(btn.dataset.lang);
        }
      });
    });
  }

  build() {
    const pageIndex = this.getAttribute("current-page");

    const navRoot = document.createElement("header");
    navRoot.setAttribute("data-bs-theme", "dark");

    const linkClass = (idx) =>
      `nav-link border-bottom ${pageIndex == idx ? "active-link border-warning" : "border-secondary"}`;

    navRoot.innerHTML += `
      <nav class="navbar navbar-expand sticky-top justify-content-center laf-nav">
      <div class="container-fluid flex-wrap row gy-3 px-3 py-3">
        <div class="d-flex col-12 col-md-3 justify-content-center justify-content-md-start">
          <a class="navbar-brand m-0 p-0" href="index.html">
            <div class="studio-logo h-25">
              <img src="img/codeit_logo_white_128.png" alt="CodeIt Logo"
                class="studio-logo d-inline-block align-text-top">
            </div>
          </a>
        </div>

        <div
          class="navbar-nav col-12 col-md-6 align-items-center justify-content-around justify-content-md-center px-0">
          <a class="${linkClass(0)}" href="index.html"><span class="lang-pt">Início</span><span class="lang-en">Home</span></a>
          <a class="${linkClass(1)}" href="cars.html"><span class="lang-pt">Conteúdo</span><span class="lang-en">Content</span></a>
          <a class="${linkClass(5)}" href="carros.html"><span class="lang-pt">Carros</span><span class="lang-en">Cars</span></a>
          <a class="${linkClass(2)}"
            href="https://www.central-mods.com.br/search/label/Baixos%20de%20Quebrada?&max-results=7">Blog</a>
          <a class="${linkClass(3)}" href="privacy.html"><span class="lang-pt">Privacidade</span><span class="lang-en">Privacy</span></a>
          <a class="${linkClass(4)}" href="manual.html"><span class="lang-pt">Manual</span><span class="lang-en">Manual</span></a>
        </div>

        <div class="navbar-nav col-12 col-md-3 nav-lang-wrap px-3">
          <div class="lang-switch" role="group" aria-label="Language">
            <button type="button" data-lang="pt">PT</button>
            <button type="button" data-lang="en">EN</button>
          </div>
          <a class="btn btn-android btn" href="https://eduardoromeu.github.io/SiteBaixosDeQuebrada/">Android</a>
          <a class="btn btn-wish btn" href="https://store.steampowered.com/app/2408060/Low_and_Furious/">
            <span class="lang-pt">Jogar na Steam</span><span class="lang-en">Play on Steam</span>
          </a>
        </div>
      </div>
    </nav>
      `;
    return navRoot;
  }
}

customElements.define("page-nav", PageNav);
