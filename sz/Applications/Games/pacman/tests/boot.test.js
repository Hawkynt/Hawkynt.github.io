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

/* The maze as the game defines it: 0=wall, 1=dot, 2=power pellet, 3=empty,
   4=ghost house, 5=gate. The driver plans routes over this grid; the game's
   own drawing tells it where Pac-Man actually ended up. */
const TILE = 16;
const MAZE = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
  [0,2,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,2,0],
  [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0],
  [0,1,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0],
  [0,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,1,0,0,0,0,0,3,0,0,3,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,0,0,0,3,0,0,3,0,0,0,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,3,3,3,3,3,3,3,3,3,3,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,3,0,0,0,5,5,0,0,0,3,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,3,0,4,4,4,4,4,4,0,3,0,0,1,0,0,0,0,0,0],
  [3,3,3,3,3,3,1,3,3,3,0,4,4,4,4,4,4,0,3,3,3,1,3,3,3,3,3,3],
  [0,0,0,0,0,0,1,0,0,3,0,4,4,4,4,4,4,0,3,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,3,0,0,0,0,0,0,0,0,3,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,3,3,3,3,3,3,3,3,3,3,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,3,0,0,0,0,0,0,0,0,3,0,0,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,0,0,3,0,0,0,0,0,0,0,0,3,0,0,1,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
  [0,1,0,0,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0],
  [0,2,1,1,0,0,1,1,1,1,1,1,1,3,3,1,1,1,1,1,1,1,0,0,1,1,2,0],
  [0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0],
  [0,0,0,1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,0,0,0],
  [0,1,1,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,0,0,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];
const COLS = 28, ROWS = 31;
const TUNNEL_ROW = 14;

const DOT_TILES = [];
const PELLET_TILES = [];
for (let r = 0; r < ROWS; ++r)
  for (let c = 0; c < COLS; ++c) {
    if (MAZE[r][c] === 1) DOT_TILES.push(c + ',' + r);
    else if (MAZE[r][c] === 2) PELLET_TILES.push(c + ',' + r);
  }

function walkable(c, r) {
  if (r < 0 || r >= ROWS) return false;
  if (c < 0 || c >= COLS) return r === TUNNEL_ROW;
  const v = MAZE[r][c];
  return v !== 0 && v !== 4 && v !== 5;
}

/* four-way neighbours; the tunnel row wraps around the edge */
function neighbours(c, r) {
  const out = [];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    let nc = c + dc, nr = r + dr;
    if (nr === TUNNEL_ROW) {
      if (nc < 0) nc = COLS - 1;
      else if (nc >= COLS) nc = 0;
    }
    if (walkable(nc, nr)) out.push([nc, nr]);
  }
  return out;
}

/* first key of the shortest route from start to the nearest target tile; tiles
   in `blocked` are stepped around when a route exists without them */
function bfsKey(start, targets, blocked) {
  if (!targets.length) return null;
  const goal = new Set(targets);
  const key = (c, r) => c + ',' + r;
  const from = new Map([[key(start.col, start.row), null]]);
  const q = [[start.col, start.row]];
  while (q.length) {
    const [cc, cr] = q.shift();
    const ck = key(cc, cr);
    if (goal.has(ck) && ck !== key(start.col, start.row)) {
      let cur = ck;
      while (from.get(cur) && key(from.get(cur)[0], from.get(cur)[1]) !== key(start.col, start.row))
        cur = from.get(cur)[0] + ',' + from.get(cur)[1];
      if (!from.get(cur)) return null;
      const [nc, nr] = cur.split(',').map(Number);
      let dc = nc - start.col;
      if (dc > 1) dc = -1;
      else if (dc < -1) dc = 1;
      const dr = nr - start.row;
      return dc === 1 ? 'ArrowRight' : dc === -1 ? 'ArrowLeft' : dr === 1 ? 'ArrowDown' : 'ArrowUp';
    }
    for (const [nc, nr] of neighbours(cc, cr)) {
      const nk = key(nc, nr);
      if (!from.has(nk) && !(blocked && blocked.has(nk))) { from.set(nk, [cc, cr]); q.push([nc, nr]); }
    }
  }
  return null;
}

