'use strict';

/* Every game with a soundtrack in a real browser: its page opens, the shared engine is loaded,
   the game asks for its menu theme (an arranged song in one of the engine's styles), the music
   switch is in the window menu, and nothing logs an error. */
exports.ns = 'Tetris';
exports.game = 'tetris';

const GAMES = [
  ['tetris', 'Tetris', 'tt-'], ['breakout', 'Breakout', 'bo-'], ['bubble-bobble', 'BubbleBobble', 'bb-'], ['minesweeper', 'Minesweeper', 'ms-'],
  ['cookie-clicker', 'CookieClicker', 'cc-'], ['space-mining', 'SpaceMining', 'sm-'], ['endless-runner', 'EndlessRunner', 'er-'], ['snake', 'Snake', 'sn-'],
  ['pacman', 'Pacman', 'pm-'], ['asteroids', 'Asteroids', 'as-'], ['bomberman', 'Bomberman', 'bm-'], ['boulder-dash', 'BoulderDash', 'bd-'],
  ['flappy-bird', 'FlappyBird', 'fb-'],
].concat(process.env.SZ_SOUNDTRACKS ? JSON.parse(process.env.SZ_SOUNDTRACKS) : []);

exports.run = async (t) => {
  const only = process.env.SZ_SOUNDTRACK_ONLY ? process.env.SZ_SOUNDTRACK_ONLY.split(',') : null;
  for (const [game, ns, prefix] of GAMES) {
    if (only && only.indexOf(game) < 0) continue;
    const W = '(function(){ const ws = [window].concat(Array.from(document.querySelectorAll("iframe")).map(f => f.contentWindow)); ' +
      'for (const w of ws) { try { if (w && w.SZ && w.SZ.' + ns + ' && w.SZ.GameMusic) return w; } catch (_) {} } return null; })()';
    const url = t.base + '/sz/Applications/Games/' + game + '/index.html';
    await t.page.goto(url, '!!' + W);
    await t.page.eval('localStorage.clear()');
    await t.page.goto(url, '!!' + W);
    let song = null;
    for (let k = 0; k < 30 && !song; ++k) {
      await t.wait(200);
      song = await t.page.eval('(function(){ const w = ' + W + '; const c = w && w.SZ.GameMusic.current; return c ? { id: c.id, style: c.style || "" } : null; })()');
    }
    t.check(game + ' plays its menu theme in an engine style', !!song && song.id.indexOf(prefix) === 0 && !!song.style, song);
    const menu = await t.page.eval('(function(){ const w = ' + W + '; return !!(w && w.document.querySelector(\'[data-action="music"]\')); })()');
    t.check(game + ' has the music switch in its menu', menu);
    const errs = t.errors();
    t.check(game + ' logs no errors', errs.length === 0, errs.slice(0, 3));
  }
};
