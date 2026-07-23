const btnAdd = document.getElementById('btn-add');
const btnSettings = document.getElementById('btn-settings');
const modalAdd = document.getElementById('modal-add');
const modalSettings = document.getElementById('modal-settings');
const btnCancel = document.getElementById('btn-cancel');
const btnStart = document.getElementById('btn-start');
const btnBrowse = document.getElementById('btn-browse');
const btnBrowseDefault = document.getElementById('btn-browse-default');
const btnCloseSettings = document.getElementById('btn-close-settings');
const themeDots = document.querySelectorAll('.theme-dot');
const popup = document.getElementById('modal-popup');
const inputUrl = document.getElementById('input-url');
const inputReferer = document.getElementById('input-referer');
const inputPath = document.getElementById('input-path');
const inputConnections = document.getElementById('input-connections');
const queueEl = document.getElementById('queue');
const statusCount = document.getElementById('status-count');
const statusSpeed = document.getElementById('status-speed');
const settingShowMascot = document.getElementById('setting-show-mascot');
const settingDefaultFolder = document.getElementById('setting-default-folder');
const settingClipboardMonitor = document.getElementById('setting-clipboard-monitor');
const settingSpeedLimit = document.getElementById('setting-speed-limit');

const tasks = new Map(); // id -> task state
let selectedId = null;
let currentFilter = 'all';
let sortKey = 'added';
let sortDir = 1;

const CATEGORY_EXT = {
  compressed: ['zip', 'rar', '7z', 'tar', 'gz'],
  documents: ['pdf', 'doc', 'docx', 'txt', 'xlsx', 'pptx'],
  music: ['mp3', 'wav', 'flac', 'aac', 'ogg'],
  programs: ['exe', 'msi', 'dmg', 'apk'],
  video: ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'ts', 'm3u8']
};

function categorize(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  for (const [category, exts] of Object.entries(CATEGORY_EXT)) {
    if (exts.includes(ext)) return category;
  }
  return 'other';
}

// --- Add / start download -------------------------------------------------

btnAdd.addEventListener('click', () => modalAdd.classList.remove('hidden'));
btnCancel.addEventListener('click', () => modalAdd.classList.add('hidden'));

btnBrowse.addEventListener('click', async () => {
  const folder = await window.dlchan.pickFolder();
  if (folder) inputPath.value = folder;
});

btnBrowseDefault.addEventListener('click', async () => {
  const folder = await window.dlchan.pickFolder();
  if (folder) settingDefaultFolder.value = folder;
});

btnStart.addEventListener('click', async () => {
  const url = inputUrl.value.trim();
  const folder = inputPath.value.trim();
  const connections = parseInt(inputConnections.value, 10);
  const format = document.getElementById('input-format').value;
  if (!url || !folder) return;

  const fileName = decodeURIComponent(url.split('/').filter(Boolean).pop() || 'download');
  const destPath = `${folder}\\${fileName}`;
  const referer = inputReferer.value.trim();
  const headers = referer ? { referer } : undefined;

  const snapshot = await window.dlchan.startDownload({ url, destPath, connections, headers });
  registerTask(snapshot.id, fileName, { url, destPath, connections, format, headers });

  modalAdd.classList.add('hidden');
  inputUrl.value = '';
  inputReferer.value = '';
});

// --- Settings modal / tabs -------------------------------------------------

btnSettings.addEventListener('click', () => modalSettings.classList.remove('hidden'));
btnCloseSettings.addEventListener('click', () => modalSettings.classList.add('hidden'));

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

settingShowMascot.addEventListener('change', () => {
  document.body.classList.toggle('mascot-hidden', !settingShowMascot.checked);
  localStorage.setItem('dlchan-show-mascot', settingShowMascot.checked ? '1' : '0');
});

if (localStorage.getItem('dlchan-show-mascot') === '0') {
  settingShowMascot.checked = false;
  document.body.classList.add('mascot-hidden');
}

if (localStorage.getItem('dlchan-clipboard-monitor') === '0') {
  settingClipboardMonitor.checked = false;
}
settingClipboardMonitor.addEventListener('change', () => {
  localStorage.setItem('dlchan-clipboard-monitor', settingClipboardMonitor.checked ? '1' : '0');
});

