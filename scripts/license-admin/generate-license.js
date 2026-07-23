// Owner-only tool. Run locally by Nakano Tabasa to mint license codes for
// distribution. Requires license-private.pem (produced by generate-keypair.js)
// to be present in this same folder — that file must NEVER be shipped inside
// the app installer (electron-builder's "files" whitelist already excludes
// the whole scripts/ folder, so this stays out of every build automatically).
//
// Usage:
//   node scripts/license-admin/generate-license.js --days 30
//   node scripts/license-admin/generate-license.js --lifetime
//   node scripts/license-admin/generate-license.js --days 30 --note "คุณสมชาย"
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function parseArgs(argv) {
  const args = { days: null, lifetime: false, note: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--days') args.days = parseInt(argv[++i], 10);
    else if (argv[i] === '--lifetime') args.lifetime = true;
    else if (argv[i] === '--note') args.note = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (!args.lifetime && !args.days) {
  console.log('ใช้งาน: node generate-license.js --days 30   หรือ   --lifetime   (เพิ่ม --note "ข้อความ" ได้)');
  process.exit(1);
}

const privatePemPath = path.join(__dirname, 'license-private.pem');
if (!fs.existsSync(privatePemPath)) {
  console.error('ไม่พบ license-private.pem — รัน generate-keypair.js ก่อนหนึ่งครั้ง (เก็บไฟล์นี้เป็นความลับ ห้ามแจกจ่าย)');
  process.exit(1);
}

const privateKey = crypto.createPrivateKey(fs.readFileSync(privatePemPath, 'utf8'));

const payload = {
  exp: args.lifetime ? null : Date.now() + args.days * 24 * 60 * 60 * 1000,
  note: args.note || null,
  id: crypto.randomBytes(6).toString('hex')
};

const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
const signature = crypto.sign(null, Buffer.from(payloadB64), privateKey);
const code = `${payloadB64}.${signature.toString('base64url')}`;

console.log('\nสร้างโค้ดสำเร็จ:\n');
console.log(code);
console.log('');
console.log(args.lifetime ? 'ประเภท: ใช้ได้ตลอดชีพ (lifetime)' : `ประเภท: ใช้ได้ ${args.days} วัน (หมดอายุ ${new Date(payload.exp).toLocaleString('th-TH')})`);
if (args.note) console.log('หมายเหตุ:', args.note);
