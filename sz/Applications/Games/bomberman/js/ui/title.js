/* The title screen: the animated logo, a live vignette of Pip blasting a brick wall, the
   profile card (rank, XP, gems, streak), Continue with the saved run, the five modes, the
   seasonal event card with its token track, today's quests, and the tech tree, wardrobe,
   goals, stats and help buttons. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Bomberman || (SZ.Bomberman = {});
  const C = NS.constants;
  const G = NS.state;
  const { UI } = C;
  const { EVENT_TIERS } = NS.meta;
  const K = NS.artKit;
  const kit = NS.kit;
  const scr = NS.screens;
  const rules = NS.rules;
  const { ctx } = NS.view;
  const M = NS.modes;

  /* ── the vignette: Pip walks a ledge, drops a bomb by a brick and ducks away ── */
  const V = { x: 70, dir: 1, bombX: -1, bombT: 0, wait: 0, bricks: [1, 1, 1, 1, 1], respawn: [0, 0, 0, 0, 0] };
  const VY = 560, VX0 = 60, CELL = 52;

  function vignette(dt) {
    for (let i = 0; i < V.bricks.length; ++i)
      if (!V.bricks[i] && (V.respawn[i] -= dt) <= 0) { V.bricks[i] = 1; NS.fx.burst(brickX(i), VY - 20, 8, '#ffe066', 100, 0.4, 6, true); }
    if (V.bombX >= 0) {
      V.bombT -= dt;
      if (V.bombT <= 0) {
        const bx = V.bombX;
        V.bombX = -1;
        NS.fx.burst(bx, VY - 20, 26, '#ffd23a', 320, 0.5, 1, true);
        NS.fx.ring(bx, VY - 20, 6, 90, 0.35, '#fff1b0', 5);
        NS.fx.shake(3);
        for (let i = 0; i < V.bricks.length; ++i)
          if (V.bricks[i] && Math.abs(brickX(i) - bx) < CELL * 1.6) {
            V.bricks[i] = 0;
            V.respawn[i] = 3 + Math.random() * 2;
            for (let k = 0; k < 8; ++k) NS.fx.emit(brickX(i), VY - 24, (Math.random() - 0.5) * 300, -150 - Math.random() * 200, 0.9, 6, k % 2 ? '#c8743c' : '#a65a2c', 2, false, 900, 0.5);
          }
        if (SZ.GameAudio && G.screen === 'title' && G.screenT > 0.5) SZ.GameAudio.play('smallExplode', { volume: 0.15, pitch: 1.2 });
      }
    }
    if (V.wait > 0) { V.wait -= dt; return; }
    V.x += V.dir * 70 * dt;
    if (V.x > 400) V.dir = -1;
    if (V.x < 40) V.dir = 1;
    if (V.bombX < 0) {
      for (let i = 0; i < V.bricks.length; ++i) {
        if (!V.bricks[i]) continue;
        const d = brickX(i) - V.x;
        if (Math.abs(d) < CELL + 4 && Math.sign(d) === V.dir) {
          V.bombX = V.x;
          V.bombT = 1.4;
          V.dir = -V.dir;
          if (SZ.GameAudio && G.screenT > 0.5) SZ.GameAudio.play('drop', { volume: 0.12 });
          break;
        }
      }
    }
  }

  function brickX(i) {
    return VX0 + 70 + i * (CELL + 14);
  }

  function drawVignette() {
    const soft = NS.tileArt.soft(0);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    K.roundRect(ctx, 24, VY + 6, 410, 20, 10); ctx.fill();
    for (let i = 0; i < 9; ++i) ctx.drawImage(NS.tileArt.floor(0, i & 1), 30 + i * 44, VY - 2, 44, 18);
    for (let i = 0; i < V.bricks.length; ++i) if (V.bricks[i]) ctx.drawImage(soft, brickX(i) - 24, VY - 46, 48, 48);
    if (V.bombX >= 0) {
      const s = NS.itemArt.bomb(G.save.equip.bomb, false);
      const k = 1 + Math.sin(G.time * 20) * 0.06;
      ctx.drawImage(s, V.bombX - 24 * k, VY - 50 * k, 48 * k, 52 * k);
    }
    const f = V.wait > 0 ? 0 : Math.floor(G.time * 8) % 4;
    const sp = NS.actorArt.bomber(G.save.equip.skin, V.dir > 0 ? 3 : 2, f);
    ctx.drawImage(sp, V.x - 32, VY - 74, 64, 76);
  }

  function draw() {
    vignette(1 / 60);
    const save = G.save;
    const t = G.time;
    /* logo */
    const logo = kit.logo();
    const k = 0.8 + Math.sin(t * 1.6) * 0.01;
    ctx.save();
    ctx.translate(640, 118);
    ctx.rotate(Math.sin(t * 0.9) * 0.012);
    ctx.drawImage(logo, -logo.width * k / 2, -logo.height * k / 2, logo.width * k, logo.height * k);
    ctx.restore();
    kit.text('S P A R K   Q U E S T', 640, 196, 20, '#fff1d0', { align: 'center', weight: 'bold', stroke: 5 });
    profile(save);
    drawVignette();
    featured();
    /* modes */
    let y = 240;
    const bx = 470, bw = 340, bh = 56;
    if (G.hasContinue && G.continueInfo) {
      const ci = G.continueInfo;
      kit.button('continue', 'Continue', bx, y, bw, bh, { icon: 'continue', accent: UI.good, sub: M.INFO[ci.mode].name + ' - ' + ci.name + ' - ' + ci.score + ' pts', action: () => NS.run.resume() });
      y += 64;
    }
    for (const id of ['story', 'arcade', 'zen', 'daily', 'rush']) {
      const info = M.INFO[id];
      let sub = info.sub;
      if (id === 'daily') sub = (save.daily.done ? 'Done today - best ' + save.daily.best : M.dailyText());
      if (id === 'arcade' && save.scores.arcade[0]) sub = 'Best ' + save.scores.arcade[0].score + ' - endless arenas';
      if (id === 'story') { const n = rules.nextStage(save); sub = save.stats.stars + '/105 stars - next ' + (n.world + 1) + '-' + (n.level + 1); }
      kit.button('m_' + id, info.name, bx, y, bw, bh, {
        icon: info.icon, accent: info.color, sub: sub,
        action: () => id === 'story' ? openMap() : M.start(id)
      });
      y += 64;
    }
    /* meta buttons */
    const metas = [['tree', 'Tech Tree', 'tree', '#ff8a3c'], ['wardrobe', 'Wardrobe', 'shirt', '#ff70c0'], ['goals', 'Goals', 'trophy', '#ffd84a'], ['stats', 'Stats', 'stats', '#6fd3ff'], ['help', 'How to Play', 'help', '#7cf08a']];
    const mw = 176, gap = 12, mx = 640 - (metas.length * mw + (metas.length - 1) * gap) / 2;
    for (let i = 0; i < metas.length; ++i) {
      const m = metas[i];
      const badge = m[0] === 'goals' ? claimable() : m[0] === 'tree' ? affordable() : 0;
      kit.button('t_' + m[0], m[1], mx + i * (mw + gap), 640, mw, 50, { icon: m[2], accent: m[3], px: 17, badge: badge, action: () => scr.open(m[0], 'title') });
    }
  }

  function openMap() {
    const n = rules.nextStage(G.save);
    G.ui.mapWorld = n.world;
    G.ui.mapSel = n.level;
    scr.setScreen('map');
  }

  function profile(save) {
    const rank = rules.rankOf(save.stats.xp);
    kit.panel(20, 20, 300, 92, { accent: '#ffb347' });
    const s = NS.actorArt.bomber(save.equip.skin, 0, 0);
    ctx.drawImage(s, 28, 26, 64, 76);
    kit.text(rank.name.toUpperCase(), 100, 44, 18, '#ffffff', { weight: 'bold' });
    kit.bar(100, 58, 130, 8, rank.max ? 1 : (rank.xp - rank.from) / (rank.to - rank.from), '#ffb347');
    kit.text(rank.max ? 'max rank' : (rank.to - rank.xp) + ' xp to go', 100, 76, 11, UI.textDim);
    kit.gems(save.gems, 306, 44, 20, 'right');
    kit.icon('fire', 228, 84, 20, save.streak.count > 1 ? '#ff8a3c' : '#6a5a5a');
    kit.text(save.streak.count + ' day streak', 242, 85, 12, save.streak.count > 1 ? '#ffd0a0' : UI.textMute);
  }

  function featured() {
    const save = G.save;
    const se = G.season;
    /* season event card */
    const x = 880, y = 240, w = 376, h = 186;
    kit.panel(x, y, w, h, { accent: se.def.color, glow: true });
    kit.icon(se.def.tokenIcon, x + 34, y + 34, 40, se.def.color);
    kit.text(se.def.name.toUpperCase() + (se.spooky ? ' - SPOOKY NIGHTS' : ''), x + 62, y + 26, 17, se.def.color, { weight: 'bold' });
    kit.text('Seasonal event - ' + se.daysLeft + ' days left', x + 62, y + 46, 12, UI.textDim);
    const tokens = save.event.tokens;
    const max = EVENT_TIERS[EVENT_TIERS.length - 1].need;
    kit.bar(x + 22, y + 82, w - 44, 14, tokens / max, se.def.color);
    for (let i = 0; i < EVENT_TIERS.length; ++i) {
      const tx = x + 22 + (w - 44) * EVENT_TIERS[i].need / max;
      const got = save.event.claimed.indexOf(i) >= 0, ready = tokens >= EVENT_TIERS[i].need && !got;
      ctx.fillStyle = got ? UI.good : ready ? UI.gold : 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(tx, y + 89, ready ? 8 + Math.sin(G.time * 6) * 1.5 : 6, 0, Math.PI * 2); ctx.fill();
    }
    kit.text(tokens + ' ' + se.def.token.toLowerCase() + ' collected', x + 22, y + 116, 14, UI.text);
    kit.text('Find them under bricks and floating in every mode', x + 22, y + 136, 11, UI.textDim);
    kit.button('event', 'Event Rewards', x + w - 190, y + h - 44, 170, 34, { px: 14, accent: se.def.color, action: () => { G.ui.goalsTab = 'event'; scr.open('goals', 'title'); } });
    /* quests */
    const qy = 440, qh = 186;
    kit.panel(x, qy, w, qh, { accent: '#7cf08a' });
    kit.text("TODAY'S QUESTS", x + 20, qy + 22, 14, '#7cf08a', { weight: 'bold' });
    const list = save.quests.list;
    for (let i = 0; i < list.length; ++i) {
      const q = list[i];
      const prog = rules.questProgress(save, q);
      const yy = qy + 52 + i * 42;
      kit.fitText(q.text, x + 20, yy, w - 120, 14, { color: q.claimed ? UI.textMute : UI.text });
      kit.bar(x + 20, yy + 12, w - 120, 7, prog / q.goal, q.claimed ? '#5a6a5a' : prog >= q.goal ? UI.gold : '#7cf08a');
      kit.gems(q.gems, x + w - 20, yy + 6, 14, 'right');
      if (prog >= q.goal && !q.claimed) kit.text('CLAIM!', x + w - 92, yy + 6, 12, UI.gold, { weight: 'bold', align: 'right' });
    }
    /* daily featured */
    kit.panel(24, 248, 410, 92, { accent: '#6fd3ff' });
    kit.icon('daily', 56, 280, 34, '#6fd3ff');
    kit.text("TODAY'S CHALLENGE", 84, 270, 14, '#6fd3ff', { weight: 'bold' });
    kit.fitText(M.dailyText(), 84, 292, 330, 14, { color: UI.text });
    kit.text(save.daily.done ? 'Cleared! Come back tomorrow' : 'First clear pays 80 gems', 84, 316, 12, save.daily.done ? UI.good : UI.textDim);
    const wk = G.weekly;
    kit.panel(24, 352, 410, 72, { accent: '#c58bff' });
    kit.text('WEEKLY: ' + wk.text, 44, 374, 13, '#c58bff', { weight: 'bold' });
    kit.bar(44, 392, 280, 8, rules.weeklyProgress(save, wk) / wk.goal, save.weekly.claimed ? '#5a6a5a' : '#c58bff');
    kit.gems(wk.gems, 414, 396, 14, 'right');
  }

  function claimable() {
    const save = G.save;
    let n = 0;
    for (let i = 0; i < save.quests.list.length; ++i) {
      const q = save.quests.list[i];
      if (!q.claimed && rules.questProgress(save, q) >= q.goal) ++n;
    }
    if (!save.weekly.claimed && rules.weeklyProgress(save, G.weekly) >= G.weekly.goal) ++n;
    for (let i = 0; i < EVENT_TIERS.length; ++i) if (save.event.tokens >= EVENT_TIERS[i].need && save.event.claimed.indexOf(i) < 0) ++n;
    return n;
  }

  function affordable() {
    let n = 0;
    for (let i = 0; i < rules.TREE.length; ++i) if (rules.nodeState(G.save, rules.TREE[i].id) === 'available') ++n;
    return n;
  }

  Object.assign(NS.title, {
    draw, openMap, claimable, affordable
  });
})();
