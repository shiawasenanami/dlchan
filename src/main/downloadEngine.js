const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const PART_DIR_SUFFIX = '.dlchan-parts';

const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DL-chan/0.1.0'
};

// Global bandwidth cap shared across every DownloadTask, editable live from
// Settings without restarting a download. 0 = unlimited.
class SpeedLimiter {
  constructor() {
    this.limitBytesPerSec = 0;
    this.usedThisSecond = 0;
    setInterval(() => { this.usedThisSecond = 0; }, 1000).unref();
  }

  setLimit(bytesPerSec) {
    this.limitBytesPerSec = bytesPerSec || 0;
  }

  // Resolves immediately if under budget, otherwise waits out the rest of
  // the current 1s window before letting the caller proceed.
  async throttle(bytes) {
    if (!this.limitBytesPerSec) return;
    this.usedThisSecond += bytes;
    if (this.usedThisSecond > this.limitBytesPerSec) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
}

const globalLimiter = new SpeedLimiter();

function requestFor(urlObj, options) {
  const lib = urlObj.protocol === 'http:' ? http : https;
  const headers = { ...DEFAULT_HEADERS, ...(options.headers || {}) };
  return lib.request(urlObj, { ...options, headers });
}

// Follows redirects, resolves with { statusCode, headers, finalUrl }
function probe(urlString, extraHeaders) {
  return new Promise((resolve, reject) => {
    function attempt(target, redirectsLeft) {
      const urlObj = new URL(target);
      const req = requestFor(urlObj, { method: 'HEAD', headers: extraHeaders });
      req.on('response', (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
          res.resume();
          const next = new URL(res.headers.location, target).toString();
          attempt(next, redirectsLeft - 1);
          return;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, finalUrl: target });
        res.resume();
      });
      req.on('error', reject);
      req.end();
    }
    attempt(urlString, 5);
  });
}

// GET request that follows redirects, resolves the full response body as a Buffer.
function fetchBuffer(urlString, extraHeaders, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlString);
    const req = requestFor(urlObj, { method: 'GET', headers: extraHeaders });
    req.on('response', (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        const next = new URL(res.headers.location, urlString).toString();
        fetchBuffer(next, extraHeaders, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      if (res.statusCode >= 400) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ body: Buffer.concat(chunks), finalUrl: urlString }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

// --- Minimal HLS (.m3u8) playlist parser -----------------------------------

function parseM3U8(text, baseUrl) {
  const lines = text.split(/\r?\n/);
  const isMaster = lines.some((l) => l.startsWith('#EXT-X-STREAM-INF'));

  if (isMaster) {
    let bestBandwidth = -1;
    let bestUri = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('#EXT-X-STREAM-INF')) {
        const match = /BANDWIDTH=(\d+)/.exec(lines[i]);
        const bandwidth = match ? parseInt(match[1], 10) : 0;
        const uri = lines[i + 1] && !lines[i + 1].startsWith('#') ? lines[i + 1].trim() : null;
        if (uri && bandwidth >= bestBandwidth) {
          bestBandwidth = bandwidth;
          bestUri = uri;
        }
      }
    }
    return { master: true, variantUrl: bestUri ? new URL(bestUri, baseUrl).toString() : null };
  }

  const segments = [];
  let currentKey = null;
  let sequence = 0;

  for (const line of lines) {
    if (line.startsWith('#EXT-X-KEY')) {
      const methodMatch = /METHOD=([^,]+)/.exec(line);
      const uriMatch = /URI="([^"]+)"/.exec(line);
      const ivMatch = /IV=0x([0-9a-fA-F]+)/.exec(line);
      if (methodMatch && methodMatch[1] === 'NONE') {
        currentKey = null;
      } else if (uriMatch) {
        currentKey = {
          uri: new URL(uriMatch[1], baseUrl).toString(),
          iv: ivMatch ? ivMatch[1] : null
        };
      }
      continue;
    }
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE')) {
      sequence = parseInt(line.split(':')[1], 10) || 0;
      continue;
    }
    if (line.startsWith('#') || line.trim() === '') continue;

    segments.push({
      url: new URL(line.trim(), baseUrl).toString(),
      key: currentKey,
      sequence: sequence + segments.length
    });
  }

  return { master: false, segments };
}

async function resolveMediaPlaylist(url, extraHeaders) {
  const { body, finalUrl } = await fetchBuffer(url, extraHeaders);
  const parsed = parseM3U8(body.toString('utf8'), finalUrl);
  if (parsed.master) {
    if (!parsed.variantUrl) throw new Error('ไม่พบ variant playlist ใน master .m3u8');
    return resolveMediaPlaylist(parsed.variantUrl, extraHeaders);
  }
  return parsed.segments;
}

