const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const ffmpegPath = require('ffmpeg-static');

// A generic webpage URL (YouTube/Twitter/TikTok/Facebook/etc.) doesn't point
// at a direct media file — yt-dlp knows how to scrape those per-site. Direct
// file links and .m3u8 already have their own faster/simpler task classes
// (DownloadTask / HlsDownloadTask), so this is only used as the fallback for
// "URL that isn't a downloadable file by itself".
const YTDLP_DOMAINS = [
  'youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'tiktok.com',
  'facebook.com', 'fb.watch', 'instagram.com', 'vimeo.com', 'twitch.tv',
  'dailymotion.com', 'reddit.com', 'soundcloud.com', 'bilibili.com', 'niconico.jp'
];

function isYtDlpUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return YTDLP_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function resolveYtDlpPath() {
  let isPackaged = false;
  let resourcesPath = null;
  try {
    const { app } = require('electron');
    isPackaged = app.isPackaged;
    resourcesPath = process.resourcesPath;
  } catch {
    // running outside Electron (e.g. a standalone script) — fall through
  }
  const base = isPackaged ? resourcesPath : path.join(__dirname, '..', '..');
  return path.join(base, 'vendor', 'yt-dlp.exe');
}

const YTDLP_PATH = resolveYtDlpPath();

function isYtDlpAvailable() {
  return fs.existsSync(YTDLP_PATH);
}

// Runs `yt-dlp -J <url>` to list available formats without downloading
// anything — used to populate a quality picker before committing to one.
function listFormats(url) {
  return new Promise((resolve, reject) => {
    if (!isYtDlpAvailable()) {
      reject(new Error('ไม่พบ yt-dlp — รัน "npm run fetch:ytdlp" แล้ว build ใหม่'));
      return;
    }
    const proc = spawn(YTDLP_PATH, ['-J', '--no-playlist', url]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (chunk) => { stdout += chunk; });
    proc.stderr.on('data', (chunk) => { stderr += chunk; });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim().split('\n').pop() || `yt-dlp exited with code ${code}`));
        return;
      }
      try {
        const info = JSON.parse(stdout);
        const formats = (info.formats || [])
          .filter((f) => f.vcodec !== 'none' || f.acodec !== 'none')
          .map((f) => ({
            formatId: f.format_id,
            ext: f.ext,
            note: f.format_note || '',
            height: f.height || null,
            tbr: f.tbr || null,
            filesize: f.filesize || f.filesize_approx || null,
            isAudioOnly: f.vcodec === 'none',
            isVideoOnly: f.acodec === 'none'
          }));
        resolve({ title: info.title || 'download', formats });
      } catch (err) {
        reject(new Error('อ่านข้อมูลจาก yt-dlp ไม่สำเร็จ'));
      }
    });
  });
}

// Parses yt-dlp's default progress lines, e.g.:
// "[download]  42.5% of  123.45MiB at    2.34MiB/s ETA 00:30"
const PROGRESS_RE = /\[download\]\s+([\d.]+)% of\s+~?\s*([\d.]+)(K|M|G)iB/;

function sizeToBytes(value, unit) {
  const n = parseFloat(value);
  const mult = { K: 1024, M: 1024 ** 2, G: 1024 ** 3 }[unit] || 1;
  return Math.round(n * mult);
}

class YtDlpTask extends EventEmitter {
  constructor({ id, url, destPath, formatId }) {
    super();
    this.id = id;
    this.url = url;
    this.destPath = destPath;
    // yt-dlp writes/merges directly to whatever -o points at, including
    // ffmpeg's merge step — if that step fails partway, a corrupt file
    // lands exactly there. Point -o at a temp path instead and only move
    // it to destPath once the whole process has exited successfully, same
    // pattern as DownloadTask/HlsDownloadTask's merge().
    this.tempPath = `${destPath}.dlchan-tmp.mp4`;
    this.formatId = formatId || 'bv*+ba/b';
    this.status = 'pending';
    this.totalBytes = 0;
    this.downloadedBytes = 0;
    this.proc = null;
    this.canceled = false;
  }

