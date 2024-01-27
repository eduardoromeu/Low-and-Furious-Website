const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));

const gameplayVideo = document.querySelector("#gameplay-bg");
const volumeIcon = document.querySelector(".sound-img");

const ToggleVideoMute = () => {
    gameplayVideo.muted = !gameplayVideo.muted;
    
    if(gameplayVideo.muted) {
        volumeIcon.classList.remove("mute-off");
        volumeIcon.classList.add("mute-on");
    } else {
        volumeIcon.classList.remove("mute-on");
        volumeIcon.classList.add("mute-off");
    }
}
