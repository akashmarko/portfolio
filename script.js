/* ============================================================================
   script.js — Portfolio Desktop OS
   ─────────────────────────────────────────────────────────────────────────────
   SECTION INDEX
   ── SECTION: Constants & State
   ── SECTION: Window Manager (open / close / minimize / restore / z-index)
   ── SECTION: Drag (title-bar drag + touch)
   ── SECTION: Desktop Icons (click-to-select, dbl-click-to-open)
   ── SECTION: Dock Buttons
   ── SECTION: Menu Bar (Window menu + clock)
   ── SECTION: Weather Widget
   ── SECTION: Music Widget
   ── SECTION: Projects Finder (fetch API → fallback → render)
   ── SECTION: Window Content (About Me, Skills, Certs, Resume inject)
   ── SECTION: About Me Multi-Window
   ── SECTION: Trash Easter Egg
   ── SECTION: Cloud Decoration
   ── SECTION: Init
   ============================================================================ */

'use strict';

// ── SECTION: Constants & State ───────────────────────────────────────────────

/** Base URL for the API (same origin when served via FastAPI). */
const API_BASE = '';

/** Incrementing z-index counter so windows stack on focus. */
let zTop = 100;

/** Map of window-id → { isOpen, isMinimized }  */
const winState = {};

/** Single-click select timer for distinguishing single vs dbl click on icons. */
let iconClickTimer = null;

/** Currently selected desktop icon element. */
let selectedIcon = null;

// ── SECTION: Window Manager ───────────────────────────────────────────────────

/**
 * Register a window element with the window manager.
 * Call this for every .window element, including dynamically created ones.
 * @param {HTMLElement} el  The .window element
 */
function initWindow(el) {
  const id = el.dataset.windowId;
  if (!id) return;

  // Set initial state entry
  if (!winState[id]) winState[id] = { isOpen: false, isMinimized: false };

  // Traffic-light buttons
  el.querySelector('.btn-close')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeWindow(id);
  });
  el.querySelector('.btn-min')?.addEventListener('click', (e) => {
    e.stopPropagation();
    minimizeWindow(id);
  });
  el.querySelector('.btn-max')?.addEventListener('click', (e) => {
    e.stopPropagation();
    // Simple toggle: maximise fills desktop; clicking again restores
    toggleMaximize(id);
  });

  // Click anywhere on window → bring to front
  el.addEventListener('mousedown', () => focusWindow(id), true);

  // Init drag
  initDrag(el);

  // Centre on desktop on first open
  centreWindow(el);
}

/**
 * Open (or focus) a window by id.
 * @param {string} id           window element id
 * @param {number} [cascadeX=0] horizontal cascade offset in px
 * @param {number} [cascadeY=0] vertical cascade offset in px
 */
function openWindow(id, cascadeX = 0, cascadeY = 0) {
  const el = document.getElementById(id);
  if (!el) return;

  // If minimized, restore instead
  if (winState[id]?.isMinimized) {
    restoreWindow(id);
    return;
  }
  // If already open, just focus
  if (!el.classList.contains('hidden')) {
    focusWindow(id);
    return;
  }

  el.classList.remove('hidden');

  // Apply cascade offset
  if (cascadeX || cascadeY) {
    const currentLeft = parseInt(el.style.left || 0, 10);
    const currentTop  = parseInt(el.style.top  || 0, 10);
    el.style.left = (currentLeft + cascadeX) + 'px';
    el.style.top  = (currentTop  + cascadeY) + 'px';
  }

  focusWindow(id);

  // Opening animation
  el.classList.remove('win-closing');
  el.classList.add('win-opening');
  el.addEventListener('animationend', () => el.classList.remove('win-opening'), { once: true });

  winState[id] = { isOpen: true, isMinimized: false };
  updateDockIndicator(id, true);
}

/**
 * Close a window entirely (hides it, removes minimized badge if any).
 * @param {string} id
 */
function closeWindow(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.add('win-closing');
  el.addEventListener('animationend', () => {
    el.classList.remove('win-closing');
    el.classList.add('hidden');
  }, { once: true });

  winState[id] = { isOpen: false, isMinimized: false };
  removeDockMinimizedBadge(id);
  updateDockIndicator(id, false);
}

/**
 * Minimize a window → hides it and shows a dock badge.
 * @param {string} id
 */
function minimizeWindow(id) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('hidden')) return;

  // Closing animation then hide
  el.classList.add('win-closing');
  el.addEventListener('animationend', () => {
    el.classList.remove('win-closing');
    el.classList.add('hidden');
  }, { once: true });

  winState[id] = { isOpen: true, isMinimized: true };
  addDockMinimizedBadge(id);
  updateDockIndicator(id, false);
}

/**
 * Restore a minimized window.
 * @param {string} id
 */
function restoreWindow(id) {
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.remove('hidden');
  el.classList.add('win-opening');
  el.addEventListener('animationend', () => el.classList.remove('win-opening'), { once: true });

  winState[id] = { isOpen: true, isMinimized: false };
  removeDockMinimizedBadge(id);
  focusWindow(id);
  updateDockIndicator(id, true);
}