const keyCache = new Map();

async function getSegmentKey(keyInfo, extraHeaders) {
  if (!keyCache.has(keyInfo.uri)) {
    keyCache.set(keyInfo.uri, fetchBuffer(keyInfo.uri, extraHeaders).then((r) => r.body));
  }
  return keyCache.get(keyInfo.uri);
}

class HlsDownloadTask extends EventEmitter {
  constructor({ id, url, destPath, connections = 8, headers }) {
    super();
    this.id = id;
    this.url = url;
    this.destPath = destPath;
    this.connections = Math.max(1, Math.min(connections, 32));
    this.headers = headers || {};
    this.status = 'pending';
    this.segments = [];
    this.completedSegments = 0;
    this.downloadedBytes = 0;
    this.activeRequests = new Set();
    this.partsDir = destPath + PART_DIR_SUFFIX;
    this.canceled = false;
  }

  progressSnapshot() {
    return {
      id: this.id,
      status: this.status,
      totalBytes: 0,
      downloadedBytes: this.downloadedBytes,
      totalSegments: this.segments.length,
      completedSegments: this.completedSegments,
      connections: this.connections
    };
  }

  emitProgress() {
    this.emit('progress', this.progressSnapshot());
  }

  async start() {
    this.status = 'downloading';
    this.emitProgress();

    try {
      if (this.segments.length === 0) {
        const rawSegments = await resolveMediaPlaylist(this.url, this.headers);
        this.segments = rawSegments.map((seg, index) => ({
          ...seg,
          index,
          partPath: path.join(this.partsDir, `seg${index}.ts`),
          done: false
        }));
      }
    } catch (err) {
      this.status = 'error';
      this.emit('error', err.message);
      return;
    }

    if (!fs.existsSync(this.partsDir)) fs.mkdirSync(this.partsDir, { recursive: true });
    this.runWorkerPool();
  }

  runWorkerPool() {
    const pending = this.segments.filter((s) => !s.done);
    let cursor = 0;
    const next = () => (cursor < pending.length ? pending[cursor++] : null);

    const worker = async () => {
      let segment;
      while (this.status === 'downloading' && (segment = next())) {
        await this.downloadSegment(segment);
      }
    };

    const workers = Array.from({ length: Math.min(this.connections, pending.length || 1) }, worker);
    Promise.all(workers).then(() => {
      if (this.status === 'downloading' && this.segments.every((s) => s.done)) {
        this.merge();
      }
    });
  }

  async downloadSegment(segment) {
    if (fs.existsSync(segment.partPath)) {
      segment.done = true;
      this.completedSegments++;
      this.downloadedBytes += fs.statSync(segment.partPath).size;
      this.emitProgress();
      return;
    }

    const marker = {};
    this.activeRequests.add(marker);
    try {
      const { body } = await fetchBuffer(segment.url, this.headers);
      if (this.status !== 'downloading') return;

      let plain = body;
      if (segment.key) {
        const keyBytes = await getSegmentKey(segment.key, this.headers);
        let iv;
        if (segment.key.iv) {
          iv = Buffer.from(segment.key.iv, 'hex');
        } else {
          iv = Buffer.alloc(16);
          iv.writeUInt32BE(segment.sequence >>> 0, 12);
        }
        const decipher = crypto.createDecipheriv('aes-128-cbc', keyBytes, iv);
        plain = Buffer.concat([decipher.update(body), decipher.final()]);
      }

      fs.writeFileSync(segment.partPath, plain);
      segment.done = true;
      this.completedSegments++;
      this.downloadedBytes += plain.length;
      this.emitProgress();
    } catch (err) {
      if (this.status === 'paused' || this.status === 'canceled') return;
      this.status = 'error';
      this.emit('error', err.message);
    } finally {
      this.activeRequests.delete(marker);
    }
  }

  async merge() {
    this.status = 'merging';
    this.emitProgress();
    // Same temp-then-rename approach as DownloadTask: never leave a partial
    // file at destPath if a segment is missing or the merge throws.
    const tmpPath = this.destPath + '.dlchan-tmp';
    try {
      if (!this.segments.every((s) => s.done)) {
        throw new Error('เซกเมนต์ดาวน์โหลดไม่ครบ');
      }
      const out = fs.createWriteStream(tmpPath);
      for (const segment of [...this.segments].sort((a, b) => a.index - b.index)) {
        await new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(segment.partPath);
          readStream.pipe(out, { end: false });
          readStream.on('end', resolve);
          readStream.on('error', reject);
        });
      }
      out.end();
      await new Promise((resolve) => out.on('finish', resolve));
      fs.renameSync(tmpPath, this.destPath);
      fs.rmSync(this.partsDir, { recursive: true, force: true });
      this.status = 'done';
      this.emitProgress();
    } catch (err) {
      fs.rmSync(tmpPath, { force: true });
      this.status = 'error';
      this.emit('error', err.message);
    }
  }

  pause() {
    if (this.status !== 'downloading') return;
    this.status = 'paused';
    this.emitProgress();
  }

  resume() {
    if (this.status !== 'paused' && this.status !== 'error') return;
    this.status = 'downloading';
    this.emitProgress();
    this.runWorkerPool();
  }

  cancel() {
    this.status = 'canceled';
    fs.rmSync(this.partsDir, { recursive: true, force: true });
    fs.rmSync(this.destPath + '.dlchan-tmp', { force: true });
    if (fs.existsSync(this.destPath)) fs.rmSync(this.destPath, { force: true });
    this.emitProgress();
  }
}

