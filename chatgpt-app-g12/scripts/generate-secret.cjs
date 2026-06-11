#!/usr/bin/env node
const { randomBytes } = require('crypto');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const save = args.includes('--save');
const clip = args.includes('--clip');
const envIndex = args.indexOf('--env-file');
const envFile = envIndex >= 0 && args[envIndex + 1] ? args[envIndex + 1] : path.join(__dirname, '..', '.env');

function generateSecret() {
  return randomBytes(32).toString('hex');
}

function copyToClipboard(text) {
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      const p = spawnSync('pbcopy');
      p.stdin && p.stdin.end(text);
      return p.status === 0;
    }
    if (platform === 'win32') {
      const p = spawnSync('clip');
      p.stdin && p.stdin.end(text);
      return p.status === 0;
    }
    let p = spawnSync('which', ['xclip']);
    if (p.status === 0) {
      const child = spawnSync('xclip', ['-selection', 'clipboard']);
      child.stdin && child.stdin.end(text);
      return child.status === 0;
    }
    p = spawnSync('which', ['xsel']);
    if (p.status === 0) {
      const child = spawnSync('xsel', ['--clipboard', '--input']);
      child.stdin && child.stdin.end(text);
      return child.status === 0;
    }
  } catch (e) {
    return false;
  }
  return false;
}

const secret = generateSecret();
console.log('Generated secret:');
console.log(secret);

if (clip) {
  const ok = copyToClipboard(secret);
  console.log(ok ? 'Copied to clipboard.' : 'Failed to copy to clipboard.');
}

if (save) {
  try {
    const line = `G12_LEAD_SECRET=${secret}\n`;
    fs.appendFileSync(envFile, line, { encoding: 'utf8', flag: 'a' });
    console.log(`Appended secret to ${envFile}`);
  } catch (err) {
    console.error('Failed to write env file:', err.message || err);
    process.exitCode = 2;
  }
}

console.log('\nNext steps: paste this secret into WordPress settings and set G12_LEAD_SECRET in Vercel.');