const savedSpeedLimit = localStorage.getItem('dlchan-speed-limit');
if (savedSpeedLimit) {
  settingSpeedLimit.value = savedSpeedLimit;
  window.dlchan.setSpeedLimit(parseInt(savedSpeedLimit, 10));
}
settingSpeedLimit.addEventListener('change', () => {
  const kbps = parseInt(settingSpeedLimit.value, 10) || 0;
  localStorage.setItem('dlchan-speed-limit', String(kbps));
  window.dlchan.setSpeedLimit(kbps);
});

// --- Theme -----------------------------------------------------------------

function mix(hexA, hexB, amount) {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar + (br - ar) * amount);
  const g = Math.round(ag + (bg - ag) * amount);
  const bl = Math.round(ab + (bb - ab) * amount);
  return `#${((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1)}`;
}

function applyCustomColor(hex) {
  const root = document.body.style;
  root.setProperty('--accent-solid', hex);
  root.setProperty('--accent-dark', mix(hex, '#000000', 0.15));
  root.setProperty('--accent-light', mix(hex, '#ffffff', 0.45));
  root.setProperty('--accent-eye', mix(hex, '#000000', 0.55));
  root.setProperty('--bg-page', mix(hex, '#ffffff', 0.95));
  root.setProperty('--bg-sidebar', mix(hex, '#ffffff', 0.9));
  root.setProperty('--border', mix(hex, '#ffffff', 0.8));
  root.setProperty('--text-main', mix(hex, '#000000', 0.8));
}

function clearCustomColor() {
  const root = document.body.style;
  ['--accent-solid', '--accent-dark', '--accent-light', '--accent-eye', '--bg-page', '--bg-sidebar', '--border', '--text-main']
    .forEach((prop) => root.removeProperty(prop));
}

function applyTheme(theme, customHex) {
  document.body.setAttribute('data-theme', theme);
  themeDots.forEach((dot) => dot.classList.toggle('active', dot.dataset.theme === theme));
  localStorage.setItem('dlchan-theme', theme);

  if (theme === 'custom') {
    const hex = customHex || localStorage.getItem('dlchan-custom-color') || '#4cb85c';
    themeCustomPicker.value = hex;
    applyCustomColor(hex);
    localStorage.setItem('dlchan-custom-color', hex);
  } else {
    clearCustomColor();
  }
}

themeDots.forEach((dot) => {
  dot.addEventListener('click', () => applyTheme(dot.dataset.theme));
});

const themeCustomPicker = document.getElementById('theme-custom-picker');
themeCustomPicker.addEventListener('input', () => applyTheme('custom', themeCustomPicker.value));

const savedTheme = localStorage.getItem('dlchan-theme') || 'green';
applyTheme(savedTheme, localStorage.getItem('dlchan-custom-color'));

// --- Language ----------------------------------------------------------------

const settingLanguage = document.getElementById('setting-language');
settingLanguage.value = window.i18n.getLocale();
window.i18n.applyLocale(window.i18n.getLocale());

settingLanguage.addEventListener('change', () => {
  window.i18n.applyLocale(settingLanguage.value);
  renderQueue();
});

// --- Popup toast (from extension detections) --------------------------------

const popupTitle = document.getElementById('popup-title');
const popupSub = document.getElementById('popup-sub');
const btnPopupDownload = document.getElementById('btn-popup-download');
const btnPopupDismiss = document.getElementById('btn-popup-dismiss');
let pendingDetection = null;
let popupHideTimer = null;

// Real-world filenames are often long hashes/IDs with query-string leftovers
// that read like a raw link. Show a short, clean label instead; the input
// field still gets the real filename via pendingDetection.filename.
function cleanDisplayName(name, maxLen = 28) {
  const clean = name.split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  const ext = dot > -1 ? clean.slice(dot) : '';
  const base = dot > -1 ? clean.slice(0, dot) : clean;
  if (base.length <= maxLen) return clean;
  return `${base.slice(0, maxLen)}…${ext}`;
}

