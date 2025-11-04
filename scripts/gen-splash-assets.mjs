#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(process.cwd());

// CLI args: [node, script, inputPath?, baseWidth?, background?]
const inputArg = process.argv[2];
const widthArg = Number(process.argv[3]);
const bgArg = process.argv[4];

const inputPath = inputArg
  ? path.resolve(root, inputArg)
  : path.join(root, 'assets', 'splash-logo.svg');

const baseWidth = Number.isFinite(widthArg) && widthArg > 0 ? widthArg : 200; // px at 1x
const background = /^#?[0-9a-fA-F]{6}$/.test(bgArg || '')
  ? (bgArg.startsWith('#') ? bgArg : `#${bgArg}`)
  : '#2C7A4B';

const androidRes = path.join(root, 'android', 'app', 'src', 'main', 'res');
const iosImageset = path.join(root, 'ios', 'HaemilForCounseolrs', 'Images.xcassets', 'BootSplashLogo.imageset');

const ensureDir = async (p) => fs.mkdir(p, { recursive: true });

const densities = [
  { name: 'mdpi', factor: 1 },
  { name: 'hdpi', factor: 1.5 },
  { name: 'xhdpi', factor: 2 },
  { name: 'xxhdpi', factor: 3 },
  { name: 'xxxhdpi', factor: 4 },
];

async function assertInput() {
  try {
    await fs.access(inputPath);
  } catch {
    console.error(`❌ Input file not found: ${inputPath}`);
    console.error('Usage: node scripts/gen-splash-assets.mjs <image.(png|svg)> [baseWidthPx=200] [background=#2C7A4B]');
    process.exit(1);
  }
}

async function buildAndroid() {
  for (const d of densities) {
    const dir = path.join(androidRes, `drawable-${d.name}`);
    await ensureDir(dir);
    const out = path.join(dir, 'bootsplash_logo.png');
    await sharp(inputPath).resize(Math.round(baseWidth * d.factor)).png().toFile(out);
  }
  // drawable/bootsplash.xml
  const drawableDir = path.join(androidRes, 'drawable');
  await ensureDir(drawableDir);
  const bootsplashXml = `<?xml version="1.0" encoding="utf-8"?>\n<layer-list xmlns:android="http://schemas.android.com/apk/res/android">\n  <item android:drawable="@color/bootsplash_background" />\n  <item>\n    <bitmap android:gravity="center" android:src="@drawable/bootsplash_logo" android:antialias="true"/>\n  </item>\n</layer-list>\n`;
  await fs.writeFile(path.join(drawableDir, 'bootsplash.xml'), bootsplashXml, 'utf8');

  // values/colors.xml
  const valuesDir = path.join(androidRes, 'values');
  await ensureDir(valuesDir);
  const colorsXmlPath = path.join(valuesDir, 'colors.xml');
  let colorsXml = '';
  try { colorsXml = (await fs.readFile(colorsXmlPath, 'utf8')); } catch {}
  if (!colorsXml.includes('bootsplash_background')) {
    const fragment = `\n    <color name=\"bootsplash_background\">${background}</color>\n`;
    if (colorsXml.trim().startsWith('<resources')) {
      colorsXml = colorsXml.replace('</resources>', fragment + '</resources>');
    } else {
      colorsXml = `<resources>${fragment}</resources>\n`;
    }
  } else {
    colorsXml = colorsXml.replace(/<color name=\"bootsplash_background\">#?[0-9a-fA-F]{6}<\/color>/, `<color name=\"bootsplash_background\">${background}</color>`);
  }
  await fs.writeFile(colorsXmlPath, colorsXml, 'utf8');

  // values/styles.xml -> ensure BootTheme exists
  const stylesXmlPath = path.join(valuesDir, 'styles.xml');
  let stylesXml = '';
  try { stylesXml = (await fs.readFile(stylesXmlPath, 'utf8')); } catch {}
  const bootStyle = `\n    <style name=\"BootTheme\" parent=\"AppTheme\">\n        <item name=\"android:windowBackground\">@drawable/bootsplash</item>\n        <item name=\"android:windowNoTitle\">true</item>\n        <item name=\"android:windowFullscreen\">true</item>\n    </style>\n`;
  if (stylesXml.trim().startsWith('<resources')) {
    if (!stylesXml.includes('name="BootTheme"')) {
      stylesXml = stylesXml.replace('</resources>', bootStyle + '</resources>');
    }
  } else {
    stylesXml = `<resources>${bootStyle}</resources>\n`;
  }
  await fs.writeFile(stylesXmlPath, stylesXml, 'utf8');
}

async function buildIOS() {
  await ensureDir(iosImageset);
  const outputs = [
    { suffix: '', scale: 1 },
    { suffix: '@2x', scale: 2 },
    { suffix: '@3x', scale: 3 },
  ];
  for (const o of outputs) {
    const out = path.join(iosImageset, `logo${o.suffix}.png`);
    await sharp(inputPath).resize(Math.round(baseWidth * o.scale)).png().toFile(out);
  }
  const contents = {
    images: [
      { filename: 'logo.png', idiom: 'universal', scale: '1x' },
      { filename: 'logo@2x.png', idiom: 'universal', scale: '2x' },
      { filename: 'logo@3x.png', idiom: 'universal', scale: '3x' },
    ],
    info: { version: 1, author: 'xcode' },
  };
  await fs.writeFile(path.join(iosImageset, 'Contents.json'), JSON.stringify(contents, null, 2));
}

async function main() {
  await assertInput();
  await buildAndroid();
  await buildIOS();
  console.log(`✅ Splash assets generated from ${path.relative(root, inputPath)} (width=${baseWidth}, bg=${background})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
