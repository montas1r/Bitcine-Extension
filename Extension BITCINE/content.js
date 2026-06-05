// ============================================================
//  BitCine Enhancer — content.js
//  Runs on https://www.bitcine.tv/* (all frames incl. iframes)
// ============================================================

(function () {
  'use strict';

  // ── Helpers ────────────────────────────────────────────────
  function getEpisodeKey() {
    // URL pattern: /tv/{showId}/{season}/{episode}
    const m = location.pathname.match(/\/tv\/(\d+)\/(\d+)\/(\d+)/);
    return m ? `bitcine_ep_${m[1]}_s${m[2]}_e${m[3]}` : null;
  }

  function fmtTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── Toast ──────────────────────────────────────────────────
  let toastTimer = null;
  let toastEl = null;

function getToastParent() {
  // In fullscreen, document.fullscreenElement is the active fullscreen node
  // Toast must be a child of it, otherwise it renders behind the fullscreen layer
  return document.fullscreenElement || document.webkitFullscreenElement || document.body;
}

function getSavedSubPrefs() {
  return new Promise(resolve => {
    chrome.storage.sync.get(SUB_DEFAULTS, resolve);
  });
}

function showToast(msg) {
  const parent = getToastParent();

  // If fullscreen root changed, re-adopt the toast into the new parent
  if (!toastEl || toastEl.parentNode !== parent) {
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div');
    toastEl.id = 'bce-toast';
    // Inline the critical styles so they work even inside fullscreen shadow DOM
toastEl.style.cssText = `
  position:fixed;top:10%;right:0%;bottom:auto;
  z-index:2147483647;pointer-events:none;
  display:flex;flex-direction:column;align-items:center;gap:2px;
  background:linear-gradient(135deg,#1a0a2e,#2d1b4e);
  border:1px solid rgba(138,92,246,0.25);border-radius:4px;
  box-shadow:0 0 24px rgba(109,40,217,0.35),0 4px 20px rgba(0,0,0,0.5);
  padding:10px 22px 8px;min-width:110px;text-align:center;
  opacity:0;transition:opacity 0.22s cubic-bezier(0.34,1.56,0.64,1),transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
`;
    parent.appendChild(toastEl);
  }

  toastEl.innerHTML = `
    <span style="display:block;font-family:'Inter',-apple-system,sans-serif;font-size:13px;font-weight:600;color:#fff;white-space:nowrap;">${msg}</span>
    <span style="display:block;font-family:'Inter',-apple-system,sans-serif;font-size:9px;color:rgba(255,255,255,0.32);letter-spacing:0.04em;">@monumeeent</span>
  `;

  toastEl.style.opacity = '1';
  toastEl.style.transform = 'translateX(-50%) translateY(-50%) scale(1)';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.style.opacity = '0';
  }, 2000);
}

  // ── Speed ──────────────────────────────────────────────────
  function getSavedSpeed() {
    return parseFloat(localStorage.getItem('bce_speed') || '1');
  }

  function applySpeed(video, speed) {
    video.playbackRate = speed;
    localStorage.setItem('bce_speed', speed);
  }

  function changeSpeed(video, delta) {
    const newSpeed = Math.min(6, Math.max(0.8, +(video.playbackRate + delta).toFixed(2)));
    applySpeed(video, newSpeed);
    showToast(`Speed: ${newSpeed}x`);
  }

  // ── Next / Prev Episode ────────────────────────────────────
  function navigateEpisode(direction) {
    // Works from the top-level page URL
    const topURL = window.top?.location?.pathname || location.pathname;
    const m = topURL.match(/\/tv\/(\d+)\/(\d+)\/(\d+)/);
    if (!m) return;

    const showId = m[1];
    const season = parseInt(m[2]);
    const ep = parseInt(m[3]);
    const newEp = direction === 'next' ? ep + 1 : ep - 1;
    if (newEp < 1) { showToast('Already at first episode'); return; }

    const label = direction === 'next' ? `▶ Ep ${newEp}` : `◀ Ep ${newEp}`;
    showToast(label);

    setTimeout(() => {
      const url = `https://www.bitcine.tv/tv/${showId}/${season}/${newEp}`;
      if (window === window.top) {
        window.location.href = url;
      } else {
        window.top.location.href = url;
      }
    }, 300);
  }

  // ── Last-minute resume ──────────────────────────────────────
  let progressSaveTimer = null;

  function saveProgress(video) {
    const key = getEpisodeKey();
    if (!key || video.currentTime < 5) return;
    localStorage.setItem(key, Math.floor(video.currentTime));
  }

