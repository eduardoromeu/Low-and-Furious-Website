const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

function syncTooltipTitles(lang) {
  tooltipTriggerList.forEach((el, i) => {
    const title = el.getAttribute(lang === "en" ? "data-bs-title-en" : "data-bs-title-pt");
    if (!title || !tooltipList[i]) return;
    el.setAttribute("data-bs-title", title);
    tooltipList[i].setContent({ ".tooltip-inner": title });
  });
}

window.addEventListener("laf:langchange", (e) => syncTooltipTitles(e.detail.lang));
if (typeof window.getLafLang === "function") syncTooltipTitles(window.getLafLang());

const gameplayVideo = document.querySelector("#gameplay-bg");
const volumeIcon = document.querySelector(".sound-img");

const ToggleVideoMute = () => {
    if (!gameplayVideo || !volumeIcon) return;
    gameplayVideo.muted = !gameplayVideo.muted;
    
    if(gameplayVideo.muted) {
        volumeIcon.classList.remove("mute-off");
        volumeIcon.classList.add("mute-on");
    } else {
        volumeIcon.classList.remove("mute-on");
        volumeIcon.classList.add("mute-off");
    }
}

