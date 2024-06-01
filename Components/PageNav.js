class PageNav extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `    
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
        <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz" crossorigin="anonymous"></script>
        <link rel="stylesheet" href="../css/style.css">
        `;
    
        shadow.appendChild(this.build());
  }

  build() {
    // const docRoot = Document.document;
    const theme = this.getAttribute("theme");

    const pageIndex = this.getAttribute("current-page");

    const navRoot = document.createElement("header");
    navRoot.setAttribute("data-bs-theme", theme);


    navRoot.innerHTML += `
      <nav class="navbar navbar-expand sticky-top justify-content-center bg-body-tertiary">
      <div class="container-fluid flex-wrap row gy-3 px-3 py-3">
        <div class="d-flex col-12 col-md-3 justify-content-center justify-content-md-start">
          <a class="navbar-brand m-0 p-0" href="index.html">
            <div class="studio-logo">
              <img src="img/codeit_logo_${theme == "dark" ? "white" : "black"}_512.png" alt="CodeIt Logo"
                class="studio-logo d-inline-block align-text-top">
            </div>
          </a>
        </div>

        <div
          class="navbar-nav col-12 col-md-6 align-items-center justify-content-around justify-content-md-center px-0">
          <a class="nav-link border-bottom ${pageIndex == 0 ? "border-primary" : `border-${theme}`}" href="index.html">Home</a>
          <a class="nav-link border-bottom ${pageIndex == 1 ? "border-primary" : `border-${theme}`}" href="cars.html">Conteúdo</a>
          <a class="nav-link border-bottom ${pageIndex == 2 ? "border-primary" : `border-${theme}`}"
            href="https://www.central-mods.com.br/search/label/Baixos%20de%20Quebrada?&max-results=7">Blog</a>
          <a class="nav-link border-bottom ${pageIndex == 3 ? "border-primary" : `border-${theme}`}" href="privacy.html">Privacidade</a>
        </div>

        <div class="navbar-nav col-12 col-md-3 align-items-center justify-content-around row-cols-3 gap-3 px-3">
          <a class="btn btn-light btn col-5" href="#">Steam</a>
          <a class="btn btn-success btn col-7" href="https://store.steampowered.com/app/2408060/Low_and_Furious/">+
            Lista de desejo</a>
        </div>
      </div>
    </nav>
      `;
    return navRoot;
  }
}

customElements.define("page-nav", PageNav)