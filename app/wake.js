// Mantém a tela acesa durante a leitura (opção "keepAwake", ligada por padrão).
// 1) Wake Lock API (Chrome, Edge, Firefox, Safari 16.4+); 2) reserva: vídeo mudo em repetição, para navegadores sem a API.
const Wake = (() => {
  let want = true, forced = false, lock = null, video = null;
  const SILENT = "data:video/mp4;base64,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";

  async function acquire() {
    if (!(want || forced) || document.visibilityState !== "visible") return;
    if (navigator.wakeLock && navigator.wakeLock.request) {
      if (lock) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        lock.addEventListener("release", () => { lock = null; });
      } catch (e) { lock = null; }   // recusado (bateria baixa, aba oculta): tenta de novo no próximo toque
    } else {
      if (!video) {
        video = document.createElement("video");
        video.setAttribute("playsinline", ""); video.muted = true; video.loop = true;
        video.setAttribute("aria-hidden", "true"); video.tabIndex = -1;
        video.style.cssText = "position:fixed;width:1px;height:1px;opacity:.01;pointer-events:none;left:0;bottom:0";
        video.src = SILENT; document.body.appendChild(video);
      }
      try { await video.play(); } catch (e) { /* precisa de um toque do usuário */ }
    }
  }
  function release() {
    if (lock) { try { lock.release(); } catch (e) {} lock = null; }
    if (video) { try { video.pause(); } catch (e) {} }
  }
  function apply() { (want || forced) ? acquire() : release(); }
  // a narração segura a tela acesa mesmo com a opção desligada (no iPhone a voz para quando a tela apaga)
  function hold(on) { forced = !!on; apply(); }

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") apply(); });
  // o primeiro toque ou tecla também tenta (alguns navegadores só liberam depois de uma ação do usuário)
  ["pointerdown", "keydown", "touchend"].forEach(ev => document.addEventListener(ev, () => { if (want || forced) acquire(); }, { passive: true }));
  window.addEventListener("pagehide", release);

  const ready = (async () => {
    try { const r = await chrome.storage.local.get("keepAwake"); want = r.keepAwake !== false; } catch (e) { want = true; }
    apply();
    try { chrome.storage.onChanged.addListener(c => { if (c.keepAwake) { want = c.keepAwake.newValue !== false; apply(); } }); } catch (e) {}
  })();
  return { ready, acquire, release, hold };
})();
