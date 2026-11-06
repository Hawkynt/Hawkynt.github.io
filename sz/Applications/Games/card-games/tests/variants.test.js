/* Golden master of every variant: boots the suite per variant in the deterministic
   sandbox, plays a seeded session of clicks, drags and keys and pins the digest of
   everything observable. A pure refactor of a variant must reproduce its digest.
   Usage: node tests/variants.test.js [id ...]   UPDATE=1 rewrites the baseline. */
'use strict';

const fs = require('fs');
const path = require('path');
const { createGame } = require('./harness.js');

const BASELINE = process.env.BASELINE || path.join(__dirname, 'variants-baseline.json');
const ROOT = path.join(__dirname, '..');

function playVariant(id) {
  const game = createGame(ROOT, { seed: 7 });
  const errors = game.load();
  if (errors.length) return { error: errors.join(' | ') };
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
  const at = (type, mx, my) => game.pointer(type, mx / 9, my / 15);
  game.frames(3);
  game.SZ.CardGames.game.selectGame(id);
  game.frames(60);
  const keys = ['1', '2', '3', '4', '5', ' ', 'h', 's', 'Enter', 'd'];
  for (let i = 0; i < 300; ++i) {
    const r = rnd();
    const zone = rnd();
    /* bias towards the player's hand, the table centre and the button rows */
    const mx = 30 + rnd() * 840;
    const my = zone < 0.45 ? 440 + rnd() * 150 : zone < 0.8 ? 150 + rnd() * 300 : rnd() * 600;
    if (r < 0.7) {
      at('pointerdown', mx, my); at('pointerup', mx, my);
    } else if (r < 0.9) {
      const tx = 30 + rnd() * 840, ty = 80 + rnd() * 500;
      at('pointerdown', mx, my);
      for (let k = 1; k <= 4; ++k) { at('pointermove', mx + (tx - mx) * k / 4, my + (ty - my) * k / 4); game.frames(1); }
      at('pointerup', tx, ty);
    } else {
      game.key(keys[Math.floor(rnd() * keys.length)]);
    }
    game.frames(6 + Math.floor(rnd() * 20));
  }
  game.frames(120);
  const texts = new Set(game.log.filter(l => l.startsWith('ctx.fillText')).map(l => l.split(' ').slice(0, 3).join(' ')));
  return { digest: game.digest(), entries: game.log.length, texts: texts.size };
}

function main() {
  const ids = process.argv.slice(2);
  const all = require('vm').runInNewContext(
    fs.readFileSync(path.join(ROOT, 'js/core/constants.js'), 'utf8').match(/const VARIANTS = (\[[\s\S]*?\n    \]);/)[1]);
  const list = ids.length ? all.filter(v => ids.includes(v.id)) : all;
  const base = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
  let failures = 0;
  for (const v of list) {
    const r = playVariant(v.id);
    if (r.error) { ++failures; console.log('FAIL ' + v.id + ': ' + r.error); continue; }
    if (process.env.UPDATE || !base[v.id]) {
      base[v.id] = { digest: r.digest, entries: r.entries };
      console.log('REC  ' + v.id + ' ' + r.digest.slice(0, 12) + ' entries=' + r.entries + ' texts=' + r.texts);
    } else if (base[v.id].digest === r.digest) {
      console.log('PASS ' + v.id);
    } else {
      ++failures;
      console.log('FAIL ' + v.id + ' digest ' + r.digest.slice(0, 12) + ' want ' + base[v.id].digest.slice(0, 12) + ' entries ' + r.entries + '/' + base[v.id].entries);
    }
  }
  fs.writeFileSync(BASELINE, JSON.stringify(base, null, 1) + '\n');
  process.exit(failures ? 1 : 0);
}

main();
