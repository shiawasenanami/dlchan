const path = require('path');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

// Format id -> [ffmpeg args (minus -i input/output), output extension, is audio-only]
const FORMATS = {
  original: null, // no conversion — pass the downloaded file through as-is
  mp3: { args: ['-vn', '-acodec', 'libmp3lame', '-q:a', '2'], ext: '.mp3' }, // lossy
  aac: { args: ['-vn', '-c:a', 'aac', '-b:a', '192k'], ext: '.m4a' }, // lossy
  wav16: { args: ['-vn', '-c:a', 'pcm_s16le'], ext: '.wav' }, // lossless, 16-bit
  wav24: { args: ['-vn', '-c:a', 'pcm_s24le'], ext: '.wav' }, // lossless, 24-bit
  flac16: { args: ['-vn', '-c:a', 'flac', '-sample_fmt', 's16'], ext: '.flac' }, // lossless, 16-bit
  flac24: { args: ['-vn', '-c:a', 'flac', '-sample_fmt', 's32'], ext: '.flac' } // lossless, 24-bit
};

function convertFile(sourcePath, format, onProgress) {
  return new Promise((resolve, reject) => {
    const spec = FORMATS[format];
    if (!spec) {
      resolve({ outputPath: sourcePath, converted: false });
      return;
    }

    const outputPath = sourcePath.replace(/\.[^.]+$/, '') + spec.ext;
    const args = ['-y', '-i', sourcePath, ...spec.args, outputPath];
    const proc = spawn(ffmpegPath, args);

    let stderr = '';
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (onProgress) onProgress(chunk.toString());
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ outputPath, converted: true });
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-300)}`));
      }
    });
  });
}

module.exports = { convertFile, FORMATS };