/**
 * Bring window to front.
 * @param {string} id
 */
function focusWindow(id) {
  zTop++;
  const el = document.getElementById(id);
  if (el) el.style.zIndex = zTop;
}

/**
 * Toggle maximise state.
 * @param {string} id
 */
function toggleMaximize(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.dataset.maximized === 'true') {
    el.style.width   = el.dataset.prevW   || '';
    el.style.height  = el.dataset.prevH   || '';
    el.style.left    = el.dataset.prevL   || '';
    el.style.top     = el.dataset.prevT   || '';
    el.dataset.maximized = 'false';
  } else {
    el.dataset.prevW = el.style.width;
    el.dataset.prevH = el.style.height;
    el.dataset.prevL = el.style.left;
    el.dataset.prevT = el.style.top;
    el.style.width   = 'calc(100vw - 20px)';
    el.style.height  = 'calc(100vh - var(--menubar-height) - var(--dock-height) - 30px)';
    el.style.left    = '10px';
    el.style.top     = '10px';
    el.dataset.maximized = 'true';
    focusWindow(id);
  }
}

/**
 * Centre window on first placement.
 * @param {HTMLElement} el
 */
function centreWindow(el) {
  if (el.style.left && el.style.top) return; // already positioned
  const desktop = document.getElementById('desktop');
  const dw = desktop.clientWidth;
  const dh = desktop.clientHeight;
  const ww = el.offsetWidth  || 480;
  const wh = el.offsetHeight || 300;
  el.style.left = Math.max(20, (dw - ww) / 2) + 'px';
  el.style.top  = Math.max(20, (dh - wh) / 4) + 'px';
}

/* ── Dock open-indicator helpers ─────────────────────────────────────────── */
function updateDockIndicator(id, isOpen) {
  const actionMap = {
    'win-about':    'open-about-multi',
    'win-skills':   'open-about-multi',
    'win-photo':    'open-photo',
    'win-certs':    'open-certs',
    'win-projects': 'open-projects',
    'win-resume':   'open-resume',
  };
  const action = actionMap[id];
  if (!action) return;
  const dockItem = document.querySelector(`.dock-item[data-action="${action}"]`);
  if (dockItem) dockItem.classList.toggle('win-open', isOpen);
}

function addDockMinimizedBadge(id) {
  const tray = document.getElementById('dock-minimized-tray');
  if (!tray || document.querySelector(`.dock-minimized-item[data-win="${id}"]`)) return;

  const label = getWindowTitle(id);
  const badge = document.createElement('div');
  badge.className = 'dock-minimized-item';
  badge.dataset.win = id;
  badge.setAttribute('role', 'button');
  badge.setAttribute('tabindex', '0');
  badge.setAttribute('aria-label', `Restore ${label}`);
  badge.innerHTML = `
    <div class="minimized-dot" title="${label}">🗂</div>
    <span class="dock-label">${label}</span>
  `;
  badge.addEventListener('click', () => restoreWindow(id));
  badge.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') restoreWindow(id); });
  tray.appendChild(badge);
}

function removeDockMinimizedBadge(id) {
  document.querySelector(`.dock-minimized-item[data-win="${id}"]`)?.remove();
}

function getWindowTitle(id) {
  const el = document.getElementById(id);
  return el?.querySelector('.win-title')?.textContent || id;
}

// ── SECTION: Drag ──────────────────────────────────────────────────────────

/**
 * Make a .window draggable by its .win-titlebar.
 * Supports mouse and touch events. Clamps to desktop bounds.
 * @param {HTMLElement} winEl  The .window element
 */
function initDrag(winEl) {
  const titlebar = winEl.querySelector('.win-titlebar');
  if (!titlebar) return;

  let isDragging = false;
  let startX, startY, startLeft, startTop;

  function getDesktopBounds() {
    const desktop = document.getElementById('desktop');
    return {
      maxLeft: desktop.clientWidth  - winEl.offsetWidth,
      maxTop:  desktop.clientHeight - winEl.offsetHeight,
    };
  }

  function onStart(clientX, clientY) {
    // Don't start drag on traffic light buttons
    isDragging = true;
    startX    = clientX;
    startY    = clientY;
    startLeft = parseInt(winEl.style.left || 0, 10);
    startTop  = parseInt(winEl.style.top  || 0, 10);
    winEl.style.transition = 'none';
    winEl.style.userSelect = 'none';
  }

  function onMove(clientX, clientY) {
    if (!isDragging) return;
    const dx = clientX - startX;
    const dy = clientY - startY;
    const bounds = getDesktopBounds();
    const newLeft = Math.min(Math.max(0, startLeft + dx), bounds.maxLeft);
    const newTop  = Math.min(Math.max(0, startTop  + dy), bounds.maxTop);
    winEl.style.left = newLeft + 'px';
    winEl.style.top  = newTop  + 'px';
  }

  function onEnd() {
    isDragging = false;
    winEl.style.transition = '';
    winEl.style.userSelect = '';
  }

  // Mouse events
  titlebar.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('tl-btn')) return;
    onStart(e.clientX, e.clientY);
    // Use document-level listeners so drag continues outside the element
    const onMouseMove = (e) => onMove(e.clientX, e.clientY);
    const onMouseUp   = () => { onEnd(); document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
  });

  // Touch events
  titlebar.addEventListener('touchstart', (e) => {
    if (e.target.classList.contains('tl-btn')) return;
    const t = e.touches[0];
    onStart(t.clientX, t.clientY);
  }, { passive: true });
  titlebar.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    onMove(t.clientX, t.clientY);
  }, { passive: true });
  titlebar.addEventListener('touchend', onEnd, { passive: true });
}