function checkResume(video) {
  const key = getEpisodeKey();
  if (!key) return;
  const saved = parseInt(localStorage.getItem(key) || '0');
  if (saved > 10) {
    // Seek to saved position
    video.currentTime = saved;
    showToast(`⏱ Resumed: ${fmtTime(saved)}`);
  }
}

  // ── Subtitle styling ───────────────────────────────────────
  function injectSubtitleStyles() {
    if (document.getElementById('bce-sub-style')) return;
    const style = document.createElement('style');
    style.id = 'bce-sub-style';
    style.textContent = `
      /* Target common subtitle containers across player types */
      ::cue {
        font-size: 1.15em !important;
        font-family: 'Inter', Arial, sans-serif !important;
        color: #FFFFFF !important;
        background-color: rgba(0, 0, 0, 0.72) !important;
        text-shadow: none !important;
        padding: 2px 6px !important;
      }
      /* Plyr / custom DOM subtitles */
      .plyr__captions,
      .plyr__caption,
      [class*="subtitle"],
      [class*="caption"],
      [class*="sub-text"],
      [class*="cue"] {
        font-size: 1.05rem !important;
        font-family: 'Inter', Arial, sans-serif !important;
        color: #FFFFFF !important;
        background: rgba(0,0,0,0.72) !important;
        text-shadow: none !important;
        padding: 3px 8px !important;
        border-radius: 3px !important;
        bottom: 8% !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        max-width: 85% !important;
        text-align: center !important;
        line-height: 1.5 !important;
      }
    `;
    document.head.appendChild(style);
  }

  // ── Video watcher ───────────────────────────────────────────
  function attachToVideo(video) {
  if (video._bceAttached) return;
  video._bceAttached = true;

  // Boot overlay fallback
  createOverlay(video);
  attachCueListener(video);
  chrome.storage.sync.get(SUB_DEFAULTS, (prefs) => updateOverlayStyle(prefs));

  // Restore speed immediately
  const savedSpeed = getSavedSpeed();
  applySpeed(video, savedSpeed);

  // On ready — show toast + resume info
  video.addEventListener('canplay', () => {
    const speed = getSavedSpeed();
    applySpeed(video, speed);
    showToast(`▶ Ready! ${speed}x`);
    checkResume(video);
  }, { once: true });

  // Save progress every 5s
  video.addEventListener('timeupdate', () => {
    clearTimeout(progressSaveTimer);
    progressSaveTimer = setTimeout(() => saveProgress(video), 5000);
  });

  // Re-apply speed if the player resets it
  video.addEventListener('ratechange', () => {
    const saved = getSavedSpeed();
    if (Math.abs(video.playbackRate - saved) > 0.05) {
      video.playbackRate = saved;
    }
  });
}
  // ── Keyboard handler ────────────────────────────────────────
  function handleKey(e) {
    // Don't fire if user is typing in an input
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

    const video = document.querySelector('video');

    switch (e.key) {
case '[':
  if (video) changeSpeed(video, -0.1);
  break;
case ']':
  if (video) changeSpeed(video, +0.1);
  break;
      case ',':
        navigateEpisode('prev');
        break;
      case '.':
        navigateEpisode('next');
        break;
    }
  }

  // ── MutationObserver to catch dynamically loaded <video> ───
  function watchForVideo() {
    const tryAttach = () => {
      const video = document.querySelector('video');
      if (video) attachToVideo(video);
    };

    tryAttach();

    const obs = new MutationObserver(tryAttach);
    obs.observe(document.body, { childList: true, subtree: true });
  }
	// ── Subtitle prefs from popup ───────────────────────────────
const SUB_DEFAULTS = { subSize: 100, subBg: 72, subPos: 8, subColor: '#ffffff' };

// ── applySubtitlePrefs ──────────────────────────────────────
function applySubtitlePrefs(prefs) {
  const p = Object.assign({}, SUB_DEFAULTS, prefs);
  const fontSize = (p.subSize / 100).toFixed(2);
  const bgAlpha  = (p.subBg  / 100).toFixed(2);
  const bottom   = p.subPos;
  const color    = p.subColor;

  // ── Approach 1: inject CSS (works if same-origin or iframe allowed) ──
  let style = document.getElementById('bce-sub-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'bce-sub-style';
    document.head.appendChild(style);
  }

  style.textContent = `
    ::cue {
      font-size: ${fontSize}em !important;
      font-family: 'Inter', Arial, sans-serif !important;
      color: ${color} !important;
      background-color: rgba(0,0,0,${bgAlpha}) !important;
      text-shadow: none !important;
      padding: 2px 6px !important;
    }
    html body * [class*="subtitle-container"],
    html body * [class*="caption-container"],
    html body * [class*="subtitles-container"],
    html body * [class*="captions-container"],
    html body * .plyr__captions {
      position: absolute !important;
      bottom: ${bottom}% !important;
      top: auto !important;
      left: 0 !important;
      right: 0 !important;
      width: 100% !important;
      transform: none !important;
      text-align: center !important;
      pointer-events: none !important;
    }
    html body * [class*="subtitle"],
    html body * [class*="caption"],
    html body * [class*="sub-text"],
    html body * [class*="cue"],
    html body * .plyr__caption {
      font-size: ${fontSize}em !important;
      font-family: 'Inter', Arial, sans-serif !important;
      color: ${color} !important;
      background: rgba(0,0,0,${bgAlpha}) !important;
      text-shadow: none !important;
      padding: 3px 10px !important;
      border-radius: 3px !important;
      line-height: 1.5 !important;
      display: inline-block !important;
      max-width: 80% !important;
      text-align: center !important;
      white-space: pre-wrap !important;
      position: static !important;
      transform: none !important;
    }
  `;

  // ── Approach 2: update overlay if it's active ──
  if (overlayActive) {
    updateOverlayStyle(p);
  }
}