class DownloadTask extends EventEmitter {
  constructor({ id, url, destPath, connections = 8, headers }) {
    super();
    this.id = id;
    this.url = url;
    this.destPath = destPath;
    this.requestedConnections = connections;
    this.headers = headers || {};
    this.status = 'pending'; // pending | downloading | paused | merging | done | error | canceled
    this.totalBytes = 0;
    this.segments = [];
    this.activeRequests = new Map();
    this.partsDir = destPath + PART_DIR_SUFFIX;
  }

  get downloadedBytes() {
    return this.segments.reduce((sum, seg) => sum + seg.downloaded, 0);
  }

  progressSnapshot() {
    return {
      id: this.id,
      status: this.status,
      totalBytes: this.totalBytes,
      downloadedBytes: this.downloadedBytes,
      connections: this.segments.length || this.requestedConnections
    };
  }

  emitProgress() {
    this.emit('progress', this.progressSnapshot());
  }

  async start() {
    this.status = 'downloading';
    this.emitProgress();

    // Some servers reject/RST a HEAD request outright (no status code at
    // all) even though a plain GET works fine — fall back to a single
    // unranged connection instead of failing the whole download over that.
    let info;
    try {
      info = await probe(this.url, this.headers);
    } catch (err) {
      info = { statusCode: 0, headers: {}, finalUrl: this.url };
    }

    this.finalUrl = info.finalUrl;
    // Only trust the probe's headers on a genuine 200 — some CDNs reject or
    // mishandle HEAD requests (403/405/redirect-to-error-page) while GET
    // works fine. Blindly trusting a wrong content-length there previously
    // caused segments to be marked "done" with zero bytes downloaded,
    // producing a corrupt/empty output file that still reported "done".
    const headOk = info.statusCode === 200;
    const acceptsRanges = headOk && info.headers['accept-ranges'] === 'bytes';
    const length = headOk ? parseInt(info.headers['content-length'] || '0', 10) : 0;
    this.totalBytes = length;

    const connections = acceptsRanges && length > 0
      ? Math.max(1, Math.min(this.requestedConnections, 32))
      : 1;

    if (!fs.existsSync(this.partsDir)) fs.mkdirSync(this.partsDir, { recursive: true });

    if (this.segments.length === 0) {
      const chunkSize = Math.ceil(length / connections) || length;
      for (let i = 0; i < connections; i++) {
        const start = i * chunkSize;
        const end = length > 0
          ? (i === connections - 1 ? length - 1 : Math.min(start + chunkSize - 1, length - 1))
          : undefined;
        this.segments.push({
          index: i,
          start,
          end,
          partPath: path.join(this.partsDir, `part${i}`),
          downloaded: 0,
          done: false
        });
      }
    }

    this.downloadAllSegments();
  }

  downloadAllSegments() {
    this.segments.forEach((segment) => {
      if (!segment.done) this.downloadSegment(segment);
    });
  }

