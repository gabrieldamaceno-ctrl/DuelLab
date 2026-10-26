/* DuelLab: carregamento automático das imagens das cartas no construtor.
   Fonte dos dados: API pública YGOPRODeck. As imagens são carregadas sob demanda. */
(() => {
  const API = "https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=";
  const cache = new Map();
  const pending = [];
  let active = 0;
  const MAX_ACTIVE = 3;

  function processQueue() {
    while (active < MAX_ACTIVE && pending.length) {
      const job = pending.shift();
      active++;
      job().finally(() => { active--; processQueue(); });
    }
  }

  function lookupCard(name) {
    const key = String(name || "").trim().toLowerCase();
    if (!key) return Promise.resolve(null);
    if (cache.has(key)) return cache.get(key);
    const promise = new Promise(resolve => {
      pending.push(async () => {
        try {
          const response = await fetch(API + encodeURIComponent(name.trim()));
          if (!response.ok) throw new Error("Carta não encontrada");
          const json = await response.json();
          const cards = Array.isArray(json.data) ? json.data : [];
          const exact = cards.find(card => String(card.name || "").toLowerCase() === key) || cards[0];
          resolve(exact || null);
        } catch (_) {
          resolve(null);
        }
      });
      processQueue();
    });
    cache.set(key, promise);
    return promise;
  }

  function ensureImage(cardElement) {
    if (!cardElement || cardElement.dataset.imageLookup === "done") return;
    const nameElement = cardElement.querySelector(".bname");
    if (!nameElement) return;
    const name = (nameElement.textContent || "").trim();
    if (!name) return;
    cardElement.dataset.imageLookup = "done";

    lookupCard(name).then(data => {
      if (!cardElement.isConnected) return;
      const image = data?.card_images?.[0]?.image_url_small || data?.card_images?.[0]?.image_url;
      if (!image) return;

      let img = cardElement.querySelector("img");
      if (!img) {
        const placeholder = cardElement.querySelector(".duellab-no-image");
        img = document.createElement("img");
        img.loading = "lazy";
        img.alt = name;
        img.style.cssText = "width:100%;aspect-ratio:.72;object-fit:contain;background:#0b1020;border-radius:5px;";
        if (placeholder) placeholder.replaceWith(img);
        else cardElement.insertBefore(img, nameElement);
      }
      img.src = image;
      img.alt = name;
      img.onerror = () => { img.style.display = "none"; };
    });
  }

  function scanBuilder() {
    document.querySelectorAll("#builderSections .builder-card").forEach(ensureImage);
    document.querySelectorAll("#builderSections .builder-card > div[style*='aspect-ratio']").forEach(el => {
      el.classList.add("duellab-no-image");
    });
  }

  function start() {
    const host = document.getElementById("builderSections");
    if (!host) return;
    scanBuilder();
    new MutationObserver(scanBuilder).observe(host, { childList: true, subtree: true });
    const nav = document.querySelectorAll('[data-view="builder"], [data-goto="builder"]');
    nav.forEach(el => el.addEventListener("click", () => setTimeout(scanBuilder, 100)));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();