// ── SECTION: Desktop Icons ─────────────────────────────────────────────────

/**
 * Wire up desktop icon grid:
 *   - single click  → select (highlight)
 *   - double click  → open window (or multi-window for About Me)
 *   - keyboard Enter → same as double click
 */
function initDesktopIcons() {
  const grid = document.getElementById('desktop-icons');
  if (!grid) return;

  grid.addEventListener('click', (e) => {
    const icon = e.target.closest('.icon-item');
    if (!icon) {
      clearIconSelection();
      return;
    }
    clearIconSelection();
    icon.classList.add('selected');
    selectedIcon = icon;

    // Detect double-click via timer
    if (iconClickTimer) {
      clearTimeout(iconClickTimer);
      iconClickTimer = null;
      activateIcon(icon);
    } else {
      iconClickTimer = setTimeout(() => { iconClickTimer = null; }, 300);
    }
  });

  // Keyboard accessibility
  grid.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const icon = e.target.closest('.icon-item');
      if (icon) activateIcon(icon);
    }
  });

  // Touch: tap = single select; quick double-tap = open
  let lastTap = 0;
  grid.addEventListener('touchend', (e) => {
    const icon = e.target.closest('.icon-item');
    if (!icon) return;
    const now = Date.now();
    if (now - lastTap < 350) {
      activateIcon(icon);
    } else {
      clearIconSelection();
      icon.classList.add('selected');
      selectedIcon = icon;
    }
    lastTap = now;
  }, { passive: true });
}

function activateIcon(icon) {
  const target = icon.dataset.opens;
  if (target === 'about-me-multi') {
    openAboutMeMulti();
  } else if (target) {
    openWindow(target);
  }
}

function clearIconSelection() {
  document.querySelectorAll('.icon-item.selected').forEach(i => i.classList.remove('selected'));
  selectedIcon = null;
}

// ── SECTION: Dock Buttons ──────────────────────────────────────────────────

/**
 * Wire dock button actions via data-action attribute event delegation.
 */
function initDock() {
  const dock = document.getElementById('dock-inner');
  if (!dock) return;

  function handleDockAction(el) {
    const action = el.dataset.action;
    if (!action) return;
    switch (action) {
      case 'open-about-multi': openAboutMeMulti();           break;
      case 'open-photo':       openWindow('win-photo');      break;
      case 'open-certs':       openWindow('win-certs');      break;
      case 'open-projects':    openWindow('win-projects');   break;
      case 'open-resume':      openWindow('win-resume');     break;
      case 'open-url': {
        const url = el.dataset.url;
        if (url && !url.startsWith('[PLACEHOLDER')) window.open(url, '_blank', 'noopener');
        else showToast('Link not configured yet — update the placeholder URL.');
        break;
      }
      case 'trash-easter-egg': trashEasterEgg(); break;
    }
  }

  dock.addEventListener('click', (e) => {
    const item = e.target.closest('.dock-item');
    if (item) handleDockAction(item);
  });
  dock.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const item = e.target.closest('.dock-item');
      if (item) handleDockAction(item);
    }
  });
}

// ── SECTION: Menu Bar (Window menu + clock) ────────────────────────────────

/**
 * "Window" dropdown menu toggle and action handlers.
 */
function initMenuBar() {
  const btn      = document.getElementById('window-menu-btn');
  const dropdown = document.getElementById('window-dropdown');
  if (!btn || !dropdown) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = dropdown.classList.toggle('open');
    btn.setAttribute('aria-expanded', open);
  });

  // Close on outside click
  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });

  // Menu item actions
  dropdown.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('[data-menu-action]');
    if (!menuBtn) return;
    const action = menuBtn.dataset.menuAction;
    switch (action) {
      case 'close-all':
        Object.keys(winState).forEach(id => {
          if (winState[id]?.isOpen) closeWindow(id);
        });
        break;
      case 'minimize-all':
        Object.keys(winState).forEach(id => {
          if (winState[id]?.isOpen && !winState[id]?.isMinimized) minimizeWindow(id);
        });
        break;
      case 'bring-all-front':
        Object.keys(winState).forEach(id => {
          if (winState[id]?.isMinimized) restoreWindow(id);
          else if (winState[id]?.isOpen) focusWindow(id);
        });
        break;
    }
    dropdown.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  });
}

/**
 * Live clock — updates every second.
 */
