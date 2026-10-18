/* The win sequence, star rating, shard payout, realm restoration and the fireworks afterwards. Owns
   G.winSeq, G.celebrate, G.panelAnim. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { VIEW_W, VIEW_H, SPELL_TIME, PORTAL_ENTER_TIME, DAILY_SHARDS, STATE_LEVEL_COMPLETE } = NS.consts;
  const { sfx, screenShake, floatingText, Fx, fxBoard, fxScreen } = NS.context;
  const { tileCenterX, tileCenterY, toViewX, toViewY } = NS.view;
  const { writeSave, addHighScore } = NS.store;
  const { goalIndex } = NS.rules;
  const { treeLevel } = NS.grimoire;
  const { localDateString, realmInfo } = NS.session;
  const { startWalk } = NS.world;
  const { pushRing } = NS.casting;

  function startWin() {
    const goal = goalIndex();
    /* the puzzle is solved: the portal wakes and the goal turns reachable */
    sfx('powerup');
    G.winSeq = { phase: 'walk', t: 0, trail: [G.puzzle.hero] };
    startWalk(goal, function() {
      G.winSeq.phase = 'enter';
      G.winSeq.t = 0;
      G.spells.push({ kind: 'portalOpen', x: tileCenterX(goal), y: tileCenterY(goal), t: 0, dur: SPELL_TIME });
      pushRing(tileCenterX(goal), tileCenterY(goal), 10, 70, '#ffd75a', 4, 0.6);
      Fx.portal(fxBoard, tileCenterX(goal), tileCenterY(goal), realmInfo().color);
      pushRing(tileCenterX(goal), tileCenterY(goal), 20, 130, '#ffffff', 5, 0.7);
      screenShake.trigger(4, 220);
      /* Grand Entrance: fireworks at the portal */
      if (treeLevel('s_finale') > 0) {
        const gx = toViewX(tileCenterX(goal)), gy = toViewY(tileCenterY(goal));
        Fx.confetti(fxScreen, gx, gy, 40);
        Fx.firework(fxScreen, gx, gy + 40);
      }
    });
  }

  function updateWin(dt) {
    if (!G.winSeq)
      return;
    if (G.winSeq.phase === 'enter') {
      G.winSeq.t += dt;
      const k = Math.min(1, G.winSeq.t / PORTAL_ENTER_TIME);
      const goal = goalIndex();
      G.hero.x = G.hero.x + (tileCenterX(goal) - G.hero.x) * Math.min(1, dt * 6);
      G.hero.y = G.hero.y + (tileCenterY(goal) - G.hero.y) * Math.min(1, dt * 6);
      G.hero.scale = 1 - k * 0.8;
      G.hero.alpha = 1 - k;
      G.hero.pose = 'idle';
      /* finish once: the complete panel and its star pop-in start from here */
      if (k >= 1) {
        G.winSeq.phase = 'done';
        completeLevel();
      }
    }
  }

  function completeLevel() {
    G.state = STATE_LEVEL_COMPLETE;
    const stars = 1
      + (G.casts <= G.level.par ? 1 : 0)
      + (SZ.PuzzleCore.isPerfect(G.puzzle) ? 1 : 0);
    /* every star above the best before pays arcane shards, trials double */
    const oldStars = G.save.stars[G.level.id] | 0;
    let gained = 0;
    if (stars > oldStars) {
      gained = (stars - oldStars) * (G.levelKind === 'bonus' ? 2 : 1);
      G.save.stars[G.level.id] = stars;
    }
    if (G.sessionMode === 'daily') {
      const today = localDateString();
      if (G.save.daily.date !== today)
        G.save.daily = { date: today, solved: false, stars: 0 };
      if (!G.save.daily.solved) {
        G.save.daily.solved = true;
        gained += DAILY_SHARDS;
      }
      if (stars > G.save.daily.stars)
        G.save.daily.stars = stars;
    }
    G.save.shards += gained;
    ++G.save.stats.levels;
    G.lastShardGain = gained;
    writeSave();
    addHighScore(G.level.name, stars);
    G.panelAnim = { at: G.time, starPlayed: [false, false, false] };
    screenShake.trigger(5, 250);
    Fx.confetti(fxScreen, VIEW_W / 2 - 300, VIEW_H, 36);
    Fx.confetti(fxScreen, VIEW_W / 2 + 300, VIEW_H, 36);
    for (let k = 0; k < 3; ++k)
      Fx.firework(fxScreen, 200 + Math.random() * 880, VIEW_H + 10);
    celebrate = { t: 0, next: 0.6, left: 4 };
    if (gained > 0)
      floatingText.add(VIEW_W / 2, VIEW_H / 2 - 110, `+${gained} shards`, { color: '#8fd0ff', font: 'bold 20px sans-serif' });
    /* the first full clear of a realm: the whole realm is restored */
    if (G.levelKind === 'campaign' && (G.levelIndex % 8) === 7) {
      const realm = G.level.realm;
      let cleared = true, wasCleared = true;
      for (let k = 0; k < 8; ++k) {
        const id = SZ.PuzzleLevels.CAMPAIGN[realm * 8 + k].id;
        if ((G.save.stars[id] | 0) < 1)
          cleared = false;
        if ((id === G.level.id ? oldStars : G.save.stars[id] | 0) < 1)
          wasCleared = false;
      }
      if (cleared && !wasCleared) {
        G.realmBanner = { realm: realm, t: 0 };
        Fx.confetti(fxScreen, 320, 420, 40);
        Fx.confetti(fxScreen, 960, 420, 40);
        celebrate.left += 4;
        sfx('levelup');
      }
    }
    sfx('win');
    NS.screens.updateWindowTitle();
  }

  /* particles: the realm's air, power gathering at the staff, motes into the portal */
  let celebrate = null;

  function updateCelebration(dt) {
    if (!celebrate)
      return;
    celebrate.t += dt;
    if (celebrate.left > 0 && celebrate.t >= celebrate.next) {
      --celebrate.left;
      celebrate.next = celebrate.t + 0.35 + Math.random() * 0.4;
      Fx.firework(fxScreen, 160 + Math.random() * 960, VIEW_H + 10);
      sfx('smallExplode', { volume: 0.18, pitch: 1.4 + Math.random() * 0.4 });
    }
    if (celebrate.left <= 0 && celebrate.t > 4)
      celebrate = null;
  }

  NS.win = { updateWin, startWin, updateCelebration };
})();