// ── Subtitle overlay (fallback) ─────────────────────────────
let overlayEl = null;
let overlayActive = false;

function createOverlay(video) {
  if (overlayEl) return;

  const wrapper = video.parentElement;
  if (!wrapper) return;

  // Make sure parent can contain absolute children
  const wStyle = getComputedStyle(wrapper);
  if (wStyle.position === 'static') wrapper.style.position = 'relative';

  overlayEl = document.createElement('div');
  overlayEl.id = 'bce-sub-overlay';
  overlayEl.style.cssText = `
    position: absolute !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    text-align: center !important;
    pointer-events: none !important;
    z-index: 99999 !important;
    transition: bottom 0.2s ease !important;
  `;
  wrapper.appendChild(overlayEl);
  overlayActive = true;
}

function updateOverlayPosition(bottom) {
  if (!overlayEl) return;
  overlayEl.style.bottom = bottom + '%';
}

function updateOverlayStyle(prefs) {
  if (!overlayEl) return;
  const p = Object.assign({}, SUB_DEFAULTS, prefs);
  const fontSize = (p.subSize / 100).toFixed(2);
  const bgAlpha  = (p.subBg  / 100).toFixed(2);
  overlayEl.style.bottom = p.subPos + '%';
  // Store on element for cue renderer to use
  overlayEl.dataset.fontSize  = fontSize;
  overlayEl.dataset.bgAlpha   = bgAlpha;
  overlayEl.dataset.color     = p.subColor;
}

function renderCue(text) {
  if (!overlayEl) return;
  const fontSize = overlayEl.dataset.fontSize || '1.00';
  const bgAlpha  = overlayEl.dataset.bgAlpha  || '0.72';
  const color    = overlayEl.dataset.color    || '#ffffff';

  overlayEl.innerHTML = text ? `
    <span style="
      display: inline-block;
      font-size: ${fontSize}em;
      font-family: 'Inter', Arial, sans-serif;
      color: ${color};
      background: rgba(0,0,0,${bgAlpha});
      padding: 3px 10px;
      border-radius: 3px;
      line-height: 1.5;
      max-width: 80%;
      white-space: pre-wrap;
      text-align: center;
    ">${text}</span>
  ` : '';
}

function attachCueListener(video) {
  // Try native TextTrack cues first
  function tryTrack() {
    const tracks = Array.from(video.textTracks || []);
    const active = tracks.find(t => t.mode === 'showing' || t.mode === 'hidden');
    if (!active) return false;

    // Hide the native subtitle so ours shows instead
    active.mode = 'hidden';

    active.addEventListener('cuechange', () => {
      const cues = active.activeCues;
      if (cues && cues.length > 0) {
        const text = Array.from(cues).map(c => c.text || c.getCueAsHTML?.()?.textContent || '').join('\n');
        renderCue(text);
      } else {
        renderCue('');
      }
    });

    // Watch for new tracks being added (lazy-loaded subs)
    return true;
  }

  // Poll until a track appears (some players load them late)
  let attempts = 0;
  const poller = setInterval(() => {
    attempts++;
    if (tryTrack() || attempts > 40) clearInterval(poller);
  }, 500);

  // Also watch for track elements added dynamically
  video.textTracks.addEventListener('addtrack', () => {
    clearInterval(poller);
    tryTrack();
  });
}

// Listen for updates from popup
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'BCE_SUB_UPDATE') applySubtitlePrefs(msg.prefs);
});
  // ── Boot ────────────────────────────────────────────────────
  function init() {
    chrome.storage.sync.get(SUB_DEFAULTS, (prefs) => applySubtitlePrefs(prefs));
    watchForVideo();
    document.addEventListener('keydown', handleKey, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