window.dlchan.onDetected((detection) => {
  pendingDetection = detection;
  popupTitle.textContent = 'เจอวิดีโอในหน้านี้!';
  popupSub.textContent = cleanDisplayName(detection.filename);
  popupSub.title = detection.filename;
  popup.classList.remove('hidden');
  clearTimeout(popupHideTimer);
  popupHideTimer = setTimeout(() => popup.classList.add('hidden'), 8000);
});

btnPopupDownload.addEventListener('click', async () => {
  if (!pendingDetection) return;
  const destPath = `${inputPath.value.trim() || settingDefaultFolder.value.trim() || 'C:\\Downloads'}\\${pendingDetection.filename}`;
  const headers = pendingDetection.headers || {};
  const snapshot = await window.dlchan.startDownload({ url: pendingDetection.url, destPath, connections: 8, headers });
  registerTask(snapshot.id, pendingDetection.filename, { url: pendingDetection.url, destPath, connections: 8, headers });
  popup.classList.add('hidden');
  pendingDetection = null;
});

btnPopupDismiss.addEventListener('click', () => {
  clearTimeout(popupHideTimer);
  popup.classList.add('hidden');
  pendingDetection = null;
});

window.dlchan.onQueuedFromBrowser((payload) => {
  registerTask(payload.id, payload.name, { url: payload.url, destPath: payload.destPath, connections: 8, headers: payload.headers });
});

window.dlchan.onClipboardDetected((data) => {
  if (settingClipboardMonitor.checked === false) return;
  const filename = decodeURIComponent(data.url.split('/').filter(Boolean).pop() || 'download');
  pendingDetection = { url: data.url, filename };
  popupTitle.textContent = 'เจอลิงก์ดาวน์โหลดใน clipboard!';
  popupSub.textContent = cleanDisplayName(filename);
  popupSub.title = filename;
  popup.classList.remove('hidden');
  clearTimeout(popupHideTimer);
  popupHideTimer = setTimeout(() => popup.classList.add('hidden'), 8000);
});

// --- Tree filter -------------------------------------------------------------

document.querySelectorAll('.tree-node').forEach((node) => {
  node.addEventListener('click', () => {
    document.querySelectorAll('.tree-node').forEach((n) => n.classList.remove('active'));
    node.classList.add('active');
    currentFilter = node.dataset.filter;
    renderQueue();
  });
});

// --- Column sort -------------------------------------------------------------

document.querySelectorAll('.col').forEach((col) => {
  col.addEventListener('click', () => {
    const key = col.dataset.sort;
    if (sortKey === key) {
      sortDir *= -1;
    } else {
      sortKey = key;
      sortDir = 1;
    }
    renderQueue();
  });
});

// --- Toolbar actions ----------------------------------------------------------

document.getElementById('btn-resume-all').addEventListener('click', () => {
  tasks.forEach((task, id) => {
    if (task.status === 'paused' || task.status === 'error') window.dlchan.resumeDownload(id);
  });
});

document.getElementById('btn-pause-selected').addEventListener('click', () => {
  if (selectedId) window.dlchan.pauseDownload(selectedId);
});

document.getElementById('btn-stop-all').addEventListener('click', () => {
  tasks.forEach((task, id) => {
    if (task.status === 'downloading') window.dlchan.pauseDownload(id);
  });
});

document.getElementById('btn-delete').addEventListener('click', () => {
  if (!selectedId) return;
  window.dlchan.cancelDownload(selectedId);
  tasks.delete(selectedId);
  selectedId = null;
  renderQueue();
});

document.getElementById('btn-delete-done').addEventListener('click', () => {
  tasks.forEach((task, id) => {
    if (task.status === 'done') tasks.delete(id);
  });
  renderQueue();
});

// --- Scheduler -----------------------------------------------------------------

const modalSchedule = document.getElementById('modal-schedule');
const scheduleUrl = document.getElementById('schedule-url');
const schedulePath = document.getElementById('schedule-path');
const scheduleConnections = document.getElementById('schedule-connections');
const scheduleTime = document.getElementById('schedule-time');

document.getElementById('btn-schedule').addEventListener('click', () => {
  modalSchedule.classList.remove('hidden');
});

document.getElementById('btn-schedule-cancel').addEventListener('click', () => {
  modalSchedule.classList.add('hidden');
});

document.getElementById('btn-browse-schedule').addEventListener('click', async () => {
  const folder = await window.dlchan.pickFolder();
  if (folder) schedulePath.value = folder;
});

