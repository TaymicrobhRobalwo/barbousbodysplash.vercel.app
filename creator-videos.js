(function () {
  const labels = ["Talita Baliza", "Gabriela Sou", "Julia", "LOLLA & FELIPE"];

  function findSection() {
    return Array.from(document.querySelectorAll("h2")).find((title) =>
      title.textContent.includes("Vídeos de criadores")
    )?.parentElement;
  }

  function ensureStyles() {
    if (document.getElementById("creator-video-styles")) return;
    const style = document.createElement("style");
    style.id = "creator-video-styles";
    style.textContent = `
      .creator-video-card video{background:#111;display:block;filter:saturate(1.03);}
      .creator-video-card{cursor:pointer;touch-action:manipulation;}
      .creator-video-card:active{transform:scale(.98);}
      .creator-video-modal{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:18px;}
      .creator-video-player{width:min(420px,100%);max-height:86vh;border-radius:16px;background:#000;box-shadow:0 20px 70px rgba(0,0,0,.55);}
      .creator-video-close{position:fixed;top:14px;right:14px;width:42px;height:42px;border:0;border-radius:999px;background:rgba(255,255,255,.14);color:#fff;font-size:28px;line-height:1;z-index:10000;}
    `;
    document.head.appendChild(style);
  }

  function normalizeSrc(src) {
    return src.replace(location.origin + "/", "");
  }

  function openPlayer(src, label) {
    document.querySelector(".creator-video-modal")?.remove();

    const modal = document.createElement("div");
    modal.className = "creator-video-modal";
    modal.innerHTML = `
      <button class="creator-video-close" type="button" aria-label="Fechar">×</button>
      <video class="creator-video-player" src="${normalizeSrc(src).replace(/"/g, "&quot;")}" controls autoplay playsinline preload="auto" aria-label="${label.replace(/"/g, "&quot;")}"></video>
    `;
    document.body.appendChild(modal);

    const player = modal.querySelector("video");
    player.muted = false;
    player.play().catch(() => {
      player.muted = true;
      player.play().catch(() => {});
    });

    function close() {
      player.pause();
      modal.remove();
    }

    modal.querySelector("button").addEventListener("click", close);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close();
    });
    document.addEventListener("keydown", function onKey(event) {
      if (event.key === "Escape") {
        document.removeEventListener("keydown", onKey);
        close();
      }
    });
  }

  function hydrateVideos() {
    const section = findSection();
    if (!section || section.dataset.creatorVideosReady === "true") return;

    const videos = Array.from(section.querySelectorAll("button video"));
    if (!videos.length) return;

    ensureStyles();
    section.dataset.creatorVideosReady = "true";

    videos.forEach((video, index) => {
      const card = video.closest("button");
      const label = labels[index] || `Vídeo ${index + 1}`;
      const src = video.getAttribute("src") || video.currentSrc;

      card.classList.add("creator-video-card");
      card.type = "button";
      card.setAttribute("aria-label", `Assistir vídeo de ${label}`);

      video.dataset.creatorVideo = "true";
      video.muted = true;
      video.loop = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = "auto";
      video.controls = false;

      const tryPreview = () => {
        video.play().catch(() => {});
      };

      video.addEventListener("loadeddata", tryPreview, { once: true });
      video.addEventListener("canplay", tryPreview, { once: true });
      tryPreview();

      card.addEventListener("click", (event) => {
        event.preventDefault();
        openPlayer(src, label);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hydrateVideos);
  } else {
    hydrateVideos();
  }

  setTimeout(hydrateVideos, 600);
  setTimeout(hydrateVideos, 1600);
})();