/* tile -> steps from the nearest source, over the walkable maze */
function distMap(sources) {
  const d = new Map();
  const q = [];
  for (const s of sources) {
    const k = s.col + ',' + s.row;
    if (!d.has(k)) { d.set(k, 0); q.push([s.col, s.row]); }
  }
  for (let head = 0; head < q.length; ++head) {
    const [cc, cr] = q[head];
    const cd = d.get(cc + ',' + cr);
    for (const [nc, nr] of neighbours(cc, cr)) {
      const nk = nc + ',' + nr;
      if (!d.has(nk)) { d.set(nk, cd + 1); q.push([nc, nr]); }
    }
  }
  return d;
}

/* the tiles a ghost can reach at least as fast as Pac-Man can -- ghosts move at
   about the same pace, so a tile the ghost gets to first is a tile to route
   around, and the map says so two or three intersections ahead instead of only
   on the neighbouring squares */
function dangerTiles(here, distG) {
  const distP = distMap([here]);
  const out = new Set();
  for (const [k, g] of distG) {
    const p = distP.get(k);
    if (p !== undefined && g <= p + 1) out.add(k);
  }
  return out;
}

/* Pac-Man's tile, read back from the glow pass that draws his body: the
   translate that lands on the tile centre right before the rotate/fill. */
function pacmanTile(game) {
  const a = game.all;
  for (let i = a.length - 1; i >= 2; --i) {
    if (a[i] !== 'ctx.fillStyle=#FFD700' || !a[i - 1].startsWith('ctx.rotate ') ||
      !a[i - 2].startsWith('ctx.translate '))
      continue;
    const p = a[i - 2].slice('ctx.translate '.length).split(',');
    const col = Math.floor(parseFloat(p[0]) / TILE);
    const row = Math.floor(parseFloat(p[1]) / TILE);
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS)
      return { col, row };
  }
  return null;
}

/* every ghost body is drawn as the top arc of the shell: radius TILE/2-1,
   from PI to 0, sitting two pixels above the ghost's real centre */
function ghostTiles(game) {
  const a = game.all, out = [];
  for (let i = a.length - 1; i >= 0 && out.length < 4; --i) {
    if (!a[i].startsWith('ctx.arc ')) continue;
    const p = a[i].slice('ctx.arc '.length).split(',');
    if (p[2] !== '7' || p[3] !== '3.142' || p[4] !== '0' || p[5] !== 'false') continue;
    const col = Math.floor(parseFloat(p[0]) / TILE);
    const row = Math.floor((parseFloat(p[1]) + 2) / TILE);
    if (walkable(col, row)) out.push({ col, row });
  }
  return out;
}

/* frightened ghosts show as the aura arc at radius TILE/2-1+3 */
function frightenedTiles(game) {
  const a = game.all, out = [];
  for (let i = a.length - 1; i >= 0 && out.length < 4; --i) {
    if (!a[i].startsWith('ctx.arc ')) continue;
    const p = a[i].slice('ctx.arc '.length).split(',');
    if (p[2] !== '11') continue;
    const col = Math.floor(parseFloat(p[0]) / TILE);
    const row = Math.floor(parseFloat(p[1]) / TILE);
    if (walkable(col, row)) out.push(col + ',' + row);
  }
  return out;
}

