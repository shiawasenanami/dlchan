// Run ONCE by Nakano Tabasa only, on a machine that never ships to users.
// Produces an Ed25519 keypair: the private key stays local and signs license
// codes; the public key gets pasted into src/main/license.js so the shipped
// app can VERIFY codes but never generate or forge new ones.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');

const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const publicRaw = publicKey.export({ type: 'spki', format: 'der' });
// Ed25519 SPKI DER is 44 bytes; the raw 32-byte key is the last 32 bytes.
const publicKeyB64 = publicRaw.slice(-32).toString('base64');

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, 'license-private.pem'), privatePem);
fs.writeFileSync(path.join(outDir, 'license-public.b64'), publicKeyB64);

console.log('Wrote scripts/license-admin/license-private.pem (KEEP SECRET, never commit/ship)');
console.log('Wrote scripts/license-admin/license-public.b64');
console.log('\nPublic key (paste into src/main/license.js PUBLIC_KEY_B64):\n');
console.log(publicKeyB64);
