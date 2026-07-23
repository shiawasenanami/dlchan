const api = typeof browser !== 'undefined' ? browser : chrome;
const BRIDGE = 'http://127.0.0.1:47921';
const VIDEO_EXT = /\.(mp4|webm|mkv|mov|ts|avi|flv)(\?|$)/i;
const HLS_EXT = /\.m3u8(\?|$)/i;
const MIN_SIZE_BYTES = 200 * 1024; // skip tiny thumbnails/preview clips

function headerValue(headers, name) {
  const found = (headers || []).find((h) => h.name.toLowerCase() === name);
  return found ? found.value : null;
}

function extFromUrl(url) {
  try {
    const clean = new URL(url).pathname.split('.').pop();
    return clean && clean.length <= 5 ? `.${clean.split('/').pop()}` : '';
  } catch {
    return '';
  }
}

function guessFilenameFromUrl(url) {
  try {
    const clean = new URL(url).pathname.split('/').filter(Boolean).pop();
    return decodeURIComponent(clean || 'video');
  } catch {
    return 'video';
  }
}

// Content-Disposition looks like: attachment; filename="real name.mp4"
// or the RFC 5987 form: filename*=UTF-8''real%20name.mp4
function filenameFromContentDisposition(headers) {
  const cd = headerValue(headers, 'content-disposition');
  if (!cd) return null;
  const starMatch = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(cd);
  if (starMatch) {
    try { return decodeURIComponent(starMatch[1].trim().replace(/"/g, '')); } catch { /* fall through */ }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(cd);
  return plainMatch ? plainMatch[1].trim() : null;
}

const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]/g;

function sanitizeForFilesystem(name) {
  return name.replace(ILLEGAL_FILENAME_CHARS, '_').replace(/\s+/g, ' ').trim();
}

// Picks the most meaningful name available, in order of trust: an explicit
// Content-Disposition filename from the server, then the page's <title>
// (so a random CDN hash URL still becomes something like "My Video.mp4"),
// falling back to the URL's own path segment only as a last resort.
function resolveFilename({ headers, url, pageTitle }) {
  const fromHeader = filenameFromContentDisposition(headers);
  if (fromHeader) return sanitizeForFilesystem(fromHeader);

  const ext = extFromUrl(url) || '.mp4';
  if (pageTitle && pageTitle.trim()) {
    const cleanTitle = sanitizeForFilesystem(pageTitle.trim()).slice(0, 80);
    if (cleanTitle) return `${cleanTitle}${ext}`;
  }

  return guessFilenameFromUrl(url);
}

// Many video CDNs 403 a request that doesn't carry the same Referer/Cookie
// the browser sent — capture the real outgoing request headers here and
// forward them to DL-chan so its downloader can replay them.
const pendingRequestHeaders = new Map();
// Remembers the last captured headers per media URL so the "queue" click
// (which only carries url/filename from the content-script bar) can still
// replay the same Referer/Cookie the browser used to fetch it.
const detectedHeadersByUrl = new Map();

api.webRequest.onSendHeaders.addListener(
  (details) => {
    pendingRequestHeaders.set(details.requestId, details.requestHeaders || []);
  },
  { urls: ['<all_urls>'], types: ['media', 'xmlhttprequest', 'object'] },
  ['requestHeaders', 'extraHeaders']
);

function captureAndForwardHeaders(requestId) {
  const requestHeaders = pendingRequestHeaders.get(requestId);
  pendingRequestHeaders.delete(requestId);
  if (!requestHeaders) return {};
  const referer = headerValue(requestHeaders, 'referer');
  const cookie = headerValue(requestHeaders, 'cookie');
  const origin = headerValue(requestHeaders, 'origin');
  const userAgent = headerValue(requestHeaders, 'user-agent');
  const headers = {};
  if (referer) headers.referer = referer;
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  if (userAgent) headers['user-agent'] = userAgent;
  return headers;
}

api.webRequest.onHeadersReceived.addListener(
  (details) => {
    const requestHeaders = captureAndForwardHeaders(details.requestId);
    const contentType = headerValue(details.responseHeaders, 'content-type') || '';
    const isVideoType = /^(video|audio)\//i.test(contentType);
    const isVideoExt = VIDEO_EXT.test(details.url);
    const isHls = HLS_EXT.test(details.url) || /mpegurl/i.test(contentType);
    if (!isVideoType && !isVideoExt && !isHls) return;

    if (!isHls) {
      const contentLength = parseInt(headerValue(details.responseHeaders, 'content-length') || '0', 10);
      if (contentLength && contentLength < MIN_SIZE_BYTES) return;
    }

    const mediaType = isHls ? 'hls' : (isVideoType ? contentType.split('/')[0] : 'video');

    const tabTitlePromise = details.tabId >= 0
      ? api.tabs.get(details.tabId).then((tab) => tab.title).catch(() => null)
      : Promise.resolve(null);

    tabTitlePromise.then((pageTitle) => {
      const filename = resolveFilename({ headers: details.responseHeaders, url: details.url, pageTitle });
      if (!requestHeaders.referer) requestHeaders.referer = details.originUrl || details.documentUrl || '';
      if (detectedHeadersByUrl.size > 300) detectedHeadersByUrl.clear();
      detectedHeadersByUrl.set(details.url, requestHeaders);

      fetch(`${BRIDGE}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: details.url, filename, pageUrl: details.originUrl || details.url, mediaType, headers: requestHeaders })
      }).then(() => {
        if (details.tabId >= 0) {
          api.tabs.sendMessage(details.tabId, { type: 'DLCHAN_SHOW_BAR', filename, url: details.url }).catch(() => {});
        }
      }).catch(() => {
        // DL-chan desktop app isn't running — stay silent, don't nag the user
      });
    });
  },
  { urls: ['<all_urls>'], types: ['media', 'xmlhttprequest', 'object'] },
  ['responseHeaders']
);

api.runtime.onMessage.addListener((message) => {
  if (message.type !== 'DLCHAN_QUEUE') return;
  const headers = detectedHeadersByUrl.get(message.url) || {};
  fetch(`${BRIDGE}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: message.url, filename: message.filename, connections: 8, headers })
  }).catch(() => {});
});
