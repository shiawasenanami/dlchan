const api = typeof browser !== 'undefined' ? browser : chrome;

// Mirrors src/main/ytdlp.js's YTDLP_DOMAINS — on these sites we always
// target the page URL (yt-dlp scrapes it) instead of the <video> element's
// own src, which on these sites is usually a blob: URL or a DASH manifest
// fragment that isn't downloadable on its own.
const YTDLP_DOMAINS = [
  'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'tiktok.com',
  'facebook.com', 'fb.watch', 'instagram.com', 'vimeo.com', 'twitch.tv',
  'dailymotion.com', 'reddit.com', 'soundcloud.com', 'bilibili.com', 'niconico.jp'
];

function isYtDlpDomain(hostname) {
  const host = hostname.replace(/^www\./, '');
  return YTDLP_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

const PAGE_IS_YTDLP_SITE = isYtDlpDomain(location.hostname);

function sanitizeForFilesystem(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim();
}

function formatQualityLabel(fmt) {
  const bits = [];
  if (fmt.height) bits.push(`${fmt.height}p${fmt.height >= 720 ? ' HD' : ''}`);
  else if (fmt.isAudioOnly) bits.push('เสียงอย่างเดียว');
  else if (fmt.note) bits.push(fmt.note);
  bits.push((fmt.ext || '').toUpperCase());
  if (fmt.filesize) bits.push(`${(fmt.filesize / 1024 / 1024).toFixed(1)} MB`);
  return bits.filter(Boolean).join(' · ');
}

// --- Per-video floating "download" overlay ----------------------------------
// Pinned to the top-left corner of the <video> it belongs to (not a fixed
// corner of the page), so on a page with several clips it's always obvious
// which one a click will download. Follows scroll/resize and hides entirely
// while its video is scrolled out of view, reappearing when it's back.

const MIN_VIDEO_SIZE = 160; // px — skip tiny/ad/thumbnail <video> elements
const attachedVideos = new WeakSet();

function buildOverlay(videoEl) {
  const overlay = document.createElement('div');
  overlay.className = 'dlchan-ov';
  overlay.innerHTML = `
    <button class="dlchan-ov-main" type="button">
      <span class="dlchan-ov-icon">&#9660;</span>
      <span class="dlchan-ov-label">ดาวน์โหลด</span>
    </button>
    <button class="dlchan-ov-caret" type="button" title="เลือกคุณภาพ">&#9662;</button>
    <div class="dlchan-ov-dropdown dlchan-hidden"></div>
  `;
  document.documentElement.appendChild(overlay);

  function reposition() {
    const rect = videoEl.getBoundingClientRect();
    const onScreen = rect.width >= MIN_VIDEO_SIZE && rect.height >= MIN_VIDEO_SIZE
      && rect.bottom > 0 && rect.top < window.innerHeight
      && rect.right > 0 && rect.left < window.innerWidth;
    overlay.classList.toggle('dlchan-hidden', !onScreen);
    if (!onScreen) return;
    overlay.style.top = `${Math.max(0, rect.top) + 10}px`;
    overlay.style.left = `${Math.max(0, rect.left) + 10}px`;
  }

  const resolveTargetUrl = () => (PAGE_IS_YTDLP_SITE ? location.href : (videoEl.currentSrc || videoEl.src));
  const resolveFilename = () => `${sanitizeForFilesystem(document.title || 'video')}.mp4`;

  const queue = (formatId) => {
    api.runtime.sendMessage({
      type: 'DLCHAN_QUEUE',
      url: resolveTargetUrl(),
      filename: resolveFilename(),
      formatId
    });
  };

  overlay.querySelector('.dlchan-ov-main').addEventListener('click', (event) => {
    event.stopPropagation();
    queue(undefined);
    overlay.classList.add('dlchan-queued');
    setTimeout(() => overlay.classList.remove('dlchan-queued'), 1500);
  });

  const dropdown = overlay.querySelector('.dlchan-ov-dropdown');
  let ddOpen = false;
  let ddLoaded = false;

  function renderQualityOptions(result) {
    const items = ['<button class="dlchan-dd-item dlchan-dd-all" data-best>คุณภาพดีที่สุด</button>'];
    if (result && result.ok && result.formats && result.formats.length) {
      const heightSeen = new Set();
      [...result.formats].reverse().forEach((fmt) => {
        if (fmt.height && heightSeen.has(fmt.height)) return;
        if (fmt.height) heightSeen.add(fmt.height);
        const selector = fmt.isVideoOnly ? `${fmt.formatId}+ba/b` : fmt.formatId;
        items.push(`<button class="dlchan-dd-item" data-format="${selector}">${formatQualityLabel(fmt)}</button>`);
      });
    } else if (!PAGE_IS_YTDLP_SITE) {
      items.push('<div class="dlchan-dropdown-loading">ไฟล์นี้มีคุณภาพเดียว</div>');
    }
    dropdown.innerHTML = items.join('');
    dropdown.querySelector('[data-best]').addEventListener('click', () => { queue(undefined); dropdown.classList.add('dlchan-hidden'); ddOpen = false; });
    dropdown.querySelectorAll('[data-format]').forEach((btn) => {
      btn.addEventListener('click', () => { queue(btn.dataset.format); dropdown.classList.add('dlchan-hidden'); ddOpen = false; });
    });
  }

  overlay.querySelector('.dlchan-ov-caret').addEventListener('click', (event) => {
    event.stopPropagation();
    ddOpen = !ddOpen;
    dropdown.classList.toggle('dlchan-hidden', !ddOpen);
    if (!ddOpen || ddLoaded) return;
    ddLoaded = true;
    if (!PAGE_IS_YTDLP_SITE) {
      renderQualityOptions(null);
      return;
    }
    dropdown.innerHTML = '<div class="dlchan-dropdown-loading">กำลังโหลดคุณภาพที่มี...</div>';
    api.runtime.sendMessage({ type: 'DLCHAN_GET_FORMATS', url: location.href }, (result) => renderQualityOptions(result));
  });

  document.addEventListener('click', (event) => {
    if (!overlay.contains(event.target)) { ddOpen = false; dropdown.classList.add('dlchan-hidden'); }
  });

  const io = new IntersectionObserver(reposition, { threshold: [0, 0.1, 0.5, 1] });
  io.observe(videoEl);
  window.addEventListener('scroll', reposition, true);
  window.addEventListener('resize', reposition);
  reposition();

  // Clean up if the video element itself gets removed from the page (SPA
  // navigation, feed item scrolled away and unmounted, etc.).
  new MutationObserver(() => {
    if (!document.documentElement.contains(videoEl)) {
      io.disconnect();
      overlay.remove();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}

function attachOverlayIfEligible(videoEl) {
  if (attachedVideos.has(videoEl)) return;
  const rect = videoEl.getBoundingClientRect();
  if (rect.width < MIN_VIDEO_SIZE && rect.height < MIN_VIDEO_SIZE && !PAGE_IS_YTDLP_SITE) return;
  attachedVideos.add(videoEl);
  buildOverlay(videoEl);
}

function scanForVideos() {
  document.querySelectorAll('video').forEach(attachOverlayIfEligible);
}

scanForVideos();
new MutationObserver(scanForVideos).observe(document.documentElement, { childList: true, subtree: true });
// Some sites (YouTube, Facebook) resize/replace the video element's
// dimensions after it starts buffering — re-check periodically for the
// first while so an overlay isn't missed just because it was too small
// (or zero-sized) at the moment it first appeared in the DOM.
let rescanCount = 0;
const rescanTimer = setInterval(() => {
  scanForVideos();
  if (++rescanCount > 20) clearInterval(rescanTimer);
}, 1000);