function initClock() {
  function update() {
    const now     = new Date();
    const days    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const months  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const dayName = days[now.getDay()];
    const month   = months[now.getMonth()];
    const date    = now.getDate();
    const rawH    = now.getHours();
    const ampm    = rawH >= 12 ? 'PM' : 'AM';
    const hh      = String(rawH % 12 || 12).padStart(2, '0');
    const mm      = String(now.getMinutes()).padStart(2, '0');

    const dateEl = document.getElementById('clock-date');
    const timeEl = document.getElementById('clock-time');
    if (dateEl) dateEl.textContent = `${dayName} ${date} ${month}`;
    if (timeEl) timeEl.textContent = `${hh}:${mm} ${ampm}`;
  }
  update();
  setInterval(update, 1000);
}

// ── SECTION: Weather Widget ────────────────────────────────────────────────

/** WMO weather code → human-readable description + emoji */
const WMO_CODES = {
  0: ['Clear sky', '☀️'],
  1: ['Mainly clear', '🌤'],
  2: ['Partly cloudy', '⛅'],
  3: ['Overcast', '☁️'],
  45: ['Foggy', '🌫'],
  48: ['Icy fog', '🌫'],
  51: ['Light drizzle', '🌦'],
  53: ['Moderate drizzle', '🌦'],
  55: ['Dense drizzle', '🌧'],
  61: ['Slight rain', '🌧'],
  63: ['Moderate rain', '🌧'],
  65: ['Heavy rain', '🌧'],
  71: ['Slight snow', '🌨'],
  73: ['Moderate snow', '❄️'],
  75: ['Heavy snow', '❄️'],
  77: ['Snow grains', '❄️'],
  80: ['Slight showers', '🌦'],
  81: ['Moderate showers', '🌧'],
  82: ['Violent showers', '⛈'],
  85: ['Slight snow showers', '🌨'],
  86: ['Heavy snow showers', '🌨'],
  95: ['Thunderstorm', '⛈'],
  96: ['Thunderstorm w/ hail', '⛈'],
  99: ['Thunderstorm w/ heavy hail', '⛈'],
};

/** Fallback location: Gwalior, India */
const FALLBACK_LAT = 26.22;
const FALLBACK_LON = 78.18;
const FALLBACK_CITY = 'Gwalior, IN';

async function fetchWeather(lat, lon, cityLabel) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code` +
    `&wind_speed_unit=kmh`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    const cur  = data.current;
    const [desc, emoji] = WMO_CODES[cur.weather_code] ?? ['Unknown', '🌡'];

    document.getElementById('weather-temp').textContent   = `${Math.round(cur.temperature_2m)}°`;
    document.getElementById('weather-desc').textContent   = `${emoji} ${desc}`;
    document.getElementById('weather-humidity').textContent = `${cur.relative_humidity_2m}%`;
    document.getElementById('weather-wind').textContent   = `${Math.round(cur.wind_speed_10m)} km/h`;
    document.getElementById('weather-location').textContent = cityLabel;
  } catch {
    document.getElementById('weather-desc').textContent = 'Unavailable';
    document.getElementById('weather-location').textContent = cityLabel;
  }
}

/**
 * Init weather widget: try geolocation first, fall back to Gwalior.
 */
function initWeather() {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        // Reverse geocode city name via Open-Meteo's free geocoding-adjacent endpoint
        // (We just show coordinates if we can't get a city name easily)
        let cityLabel = `${lat.toFixed(1)}°N ${lon.toFixed(1)}°E`;
        // Attempt simple reverse geocode via nominatim (no key needed)
        try {
          const g = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const gj = await g.json();
          const addr = gj.address;
          cityLabel = addr.city || addr.town || addr.village || addr.county || cityLabel;
          if (addr.country_code) cityLabel += ', ' + addr.country_code.toUpperCase();
        } catch { /* ignore — use coordinates label */ }
        fetchWeather(lat, lon, cityLabel);
      },
      () => fetchWeather(FALLBACK_LAT, FALLBACK_LON, FALLBACK_CITY)
    );
  } else {
    fetchWeather(FALLBACK_LAT, FALLBACK_LON, FALLBACK_CITY);
  }
  // Refresh every 10 minutes
  setInterval(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, ''),
        ()    => fetchWeather(FALLBACK_LAT, FALLBACK_LON, FALLBACK_CITY)
      );
    }
  }, 10 * 60 * 1000);
}

// ── SECTION: Music Widget ──────────────────────────────────────────────────

/**
 * Playlist definition.
 * [PLACEHOLDER: replace with real track titles, artists, and audio file paths]
 */
const PLAYLIST = [
  {
    title:  'In the sea',   // e.g. 'Blinding Lights'
    artist: 'Kensuke ushio',          // e.g. 'The Weeknd'
    src:    '/static/assets/audio/in_the_sea_kensuke_ushio.mp3',
  },
  {
    title:  'Ahead of Us',   // e.g. 'Blinding Lights'
    artist: 'Akira Kosemura',          // e.g. 'The Weeknd'
    src:    '/static/assets/audio/ahead_of_us_Akira_Kosemura.mp3',
  },
];

let currentTrackIdx = 0;
let isPlaying = false;

function initMusic() {
  const audio    = document.getElementById('audio-player');
  const playBtn  = document.getElementById('music-play');
  const prevBtn  = document.getElementById('music-prev');
  const nextBtn  = document.getElementById('music-next');
  const fill     = document.getElementById('music-progress-fill');
  const curTime  = document.getElementById('music-current');
  const totTime  = document.getElementById('music-total');

  if (!audio || !playBtn) return;

  function loadTrack(idx) {
    const track = PLAYLIST[idx];
    if (!track) return;
    document.getElementById('music-title').textContent  = track.title;
    document.getElementById('music-artist').textContent = track.artist;
    audio.src = track.src;
    audio.onerror = () => {
      document.getElementById('music-title').textContent  = track.title;
      document.getElementById('music-artist').textContent = '⚠ Audio file not found';
    };
    if (isPlaying) audio.play().catch(() => {});
  }

  function formatTime(s) {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2,'0')}`;
  }

  const disc = document.getElementById('music-disc');

  function setDiscState(playing) {
    if (disc) disc.classList.toggle('playing', playing);
  }

  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      audio.pause();
      playBtn.textContent = '▶';
      setDiscState(false);
    } else {
      if (!audio.src || audio.src === window.location.href) loadTrack(currentTrackIdx);
      audio.play().catch(() => {
        showToast('Add MP3 files to static/assets/audio/ to enable playback.');
      });
      playBtn.textContent = '⏸';
      setDiscState(true);
    }
    isPlaying = !isPlaying;
  });

  prevBtn.addEventListener('click', () => {
    currentTrackIdx = (currentTrackIdx - 1 + PLAYLIST.length) % PLAYLIST.length;
    isPlaying = true;
    playBtn.textContent = '⏸';
    setDiscState(true);
    loadTrack(currentTrackIdx);
  });

  nextBtn.addEventListener('click', () => {
    currentTrackIdx = (currentTrackIdx + 1) % PLAYLIST.length;
    isPlaying = true;
    playBtn.textContent = '⏸';
    setDiscState(true);
    loadTrack(currentTrackIdx);
  });

  audio.addEventListener('ended', () => {
    currentTrackIdx = (currentTrackIdx + 1) % PLAYLIST.length;
    setDiscState(false);
    loadTrack(currentTrackIdx);
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    if (fill) fill.style.width = pct + '%';
    if (curTime) curTime.textContent = formatTime(audio.currentTime);
    if (totTime) totTime.textContent = formatTime(audio.duration);
  });

  // Load first track metadata (don't autoplay)
  loadTrack(0);
}

