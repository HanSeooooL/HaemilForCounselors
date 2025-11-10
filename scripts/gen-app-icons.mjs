#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import url from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const projectRoot = path.resolve(__dirname, '..');

const srcArg = process.argv[2] || path.resolve(projectRoot, 'assets', 'new-splash-logo.png');
const srcPath = path.isAbsolute(srcArg) ? srcArg : path.resolve(projectRoot, srcArg);

if (!fs.existsSync(srcPath)) {
  console.error(`Source icon not found: ${srcPath}`);
  process.exit(1);
}

async function ensureDir(d) {
  await fs.promises.mkdir(d, { recursive: true });
}

async function generateAndroidIcons() {
  const resBase = path.resolve(projectRoot, 'android', 'app', 'src', 'main', 'res');
  const densities = [
    { name: 'mdpi', size: 48 },
    { name: 'hdpi', size: 72 },
    { name: 'xhdpi', size: 96 },
    { name: 'xxhdpi', size: 144 },
    { name: 'xxxhdpi', size: 192 },
  ];
  for (const d of densities) {
    const dir = path.join(resBase, `mipmap-${d.name}`);
    await ensureDir(dir);
    const targets = ['ic_launcher.png', 'ic_launcher_round.png'];
    for (const file of targets) {
      const out = path.join(dir, file);
      await sharp(srcPath).resize(d.size, d.size, { fit: 'cover' }).png().toFile(out);
      console.log(`Android ${d.name}: wrote ${file}`);
    }
  }
}

async function generateIOSIcons() {
  const appIconSet = path.resolve(projectRoot, 'ios', 'HaemilForCounseolrs', 'Images.xcassets', 'AppIcon.appiconset');
  await ensureDir(appIconSet);
  const contentsJsonPath = path.join(appIconSet, 'Contents.json');
  let contents;
  if (fs.existsSync(contentsJsonPath)) {
    contents = JSON.parse(fs.readFileSync(contentsJsonPath, 'utf8'));
  } else {
    contents = { images: [], info: { version: 1, author: 'xcode' } };
  }

  const specs = [
    { size: '20x20', scale: '2x', idiom: 'iphone', px: 40, filename: 'Icon-20@2x.png' },
    { size: '20x20', scale: '3x', idiom: 'iphone', px: 60, filename: 'Icon-20@3x.png' },
    { size: '29x29', scale: '2x', idiom: 'iphone', px: 58, filename: 'Icon-29@2x.png' },
    { size: '29x29', scale: '3x', idiom: 'iphone', px: 87, filename: 'Icon-29@3x.png' },
    { size: '40x40', scale: '2x', idiom: 'iphone', px: 80, filename: 'Icon-40@2x.png' },
    { size: '40x40', scale: '3x', idiom: 'iphone', px: 120, filename: 'Icon-40@3x.png' },
    { size: '60x60', scale: '2x', idiom: 'iphone', px: 120, filename: 'Icon-60@2x.png' },
    { size: '60x60', scale: '3x', idiom: 'iphone', px: 180, filename: 'Icon-60@3x.png' },
    { size: '1024x1024', scale: '1x', idiom: 'ios-marketing', px: 1024, filename: 'Icon-1024.png' },
  ];

  // Update images entries with filenames
  contents.images = contents.images || [];
  for (const spec of specs) {
    let entry = contents.images.find(
      (img) => img.idiom === spec.idiom && img.size === spec.size && img.scale === spec.scale
    );
    if (!entry) {
      entry = { idiom: spec.idiom, size: spec.size, scale: spec.scale };
      contents.images.push(entry);
    }
    entry.filename = spec.filename;
    const out = path.join(appIconSet, spec.filename);
    await sharp(srcPath).resize(spec.px, spec.px, { fit: 'cover' }).png().toFile(out);
    console.log(`iOS: wrote ${spec.filename}`);
  }

  fs.writeFileSync(contentsJsonPath, JSON.stringify(contents, null, 2));
}

(async () => {
  try {
    await generateAndroidIcons();
    await generateIOSIcons();
    console.log('\nApp icons generated successfully from:', srcPath);
  } catch (e) {
    console.error('Failed to generate app icons:', e);
    process.exit(1);
  }
})();

