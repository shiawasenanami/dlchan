// Pure-JS PNG encoder (no native deps) that procedurally draws the DL-chan
// slime mascot as a flat-color icon at several sizes. Used for the Electron
// app icon and the browser extension's toolbar icons.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = chunk('IHDR', ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function mix(base, over, alpha) {
  return base.map((c, i) => Math.round(c * (1 - alpha) + over[i] * alpha));
}

function drawSlime(size, { withArrow } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const bodyColor = [76, 184, 92];
  const bodyShade = [63, 163, 77];
  const eyeColor = [255, 255, 255];
  const pupilColor = [43, 107, 52];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x - size / 2) / (size * 0.46);
      const ny = (y - size / 2) / (size * 0.46);
      const idx = (y * size + x) * 4;

      const ry = ny < 0 ? 0.82 : 1.02;
      const inBody = (nx * nx) / (0.98 * 0.98) + (ny * ny) / (ry * ry) <= 1;

      let color = null;

      if (inBody) {
        color = ny > 0.35 ? bodyShade : bodyColor;

        const eyeDx = Math.abs(nx) - 0.27;
        const eyeDy = ny + 0.05;
        const inEye = eyeDx * eyeDx + eyeDy * eyeDy <= 0.16 * 0.16 && Math.abs(nx) > 0.05;
        if (inEye) {
          color = eyeColor;
          const pupilDy = ny + 0.02;
          if (eyeDx * eyeDx * 1.4 + pupilDy * pupilDy <= 0.075 * 0.075) color = pupilColor;
        }

        const mouthX = nx;
        const mouthCurve = 0.32 + 0.09 * Math.pow(mouthX / 0.22, 2);
        if (Math.abs(mouthX) < 0.22 && Math.abs(ny - mouthCurve) < 0.028) {
          color = pupilColor;
        }

        if (withArrow) {
          const ax = nx;
          const ay = ny;
          const inStem = Math.abs(ax) < 0.09 && ay > 0.55 && ay < 0.78;
          const inHead = Math.abs(ax) + (ay - 0.78) * 1.3 < 0.16 && ay >= 0.72 && ay <= 0.9;
          if (inStem || inHead) color = eyeColor;
        }
      }

      if (color) {
        rgba[idx] = color[0];
        rgba[idx + 1] = color[1];
        rgba[idx + 2] = color[2];
        rgba[idx + 3] = 255;
      } else {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      }
    }
  }

  return rgba;
}

function writeIcon(size, outPath, opts) {
  const rgba = drawSlime(size, opts);
  const png = encodePNG(size, size, rgba);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  console.log('wrote', outPath, `(${size}x${size}, ${png.length} bytes)`);
}

// Wraps PNG images into a multi-size .ico (Windows has supported PNG-compressed
// ICO entries at any size since Vista, so no need for raw BMP/DIB encoding).
function writeIco(sizes, outPath, opts) {
  const images = sizes.map((size) => encodePNG(size, size, drawSlime(size, opts)));

  const headerSize = 6 + 16 * images.length;
  let offset = headerSize;
  const dirEntries = [];
  for (let i = 0; i < images.length; i++) {
    const size = sizes[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(images[i].length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    offset += images[i].length;
  }

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const ico = Buffer.concat([header, ...dirEntries, ...images]);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, ico);
  console.log('wrote', outPath, `(${images.length} sizes, ${ico.length} bytes)`);
}

const root = path.join(__dirname, '..');
writeIcon(16, path.join(root, 'extension', 'icons', 'icon16.png'));
writeIcon(48, path.join(root, 'extension', 'icons', 'icon48.png'));
writeIcon(128, path.join(root, 'extension', 'icons', 'icon128.png'));
writeIcon(256, path.join(root, 'assets', 'icon.png'), { withArrow: true });
writeIco([16, 32, 48, 256], path.join(root, 'assets', 'icon.ico'), { withArrow: true });
