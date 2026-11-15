/* Memory: an unmatched pair turns face down again after about a second, so play can go on. */
'use strict';

const path = require('path');
const { createGame } = require('./harness.js');

const game = createGame(path.join(__dirname, '..'), { seed: 3 });
const errors = game.load();
if (errors.length) { console.log('FAIL load: ' + errors.join(' | ')); process.exit(1); }
const frame = game.SZ.CardGames.dom.canvas.parentElement;
frame.clientWidth = 900;
frame.clientHeight = 600;
game.SZ.CardGames.dom.setupCanvas();
game.frames(3);
game.SZ.CardGames.scenes.clear();
game.SZ.CardGames.state.skipTitles = true;
game.SZ.CardGames.game.selectGame('memory');
game.frames(30);
for (let i = 0; i < 600 && game.SZ.CardGames.v.memory.S.dealAnimActive; ++i) game.frames(1); /* let the deal finish */

const V = game.SZ.CardGames.v.memory, S = V.S;
const a = 0;
const b = S.cards.findIndex((c, i) => i > 0 && c.rank !== S.cards[a].rank);
const mod = game.SZ.CardGames.state.activeVariantModule;
const at = (i) => { const p = V.cardPos(i); mod.handleClick(p.x + 10, p.y + 10); };
at(a); game.frames(20);
at(b); game.frames(12); /* mid-way: both shown, the check still pending */
let failures = 0;
const check = (name, ok) => { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) ++failures; };
check('two different cards are both face up', S.cards[a].faceUp && S.cards[b].faceUp);
game.frames(90); /* 1.5 s */
check('the unmatched pair is face down again after 1.5 s', !S.cards[a].faceUp && !S.cards[b].faceUp);
check('the board is unlocked for the next pick', S.flipLockTimer === 0 && S.firstPick < 0 && S.secondPick < 0);
process.exit(failures ? 1 : 0);
