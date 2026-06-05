const DEFAULTS = {
  subSize: 100,
  subBg: 72,
  subPos: 8,
  subColor: '#ffffff'
};

let saveTimer = null;

function getCurrentPrefs() {
  return {
    subSize:  Number(document.getElementById('sub-size').value),
    subBg:    Number(document.getElementById('sub-bg').value),
    subPos:   Number(document.getElementById('sub-pos').value),
    subColor: document.getElementById('sub-color').value
  };
}

function sendToTab(prefs) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'BCE_SUB_UPDATE', prefs });
    }
  });
}

function saveAndSend() {
  const prefs = getCurrentPrefs();

  // Send to tab instantly for live preview
  sendToTab(prefs);

  // Only write to storage 600ms after user stops dragging
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    chrome.storage.sync.set(prefs);
  }, 600);
}

function loadPrefs(cb) {
  chrome.storage.sync.get(DEFAULTS, cb);
}

loadPrefs((prefs) => {
  const sizeSlider = document.getElementById('sub-size');
  const sizeVal    = document.getElementById('val-size');
  sizeSlider.value = prefs.subSize;
  sizeVal.textContent = prefs.subSize + '%';
  sizeSlider.addEventListener('input', () => {
    sizeVal.textContent = sizeSlider.value + '%';
    saveAndSend();
  });

  const bgSlider = document.getElementById('sub-bg');
  const bgVal    = document.getElementById('val-bg');
  bgSlider.value = prefs.subBg;
  bgVal.textContent = prefs.subBg + '%';
  bgSlider.addEventListener('input', () => {
    bgVal.textContent = bgSlider.value + '%';
    saveAndSend();
  });

  const posSlider = document.getElementById('sub-pos');
  const posVal    = document.getElementById('val-pos');
  posSlider.value = prefs.subPos;
  posVal.textContent = prefs.subPos + '%';
  posSlider.addEventListener('input', () => {
    posVal.textContent = posSlider.value + '%';
    saveAndSend();
  });

  const colorPicker = document.getElementById('sub-color');
  colorPicker.value = prefs.subColor;
  colorPicker.addEventListener('input', () => {
    saveAndSend();
  });
});

document.getElementById('reset-subs').addEventListener('click', () => {
  clearTimeout(saveTimer);
  chrome.storage.sync.set(DEFAULTS);
  sendToTab(DEFAULTS);

  document.getElementById('sub-size').value       = DEFAULTS.subSize;
  document.getElementById('val-size').textContent = DEFAULTS.subSize + '%';
  document.getElementById('sub-bg').value         = DEFAULTS.subBg;
  document.getElementById('val-bg').textContent   = DEFAULTS.subBg + '%';
  document.getElementById('sub-pos').value        = DEFAULTS.subPos;
  document.getElementById('val-pos').textContent  = DEFAULTS.subPos + '%';
  document.getElementById('sub-color').value      = DEFAULTS.subColor;
});