async function main() {
  const game = createGame(path.join(__dirname, '..'), { seed: 42, allLines: true });
  const errors = game.load();
  check('scripts load without errors', errors.length === 0, errors.join(' | '));

  let mark = game.log.length;
  let frame = 0;

  /* press a key, run n frames, release it, and hand back the new log lines */
  function step(dir, n) {
    if (dir) game.key(dir);
    game.frames(n);
    if (dir) game.keyUp(dir);
    frame += n;
    const fresh = game.log.slice(mark);
    mark = game.log.length;
    return fresh;
  }
  const has = (lines, prefix) => lines.some((l) => l.startsWith(prefix));

  /* the title screen, then start via Space */
  step(null, 4);
  step(' ', 130);

  /* Sweep the maze one committed target at a time: pick the nearest pellet
     still on the board, otherwise the nearest dot not walked over yet, and keep
     walking toward that one target until it is reached -- re-picking after every
     tile makes the route flip between two neighbouring dots. While a pellet is
     active the route switches to the nearest frightened ghost, so the captures,
     the zap sound and the electric arc are covered too. The fruit appears at
     exactly 70 and 170 dots, so from 68 on the target becomes the fruit tile.
     Deaths put Pac-Man back at the spawn but keep the eaten dots, game over
     rebuilds the maze, and a finished level rebuilds it as well. */
  const FRUIT_TILE = '13,17';
  const visited = new Set();
  let target = null;
  let dots = 0;
  let fruitTaken = false;
  let frightenedUntil = -1;
  let zaps = 0;
  let levelsDone = 0;
  let guard = 0;
  let stalled = 0;

  /* the nearest still-open tile over the maze, so the sweep walks a corridor
     instead of crossing the whole field for every dot */
  function nearestOpen(here, open) {
    if (!open.length) return null;
    const goal = new Set(open);
    const key = (c, r) => c + ',' + r;
    const seen = new Set([key(here.col, here.row)]);
    const q = [[here.col, here.row]];
    while (q.length) {
      const [cc, cr] = q.shift();
      if (goal.has(key(cc, cr)) && key(cc, cr) !== key(here.col, here.row))
        return key(cc, cr);
      for (const [nc, nr] of neighbours(cc, cr)) {
        const nk = key(nc, nr);
        if (!seen.has(nk)) { seen.add(nk); q.push([nc, nr]); }
      }
    }
    return open[0];
  }

  let lastVisited = -1;
  let noProgress = 0;
  let recoveries = 0;
  const trace = [];
  while (guard++ < 12000 && levelsDone < 1) {
    if (visited.size !== lastVisited) { lastVisited = visited.size; noProgress = 0; }
    else if (++noProgress > 100) {
      /* Pac-Man is standing still while the sim runs (a transition, a boss
         intro, an end screen): nudge the game back into a running state */
      ++recoveries;
      const fresh = step(' ', 400);
      target = null;
      noProgress = 0;
      /* Space starts a fresh game from the end screens, and a fresh game
         rebuilds the maze -- the sweep model has to start over with it */
      if (has(fresh, 'sfx select')) { visited.clear(); dots = 0; }
      if (recoveries > 24) break;
    }
    const here = pacmanTile(game);
    if (!here) {
      /* not on the field: title, dying or a level transition */
      step(null, 60);
      continue;
    }
    const hereKey = here.col + ',' + here.row;
    if (!visited.has(hereKey)) {
      visited.add(hereKey);
      if (MAZE[here.row][here.col] === 1) ++dots;
    }

    if (!fruitTaken && dots >= 68)
      target = FRUIT_TILE;
    else if (target === null || visited.has(target)) {
      let open = PELLET_TILES.filter((k) => !visited.has(k));
      if (!open.length) open = DOT_TILES.filter((k) => !visited.has(k));
      target = nearestOpen(here, open);
    }

    let dir = null;
    const walkers = ghostTiles(game);
    const distG = distMap(walkers);
    if (frame < frightenedUntil && zaps < 2) {
      /* the frightened window is only worth hunting while the captures are
         still owed to the session -- after that the dots come first again */
      const scared = frightenedTiles(game);
      if (scared.length) dir = bfsKey(here, scared);
    }
    if (!dir && walkers.length && frame >= frightenedUntil) {
      /* a ghost closing in: step to whichever neighbour is furthest from the
         closest one of them, measured along the corridors */
      const hereG = distG.get(hereKey);
      if (hereG !== undefined && hereG <= 4) {
        let best = null, bestScore = hereG;
        for (const [nc, nr] of neighbours(here.col, here.row)) {
          const score = distG.get(nc + ',' + nr);
          if (score !== undefined && score > bestScore) { bestScore = score; best = [nc, nr]; }
        }
        if (best) {
          let dc = best[0] - here.col;
          if (dc > 1) dc = -1;
          else if (dc < -1) dc = 1;
          dir = dc === 1 ? 'ArrowRight' : dc === -1 ? 'ArrowLeft' :
            best[1] > here.row ? 'ArrowDown' : 'ArrowUp';
        }
      }
    }
    if (!dir && target) {
      /* route around the tiles the ghosts can win; when every route crosses
         them, take the short one anyway -- the dots matter more than a perfect
         run, and deaths are part of what the session covers */
      const danger = dangerTiles(here, distG);
      dir = bfsKey(here, [target], danger) || bfsKey(here, [target]);
    }
    trace.push(hereKey + ' -> ' + target + ' ' + dir);
    if (trace.length > 40) trace.shift();
    if (!dir) {
      /* nothing left to walk to: let the level-complete sequence run */
      ++stalled;
      const fresh = step(null, 200);
      if (has(fresh, 'sfx levelup')) { ++levelsDone; visited.clear(); dots = 0; target = null; }
      continue;
    }

    /* exactly one tile per decision: at 2 px per frame eight frames land him on
       the next tile centre, which is the only moment a turn is accepted */
    let fresh = step(dir, 8);
    if (has(fresh, 'sfx select')) { visited.clear(); dots = 0; target = null; }
    if (has(fresh, 'sfx powerup')) frightenedUntil = frame + 200;
    if (has(fresh, 'sfx zap')) ++zaps;
    if (has(fresh, 'sfx pickup')) fruitTaken = true;
    if (has(fresh, 'sfx hurt')) { step(null, 240); continue; }
    if (has(fresh, 'sfx lose')) { step(' ', 130); visited.clear(); dots = 0; target = null; continue; }
    if (has(fresh, 'sfx levelup')) { ++levelsDone; visited.clear(); dots = 0; target = null; continue; }

    const moved = pacmanTile(game);
    if (moved && moved.col === here.col && moved.row === here.row)
      fresh = step(dir, 16);
  }

  /* pause and resume while the game is definitely running */
  let paused = false;
  for (let attempt = 0; attempt < 6 && !paused; ++attempt) {
    /* Space only starts a game from the title or the game-over screen, so this
       cannot disturb a running one; a short walk then proves the sim is live */
    step(' ', 130);
    step('ArrowLeft', 30);
    step('p', 5);
    paused = game.log.some((l) => l.startsWith('ctx.fillText PAUSED'));
  }
  step('p', 5);
  game.SZ.GameAutoPause.handlers[0].pause();
  step(null, 5);
  step('p', 5);

  /* swipe control on the canvas */
  game.pointer('pointerdown', 100, 100);
  step(null, 2);
  game.pointer('pointerup', 320, 100);
  step(null, 30);

  /* menu: high scores dialog, then Escape closes it */
  game.SZ.MenuBar.onAction('high-scores');
  step(null, 2);
  game.key('Escape');
  step(null, 2);
  game.SZ.MenuBar.onAction('controls');
  game.SZ.MenuBar.onAction('about');
  game.key('Escape');
  step(null, 2);

  /* stand still and let the ghosts take the remaining lives: deaths, game over,
     high-score storage */
  step(null, 1500);

  /* restart from the game-over screen and play a little */
  step(' ', 130);
  step('ArrowLeft', 60);
  step('ArrowUp', 120);
  step('ArrowRight', 60);

  /* menu pause twice */
  game.SZ.MenuBar.onAction('pause');
  step(null, 3);
  game.SZ.MenuBar.onAction('pause');
  step(null, 3);

  /* exit through the menu */
  game.SZ.MenuBar.onAction('exit');
  step(null, 50);
  await game.settle();

  if (process.env.PACMAN_DEBUG) {
    let maxScore = 0;
    for (const l of game.log) {
      const m = l.match(/^text statusScore Score: (\d+)/);
      if (m) maxScore = Math.max(maxScore, +m[1]);
    }
    console.error('DEBUG maxScore=' + maxScore + ' logLines=' + game.log.length +
      ' deaths=' + game.log.filter((l) => l.startsWith('sfx hurt')).length +
      ' gameovers=' + game.log.filter((l) => l.startsWith('sfx lose')).length +
      ' levels=' + levelsDone + ' guard=' + guard + ' stalled=' + stalled +
      ' zaps=' + zaps + ' dots=' + dots + ' recoveries=' + recoveries +
      ' unvisitedDots=' + DOT_TILES.filter((k) => !visited.has(k)).length +
      ' unvisitedPellets=' + PELLET_TILES.filter((k) => !visited.has(k)).length);
    if (process.env.PACMAN_TRACE) {
      console.error('DEBUG unvisited: ' + DOT_TILES.filter((k) => !visited.has(k)).join(' '));
      for (const t of trace) console.error('TRACE ' + t);
      console.error('DEBUG last status lines: ' + game.log.filter((l) => l.startsWith('text status')).slice(-4).join(' | '));
      console.error('DEBUG recoveries=' + recoveries);
      for (const l of game.log.slice(-12)) console.error('TAIL ' + l.slice(0, 90));
      const texts = game.all.filter((l) => l.startsWith('ctx.fillText')).slice(-14);
      for (const l of texts) console.error('TEXT ' + l.slice(0, 90));
      console.error('DEBUG fx.update lines: ' + game.all.filter((l) => l.startsWith('fx.update')).length +
        ' fx.draw lines: ' + game.all.filter((l) => l.startsWith('fx.draw')).length);
    }
    for (const probe of ['LEVEL COMPLETE!', 'sfx zap', 'sfx powerup', 'sfx pickup', 'sfx levelup'])
      console.error('DEBUG ' + probe + ': ' + game.log.some((l) => l.startsWith(probe)));
  }

  const d = game.digest();
  check('session produced effects', game.log.length > 500, 'log entries: ' + game.log.length);
  for (const marker of ['GameAutoPause.attach', 'MenuBar', 'User32.EnableVisualStyles',
    'GameAudio.attachMuteButton', 'sfx select', 'ctx.fillText PAC-MAN', 'ctx.fillText READY!',
    'sfx click', 'sfx coin', 'sfx powerup', 'sfx zap', 'sfx hurt', 'sfx lose', 'sfx levelup',
    'sfx pickup', 'LEVEL COMPLETE!', 'ctx.fillText GAME OVER', 'ctx.fillText PAUSED',
    'store sz-pacman-high-scores', 'Dialog.show highScoresBackdrop', 'html highScoresBody',
    'fx.burst', 'fx.sparkle', 'fx.trail', 'fx.confetti', 'ftext', 'shake', 'glow', 'arc',
    'text statusScore Score:', 'text statusLives Lives:', 'window.close'])
    check('session covers ' + marker, game.log.some((l) => l.includes(marker)), 'no line contains ' + marker);

  if (!fs.existsSync(BASELINE)) {
    if (failures) {
      console.log('NOT RECORDED: ' + failures + ' check(s) failed -- fix the session before locking the baseline');
      process.exit(1);
    }
    fs.writeFileSync(BASELINE, JSON.stringify({ digest: d, entries: game.log.length }, null, 2) + '\n');
    console.log('BASELINE RECORDED ' + d);
    process.exit(0);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  check('digest matches baseline', d === base.digest, 'got ' + d + ' want ' + base.digest);

  process.exit(failures ? 1 : 0);
}

main();
