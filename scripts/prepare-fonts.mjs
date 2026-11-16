// Menyalin font dari paket npm (fontsource) ke www/fonts dan membuat fonts.css.
// Nama family disamakan dengan yang dipakai di index.html. Build GAGAL kalau ada yang kurang.
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'www/fonts';
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const specs = [
  { pkg: '@fontsource-variable/bricolage-grotesque', css: ['full.css', 'index.css'], family: 'Bricolage Grotesque' },
  { pkg: '@fontsource-variable/onest', css: ['index.css', 'wght.css'], family: 'Onest' },
  { pkg: '@fontsource/anton', css: ['400.css', 'index.css'], family: 'Anton' },
];

const fail = (m) => { console.error('FONT ERROR: ' + m); process.exit(1); };
let out = '/* dibuat otomatis oleh scripts/prepare-fonts.mjs */\n';
const summary = {};

for (const s of specs) {
  const dir = path.join('node_modules', s.pkg);
  if (!fs.existsSync(dir)) fail('paket tidak ada: ' + s.pkg);
  const cssName = s.css.find((c) => fs.existsSync(path.join(dir, c)));
  if (!cssName) fail('css tidak ditemukan di ' + s.pkg);
  const cssText = fs.readFileSync(path.join(dir, cssName), 'utf8');
  const blocks = cssText.match(/@font-face\s*\{[^}]*\}/g) || [];
  let n = 0;
  for (const b of blocks) {
    const m = b.match(/url\(\s*['"]?([^)'"]+\.woff2)['"]?\s*\)/);
    if (!m) continue;
    const srcFile = path.resolve(dir, m[1]);
    if (!fs.existsSync(srcFile)) fail('file font tidak ada: ' + srcFile);
    const fileName = path.basename(srcFile);
    fs.copyFileSync(srcFile, path.join(OUT, fileName));
    let nb = b
      .replace(/font-family\s*:[^;]+;/, `font-family:'${s.family}';`)
      .replace(/src\s*:[^;]+;/, `src:url('./${fileName}') format('woff2');`)
      .replace(/font-display\s*:[^;]+;/, 'font-display:swap;');
    if (!/font-display/.test(nb)) nb = nb.replace(/\}\s*$/, 'font-display:swap;}');
    out += nb + '\n';
    n++;
  }
  if (n === 0) fail('tidak ada @font-face woff2 di ' + s.pkg + '/' + cssName);
  summary[s.family] = `${n} berkas (${cssName})`;
}

fs.writeFileSync(path.join(OUT, 'fonts.css'), out);

// verifikasi akhir
const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.woff2'));
for (const f of files) if (fs.statSync(path.join(OUT, f)).size < 1000) fail('font terlalu kecil/rusak: ' + f);
for (const s of specs) if (!out.includes(`font-family:'${s.family}'`)) fail('family hilang: ' + s.family);
console.log('Font OK:', JSON.stringify(summary), '| total woff2:', files.length);
