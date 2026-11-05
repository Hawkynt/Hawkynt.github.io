;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* The boss fight glue: starts a SZ.FlappyBoss simulation when a boss stage (or Boss Rush)
     reaches its arena, steps it with the bird, turns its events into sound, shake, flashes
     and particles, and settles a defeat into the story (victory cinematic, stage clear) or
     the next Boss Rush round. Owns G.boss, G.bossIntro, G.bossBeaten, G.bossRush.index. */

  const { BIRD_X, CANVAS_W, BOSS_TAUNTS } = NS.C;
  const { particles, floatingText, screenShake, sfx } = NS.services;
  const G = NS.state;
  const Rules = NS.rules;
  const Goals = NS.goals;
  const View = NS.view;
  const B = SZ.FlappyBoss;
  const Course = SZ.FlappyCourse;

  const BOSS_COLORS = { bee: '#ffc21a', wyrm: '#e8a050', owl: '#9fe0ff', moth: '#c08aff', crowbot: '#ff4a6a', corvus: '#b45aff' };

  function begin(kind) {
    G.boss = B.create(kind, G.seed ^ 0x5bd1e995, { orbRate: Rules.orbRate(), hpScale: G.mode === 'bossrush' ? 0.8 : 1 });
    G.boss.hitsAtStart = G.hitsTaken;
    G.bossIntro = 3;
    G.bossBeaten = false;
    screenShake.trigger(5, 500);
    sfx('whoosh', { pitch: 0.5, volume: 0.8 });
    sfx('explode', { volume: 0.25, pitch: 0.6 });
    G.flash = 0.3;
    G.flashColor = BOSS_COLORS[kind];
  }

  function taunt() {
    return G.boss ? BOSS_TAUNTS[G.boss.kind] : '';
  }

  function update(dt) {
    const b = G.boss;
    if (!b)
      return;
    G.bossIntro = Math.max(0, G.bossIntro - dt);
    B.update(b, dt, G.bird.y);
    for (const ev of b.events) {
      if (ev === 'hit') {
        sfx('explode', { volume: 0.35, pitch: 1.4 });
        sfx('hurt', { pitch: 0.6, volume: 0.4 });
        particles.burst(b.x, b.y, 26, { color: '#ffd84a', speed: 7, size: 4, life: 0.7 });
        particles.ring(b.x, b.y, '#fff3a0', 7, 0.35);
        screenShake.trigger(6, 220);
        G.hitStop = Math.max(G.hitStop, 0.05);
        floatingText.add(b.x, b.y - 90, b.hp > 0 ? b.hp + ' / ' + b.maxHp : 'K.O.!', { color: '#ffd84a', font: 'bold 26px sans-serif' });
      } else if (ev === 'phase2') {
        floatingText.add(CANVAS_W / 2, 240, 'ENRAGED!', { color: '#ff4a4a', font: 'bold 52px sans-serif' });
        G.flash = 0.4;
        G.flashColor = '#ff4a4a';
        sfx('laser', { pitch: 0.5, volume: 0.6 });
      } else if (ev === 'defeated') {
        particles.burst(b.x, b.y, 80, { color: BOSS_COLORS[b.kind], speed: 10, size: 5, life: 1 });
        particles.confetti(b.x, b.y, 50);
        particles.ring(b.x, b.y, '#ffffff', 12, 0.6);
        screenShake.trigger(12, 700);
        G.hitStop = 0.25;
        G.flash = 0.9;
        G.flashColor = '#ffffff';
        sfx('explode', { volume: 0.9, pitch: 0.7 });
        sfx('win', { volume: 0.5 });
      } else if (ev === 'dead') {
        defeated();
        return;
      } else if (ev.indexOf('attack:') === 0) {
        const a = ev.slice(7);
        sfx(a === 'beam' || a === 'bolts' || a === 'geyser' ? 'zap' : a === 'crows' ? 'whoosh' : 'shoot', { volume: 0.35, pitch: 0.8 + Math.random() * 0.3 });
      } else if (ev.indexOf('zone:') === 0) {
        sfx(ev === 'zone:geyser' ? 'smallExplode' : 'laser', { volume: 0.45 });
        if (ev === 'zone:bolt') {
          G.flash = 0.25;
          G.flashColor = '#e8e0ff';
          screenShake.trigger(4, 150);
        }
      }
    }
    for (const bt of b.bolts)
      particles.trail(bt.x, bt.y, { color: '#fff3a0', size: 5, life: 0.4, shape: 'glow' });
    if (b.state === 'dying') {
      if (Math.random() < 0.3)
        particles.burst(b.x + (Math.random() - 0.5) * 80, b.y + (Math.random() - 0.5) * 60, 6, { color: '#ffb03a', speed: 4, size: 4 });
      return;
    }
    if (b.state !== 'fight')
      return;
    const res = B.collide(b, BIRD_X, G.bird.y, Rules.birdRadius());
    if (res === 'orb') {
      sfx('zap', { pitch: 1.3 });
      sfx('powerup', { pitch: 1.6, volume: 0.4 });
      particles.burst(BIRD_X, G.bird.y, 16, { color: '#fff3a0', speed: 5, size: 3, shape: 'star' });
      particles.ring(BIRD_X, G.bird.y, '#ffd84a', 6, 0.3);
    } else if (res) {
      NS.run.takeHit('boss');
    }
  }

  function defeated() {
    const b = G.boss;
    const kind = b.kind;
    G.save.bosses[kind] = (G.save.bosses[kind] || 0) + 1;
    if (G.hitsTaken === b.hitsAtStart)
      G.save.stats.bossNoHit = (G.save.stats.bossNoHit || 0) + 1;
    G.boss = null;
    G.bossBeaten = true;
    if (G.mode === 'bossrush') {
      ++G.bossRush.index;
      if (G.bossRush.index < G.bossRush.list.length) {
        G.hearts = Math.min(Rules.maxHearts(), G.hearts + 1);
        const next = G.bossRush.list[G.bossRush.index];
        G.sceneBiome = Course.BIOME_ORDER[Course.BOSS_ORDER.indexOf(next)];
        G.scene = View.sceneFor(G.sceneBiome);
        G.fade = 0.8;
        begin(next);
        return;
      }
      NS.run.finishRun('clear');
      return;
    }
    NS.run.finishRun('clear');
    const w = Course.BOSS_ORDER.indexOf(kind);
    const id = kind === 'corvus' ? 'finale' : 'victory' + (w + 1);
    if (!G.save.seenCine[id])
      NS.cine.play(id, () => { G.panelAt = G.globalTime; G.clearStarFx = 0; });
    Goals.check();
  }

  /* the arena of the current stage or round, if any */
  function arenaKind() {
    if (G.mode === 'adventure')
      return Course.STAGES[G.stageIndex].boss || null;
    if (G.mode === 'bossrush' && G.bossRush && G.bossRush.list.length)
      return G.bossRush.list[G.bossRush.index] || null;
    return null;
  }

  Object.assign(NS.bossfight, { BOSS_COLORS, begin, taunt, update, defeated, arenaKind });
})();
