// Downloads the latest yt-dlp.exe release binary into vendor/ so it can be
// bundled with the installer (see package.json "build.extraResources").
// yt-dlp itself has no small first-party npm wrapper worth trusting for a
// shipped app, and the binary is large/updates often — so instead of
// committing it to git, this script re-fetches it on demand. Run this
// whenever you want to refresh the bundled yt-dlp version, then rebuild.
const fs = require('fs');
const path = require('path');
const https = require('https');

const VENDOR_DIR = path.join(__dirname, '..', 'vendor');
const DEST = path.join(VENDOR_DIR, 'yt-dlp.exe');
const API_URL = 'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest';

function get(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'DL-chan-build-script' } }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        get(res.headers.location, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      if (res.statusCode >= 400) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      resolve(res);
    }).on('error', reject);
  });
}

async function fetchJson(url) {
  const res = await get(url);
  let data = '';
  for await (const chunk of res) data += chunk;
  return JSON.parse(data);
}

async function main() {
  console.log('Checking latest yt-dlp release...');
  const release = await fetchJson(API_URL);
  const asset = release.assets.find((a) => a.name === 'yt-dlp.exe');
  if (!asset) throw new Error('yt-dlp.exe asset not found in latest release');

  console.log(`Downloading yt-dlp.exe ${release.tag_name} (${(asset.size / 1024 / 1024).toFixed(1)} MB)...`);
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  const res = await get(asset.browser_download_url);
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(DEST);
    res.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
  });

  fs.writeFileSync(path.join(VENDOR_DIR, 'yt-dlp.version.json'), JSON.stringify({ version: release.tag_name }, null, 2));
  console.log(`Done: ${DEST}`);
}

main().catch((err) => {
  console.error('Failed to fetch yt-dlp:', err.message);
  process.exit(1);
});