// ── SECTION: Projects Finder ───────────────────────────────────────────────

/**
 * Fetch projects from /api/projects; fall back to projects.json if the
 * server is not running (e.g. pure static file hosting).
 * @returns {Promise<Array>}
 */
async function fetchProjects() {
  try {
    const res = await fetch(`${API_BASE}/api/projects`);
    if (!res.ok) throw new Error('API unavailable');
    return await res.json();
  } catch {
    // Fallback: load the JSON file directly
    const res = await fetch('projects.json');
    return await res.json();
  }
}

/**
 * Build a folder icon element for a project (used inside the finder window).
 * @param {Object} project
 * @returns {HTMLElement}
 */
function buildProjectFolderIcon(project) {
  const div = document.createElement('div');
  div.className = 'icon-item';
  div.setAttribute('role', 'listitem');
  div.setAttribute('tabindex', '0');
  div.setAttribute('aria-label', `${project.name} — double-click to open`);
  div.innerHTML = `
    <div class="icon-img icon-folder icon-folder-blue">
      <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 12 Q4 8 8 8 L20 8 L24 12 L40 12 Q44 12 44 16 L44 38 Q44 42 40 42 L8 42 Q4 42 4 38 Z" fill="#74B9FF"/>
        <path d="M4 18 L44 18 L44 38 Q44 42 40 42 L8 42 Q4 42 4 38 Z" fill="#4A90E2"/>
      </svg>
    </div>
    <span class="icon-label">${project.name}</span>
  `;
  return div;
}

/**
 * Create and append a project detail window to #desktop,
 * then open it.
 * @param {Object} project
 */
