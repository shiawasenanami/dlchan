const https = require('http');
const httpsReal = require('https');
const { version: CURRENT_VERSION } = require('../../package.json');

// Hosted via GitHub (github.com/shiawasenanami/dlchan-releases). Update this
// repo's latest.json + create a new Release with the new .exe each time a
// new version ships — see chat for the exact steps.
const MANIFEST_URL = 'https://raw.githubusercontent.com/shiawasenanami/dlchan-releases/main/latest.json';

function compareVersions(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

function fetchManifest(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? httpsReal : https;
    lib.get(url, { timeout: 8000 }, (res) => {
      if (res.statusCode >= 400) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')); });
  });
}

async function checkForUpdate(manifestUrl = MANIFEST_URL) {
  if (manifestUrl.includes('REPLACE-WITH-YOUR-HOSTED-URL')) {
    return { hasUpdate: false, currentVersion: CURRENT_VERSION, error: 'ยังไม่ได้ตั้งค่า URL manifest สำหรับเช็คอัปเดต' };
  }
  try {
    const manifest = await fetchManifest(manifestUrl);
    const hasUpdate = compareVersions(manifest.version, CURRENT_VERSION) > 0;
    return {
      hasUpdate,
      currentVersion: CURRENT_VERSION,
      latestVersion: manifest.version,
      downloadUrl: manifest.url,
      notes: manifest.notes || ''
    };
  } catch (err) {
    return { hasUpdate: false, currentVersion: CURRENT_VERSION, error: err.message };
  }
}

module.exports = { checkForUpdate, compareVersions, CURRENT_VERSION, MANIFEST_URL };
