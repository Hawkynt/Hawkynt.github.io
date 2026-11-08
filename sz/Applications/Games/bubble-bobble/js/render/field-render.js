/* The room: a framed window into the kingdom with its platform tiles (rounded at the ends),
   items, floods, flames and bolts, the guardian, enemies (bobbing, angry red, frozen blue,
   blinking while stunned), bubbles (empty, elemental, or with a curled-up enemy that shakes
   before breaking out), enemy shots, the shade, and Fizz (blinking while safe after a hit,
   spinning away when hit), the shield and the hurry-up warning; Dim Rooms darken everything but
   a circle of light around the player. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BubbleBobble || (SZ.BubbleBobble = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const S = NS.sprites;
  const M = NS.metaData;
  const { FIELD_X, FIELD_Y, FIELD_W, FIELD_H, TILE, COLS, ROWS, TAU } = C;
  const { ctx } = NS.view;

  function newtDef() {
    return M.PADDLES.find(x => x.id === G.profile.cosmetics.paddle) || M.PADDLES[0];
  }

  function bubbleDef() {
    return M.BALLS.find(x => x.id === G.profile.cosmetics.ball) || M.BALLS[0];
  }

  /* the static room painted once per map */
  let roomKey = '', roomImg = null;
  function room(g, w) {
    const key = w + ':' + g.map.join('');
    if (key === roomKey && roomImg) return roomImg;
    roomKey = key;
    roomImg = K.canvas(FIELD_W, FIELD_H);
    const r = roomImg.getContext('2d');
    r.fillStyle = 'rgba(6,10,24,0.55)';
    r.fillRect(0, 0, FIELD_W, FIELD_H);
    for (let y = 0; y < ROWS; ++y)
      for (let x = 0; x < COLS; ++x) {
        if (g.map[y][x] !== '#') continue;
        const l = x === 0 || g.map[y][x - 1] !== '#', rr = x === COLS - 1 || g.map[y][x + 1] !== '#';
        r.drawImage(S.tile(w, l, rr), x * TILE, y * TILE);
      }
    return roomImg;
  }

  function frame(w) {
    const W = NS.worldData.WORLDS[w || 0];
    return K.sprite('roomframe:' + (w || 0), FIELD_W + 24, FIELD_H + 24, (g) => {
      K.roundRect(g, 0, 0, FIELD_W + 24, FIELD_H + 24, 18);
      const gr = g.createLinearGradient(0, 0, 0, FIELD_H + 24);
      gr.addColorStop(0, K.shade(W.accent, 0)); gr.addColorStop(1, K.shade(W.accent, -0.6));
      g.fillStyle = gr; g.fill();
      g.strokeStyle = K.rgba(W.glow, 0.9); g.lineWidth = 2; K.roundRect(g, 3, 3, FIELD_W + 18, FIELD_H + 18, 16); g.stroke();
      for (let k = 0; k < 14; ++k) { g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1; g.beginPath(); g.arc(8 + (k * 53) % (FIELD_W + 8), k % 2 ? 6 : FIELD_H + 18, 4, 0, TAU); g.stroke(); }
    });
  }

  function draw(g, opts) {
    opts = opts || {};
    const run = G.run;
    const w = opts.demo ? 0 : run ? run.world : 0;
    const ox = FIELD_X, oy = FIELD_Y;
    ctx.drawImage(frame(w), ox - 12, oy - 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, FIELD_W, FIELD_H);
    ctx.clip();
    ctx.drawImage(room(g, w), ox, oy);
    for (const it of g.items) {
      const img = it.kind === 'fruit' ? S.fruit(it.fruit) : S.candy(it.kind);
      if (it.t > 7 && Math.floor(it.t * 8) % 2) continue;
      ctx.drawImage(img, ox + it.x - img.width / 2, oy + it.y - img.height);
    }
    for (const f of g.floods) {
      ctx.fillStyle = 'rgba(90,200,255,0.7)';
      K.roundRect(ctx, ox + f.x - 22, oy + f.y - 18, 44, 18, 8);
      ctx.fill();
    }
    for (const f of g.flames) {
      const fl = 0.7 + 0.3 * Math.sin(G.time * 20 + f.x);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fl;
      K.blit(ctx, K.glow('#ff7a2a'), ox + f.x, oy + f.y - 10, 0.6);
      ctx.restore();
    }
    for (const b of g.bolts) {
      ctx.strokeStyle = '#fff6a0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ox + b.x - 24 * Math.sign(b.vx), oy + b.y);
      for (let k = 1; k <= 4; ++k) ctx.lineTo(ox + b.x - 24 * Math.sign(b.vx) + k * 12 * Math.sign(b.vx), oy + b.y + (k % 2 ? -6 : 6));
      ctx.stroke();
    }
    if (g.boss && g.boss.hp > 0) NS.bossArt.drawBoss(g.boss.w, ox + g.boss.x, oy + g.boss.y + 70, g.boss, 0.5);
    const frozen = g.freezeT > 0;
    for (const e of g.enemies) {
      const state = frozen ? 2 : e.angry || g.angry ? 1 : 0;
      if (e.stun > 0 && Math.floor(G.time * 16) % 2) continue;
      const img = S.enemy(e.type, e.dir || 1, state, Math.floor((e.t || 0) * 6) % 2);
      ctx.drawImage(img, ox + e.x - 16, oy + e.y - 32 + (e.type === 'flyer' || e.type === 'ghost' ? 12 : 0));
    }
    const bdef = bubbleDef();
    for (const b of g.bubbles) {
      const img = S.bubble(bdef, Math.round(b.r), b.elem);
      let jx = 0;
      if (b.trap) {
        if (b.trap.t < 2) jx = Math.sin(G.time * 40) * 2;
        ctx.drawImage(S.enemy(b.trap.type, 1, b.trap.t < 2 ? 1 : 0, 0), ox + b.x - 12 + jx, oy + b.y - 12, 24, 24);
      }
      ctx.drawImage(img, ox + b.x - img.width / 2 + jx, oy + b.y - img.height / 2);
    }
    for (const s of g.shots) ctx.drawImage(S.shot(!!s.boss), ox + s.x - 10, oy + s.y - 10);
    if (g.shade) ctx.drawImage(S.shade(), ox + g.shade.x - 24, oy + g.shade.y - 24 + Math.sin(G.time * 4) * 3);
    const p = g.player;
    if (p && !(p.inv > 0 && p.inv < 100 && Math.floor(G.time * 14) % 2)) {
      const pose = p.dead ? 'jump' : !p.ground ? 'jump' : p.shotT > C.SHOT_GAP * 0.6 ? 'blow' : p.vx ? (Math.floor(p.walk * 8) % 2 ? 'walk1' : 'walk2') : 'stand';
      const img = S.newt(newtDef(), pose, p.face || 1);
      ctx.save();
      ctx.translate(ox + p.x, oy + p.y - 20);
      if (p.dead) ctx.rotate(G.time * 12);
      ctx.drawImage(img, -20, -20);
      ctx.restore();
      if (p.shield) {
        ctx.strokeStyle = 'rgba(200,160,255,' + (0.5 + 0.3 * Math.sin(G.time * 6)) + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(ox + p.x, oy + p.y - 16, 24, 0, TAU);
        ctx.stroke();
      }
    }
    if (!opts.demo && run && run.dark && p) {
      ctx.fillStyle = 'rgba(0,0,8,0.88)';
      ctx.beginPath();
      ctx.rect(ox, oy, FIELD_W, FIELD_H);
      ctx.arc(ox + p.x, oy + p.y - 14, 120, 0, TAU, true);
      ctx.fill('evenodd');
    }
    if (!opts.demo && g.angry && !g.boss && Math.floor(G.time * 3) % 2) NS.kit.text('HURRY UP!', ox + FIELD_W / 2, oy + 60, 30, '#ff6a6a', { align: 'center', weight: 'bold', shadow: true });
    ctx.restore();
  }

  Object.assign(NS.fieldRender, { newtDef, bubbleDef, room, frame, draw, paddleDef: newtDef, ballDef: bubbleDef });
})();
