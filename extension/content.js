const api = typeof browser !== 'undefined' ? browser : chrome;

api.runtime.onMessage.addListener((message) => {
  if (message.type === 'DLCHAN_SHOW_BAR') showBar(message.filename, message.url);
});

// Remembers where the user last dragged the bar to (per browser tab/session,
// via sessionStorage) so it doesn't keep popping back to the top-right corner
// like it used to — closer to how IDM's floating grab bubble behaves.
function getSavedPosition() {
  try {
    const raw = sessionStorage.getItem('dlchan-bar-pos');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePosition(top, left) {
  try {
    sessionStorage.setItem('dlchan-bar-pos', JSON.stringify({ top, left }));
  } catch {
    // sessionStorage unavailable (e.g. sandboxed iframe) — dragging still
    // works for this instance, it just won't be remembered.
  }
}

function makeDraggable(bar, handle) {
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startTop = 0;
  let startLeft = 0;

  handle.addEventListener('mousedown', (event) => {
    dragging = true;
    const rect = bar.getBoundingClientRect();
    startX = event.clientX;
    startY = event.clientY;
    startTop = rect.top;
    startLeft = rect.left;
    bar.style.right = 'auto';
    bar.classList.add('dlchan-dragging');
    event.preventDefault();
  });

  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    const nextTop = Math.max(0, Math.min(window.innerHeight - bar.offsetHeight, startTop + (event.clientY - startY)));
    const nextLeft = Math.max(0, Math.min(window.innerWidth - bar.offsetWidth, startLeft + (event.clientX - startX)));
    bar.style.top = `${nextTop}px`;
    bar.style.left = `${nextLeft}px`;
  });

  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    bar.classList.remove('dlchan-dragging');
    savePosition(parseFloat(bar.style.top), parseFloat(bar.style.left));
  });
}

function formatQualityLabel(siteName, fmt) {
  const bits = [siteName, fmt.ext ? `${fmt.ext.toUpperCase()} ไฟล์` : 'ไฟล์'];
  if (fmt.height) bits.push(`คุณภาพ ${fmt.height}p${fmt.height >= 720 ? ' HD' : ''}`);
  else if (fmt.note) bits.push(`คุณภาพ ${fmt.note}`);
  if (fmt.filesize) bits.push(`${(fmt.filesize / 1024).toFixed(2)} KB`.replace('.00 KB', ' KB'));
  return bits.join(', ');
}

function buildDropdown(bar, filename, url) {
  const panel = document.createElement('div');
  panel.className = 'dlchan-dropdown hidden';
  panel.innerHTML = '<div class="dlchan-dropdown-loading">กำลังโหลดคุณภาพที่มี...</div>';
  bar.appendChild(panel);

  let loaded = false;

  function renderItems(result) {
    const siteName = location.hostname.replace(/^www\./, '').split('.')[0];
    const items = ['<button class="dlchan-dd-item dlchan-dd-all" data-all>ดาวน์โหลดทั้งหมด</button>'];

    if (result && result.ok && result.formats.length) {
      const heightSeen = new Set();
      [...result.formats].reverse().forEach((fmt, i) => {
        if (fmt.height && heightSeen.has(fmt.height)) return;
        if (fmt.height) heightSeen.add(fmt.height);
        const selector = fmt.isVideoOnly ? `${fmt.formatId}+ba/b` : fmt.formatId;
        items.push(`<button class="dlchan-dd-item" data-format="${selector}" data-index="${i}">${i + 1}. ${formatQualityLabel(siteName, fmt)}</button>`);
      });
    }
    panel.innerHTML = items.join('');

    panel.querySelector('[data-all]').addEventListener('click', () => {
      api.runtime.sendMessage({ type: 'DLCHAN_QUEUE', url, filename });
      bar.remove();
    });
    panel.querySelectorAll('[data-format]').forEach((btn) => {
      btn.addEventListener('click', () => {
        api.runtime.sendMessage({
          type: 'DLCHAN_QUEUE',
          url: location.href,
          filename: (result.title || filename).replace(/[\\/:*?"<>|]/g, '_') + '.mp4',
          formatId: btn.dataset.format
        });
        bar.remove();
      });
    });
  }

  function open() {
    panel.classList.remove('hidden');
    if (loaded) return;
    loaded = true;
    api.runtime.sendMessage({ type: 'DLCHAN_GET_FORMATS', url: location.href }, (result) => renderItems(result));
  }

  return { panel, open, close: () => panel.classList.add('hidden') };
}

function showBar(filename, url) {
  const existing = document.getElementById('dlchan-bar');
  if (existing) existing.remove();

  const bar = document.createElement('div');
  bar.id = 'dlchan-bar';
  bar.innerHTML = `
    <span class="dlchan-drag" title="ลากเพื่อย้ายตำแหน่ง">&#8942;&#8942;</span>
    <span class="dlchan-play">&#9654;</span>
    <span class="dlchan-text">ดาวน์โหลดวิดีโอนี้</span>
    <button class="dlchan-caret" title="เลือกคุณภาพ" type="button">&#9662;</button>
    <button class="dlchan-close" title="ปิด" type="button">&#10005;</button>
  `;
  document.documentElement.appendChild(bar);

  const saved = getSavedPosition();
  if (saved) {
    bar.style.top = `${Math.min(saved.top, window.innerHeight - bar.offsetHeight)}px`;
    bar.style.left = `${Math.min(saved.left, window.innerWidth - bar.offsetWidth)}px`;
    bar.style.right = 'auto';
  }

  makeDraggable(bar, bar.querySelector('.dlchan-drag'));

  const queueAndClose = () => {
    api.runtime.sendMessage({ type: 'DLCHAN_QUEUE', url, filename });
    bar.remove();
  };

  bar.querySelector('.dlchan-play').addEventListener('click', queueAndClose);
  bar.querySelector('.dlchan-text').addEventListener('click', queueAndClose);
  bar.querySelector('.dlchan-close').addEventListener('click', () => bar.remove());

  const dropdown = buildDropdown(bar, filename, url);
  let ddOpen = false;
  bar.querySelector('.dlchan-caret').addEventListener('click', (event) => {
    event.stopPropagation();
    ddOpen = !ddOpen;
    if (ddOpen) dropdown.open(); else dropdown.close();
  });
  document.addEventListener('click', (event) => {
    if (!bar.contains(event.target)) { ddOpen = false; dropdown.close(); }
  });

  setTimeout(() => { if (!ddOpen) bar.remove(); }, 12000);
}
