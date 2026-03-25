#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function printUsage() {
  console.log(`Usage: node pack-sprites.js --input <dir> --output <name> --cols <N> [--margin <px>]

Packs individual 32x32 PNG tiles into a spritesheet + JSON mapping.

Options:
  --input   Directory containing individual tile PNGs (required)
  --output  Output base name (produces <name>.png and <name>.json) (required)
  --cols    Number of columns in the spritesheet grid (required)
  --margin  Pixels between tiles (default: 0)
  --help    Show this help message`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; ++i) {
    switch (argv[i]) {
      case '--input':  args.input  = argv[++i]; break;
      case '--output': args.output = argv[++i]; break;
      case '--cols':   args.cols   = parseInt(argv[++i], 10); break;
      case '--margin': args.margin = parseInt(argv[++i], 10); break;
      case '--help':   args.help   = true; break;
      default:
        console.error(`Unknown argument: ${argv[i]}`);
        process.exit(1);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  if (!args.input || !args.output || !args.cols) {
    printUsage();
    process.exit(1);
  }

  const margin = args.margin || 0;
  const cols = args.cols;
  const inputDir = path.resolve(args.input);

  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }

  let sharp;
  try {
    sharp = require('sharp');
  } catch (_) {
    console.error('Error: "sharp" is required. Install it with: npm install --save-dev sharp');
    process.exit(1);
  }

  const files = fs.readdirSync(inputDir)
    .filter(f => f.toLowerCase().endsWith('.png'))
    .sort();

  if (files.length === 0) {
    console.error(`No PNG files found in ${inputDir}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} PNG files in ${inputDir}`);

  const TILE_SIZE = 32;
  const tiles = {};
  const buffers = [];

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    const img = sharp(filePath);
    const meta = await img.metadata();

    if (meta.width !== TILE_SIZE || meta.height !== TILE_SIZE) {
      console.error(`Skipping ${file}: expected ${TILE_SIZE}x${TILE_SIZE}, got ${meta.width}x${meta.height}`);
      continue;
    }

    const name = path.basename(file, '.png');
    tiles[name] = buffers.length;
    buffers.push({ name, buffer: await img.raw().ensureAlpha().toBuffer() });
  }

  const count = buffers.length;
  if (count === 0) {
    console.error('No valid 32x32 tiles found');
    process.exit(1);
  }

  const rows = Math.ceil(count / cols);
  const step = TILE_SIZE + margin;
  const sheetW = cols * step - margin;
  const sheetH = rows * step - margin;

  console.log(`Packing ${count} tiles into ${cols}x${rows} grid (${sheetW}x${sheetH}px)`);

  const composites = buffers.map((tile, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      input: tile.buffer,
      raw: { width: TILE_SIZE, height: TILE_SIZE, channels: 4 },
      left: col * step,
      top: row * step,
    };
  });

  const sheet = sharp({
    create: {
      width: sheetW,
      height: sheetH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const outputPng = args.output + '.png';
  const outputJson = args.output + '.json';

  await sheet.composite(composites).png().toFile(outputPng);

  const sheetId = path.basename(args.output);
  const manifest = {
    sheetId,
    tileSize: TILE_SIZE,
    margin,
    cols,
    tiles,
  };

  fs.writeFileSync(outputJson, JSON.stringify(manifest, null, 2) + '\n');

  console.log(`Written: ${outputPng} (${sheetW}x${sheetH})`);
  console.log(`Written: ${outputJson} (${count} tiles)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