function openProjectWindow(project) {
  const winId = `win-project-${project.id}`;

  // Reuse existing window if already created
  let win = document.getElementById(winId);
  if (!win) {
    win = document.createElement('div');
    win.className = 'window hidden';
    win.id = winId;
    win.dataset.windowId = winId;
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-label', project.name);
    win.setAttribute('aria-modal', 'true');

    const screenshotIsPlaceholder = !project.screenshot || project.screenshot.includes('[PLACEHOLDER');
    const screenshotHtml = screenshotIsPlaceholder ? '' :
      `<img
         src="${project.screenshot}"
         alt="${project.name} screenshot"
         class="project-screenshot"
         onerror="this.style.display='none'"
       />`;

    const githubDisabled = !project.links?.github || project.links.github.includes('[PLACEHOLDER');
    const demoDisabled   = !project.links?.demo   || project.links.demo.includes('[PLACEHOLDER');

    const tagsHtml = (project.tags || [])
      .map(t => `<span class="project-tag">${t}</span>`)
      .join('');

    win.innerHTML = `
      <div class="win-titlebar" role="toolbar" aria-label="Window controls">
        <div class="traffic-lights">
          <button class="tl-btn btn-close" aria-label="Close window" data-win="${winId}"></button>
          <button class="tl-btn btn-min"   aria-label="Minimise window" data-win="${winId}"></button>
          <button class="tl-btn btn-max"   aria-label="Maximise window" data-win="${winId}"></button>
        </div>
        <span class="win-title">${project.name}</span>
      </div>
      <div class="win-body project-detail">
        ${screenshotHtml}
        <h2>${project.name}</h2>
        <p>${project.description}</p>
        <div class="project-tags">${tagsHtml}</div>
        <div class="project-links">
          <a href="${githubDisabled ? '#' : project.links.github}"
             class="project-link ${githubDisabled ? 'disabled' : ''}"
             target="_blank" rel="noopener"
             title="${githubDisabled ? 'GitHub link not set' : 'View on GitHub'}">
            GitHub ↗
          </a>
          <a href="${demoDisabled ? '#' : project.links.demo}"
             class="project-link ${demoDisabled ? 'disabled' : ''}"
             target="_blank" rel="noopener"
             title="${demoDisabled ? 'Demo link not set' : 'View live demo'}">
            Live Demo ↗
          </a>
        </div>
      </div>
    `;

    document.getElementById('desktop').appendChild(win);
    initWindow(win);

    // Stagger position slightly from Projects window
    const projWin = document.getElementById('win-projects');
    if (projWin) {
      const base = parseInt(projWin.style.left || 100, 10);
      const baseT = parseInt(projWin.style.top || 60, 10);
      win.style.left = (base + 40) + 'px';
      win.style.top  = (baseT + 40) + 'px';
    }

    // Register state
    winState[winId] = { isOpen: false, isMinimized: false };
  }

  openWindow(winId);
}

/**
 * Populate the Projects finder window with folder icons.
 * Called once on load.
 */
async function initProjectsFinder() {
  const body = document.getElementById('win-projects-body');
  if (!body) return;

  let projects;
  try {
    projects = await fetchProjects();
  } catch {
    body.innerHTML = '<p class="finder-loading" style="color:#c0392b">Failed to load projects.</p>';
    return;
  }

  body.innerHTML = ''; // clear "Loading…"

  projects.forEach((project) => {
    const icon = buildProjectFolderIcon(project);

    let singleClickTimer = null;

    icon.addEventListener('click', () => {
      // Select icon
      body.querySelectorAll('.icon-item.selected').forEach(i => i.classList.remove('selected'));
      icon.classList.add('selected');

      if (singleClickTimer) {
        clearTimeout(singleClickTimer);
        singleClickTimer = null;
        openProjectWindow(project);
      } else {
        singleClickTimer = setTimeout(() => { singleClickTimer = null; }, 300);
      }
    });

    // Touch double-tap
    let lastTap = 0;
    icon.addEventListener('touchend', (e) => {
      e.preventDefault();
      const now = Date.now();
      if (now - lastTap < 350) {
        openProjectWindow(project);
      } else {
        body.querySelectorAll('.icon-item.selected').forEach(i => i.classList.remove('selected'));
        icon.classList.add('selected');
      }
      lastTap = now;
    });

    // Keyboard
    icon.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') openProjectWindow(project);
    });

    body.appendChild(icon);
  });
}

// ── SECTION: Window Content ────────────────────────────────────────────────

/** Inject all static window bodies. */
function initWindowContent() {
  injectAboutContent();
  injectSkillsContent();
  injectCertsContent();
}

function injectAboutContent() {
  const body = document.getElementById('win-about-body');
  if (!body) return;
  // [PLACEHOLDER: bio, education, internship details]
  body.innerHTML = `
    <div class="txt-window">
      <div class="txt-section">
        <h1>Akash Marko</h1>
        <h3>Data analyst</h3>
        <p>
          I'm Akash Marko. My interest in data analytics started with a simple question - what is this data actually trying to tell us? That question has pushed me to build real projects, cleaning messy datasets, writing SQL queries to uncover customer patterns, and turning raw numbers into dashboards that actually tell a story. Working on projects like a customer shopping behavior analysis taught me that the real value in data isn't just in the analysis, but in making it clear enough for someone to act on. I'm currently pursuing a Bachelor's in Computer Science, backed by certifications in Google Data Analytics, Power BI, and applied GenAI for analytics, and I'm always looking for the next dataset to dig into.
        </p>
      </div>
      
      
      <div class="txt-section">
        <h4>CONTACT</h4>
        <p>
          akashmarko40@gmail.com
          <!-- [PLACEHOLDER: add or remove interests] -->
        </p>
      </div>
    </div>
  `;
}

