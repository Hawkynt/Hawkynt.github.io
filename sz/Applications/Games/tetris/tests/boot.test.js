/* Boots the game in a deterministic sandbox, drives a scripted session and compares
   the digest of every observable effect against the recorded baseline. The baseline
   was captured from the pre-refactor controller; a refactor must reproduce it. */
'use strict';

const fs = require('fs');
const path = require('path');
const { createGame } = require('./harness.js');

const BASELINE = path.join(__dirname, 'baseline.json');
let failures = 0;

function check(name, ok, details) {
  if (ok) console.log('PASS ' + name);
  else { ++failures; console.log('FAIL ' + name + (details ? ': ' + details : '')); }
}

async function main() {
  const game = createGame(path.join(__dirname, '..'), { seed: 42 });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  /* scripted session: moves, rotations, drops, hold, pause, clears, restart */
  game.key('ArrowLeft');
  game.key('ArrowLeft');
  game.key('ArrowUp');
  game.key('ArrowRight');
  game.frames(40);
  game.key(' ');
  game.frames(60);
  game.key('c');
  game.frames(30);
  game.key('ArrowDown');
  game.frames(12);
  game.keyUp('ArrowDown');
  game.key('x');
  game.frames(80);
  game.key('p');
  game.frames(10);
  game.key('p');
  game.frames(120);
  game.key(' ');
  game.key(' ');
  game.frames(200);
  game.key('F2');
  game.frames(300);
  await game.settle();

  const d = game.digest();
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);

  if (!fs.existsSync(BASELINE)) {
    fs.writeFileSync(BASELINE, JSON.stringify({ digest: d, entries: game.log.length }, null, 2) + '\n');
    console.log('BASELINE RECORDED ' + d);
    process.exit(0);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  check('digest matches baseline', d === base.digest, 'got ' + d + ' want ' + base.digest);

  process.exit(failures ? 1 : 0);
}

main();
