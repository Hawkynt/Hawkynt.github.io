/* Collecting things: coins (a rising chain of notes, turned into gems by Gem Rush), gems,
   Spark Shards, festival tokens, power-up orbs, a guardian's spark orbs and the finish gate on
   the course; the magnet pulling coins and gems in; coins from the rain and the sky trail of a
   flight. Owns nothing; marks live on the items. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.EndlessRunner || (SZ.EndlessRunner = {});
  const G = NS.state;
  const C = NS.constants;
  const PH = NS.physics;
  const PW = NS.powers;
  const fx = NS.fx;
  const { sfx } = NS.audio;
  const { PICKUP_R, POWER_BY_ID } = NS.items;

  const PB = {};

  function touches(it, r) {
    return it.x + r > PB.x0 && it.x - r < PB.x1 && it.y + r > PB.y0 && it.y - r < PB.y1;
  }

  function coin(run, x, y, gem) {
    if (gem || PW.on(run, 'lucky')) {
      gemGot(run, x, y);
      return;
    }
    ++run.coins;
    run.chain = run.t - run.chainT < 0.45 ? run.chain + 1 : 0;
    run.chainT = run.t;
    NS.run.addScore(run, C.COIN_SCORE, x, y, null);
    NS.run.bumpCombo(run, 1);
    NS.progress.count('coins', 1);
    if (!run.demo) NS.audio.coin(run.chain);
    fx.burst(x, y, 4, ['#fff2a0', '#ffd24a'], 160, 0.3, 9, fx.STAR);
  }

  function gemGot(run, x, y) {
    ++run.gems;
    const rush = PW.on(run, 'lucky');
    NS.run.addScore(run, C.GEM_SCORE, x, y, rush ? null : '#ff8ad5');
    NS.run.bumpCombo(run, rush ? 1 : 3);
    NS.progress.count('gems', 1);
    fx.burst(x, y, rush ? 5 : 10, ['#ff6ad5', '#ffffff', '#b48cff'], 260, 0.45, 12, fx.STAR);
    if (!run.demo) sfx('pickup', { pitch: 1.5, volume: 0.6 });
  }

  function take(run, it) {
    it.got = 1;
    const p = run.p;
    switch (it.k) {
      case 'coin': coin(run, it.x, it.y, false); break;
      case 'gem': gemGot(run, it.x, it.y); break;
      case 'shard':
        ++run.shards;
        run.shardMask |= 1 << (it.n || 0);
        NS.progress.count('shards', 1);
        fx.burst(it.x, it.y, 30, ['#5ee0ff', '#ffffff', '#ffd24a'], 420, 0.8, 16);
        fx.ring(it.x, it.y, 10, 160, 0.5, '#5ee0ff', 6);
        fx.text(it.x, it.y - 40, 'Spark Shard ' + run.shards + '/3', '#5ee0ff', 28, 1.4);
        fx.flash('#5ee0ff', 0.2);
        fx.hitstop(0.06);
        sfx('levelup', { pitch: 1.2 });
        break;
      case 'token':
        ++run.tokens;
        fx.burst(it.x, it.y, 18, [G.season ? G.season.color : '#ffd24a', '#ffffff'], 300, 0.6, 14, fx.STAR);
        fx.text(it.x, it.y - 30, G.season ? '+1 ' + G.season.token : '+1', G.season ? G.season.color : '#ffd24a', 22, 1.1);
        sfx('pickup', { pitch: 0.9 });
        break;
      case 'power':
        PW.activate(run, it.p);
        NS.run.bumpCombo(run, 5);
        break;
      case 'orb':
        NS.bosses.orb(run, it);
        break;
      case 'finish':
        if (!run.demo) NS.run.finish(run);
        break;
    }
    if (it.k === 'power' && POWER_BY_ID[it.p]) fx.burst(p.x, p.y - 40, 6, POWER_BY_ID[it.p].color, 200, 0.4, 14);
  }

  function update(run, dt) {
    const p = run.p;
    PH.playerBox(p, PB);
    PB.x0 -= 6; PB.x1 += 6; PB.y0 -= 6;
    const magnet = PW.on(run, 'magnet') || p.fly === 2;
    const range = magnet ? G.stats.magnetRange : 0;
    const items = run.course.items;
    const cx = p.x, cy = p.y - 36 * p.scale;
    for (let i = PH.lowerBound(items, p.x - 500); i < items.length && items[i].x < p.x + Math.max(280, range + 40); ++i) {
      const it = items[i];
      if (it.got) continue;
      const pull = it.k === 'orb' ? 240 : magnet && (it.k === 'coin' || it.k === 'gem') ? range : 0;
      if (pull) {
        const dx = cx - it.x, dy = cy - it.y;
        const d2 = dx * dx + dy * dy;
        if (it.mag || d2 < pull * pull) {
          it.mag = 1;
          const k = Math.min(1, dt * 14);
          it.x += dx * k + 600 * dt;
          it.y += dy * k;
        }
      }
      if (it.k === 'finish') {
        if (p.x >= it.x) take(run, it);
        continue;
      }
      if (touches(it, PICKUP_R[it.k] || 14)) take(run, it);
    }
    /* coin rain and the sky trail */
    for (let pass = 0; pass < 2; ++pass) {
      const list = pass ? run.sky : run.rain;
      for (let i = list.length - 1; i >= 0; --i) {
        const c = list[i];
        if (magnet || p.fly) {
          const dx = cx - c.x, dy = cy - c.y;
          if (dx * dx + dy * dy < (range || 160) * (range || 160)) {
            const k = Math.min(1, dt * 14);
            c.x += dx * k + 600 * dt;
            c.y += dy * k;
          }
        }
        if (touches(c, PICKUP_R.coin)) {
          coin(run, c.x, c.y, c.gem);
          list.splice(i, 1);
        }
      }
    }
  }

  Object.assign(NS.pickups, {
    update, take, coin
  });
})();