  // Removes the temp output plus any leftover per-format fragment files
  // yt-dlp creates while merging (e.g. "<temp>.f137.mp4", "<temp>.part") —
  // matched by prefix since the exact suffix varies by format/codec.
  cleanupTempFiles() {
    const dir = path.dirname(this.tempPath);
    const prefix = path.basename(this.tempPath);
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }
    entries
      .filter((name) => name.startsWith(prefix))
      .forEach((name) => fs.rmSync(path.join(dir, name), { force: true }));
  }

  progressSnapshot() {
    return {
      id: this.id,
      status: this.status,
      totalBytes: this.totalBytes,
      downloadedBytes: this.downloadedBytes,
      connections: 1
    };
  }

  emitProgress() {
    this.emit('progress', this.progressSnapshot());
  }

  start() {
    if (!isYtDlpAvailable()) {
      this.status = 'error';
      this.emit('error', 'ไม่พบ yt-dlp ในเครื่อง — โหลดลิงก์เว็บไซต์แบบนี้ไม่ได้');
      return;
    }

    this.status = 'downloading';
    this.emitProgress();

    const destDir = path.dirname(this.destPath);
    fs.mkdirSync(destDir, { recursive: true });

    const args = [
      '-f', this.formatId,
      '--no-playlist',
      '--newline',
      '--continue',
      '--merge-output-format', 'mp4',
      '--ffmpeg-location', ffmpegPath,
      '-o', this.tempPath,
      this.url
    ];

    this.proc = spawn(YTDLP_PATH, args);
    let stderrTail = '';

    this.proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      const match = PROGRESS_RE.exec(text);
      if (match) {
        const percent = parseFloat(match[1]);
        this.totalBytes = sizeToBytes(match[2], match[3]);
        this.downloadedBytes = Math.round((percent / 100) * this.totalBytes);
        this.emitProgress();
      }
      if (/\[Merger\]|\[ExtractAudio\]|Merging formats/i.test(text)) {
        this.status = 'merging';
        this.emitProgress();
      }
    });

    this.proc.stderr.on('data', (chunk) => { stderrTail = (stderrTail + chunk.toString()).slice(-500); });

    this.proc.on('error', (err) => {
      if (this.canceled) return;
      this.cleanupTempFiles();
      this.status = 'error';
      this.emit('error', err.message);
    });

    this.proc.on('close', (code) => {
      this.proc = null;
      if (this.canceled) return;
      if (this.status === 'paused') return;

      if (code === 0) {
        try {
          fs.renameSync(this.tempPath, this.destPath);
        } catch (err) {
          this.cleanupTempFiles();
          this.status = 'error';
          this.emit('error', `บันทึกไฟล์ไม่สำเร็จ: ${err.message}`);
          return;
        }
        this.status = 'done';
        this.downloadedBytes = this.totalBytes || this.downloadedBytes;
        this.emitProgress();
      } else {
        this.cleanupTempFiles();
        this.status = 'error';
        this.emit('error', stderrTail.trim().split('\n').pop() || `yt-dlp exited with code ${code}`);
      }
    });
  }

  // yt-dlp writes a .part file and resumes from it automatically via
  // --continue, so pausing is just "stop the process" and resuming is
  // "start it again" — no manual byte-range bookkeeping needed.
  pause() {
    if (this.status !== 'downloading' && this.status !== 'merging') return;
    this.status = 'paused';
    this.proc?.kill();
    this.emitProgress();
  }

  resume() {
    if (this.status !== 'paused' && this.status !== 'error') return;
    this.start();
  }

  cancel() {
    this.canceled = true;
    this.status = 'canceled';
    this.proc?.kill();
    this.cleanupTempFiles();
    fs.rmSync(this.destPath, { force: true });
    this.emitProgress();
  }
}

module.exports = { YtDlpTask, isYtDlpUrl, isYtDlpAvailable, listFormats, YTDLP_PATH };
