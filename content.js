// ============================================================
//   CinePlay Enhancer — content.js  v2.5
//   Integrated Clean UI Matte Block Sliders
// ============================================================
(function () {
  'use strict';

  // ── Guard: run only in the frame that owns the <video> ────
  if (window !== window.top && !document.querySelector('video')) return;

  // ── Episode key storage marker ────────────────────────────
  function getEpisodeKey() {
    const path = (window.top ? (function () { try { return window.top.location.pathname; } catch (e) { return location.pathname; } })() : location.pathname);
    const m = path.match(/\/(?:tv|watch|show|detail)\/([^/?#]+)/);
    return m ? `cpe_ep_${m[1]}_${location.pathname}` : `cpe_ep_${location.pathname}`;
  }

  function fmtTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  // ── Toast ─────────────────────────────────────────────────
  let toastTimer = null;
  let toastEl    = null;

  function getToastParent() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.body;
  }

  function showToast(msg) {
    const parent = getToastParent();
    if (!toastEl || toastEl.parentNode !== parent) {
      if (toastEl) toastEl.remove();
      toastEl = document.createElement('div');
      toastEl.id = 'bce-toast';
      toastEl.style.cssText = [
        'position:fixed;top:16px;right:16px;z-index:2147483647;pointer-events:none',
        'display:flex;align-items:center;gap:8px',
        'background:rgba(44,94,173,0.95)', 
        'border:1px solid rgba(75,184,250,0.3);border-left:3px solid #1591DC', 
        'border-radius:4px',
        'box-shadow:0 4px 18px rgba(21,145,220,0.3)', 
        'padding:7px 12px 7px 10px;min-width:80px',
        'opacity:0;transform:translateX(14px)',
        'transition:opacity 0.18s ease,transform 0.18s ease',
        'font-family:-apple-system,sans-serif'
      ].join(';');
      parent.appendChild(toastEl);
    }

    toastEl.innerHTML = `
      <div>
        <span style="display:block;font-size:12px;font-weight:600;color:#c4e2f5;white-space:nowrap;">${msg}</span>
        <span style="display:flex;align-items:center;gap:4px;font-size:9px;color:#ffffff;letter-spacing:.04em;margin-top:2px;opacity:0.9;">
          <svg viewBox="0 0 24 24" style="width:10px;height:10px;fill:#ffffff;"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
          @monumeeent
        </span>
      </div>`;

    toastEl.style.opacity  = '1';
    toastEl.style.transform = 'translateX(0)';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.style.opacity   = '0';
      toastEl.style.transform = 'translateX(14px)';
    }, 2200);
  }

  // ── Speed ─────────────────────────────────────────────────
  function getSavedSpeed() {
    return parseFloat(parseFloat(localStorage.getItem('cpe_speed') || '1').toFixed(1));
  }

  // Local helper object cache to track dynamic slider instance internal values
  const internalState = { subSize: 100, subBg: 72, speed: 1.0 };

  function applySpeed(video, speed) {
    const targetSpeed = parseFloat(speed.toFixed(1));
    video.playbackRate = targetSpeed;
    localStorage.setItem('cpe_speed', String(targetSpeed));
    internalState.speed = targetSpeed;
  }

  // ── Fullscreen Panel Management ───────────────────────────
  function getPanelParent() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.body;
  }

  function syncPanelParent() {
    if (!panelEl) return;
    const targetParent = getPanelParent();
    if (panelEl.parentNode !== targetParent) {
      targetParent.appendChild(panelEl);
    }
  }

  function changeSpeed(video, delta) {
    const currentSaved = getSavedSpeed();
    const newSpeed = Math.min(6, Math.max(0.8, +(currentSaved + delta).toFixed(1)));
       
    applySpeed(video, newSpeed);
    showToast(`Speed  ${newSpeed.toFixed(1)}x`);
    updatePanelSpeed(newSpeed);
    resetAutoCloseTimer();
  }

  // ── Smart Episode Navigation Engine ───────────────────────
  function getEpisodeInfo() {
    let topUrl;
    try { topUrl = window.top.location.href; } catch (e) { topUrl = location.href; }

    if (topUrl.includes('?play=true')) {
      let baseOrigin = 'https://www.cineplay.to';
      try { baseOrigin = window.top.location.origin; } catch (e) { baseOrigin = location.origin; }
      
      let cleanPath;
      try { cleanPath = window.top.location.pathname; } catch (e) { cleanPath = location.pathname; }

      return {
        baseUrl: `${baseOrigin}${cleanPath}`,
        season: 1,
        episode: 1,
        isInitialQuery: true
      };
    }

    let topPath;
    try { topPath = window.top.location.pathname; } catch (e) { topPath = location.pathname; }
    const match = topPath.match(/\/tv\/(\d+)[^/]*\/(\d+)\/(\d+)\/?$/);
    
    if (match) {
      let baseOrigin = 'https://www.cineplay.to';
      try { baseOrigin = window.top.location.origin; } catch (e) { baseOrigin = location.origin; }
      return {
        baseUrl: `${baseOrigin}/tv/${match[1]}`,
        season: parseInt(match[2], 10),
        episode: parseInt(match[3], 10),
        isInitialQuery: false
      };
    }
    return null;
  }

  function navigateEpisode(direction) {
    const epInfo = getEpisodeInfo();
    if (!epInfo) return;

    let nextSeason = epInfo.season;
    let nextEpisode = direction === 'next' ? epInfo.episode + 1 : epInfo.episode - 1;

    if (epInfo.isInitialQuery && direction === 'next') {
      nextEpisode = 2;
    }

    if (nextEpisode < 1) { 
      showToast('First episode'); 
      return; 
    }

    showToast(direction === 'next' ? `Next  Ep ${nextEpisode}` : `Prev  Ep ${nextEpisode}`);
    const destinationUrl = `${epInfo.baseUrl}/${nextSeason}/${nextEpisode}`;

    setTimeout(() => {
      try { window.top.location.href = destinationUrl; } catch (e) { window.location.href = destinationUrl; }
    }, 300);
  }

  // ── Progress Tracker ──────────────────────────────────────
  let progressSaveTimer = null;

  // Safe tracking values
  function saveProgress(video) {
    if (!video || video.currentTime < 5) return;
    localStorage.setItem(getEpisodeKey(), Math.floor(video.currentTime));
  }

  // Restoration logic
  function checkResume(video) {
    const saved = parseInt(localStorage.getItem(getEpisodeKey()) || '0', 10);
    if (saved > 10) {
      video.currentTime = saved;
      showToast(`Resumed  ${fmtTime(saved)}`);
    }
  }

  // ── Subtitle Configuration Controls ───────────────────────
  const SUB_DEFAULTS = { subSize: 100, subBg: 72, subColor: '#ffffff' };
  let overlayEl      = null;
  let overlayActive = false;

  function createOverlay(video) {
    if (overlayEl) return;
    const wrapper = video.parentElement;
    if (!wrapper) return;
    if (getComputedStyle(wrapper).position === 'static') wrapper.style.position = 'relative';
    overlayEl = document.createElement('div');
    overlayEl.id = 'bce-sub-overlay';
    overlayEl.style.cssText = 'position:absolute!important;bottom:8%!important;left:0!important;right:0!important;width:100%!important;text-align:center!important;pointer-events:none!important;z-index:99999!important;';
    wrapper.appendChild(overlayEl);
    overlayActive = true;
  }

  function updateOverlayStyle(prefs) {
    if (!overlayEl) return;
    const p = Object.assign({}, SUB_DEFAULTS, prefs);
    overlayEl.dataset.fontSize = (p.subSize / 100).toFixed(2);
    overlayEl.dataset.bgAlpha  = (p.subBg  / 100).toFixed(2);
    overlayEl.dataset.color    = p.subColor;
  }

  function renderCue(text) {
    if (!overlayEl) return;
    const fs = overlayEl.dataset.fontSize || '1.00';
    const ba = overlayEl.dataset.bgAlpha  || '0.72';
    const cl = overlayEl.dataset.color    || '#ffffff';
    overlayEl.innerHTML = text ? `<span style="display:inline-block;font-size:${fs}em;font-family:-apple-system,sans-serif;color:${cl};background:rgba(0,0,0,${ba});padding:3px 10px;border-radius:3px;line-height:1.5;max-width:80%;white-space:pre-wrap;text-align:center;">${text}</span>` : '';
  }

  function attachCueListener(video) {
    function tryTrack() {
      const tracks = Array.from(video.textTracks || []);
      const active = tracks.find(t => t.mode === 'showing' || t.mode === 'hidden');
      if (!active) return false;
      active.mode = 'hidden';
      active.addEventListener('cuechange', () => {
        const cues = active.activeCues;
        if (cues && cues.length > 0) {
          renderCue(Array.from(cues).map(c => c.text || c.getCueAsHTML?.()?.textContent || '').join('\n'));
        } else renderCue('');
      });
      return true;
    }
    let attempts = 0;
    const poller = setInterval(() => { if (tryTrack() || ++attempts > 40) clearInterval(poller); }, 500);
    video.textTracks.addEventListener('addtrack', () => { clearInterval(poller); tryTrack(); });
  }

  function applySubtitlePrefs(prefs) {
    const p = Object.assign({}, SUB_DEFAULTS, prefs);
    const fs = (p.subSize / 100).toFixed(2);
    const ba = (p.subBg  / 100).toFixed(2);
    const cl = p.subColor;

    let style = document.getElementById('bce-sub-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'bce-sub-style';
      document.head.appendChild(style);
    }
    style.textContent = `
      ::cue {
        font-size:${fs}em !important;
        font-family:-apple-system,sans-serif !important;
        color:${cl} !important;
        background-color:rgba(0,0,0,${ba}) !important;
        text-shadow:none !important;
        padding:2px 6px !important;
      }
      [class*="subtitle"],[class*="caption"],[class*="sub-text"],[class*="cue"],.plyr__caption {
        font-size:${fs}em !important;
        color:${cl} !important;
        background:rgba(0,0,0,${ba}) !important;
        text-shadow:none !important;
        padding:3px 10px !important;
        border-radius:3px !important;
        line-height:1.5 !important;
        white-space:pre-wrap !important;
      }`;
    if (overlayActive) updateOverlayStyle(p);
  }

  // ── Floating Panel & Auto-Close Engine ───────────────────
  let panelEl   = null;
  let panelOpen = false;
  let autoCloseTimeout = null;
  const INACTIVITY_LIMIT = 5000; 

  function startAutoCloseTimer() {
    stopAutoCloseTimer();
    if (panelOpen) {
      autoCloseTimeout = setTimeout(() => {
        if (panelOpen) togglePanel();
      }, INACTIVITY_LIMIT);
    }
  }

  function stopAutoCloseTimer() {
    if (autoCloseTimeout) {
      clearTimeout(autoCloseTimeout);
      autoCloseTimeout = null;
    }
  }

  function resetAutoCloseTimer() {
    startAutoCloseTimer();
  }

  // Dynamic Event Layer Engine for Capsule Bars
  function makeCapsuleDragInput(trackId, fillId, updateCallback) {
    const track = document.getElementById(trackId);
    let isDragging = false;

    function handleProcess(clientX) {
      const rect = track.getBoundingClientRect();
      let pct = (clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));
      updateCallback(pct);
      resetAutoCloseTimer();
    }

    track.addEventListener('mousedown', (e) => {
      isDragging = true;
      handleProcess(e.clientX);
      document.body.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
      if (isDragging) handleProcess(e.clientX);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        document.body.style.userSelect = '';
      }
    });
  }

  let saveTimer = null;
  function triggerLivePrefsUpdate() {
    applySubtitlePrefs(internalState);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { chrome.storage.sync.set(internalState); } catch (e) {} }, 600);
    resetAutoCloseTimer();
  }

  function buildPanel() {
    if (panelEl) return;
    panelEl = document.createElement('div');
    panelEl.id = 'bce-panel';
    panelEl.innerHTML = `
      <div class="bce-panel-header">
        <span class="bce-panel-title">CinePlay Enhancer</span>
        <button class="bce-panel-close" id="bce-close">✕</button>
      </div>
      <div class="bce-panel-body">

        <div class="bce-ctrl-row">
          <div class="bce-ctrl-top">
            <span class="bce-ctrl-label">Speed</span>
            <span class="bce-ctrl-val" id="bce-speed-val">1.0x</span>
          </div>
          <div class="bce-capsule-track" id="bce-speed-track">
            <div class="bce-capsule-fill" id="bce-speed-fill" style="width: 0%;"></div>
          </div>
        </div>

        <div class="bce-divider"></div>

        <div class="bce-ctrl-row">
          <div class="bce-ctrl-top">
            <span class="bce-ctrl-label">Sub Size</span>
            <span class="bce-ctrl-val" id="bce-size-val">100%</span>
          </div>
          <div class="bce-capsule-track" id="bce-size-track">
            <div class="bce-capsule-fill" id="bce-size-fill" style="width: 0%;"></div>
          </div>
        </div>

        <div class="bce-ctrl-row">
          <div class="bce-ctrl-top">
            <span class="bce-ctrl-label">Sub BG</span>
            <span class="bce-ctrl-val" id="bce-bg-val">72%</span>
          </div>
          <div class="bce-capsule-track" id="bce-bg-track">
            <div class="bce-capsule-fill" id="bce-bg-fill" style="width: 0%;"></div>
          </div>
        </div>

        <div class="bce-ctrl-row bce-color-row">
          <span class="bce-ctrl-label">Sub Color</span>
          <input class="bce-color" type="color" id="bce-color-picker" value="#ffffff" />
        </div>

        <div class="bce-divider"></div>

        <div class="bce-shortcuts">
          <div class="bce-shortcut-row">
            <span class="bce-shortcut-desc">Speed −/+ (0.1x)</span>
            <span><kbd class="bce-kbd">[</kbd> <kbd class="bce-kbd">]</kbd></span>
          </div>
          <div class="bce-shortcut-row">
            <span class="bce-shortcut-desc">Prev / Next ep</span>
            <span><kbd class="bce-kbd">,</kbd> <kbd class="bce-kbd">.</kbd></span>
          </div>
          <div class="bce-shortcut-row">
            <span class="bce-shortcut-desc">Toggle panel</span>
            <kbd class="bce-kbd">Ctrl+\\</kbd>
          </div>
        </div>

        <div class="bce-panel-wm-wrapper">
  <a href="https://github.com/montas1r" target="_blank" class="bce-panel-wm">
    <svg class="bce-icon-git" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
    <span class="bce-wm-text">@montas1r</span>
  </a>
  <a href="https://instagram.com/monumeeent" target="_blank" class="bce-panel-wm">
    <svg class="bce-icon-ig" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
    <span class="bce-wm-text">@monumeeent</span>
  </a>
</div>
      </div>`;

    getPanelParent().appendChild(panelEl);
    document.getElementById('bce-close').addEventListener('click', togglePanel);

    panelEl.addEventListener('mousemove', resetAutoCloseTimer);
    panelEl.addEventListener('mousedown', resetAutoCloseTimer);

    // Initialize Dynamic Capsule Event Mapping Layers
    makeCapsuleDragInput('bce-speed-track', 'bce-speed-fill', (pct) => {
      const v = parseFloat((0.8 + (pct * 5.2)).toFixed(1));
      const video = findVideo();
      if (video) applySpeed(video, v);
      updatePanelSpeed(v);
      showToast(`Speed  ${v.toFixed(1)}x`);
    });

    makeCapsuleDragInput('bce-size-track', 'bce-size-fill', (pct) => {
      const steps = Math.round((60 + (pct * 140)) / 5) * 5;
      internalState.subSize = steps;
      document.getElementById('bce-size-val').textContent = steps + '%';
      document.getElementById('bce-size-fill').style.width = pct * 100 + '%';
      triggerLivePrefsUpdate();
    });

    makeCapsuleDragInput('bce-bg-track', 'bce-bg-fill', (pct) => {
      const steps = Math.round((pct * 100) / 5) * 5;
      internalState.subBg = steps;
      document.getElementById('bce-bg-val').textContent = steps + '%';
      document.getElementById('bce-bg-fill').style.width = pct * 100 + '%';
      triggerLivePrefsUpdate();
    });

    document.getElementById('bce-color-picker').addEventListener('input', (e) => {
      internalState.subColor = e.target.value;
      triggerLivePrefsUpdate();
    });

    // Populate Initial Saved Preferences Values safely
    try {
      chrome.storage.sync.get(SUB_DEFAULTS, (prefs) => {
        Object.assign(internalState, prefs);
        
        // Render size initial values
        document.getElementById('bce-size-val').textContent = internalState.subSize + '%';
        const sPct = (internalState.subSize - 60) / 140;
        document.getElementById('bce-size-fill').style.width = (sPct * 100) + '%';
        
        // Render background initial values
        document.getElementById('bce-bg-val').textContent = internalState.subBg + '%';
        document.getElementById('bce-bg-fill').style.width = internalState.subBg + '%';
        
        document.getElementById('bce-color-picker').value = internalState.subColor;

        const savedSpd = getSavedSpeed();
        updatePanelSpeed(savedSpd);
      });
    } catch (e) {
      // Offline fallback defaults assignment rendering
      document.getElementById('bce-size-fill').style.width = '28%';
      document.getElementById('bce-bg-fill').style.width = '72%';
    }
  }

  function togglePanel() {
    if (!panelEl) buildPanel();
    syncPanelParent();
    panelOpen = !panelOpen;
    panelEl.classList.toggle('bce-panel-open', panelOpen);
    
    if (panelOpen) {
      const video = findVideo();
      if (video) updatePanelSpeed(video.playbackRate);
      startAutoCloseTimer();
    } else {
      stopAutoCloseTimer();
    }
  }

  function updatePanelSpeed(speed) {
    const fl = document.getElementById('bce-speed-fill');
    const vl = document.getElementById('bce-speed-val');
    if (fl && vl) { 
      const exactSpeed = parseFloat(speed).toFixed(1);
      vl.textContent = exactSpeed + 'x'; 
      const sPct = Math.max(0, Math.min(100, ((exactSpeed - 0.8) / 5.2) * 100));
      fl.style.width = sPct + '%';
    }
  }

  // ── Find the best video element ───────────────────────────
  function findVideo() {
    const videos = Array.from(document.querySelectorAll('video'));
    return videos.sort((a, b) => (b.videoWidth * b.videoHeight) - (a.videoWidth * a.videoHeight))[0] || null;
  }

  // ── Toolbar button ────────────────────────────────────────
  function injectToolbarButton() {
    if (document.getElementById('bce-toolbar-btn')) return;
    const selectors = ['.plyr__controls','[class*="player-controls"]','[class*="control-bar"]','[class*="controls"]'];
    let toolbar = null;
    for (const sel of selectors) { toolbar = document.querySelector(sel); if (toolbar) break; }
    if (!toolbar) return;
    const btn = document.createElement('button');
    btn.id = 'bce-toolbar-btn';
    btn.title = 'CinePlay Enhancer (Ctrl+\\)';
    btn.textContent = '⚙';
    btn.addEventListener('click', (e) => { e.stopPropagation(); togglePanel(); });
    toolbar.appendChild(btn);
  }

  // ── Attach to video ───────────────────────────────────────
  function attachToVideo(video) {
    if (video._bceAttached) return;
    video._bceAttached = true;

    createOverlay(video);
    attachCueListener(video);
    try {
      chrome.storage.sync.get(SUB_DEFAULTS, (prefs) => { applySubtitlePrefs(prefs); updateOverlayStyle(prefs); });
    } catch (e) { applySubtitlePrefs(SUB_DEFAULTS); }

    const savedSpeed = getSavedSpeed();
    applySpeed(video, savedSpeed);

    video.addEventListener('canplay', () => {
      const speed = getSavedSpeed();
      applySpeed(video, speed);
      showToast(`Ready  ${speed.toFixed(1)}x`);
      checkResume(video);
    }, { once: true });

    video.addEventListener('timeupdate', () => {
      clearTimeout(progressSaveTimer);
      progressSaveTimer = setTimeout(() => saveProgress(video), 5000);
    });

    video.addEventListener('ratechange', () => {
      const saved = getSavedSpeed();
      if (Math.abs(video.playbackRate - saved) > 0.01) {
        video.playbackRate = saved;
      }
    });

    setTimeout(injectToolbarButton, 1500);
    setTimeout(injectToolbarButton, 3500);
  }

  // ── Keyboard ──────────────────────────────────────────────
  function handleKey(e) {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || document.activeElement?.isContentEditable) return;

    if (e.ctrlKey && (e.key === '\\' || e.code === 'Backslash')) {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
      return;
    }

    const video = findVideo();
    if (!video) return;

    switch (e.key) {
      case '[':
        e.preventDefault();
        changeSpeed(video, -0.1);
        break;
      case ']':
        e.preventDefault();
        changeSpeed(video, +0.1);
        break;
      case ',':
        e.preventDefault();
        navigateEpisode('prev');
        break;
      case '.':
        e.preventDefault();
        navigateEpisode('next');
        break;
    }
  }

  // ── Message listener (from popup) ────────────────────────
  try {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'BCE_SUB_UPDATE') applySubtitlePrefs(msg.prefs);
    });
  } catch (e) {}

  // ── MutationObserver for dynamic video elements ───────────
  function watchForVideo() {
    const tryAttach = () => {
      const video = findVideo();
      if (video) attachToVideo(video);
    };
    tryAttach();
    new MutationObserver(tryAttach).observe(document.documentElement, { childList: true, subtree: true });
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    watchForVideo();
    window.addEventListener('keydown', handleKey, true);
    document.addEventListener('fullscreenchange', syncPanelParent);
    document.addEventListener('webkitfullscreenchange', syncPanelParent);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();