const http = require('http');
const path = require('path');
const { app } = require('electron');
const { isHlsUrl } = require('./downloadEngine');
const { isYtDlpUrl, listFormats } = require('./ytdlp');

const BRIDGE_PORT = 47921;

// Local loopback HTTP bridge the browser extension talks to over fetch().
// No native-messaging host install needed — works the same for any
// Chromium browser (Chrome/Edge/Brave/Opera) and Firefox as long as the
// extension has host_permissions for http://127.0.0.1:47921/*.
function startExtensionBridge({ downloadManager, getMainWindow, isHlsEnabled = () => true }) {
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, app: 'DL-chan', version: '0.2.2' }));
      return;
    }

    if (req.method === 'POST' && req.url === '/detect') {
      readJsonBody(req).then((body) => {
        const win = getMainWindow();
        if (win) {
          win.webContents.send('bridge:detected', {
            url: body.url,
            filename: body.filename || guessFilename(body.url),
            pageUrl: body.pageUrl || '',
            mediaType: body.mediaType || 'video',
            headers: body.headers || {}
          });
          win.show();
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      }).catch(() => {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/formats') {
      readJsonBody(req).then(async (body) => {
        try {
          const result = await listFormats(body.url);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...result }));
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: err.message }));
        }
      }).catch(() => {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      });
      return;
    }

    if (req.method === 'POST' && req.url === '/queue') {
      readJsonBody(req).then(async (body) => {
        const ytDlp = isYtDlpUrl(body.url);
        const hls = !ytDlp && isHlsEnabled() && isHlsUrl(body.url);

        // For yt-dlp URLs, never trust the client's guessed filename (often
        // a meaningless CDN token) — ask yt-dlp for the real video title.
        let filename = body.filename || guessFilename(body.url);
        if (ytDlp) {
          try {
            const info = await listFormats(body.url);
            filename = `${sanitizeFilename(info.title || 'video')}.mp4`;
          } catch {
            filename = `${sanitizeFilename(body.filename || 'video')}.mp4`;
          }
        }

        const destPath = ytDlp
          ? path.join(app.getPath('downloads'), filename)
          : path.join(app.getPath('downloads'), hls ? filename.replace(/\.m3u8$/i, '.ts') : filename);
        const headers = body.headers || {};
        const task = ytDlp
          ? downloadManager.createYtDlpTask({ url: body.url, destPath, formatId: body.formatId })
          : hls
            ? downloadManager.createHlsTask({ url: body.url, destPath, connections: body.connections || 8, headers })
            : downloadManager.createTask({ url: body.url, destPath, connections: body.connections || 8, headers });
        const win = getMainWindow();
        if (win) {
          task.on('progress', (snapshot) => win.webContents.send('download:progress', snapshot));
          task.on('error', (message) => win.webContents.send('download:error', { id: task.id, message }));
          win.webContents.send('bridge:queued', { id: task.id, name: filename, url: body.url, destPath, headers });
          win.show();
        }
        task.start();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id: task.id }));
      }).catch(() => {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false }));
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(BRIDGE_PORT, '127.0.0.1');
  return server;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sanitizeFilename(name) {
  return name.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim() || 'video';
}

function guessFilename(url) {
  try {
    const clean = new URL(url).pathname.split('/').filter(Boolean).pop();
    return decodeURIComponent(clean || 'download');
  } catch {
    return 'download';
  }
}

module.exports = { startExtensionBridge, BRIDGE_PORT };