function injectSkillsContent() {
  const body = document.getElementById('win-skills-body');
  if (!body) return;
  // [PLACEHOLDER: update skills as they grow]
  const categories = [
    {
      name: 'Languages',
      tags: ['Python', 'SQL'],
    },
    {

      name: 'Visualization Tools',
      tags: ['Tableau', 'Power BI', 'Microsoft Excel']
    },
    {
      name: 'Tools & Platforms',
      tags: ['Jupyter Notebook', 'Google BigQuery', 'PostgreSQL', 'MySQL', 'Git', 'GitHub'],
    },
    {
      name: 'Libraries & Frameworks',
      tags: ['Pandas', 'NumPy', 'Scikit-learn', 'Matplotlib', 'Seaborn'],
    },
  ];

  body.innerHTML = `
    <div class="txt-window">
      ${categories.map(cat => `
        <div class="skill-category">
          <div class="skill-category-name">${cat.name}</div>
          <div class="skill-tags">
            ${cat.tags.map(t => `<span class="skill-tag">${t}</span>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function injectCertsContent() {
  const body = document.getElementById('win-certs-body');
  if (!body) return;
  // [PLACEHOLDER: add or remove certificate entries]
  body.innerHTML = `
    <div>
      <div class="cert-card">
        <div class="cert-badge cert-badge-google">🎓</div>
        <div class="cert-info">
          <h4>Google Data Analytics Professional Certificate</h4>
          <p>Issued by Google via Coursera. Covers the full data analysis process:
             ask, prepare, process, analyse, share, and act.</p>
          <!-- [PLACEHOLDER: certificate date or credential link] -->
          <span class="cert-date">Issuer: Google · Platform: Coursera</span>
        </div>
      </div>
      <div class="cert-card">
        <div class="cert-badge cert-badge-tata">🏢</div>
        <div class="cert-info">
          <h4>Tata GenAI Data Analytics Job Simulation</h4>
          <p>Completed Tata Group's GenAI-powered data analytics simulation on
             Forage. Delivered a full case study on AI-driven collections strategy
             for a fictional fintech (Geldium).</p>
          <!-- [PLACEHOLDER: certificate date or credential link] -->
          <span class="cert-date">Issuer: Tata Group · Platform: Forage</span>
        </div>
      </div>
    </div>
  `;
}

// ── SECTION: About Me Multi-Window ─────────────────────────────────────────

/**
 * Open the three "About Me" windows simultaneously with a cascade effect.
 */
function openAboutMeMulti() {
  const desktop = document.getElementById('desktop');
  const dw = desktop ? desktop.clientWidth  : window.innerWidth;
  const dh = desktop ? desktop.clientHeight : window.innerHeight;

  // Place each window at a distinct position so they never overlap.
  // Add 28px menu-bar offset so windows never open behind it.
  const MB = 28;
  const positions = [
    { left: Math.max(20, dw * 0.04),        top: Math.max(MB + 10, dh * 0.06 + MB) },
    { left: Math.max(20, dw * 0.04 + 500),  top: Math.max(MB + 10, dh * 0.06 + MB) },
    { left: Math.max(20, dw * 0.04 + 250),  top: Math.max(MB + 10, dh * 0.40 + MB) },
  ];

  const ids = ['win-about', 'win-skills', 'win-photo'];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    // If already open, just focus; otherwise position then open
    if (winState[id]?.isMinimized) { restoreWindow(id); return; }
    if (!el.classList.contains('hidden')) { focusWindow(id); return; }
    el.style.left = positions[i].left + 'px';
    el.style.top  = positions[i].top  + 'px';
    openWindow(id);
  });
}

// ── SECTION: Trash Easter Egg ──────────────────────────────────────────────

/**
 * Wiggle the trash icon, animate the lid, show a dismissable toast.
 */
function trashEasterEgg() {
  const icon  = document.getElementById('trash-icon');
  const dockItem = icon?.closest('.dock-item');

  if (dockItem) {
    dockItem.classList.add('trash-wiggle', 'lid-animate');
    dockItem.addEventListener('animationend', () => {
      dockItem.classList.remove('trash-wiggle', 'lid-animate');
    }, { once: true });
  }
  showToast('Nothing to throw away… yet 🗑️');
}

// ── SECTION: Toast ─────────────────────────────────────────────────────────

let toastTimer = null;

/**
 * Show a temporary toast notification.
 * @param {string} msg    Message text
 * @param {number} [ms]   Auto-dismiss delay in ms (default 2500)
 */
function showToast(msg, ms = 2500) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

// ── SECTION: Cloud Decoration ──────────────────────────────────────────────

/**
 * Inject extra CSS cloud layers for depth.
 * Uses a handful of randomised sizes, heights, and durations.
 */
function initClouds() {
  // Clouds removed — wallpaper is shown without animated cloud overlays
}

// ── SECTION: Desktop Icon Drag ──────────────────────────────────────────────

/**
 * Make every .icon-item in #desktop-icons individually draggable.
 * Distinguishes drag from click: if the pointer moved ≥ 6px it's a drag,
 * otherwise the normal click-to-select / double-click-to-open logic fires.
 */
function initIconDrag() {
  const grid = document.getElementById('desktop-icons');
  if (!grid) return;

  const items = Array.from(grid.querySelectorAll('.icon-item'));
  const desktop = document.getElementById('desktop');

  // Base column position matches the original #desktop-icons CSS (left:40, top:60).
  // Each icon slot is ~108px tall (cell + gap). A small seeded jitter is applied
  // per-icon so icons look naturally scattered rather than rigidly aligned.
  const GRID_LEFT = 160;
  const GRID_TOP  = 118; /* 28px menu bar + 90px original offset */
  const SLOT_H    = 108; // cell height + row-gap
  const JITTER_X  = 90;  // max horizontal drift  (px)
  const JITTER_Y  = 10;  // max vertical drift    (px)

  // Deterministic pseudo-random so layout is stable across reloads
  function seededRand(seed) {
    const x = Math.sin(seed + 1) * 43758.5453123;
    return x - Math.floor(x); // 0..1
  }

  items.forEach((icon, i) => {
    const jx = Math.round((seededRand(i * 2)     * 2 - 1) * JITTER_X);
    const jy = Math.round((seededRand(i * 2 + 1) * 2 - 1) * JITTER_Y);
    icon.style.position = 'absolute';
    icon.style.left     = (GRID_LEFT + jx) + 'px';
    icon.style.top      = (GRID_TOP + i * SLOT_H + jy) + 'px';
    icon.style.margin   = '0';
    desktop.appendChild(icon);
    icon.style.zIndex   = '10';
  });

  // Hide the now-empty grid container
  grid.style.display = 'none';

  desktop.dataset.iconsDetached = 'true';

  items.forEach(icon => {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    const DRAG_THRESHOLD = 6;

    function pointerStart(clientX, clientY) {
      startX    = clientX;
      startY    = clientY;
      startLeft = parseInt(icon.style.left, 10);
      startTop  = parseInt(icon.style.top,  10);
      isDragging = false;
      icon.style.transition = 'none';
      // Bring icon to front
      icon.style.zIndex = String(++zTop);
    }

    function pointerMove(clientX, clientY) {
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (!isDragging && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      isDragging = true;
      const deskR = desktop.getBoundingClientRect();
      const newL = Math.min(Math.max(0, startLeft + dx), deskR.width  - icon.offsetWidth);
      const newT = Math.min(Math.max(0, startTop  + dy), deskR.height - icon.offsetHeight);
      icon.style.left = newL + 'px';
      icon.style.top  = newT + 'px';
    }

    function pointerEnd() {
      icon.style.transition = '';
      // If we dragged, prevent the click event from firing
      if (isDragging) {
        icon.dataset.wasDragged = 'true';
        setTimeout(() => { delete icon.dataset.wasDragged; }, 50);
      }
      isDragging = false;
    }

    // Mouse
    icon.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      pointerStart(e.clientX, e.clientY);
      const onMove = (e) => pointerMove(e.clientX, e.clientY);
      const onUp   = () => {
        pointerEnd();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup',   onUp);
    });

    // Touch
    icon.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      pointerStart(t.clientX, t.clientY);
    }, { passive: true });
    icon.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      pointerMove(t.clientX, t.clientY);
    }, { passive: true });
    icon.addEventListener('touchend', pointerEnd, { passive: true });

    // Suppress open/select if this touch/click was actually a drag
    icon.addEventListener('click', (e) => {
      if (icon.dataset.wasDragged) { e.stopImmediatePropagation(); }
    }, true);
  });

  // Deselect when clicking blank desktop (replaces the old grid-based handler)
  desktop.addEventListener('click', (e) => {
    if (!e.target.closest('.icon-item') && !e.target.closest('.window')) {
      clearIconSelection();
    }
  });

  // Re-wire icon click/dblclick directly on each detached icon
  items.forEach(icon => {
    let clickTimer = null;
    icon.addEventListener('click', (e) => {
      if (icon.dataset.wasDragged) return;
      e.stopPropagation();
      clearIconSelection();
      icon.classList.add('selected');
      selectedIcon = icon;
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        activateIcon(icon);
      } else {
        clickTimer = setTimeout(() => { clickTimer = null; }, 300);
      }
    });

    icon.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') activateIcon(icon);
    });
  });
}

// ── SECTION: Init ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // 1. Register all static windows with the window manager
  document.querySelectorAll('.window').forEach(el => initWindow(el));

  // 2. Desktop icon interaction
  initDesktopIcons();

  // 3. Dock button routing
  initDock();

  // 4. Menu bar (Window menu + clock)
  initMenuBar();
  initClock();

  // 5. Widgets
  initWeather();
  initMusic();

  // 6. Projects finder (async — loads from API / fallback)
  initProjectsFinder();

  // 7. Inject static window body content
  initWindowContent();

  // 8. Desktop icon drag
  initIconDrag();

  // 9. Close desktop icon selection when clicking blank desktop
  document.getElementById('desktop')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('desktop') ||
        e.target === document.getElementById('desktop-icons')) {
      clearIconSelection();
    }
  });

  // 10. Keyboard: Escape closes the topmost focused window
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Find highest z-index open window
      let topZ = 0, topId = null;
      Object.keys(winState).forEach(id => {
        if (!winState[id]?.isOpen || winState[id]?.isMinimized) return;
        const el = document.getElementById(id);
        if (el) {
          const z = parseInt(el.style.zIndex || 0, 10);
          if (z > topZ) { topZ = z; topId = id; }
        }
      });
      if (topId) closeWindow(topId);
    }
  });

});
