const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// scripts/ is excluded from every packaged build (see package.json
// "build.files"), so this path only ever resolves to a real file on
// Nakano's own dev checkout — never inside a shipped installer. That's the
// entire security boundary: no extra "admin password" needed, because a
// regular user's copy of the app literally cannot reach a private key that
// was never bundled into it.
const PRIVATE_KEY_PATH = path.join(__dirname, '..', '..', 'scripts', 'license-admin', 'license-private.pem');

function isAdminAvailable() {
  return fs.existsSync(PRIVATE_KEY_PATH);
}

// Same code format as scripts/license-admin/generate-license.js and what
// src/main/license.js verifies — kept here so it can be driven from a UI
// inside the app instead of only the command line.
function generateGiftCode({ days, lifetime, note }) {
  if (!isAdminAvailable()) {
    throw new Error('ไม่พบ private key — ฟีเจอร์นี้ใช้ได้เฉพาะเครื่อง dev ของผู้พัฒนาเท่านั้น');
  }
  if (!lifetime && (!days || days <= 0)) {
    throw new Error('กรุณาระบุจำนวนวันที่มากกว่า 0 หรือเลือกตลอดชีพ');
  }

  const privateKey = crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY_PATH, 'utf8'));
  const payload = {
    exp: lifetime ? null : Date.now() + days * 24 * 60 * 60 * 1000,
    note: note || null,
    id: crypto.randomBytes(6).toString('hex')
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.sign(null, Buffer.from(payloadB64), privateKey);
  return { code: `${payloadB64}.${signature.toString('base64url')}`, payload };
}

module.exports = { isAdminAvailable, generateGiftCode };