document.getElementById('btn-schedule-confirm').addEventListener('click', () => {
  const url = scheduleUrl.value.trim();
  const folder = schedulePath.value.trim();
  const connections = parseInt(scheduleConnections.value, 10);
  const at = scheduleTime.value ? new Date(scheduleTime.value).getTime() : Date.now();
  if (!url || !folder || !at) return;

  const fileName = decodeURIComponent(url.split('/').filter(Boolean).pop() || 'download');
  const destPath = `${folder}\\${fileName}`;
  const localId = `sched-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  tasks.set(localId, {
    name: fileName,
    category: categorize(fileName),
    lastBytes: 0,
    lastTime: Date.now(),
    speed: 0,
    status: 'scheduled',
    totalBytes: 0,
    downloadedBytes: 0,
    connections,
    addedAt: Date.now(),
    scheduledAt: at,
    url,
    destPath
  });

  modalSchedule.classList.add('hidden');
  scheduleUrl.value = '';
  renderQueue();
});

setInterval(() => {
  let dueCount = 0;
  tasks.forEach((task, id) => {
    if (task.status !== 'scheduled') return;
    if (Date.now() >= task.scheduledAt) dueCount++;
  });

  if (dueCount > 0) {
    [...tasks.entries()].forEach(async ([id, task]) => {
      if (task.status !== 'scheduled' || Date.now() < task.scheduledAt) return;
      tasks.delete(id);
      const snapshot = await window.dlchan.startDownload({ url: task.url, destPath: task.destPath, connections: task.connections || 8, headers: task.headers });
      registerTask(snapshot.id, task.name, { url: task.url, destPath: task.destPath, connections: task.connections, headers: task.headers });
    });
  } else if ([...tasks.values()].some((t) => t.status === 'scheduled')) {
    renderQueue();
  }
}, 1000);

// --- Context menu ----------------------------------------------------------------

const contextMenu = document.getElementById('context-menu');
let contextMenuTargetId = null;

queueEl.addEventListener('contextmenu', (event) => {
  const row = event.target.closest('.queue-row');
  if (!row) return;
  event.preventDefault();
  contextMenuTargetId = row.dataset.id;
  selectedId = row.dataset.id;
  renderQueue();
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.classList.remove('hidden');
});

document.addEventListener('click', (event) => {
  if (!contextMenu.contains(event.target)) contextMenu.classList.add('hidden');
});

contextMenu.addEventListener('click', async (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn || !contextMenuTargetId) return;
  const task = tasks.get(contextMenuTargetId);
  contextMenu.classList.add('hidden');
  if (!task) return;

  switch (btn.dataset.action) {
    case 'open-folder':
      if (task.destPath) window.dlchan.openInFolder(task.destPath);
      break;
    case 'copy-link':
      if (task.url) navigator.clipboard.writeText(task.url);
      break;
    case 'redownload': {
      if (!task.url) return;
      const snapshot = await window.dlchan.startDownload({ url: task.url, destPath: task.destPath, connections: task.connections || 8, headers: task.headers });
      registerTask(snapshot.id, task.name, { url: task.url, destPath: task.destPath, connections: task.connections, headers: task.headers });
      break;
    }
    case 'priority-top': {
      const minAdded = Math.min(...[...tasks.values()].map((t) => t.addedAt));
      task.addedAt = minAdded - 1;
      renderQueue();
      break;
    }
    case 'remove':
      if (task.status !== 'scheduled') window.dlchan.cancelDownload(contextMenuTargetId);
      tasks.delete(contextMenuTargetId);
      if (selectedId === contextMenuTargetId) selectedId = null;
      renderQueue();
      break;
  }
});

// --- Formatting helpers --------------------------------------------------------

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatEta(remainingBytes, speed) {
  if (!speed || speed <= 0) return '--';
  const seconds = Math.round(remainingBytes / speed);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function statusLabel(status) {
  return {
    pending: 'กำลังเตรียม',
    downloading: 'กำลังโหลด',
    paused: 'หยุดชั่วคราว',
    merging: 'กำลังรวมไฟล์',
    done: 'เสร็จแล้ว',
    error: 'ผิดพลาด',
    canceled: 'ยกเลิกแล้ว',
    scheduled: 'ตั้งเวลาไว้',
    converting: 'กำลังแปลงไฟล์'
  }[status] || status;
}

function formatCountdown(targetMs) {
  const remaining = Math.max(0, targetMs - Date.now());
  const totalSeconds = Math.round(remaining / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h} ชม. ${m} น.`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// --- Task registry / rendering --------------------------------------------------

function registerTask(id, name, meta = {}) {
  tasks.set(id, {
    name,
    category: categorize(name),
    lastBytes: 0,
    lastTime: Date.now(),
    speed: 0,
    status: 'pending',
    totalBytes: 0,
    downloadedBytes: 0,
    connections: meta.connections || 0,
    addedAt: Date.now(),
    url: meta.url || null,
    destPath: meta.destPath || null,
    format: meta.format || 'original',
    converted: false
  });
  renderQueue();
}

async function maybeConvert(id, task) {
  if (task.format === 'original' || task.converted || !task.destPath) return;
  task.converted = true; // guard against double-trigger
  task.status = 'converting';
  renderQueue();

  const result = await window.dlchan.convertMedia({ sourcePath: task.destPath, format: task.format });
  if (result.ok) {
    task.destPath = result.outputPath;
    task.name = result.outputPath.split('\\').pop();
    task.status = 'done';
  } else {
    task.status = 'error';
  }
  renderQueue();
}

function matchesFilter(task) {
  if (currentFilter === 'all') return true;
  if (currentFilter.startsWith('category:')) return task.category === currentFilter.split(':')[1];
  if (currentFilter === 'status:unfinished') return !['done', 'canceled'].includes(task.status);
  if (currentFilter === 'status:finished') return task.status === 'done';
  if (currentFilter === 'status:queue') return task.status === 'pending' || task.status === 'scheduled';
  return true;
}

function sortValue(task, key) {
  switch (key) {
    case 'name': return task.name.toLowerCase();
    case 'size': return task.totalBytes;
    case 'status': return task.status;
    case 'speed': return task.speed;
    case 'added': return task.addedAt;
    default: return 0;
  }
}

function renderQueue() {
  const entries = [...tasks.entries()].filter(([, task]) => matchesFilter(task));
  entries.sort((a, b) => {
    const va = sortValue(a[1], sortKey);
    const vb = sortValue(b[1], sortKey);
    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return 0;
  });

  if (entries.length === 0) {
    queueEl.innerHTML = `<div class="queue-empty">${window.i18n.t('queueEmpty')}</div>`;
  } else {
    queueEl.innerHTML = '';
    entries.forEach(([id, task]) => {
      const percent = task.totalBytes ? Math.round((task.downloadedBytes / task.totalBytes) * 100) : 0;
      const row = document.createElement('div');
      row.className = `queue-row${task.status === 'paused' ? ' paused' : ''}${task.status === 'scheduled' ? ' scheduled' : ''}${id === selectedId ? ' selected' : ''}`;
      row.dataset.id = id;

      const remaining = task.totalBytes - task.downloadedBytes;
      let eta = '--';
      if (task.status === 'downloading') eta = formatEta(remaining, task.speed);
      if (task.status === 'scheduled') eta = formatCountdown(task.scheduledAt);
      const speedText = task.status === 'downloading' ? `${formatBytes(task.speed)}/s` : '--';

      row.innerHTML = `
        <div class="row-name">
          <div class="name-line"><i class="ti ti-file file-icon"></i><span class="name-text">${task.name}</span></div>
          <div class="progress-track"><div class="progress-fill" style="width: ${percent}%"></div></div>
        </div>
        <div class="row-size">${formatBytes(task.totalBytes)}</div>
        <div class="row-status">${statusLabel(task.status)} ${task.status === 'downloading' ? percent + '%' : ''}</div>
        <div class="row-eta">${eta}</div>
        <div class="row-speed">${speedText}</div>
        <div class="row-added">${new Date(task.addedAt).toLocaleString('th-TH')}</div>
      `;
      queueEl.appendChild(row);
    });
  }

  const activeCount = [...tasks.values()].filter((t) => t.status === 'downloading').length;
  const totalSpeed = [...tasks.values()].reduce((sum, t) => sum + (t.status === 'downloading' ? t.speed : 0), 0);
  statusCount.textContent = `${tasks.size} รายการ (${activeCount} กำลังโหลด)`;
  statusSpeed.textContent = `รวม ${formatBytes(totalSpeed)}/s`;
}

queueEl.addEventListener('click', (event) => {
  const row = event.target.closest('.queue-row');
  if (!row) return;
  selectedId = row.dataset.id;
  renderQueue();
});

// --- IPC progress / error listeners -----------------------------------------------

window.dlchan.onProgress((snapshot) => {
  const task = tasks.get(snapshot.id);
  if (!task) return;

  const now = Date.now();
  const elapsed = (now - task.lastTime) / 1000;
  if (elapsed > 0.4) {
    task.speed = (snapshot.downloadedBytes - task.lastBytes) / elapsed;
    task.lastBytes = snapshot.downloadedBytes;
    task.lastTime = now;
  }

  Object.assign(task, snapshot);
  renderQueue();

  if (snapshot.status === 'done') maybeConvert(snapshot.id, task);
});

window.dlchan.onError((payload) => {
  const task = tasks.get(payload.id);
  if (!task) return;
  task.status = 'error';
  renderQueue();
});

// --- First-run welcome wizard ------------------------------------------------

const modalWelcome = document.getElementById('modal-welcome');
const btnWelcomeDone = document.getElementById('btn-welcome-done');
const btnExtFolder = document.getElementById('btn-ext-folder');
const btnExtCopyPath = document.getElementById('btn-ext-copy-path');
const btnScheduleToolbar = document.getElementById('btn-schedule');

function applyFeatureToggles() {
  const hlsOn = localStorage.getItem('dlchan-hls-enabled') !== '0';
  const schedulerOn = localStorage.getItem('dlchan-scheduler-enabled') !== '0';
  const contextMenuOn = localStorage.getItem('dlchan-contextmenu-enabled') !== '0';

  window.dlchan.setHlsEnabled(hlsOn);
  btnScheduleToolbar.style.display = schedulerOn ? '' : 'none';
  document.body.classList.toggle('contextmenu-disabled', !contextMenuOn);
}

btnExtFolder.addEventListener('click', () => window.dlchan.openExtensionFolder());
btnExtCopyPath.addEventListener('click', async () => {
  const extPath = await window.dlchan.getExtensionPath();
  navigator.clipboard.writeText(extPath);
});

btnWelcomeDone.addEventListener('click', () => {
  localStorage.setItem('dlchan-hls-enabled', document.getElementById('welcome-hls').checked ? '1' : '0');
  localStorage.setItem('dlchan-clipboard-monitor', document.getElementById('welcome-clipboard').checked ? '1' : '0');
  localStorage.setItem('dlchan-scheduler-enabled', document.getElementById('welcome-scheduler').checked ? '1' : '0');
  localStorage.setItem('dlchan-contextmenu-enabled', document.getElementById('welcome-contextmenu').checked ? '1' : '0');

  if (!document.getElementById('welcome-speedlimit').checked) {
    localStorage.setItem('dlchan-speed-limit', '0');
    settingSpeedLimit.value = 0;
    window.dlchan.setSpeedLimit(0);
  }

  settingClipboardMonitor.checked = document.getElementById('welcome-clipboard').checked;
  localStorage.setItem('dlchan-setup-done', '1');

  applyFeatureToggles();
  modalWelcome.classList.add('hidden');
});

if (localStorage.getItem('dlchan-setup-done') !== '1') {
  modalWelcome.classList.remove('hidden');
}
applyFeatureToggles();

queueEl.addEventListener('contextmenu', (event) => {
  if (document.body.classList.contains('contextmenu-disabled')) event.stopImmediatePropagation();
}, true);

// --- License / trial gate ----------------------------------------------------

const modalLicense = document.getElementById('modal-license');
const licenseTitle = document.getElementById('license-title');
const licenseMessage = document.getElementById('license-message');
const licenseCodeInput = document.getElementById('license-code-input');
const licenseError = document.getElementById('license-error');
const btnLicenseActivate = document.getElementById('btn-license-activate');
const statusLicense = document.getElementById('status-license');

async function refreshLicenseStatus() {
  const status = await window.dlchan.getLicenseStatus();

  if (status.licensed) {
    modalLicense.classList.add('hidden');
    if (status.mode === 'trial') {
      statusLicense.textContent = `ทดลองใช้งาน — เหลือ ${status.trialDaysLeft} วัน`;
    } else if (status.mode === 'lifetime') {
      statusLicense.textContent = 'ใช้งานตลอดชีพ';
    } else {
      statusLicense.textContent = `เปิดใช้งานด้วยโค้ด — ถึง ${new Date(status.expiresAt).toLocaleDateString('th-TH')}`;
    }
    return;
  }

  statusLicense.textContent = 'หมดอายุการใช้งาน';
  licenseTitle.textContent = status.savedCodeExpired ? 'โค้ดนี้หมดอายุแล้ว' : 'หมดเวลาทดลองใช้งาน';
  licenseMessage.textContent = 'กรุณากรอกโค้ดใหม่เพื่อใช้งานต่อ';
  modalLicense.classList.remove('hidden');
}

btnLicenseActivate.addEventListener('click', async () => {
  const code = licenseCodeInput.value.trim();
  if (!code) return;
  const result = await window.dlchan.activateLicense(code);
  if (result.ok) {
    licenseError.classList.add('hidden');
    licenseCodeInput.value = '';
    refreshLicenseStatus();
  } else {
    licenseError.textContent = result.reason;
    licenseError.classList.remove('hidden');
  }
});

refreshLicenseStatus();
setInterval(refreshLicenseStatus, 60 * 60 * 1000);

// --- Menu bar ------------------------------------------------------------------

document.getElementById('menu-tasks').addEventListener('click', () => btnAdd.click());

document.getElementById('menu-file').addEventListener('click', () => {
  const folder = settingDefaultFolder.value.trim() || inputPath.value.trim();
  if (folder) window.dlchan.openPath(folder);
});

document.getElementById('menu-downloads').addEventListener('click', () => {
  modalSettings.classList.remove('hidden');
  document.querySelector('.tab-btn[data-tab="tab-connection"]').click();
});

document.getElementById('menu-view').addEventListener('click', () => {
  settingShowMascot.checked = !settingShowMascot.checked;
  settingShowMascot.dispatchEvent(new Event('change'));
});

document.getElementById('menu-help').addEventListener('click', () => {
  modalWelcome.classList.remove('hidden');
});

// --- Update checker ------------------------------------------------------------

const versionText = document.getElementById('version-text');
const btnCheckUpdate = document.getElementById('btn-check-update');
const updateResultText = document.getElementById('update-result-text');
const updateToast = document.getElementById('update-toast');
const updateToastSub = document.getElementById('update-toast-sub');
const btnUpdateDownload = document.getElementById('btn-update-download');
const btnUpdateDismiss = document.getElementById('btn-update-dismiss');

versionText.textContent = `เวอร์ชันปัจจุบัน: ${window.dlchan.version}`;

function showUpdateToast(result) {
  updateToastSub.textContent = `v${result.latestVersion} — ${result.notes || 'มีการอัปเดตใหม่'}`;
  updateToast.classList.remove('hidden');
  updateToast.dataset.downloadUrl = result.downloadUrl;
}

btnCheckUpdate.addEventListener('click', async () => {
  updateResultText.textContent = 'กำลังตรวจสอบ...';
  const result = await window.dlchan.checkForUpdateNow();
  if (result.error) {
    updateResultText.textContent = `เช็คไม่สำเร็จ: ${result.error}`;
  } else if (result.hasUpdate) {
    updateResultText.textContent = `พบเวอร์ชันใหม่ v${result.latestVersion}`;
    showUpdateToast(result);
  } else {
    updateResultText.textContent = 'คุณใช้เวอร์ชันล่าสุดอยู่แล้ว';
  }
});

btnUpdateDownload.addEventListener('click', () => {
  window.dlchan.openUpdateDownload(updateToast.dataset.downloadUrl);
});

btnUpdateDismiss.addEventListener('click', () => updateToast.classList.add('hidden'));

window.dlchan.onUpdateAvailable((result) => showUpdateToast(result));

renderQueue();