  downloadSegment(segment) {
    let alreadyWritten = 0;
    if (fs.existsSync(segment.partPath)) {
      alreadyWritten = fs.statSync(segment.partPath).size;
    }
    segment.downloaded = alreadyWritten;
    this.emitProgress();

    const rangeStart = segment.start + alreadyWritten;
    if (segment.end !== undefined && rangeStart > segment.end) {
      segment.done = true;
      this.checkAllDone();
      return;
    }

    const urlObj = new URL(this.finalUrl);
    const headers = { ...this.headers };
    if (this.totalBytes > 0) {
      headers.Range = segment.end !== undefined
        ? `bytes=${rangeStart}-${segment.end}`
        : `bytes=${rangeStart}-`;
    }

    const req = requestFor(urlObj, { method: 'GET', headers });
    this.activeRequests.set(segment.index, req);

    req.on('response', (res) => {
      if (res.statusCode >= 400) {
        this.status = 'error';
        this.emit('error', `HTTP ${res.statusCode}`);
        res.resume();
        return;
      }
      const writeStream = fs.createWriteStream(segment.partPath, { flags: alreadyWritten ? 'a' : 'w' });
      // Written manually (not res.pipe()) so our own pause/resume for the
      // speed limiter isn't fought by pipe()'s built-in flow control.
      res.on('data', (chunk) => {
        segment.downloaded += chunk.length;
        this.emitProgress();
        writeStream.write(chunk);
        if (globalLimiter.limitBytesPerSec) {
          res.pause();
          globalLimiter.throttle(chunk.length).then(() => res.resume());
        }
      });
      res.on('end', () => writeStream.end());
      writeStream.on('finish', () => {
        segment.done = true;
        this.activeRequests.delete(segment.index);
        this.checkAllDone();
      });
    });

    req.on('error', (err) => {
      this.activeRequests.delete(segment.index);
      if (this.status === 'paused' || this.status === 'canceled') return;
      this.status = 'error';
      this.emit('error', err.message);
    });

    req.end();
  }

  checkAllDone() {
    if (this.status !== 'downloading') return;
    if (this.segments.every((s) => s.done)) {
      this.merge();
    }
  }

  async merge() {
    this.status = 'merging';
    this.emitProgress();
    // Merge into a temp path first and only move it to destPath once we know
    // the result is complete — this way a failed/corrupt download never
    // leaves a bogus file behind that the user has to notice and delete.
    const tmpPath = this.destPath + '.dlchan-tmp';
    try {
      const out = fs.createWriteStream(tmpPath);
      for (const segment of this.segments.sort((a, b) => a.index - b.index)) {
        await new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(segment.partPath);
          readStream.pipe(out, { end: false });
          readStream.on('end', resolve);
          readStream.on('error', reject);
        });
      }
      out.end();
      await new Promise((resolve) => out.on('finish', resolve));

      // Defensive integrity check: if we knew the expected size upfront,
      // make sure the merged file actually matches it instead of silently
      // reporting "done" on a truncated/corrupt result.
      if (this.totalBytes > 0) {
        const actualSize = fs.statSync(tmpPath).size;
        if (actualSize !== this.totalBytes) {
          fs.rmSync(this.partsDir, { recursive: true, force: true });
          fs.rmSync(tmpPath, { force: true });
          this.status = 'error';
          this.emit('error', `ไฟล์ไม่ครบ (ได้ ${actualSize} จาก ${this.totalBytes} ไบต์) — เว็บนี้อาจไม่รองรับการโหลดแบบนี้`);
          return;
        }
      }

      fs.renameSync(tmpPath, this.destPath);
      fs.rmSync(this.partsDir, { recursive: true, force: true });
      this.status = 'done';
      this.emitProgress();
    } catch (err) {
      fs.rmSync(tmpPath, { force: true });
      this.status = 'error';
      this.emit('error', err.message);
    }
  }

  pause() {
    if (this.status !== 'downloading') return;
    this.status = 'paused';
    this.activeRequests.forEach((req) => req.destroy());
    this.activeRequests.clear();
    this.emitProgress();
  }

  resume() {
    if (this.status !== 'paused' && this.status !== 'error') return;
    this.status = 'downloading';
    this.emitProgress();
    this.downloadAllSegments();
  }

  cancel() {
    this.status = 'canceled';
    this.activeRequests.forEach((req) => req.destroy());
    this.activeRequests.clear();
    fs.rmSync(this.partsDir, { recursive: true, force: true });
    fs.rmSync(this.destPath + '.dlchan-tmp', { force: true });
    if (fs.existsSync(this.destPath)) fs.rmSync(this.destPath, { force: true });
    this.emitProgress();
  }
}

class DownloadManager {
  constructor() {
    this.tasks = new Map();
    this.nextId = 1;
  }

  createTask({ url, destPath, connections, headers }) {
    const id = String(this.nextId++);
    const task = new DownloadTask({ id, url, destPath, connections, headers });
    this.tasks.set(id, task);
    return task;
  }

  createHlsTask({ url, destPath, connections, headers }) {
    const id = String(this.nextId++);
    const task = new HlsDownloadTask({ id, url, destPath, connections, headers });
    this.tasks.set(id, task);
    return task;
  }

  get(id) {
    return this.tasks.get(id);
  }
}

function isHlsUrl(url) {
  return /\.m3u8(\?|$)/i.test(url);
}

function setGlobalSpeedLimit(bytesPerSec) {
  globalLimiter.setLimit(bytesPerSec);
}

module.exports = { DownloadManager, DownloadTask, HlsDownloadTask, isHlsUrl, setGlobalSpeedLimit };
