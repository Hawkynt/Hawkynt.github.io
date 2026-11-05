/* The story's world map: five world islands (thumbnails of their scenery) linked by a dotted
   trail, Pac-Man standing on the furthest reached, locks on the rest; the chosen world's panel
   with its Lumen, twists and roster, and its four mazes plus boss as stage buttons with stars
   and best scores. Stages open in order; finished worlds can be replayed freely. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const { WORLDS, BOSSES } = NS.worlds;
  const { GHOSTS } = NS.items;
  const K = NS.artKit;
  const AA = NS.actorArt;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const { ctx } = NS.view;

  const TWISTS = { pads: 'Arrow pads', taffy: 'Sticky taffy', ice: 'Slippery ice', portals: 'Portals', dark: 'Darkness', vents: 'Fire vents' };

  function worldOpen(w) {
    const s = G.profile.story;
    return s.done || w <= s.reached;
  }

  function stageOpen(w, st) {
    const s = G.profile.story;
    if (!worldOpen(w)) return false;
    if (s.done || w < s.reached || st === 0) return true;
    return !!s.cleared[w + '-' + (st - 1)];
  }

  function island(i, sel) {
    const w = WORLDS[i];
    const p = w.mapPos;
    const open = worldOpen(i);
    const r = 62;
    const hot = W.area('world' + i, p.x - r, p.y - r, r * 2, r * 2, () => { G.ui.mapSel = i; }, !open);
    if (hot && open) G.ui.mapSel = i;
    const isSel = sel === i;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = open ? (isSel ? 0.7 : 0.35) : 0.1;
    K.blit(ctx, K.glow(w.theme.rim), p.x, p.y, 3.4);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * (isSel ? 1.06 : 1), 0, TAU);
    ctx.clip();
    ctx.drawImage(NS.backdrop.scene(w.theme), p.x - r * 1.9, p.y - r * 1.1, r * 3.8, r * 2.2);
    if (!open) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.strokeStyle = isSel ? UI.accent : open ? w.theme.rim : '#3a3a50';
    ctx.lineWidth = isSel ? 5 : 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * (isSel ? 1.06 : 1), 0, TAU); ctx.stroke();
    if (!open) kit.lock(p.x, p.y, 34);
    /* lumen above the island */
    const lit = G.profile.story.reached > i || G.profile.story.done;
    K.blit(ctx, NS.mazeArt.pellet(lit ? w.theme.glow : '#404050'), p.x, p.y - r - 16, 1);
    kit.text((i + 1) + '. ' + w.name, p.x, p.y + r + 20, 15, open ? '#ffffff' : UI.textMute, { align: 'center', weight: 'bold' });
    let stars = 0;
    for (let s = 0; s < 5; ++s) stars += G.profile.story.cleared[i + '-' + s] || 0;
    if (open) kit.text(stars + ' / 15 stars', p.x, p.y + r + 38, 12, UI.gold, { align: 'center' });
  }

  function trail() {
    ctx.strokeStyle = 'rgba(255,230,160,0.5)';
    ctx.lineWidth = 4;
    ctx.setLineDash([2, 12]);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < WORLDS.length; ++i) {
      const p = WORLDS[i].mapPos;
      if (i === 0) ctx.moveTo(p.x, p.y);
      else {
        const q = WORLDS[i - 1].mapPos;
        ctx.quadraticCurveTo((p.x + q.x) / 2, Math.min(p.y, q.y) - 90, p.x, p.y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = 'butt';
  }

  function panel(sel) {
    const w = WORLDS[sel];
    const x = 40, y = 40, pw = 1200, ph = 120;
    kit.panel(x, y, pw, ph, { accent: w.theme.rim, alpha: 0.94 });
    kit.text('CHAPTER ' + (sel + 1), x + 24, y + 26, 13, w.theme.accent, { weight: 'bold' });
    kit.text(w.name, x + 24, y + 56, 30, '#ffffff', { weight: 'bold' });
    kit.text('Win back ' + w.lumen, x + 24, y + 90, 15, UI.textDim);
    const tw = w.features.length ? w.features.map(f => TWISTS[f]).join(', ') : 'The classic rules';
    kit.text('Twists: ' + tw, x + 420, y + 34, 15, UI.text);
    kit.text('Boss: ' + BOSSES[w.boss].name, x + 420, y + 60, 15, BOSSES[w.boss].color, { weight: 'bold' });
    for (let i = 0; i < w.roster.length; ++i) {
      const gk = w.roster[i];
      K.blit(ctx, AA.ghost(GHOSTS[gk].color, gk, Math.floor(G.time * 4 + i) % 2), x + 440 + i * 40, y + 94, 0.75);
      K.blit(ctx, AA.eyes(2), x + 440 + i * 40, y + 94, 0.75);
    }
    for (let s = 0; s < 5; ++s) {
      const bx = x + 640 + s * 110, by = y + 16;
      const open = stageOpen(sel, s);
      const key = sel + '-' + s;
      const stars = G.profile.story.cleared[key] || 0;
      W.button('stage' + s, s === 4 ? 'BOSS' : (sel + 1) + '-' + (s + 1), bx, by, 100, 88, {
        disabled: !open, accent: s === 4 ? BOSSES[w.boss].color : w.theme.rim, px: 22,
        action: () => scr.launchStory(sel, s),
      });
      for (let k = 0; k < 3; ++k) kit.star(bx + 30 + k * 20, by + 72, 7, stars > k);
      if (!open) kit.lock(bx + 50, by + 30, 18);
    }
  }

  /* the map's own sky: deep blue with nebulae in each world's colour, stars and pellet paths */
  function background() {
    return K.sprite('mapbg', 1280, 720, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, 720);
      gr.addColorStop(0, '#04031a');
      gr.addColorStop(1, '#120830');
      g.fillStyle = gr;
      g.fillRect(0, 0, 1280, 720);
      const rng = NS.rng.makeRng(99);
      for (let i = 0; i < WORLDS.length; ++i) {
        const p = WORLDS[i].mapPos;
        const n = g.createRadialGradient(p.x, p.y, 10, p.x, p.y, 260);
        n.addColorStop(0, K.rgba(WORLDS[i].theme.glow, 0.22));
        n.addColorStop(1, K.rgba(WORLDS[i].theme.glow, 0));
        g.fillStyle = n;
        g.fillRect(p.x - 260, p.y - 260, 520, 520);
      }
      for (let i = 0; i < 260; ++i) {
        g.fillStyle = 'rgba(255,255,255,' + (0.2 + rng() * 0.7).toFixed(2) + ')';
        const sz = rng() < 0.08 ? 2 : 1;
        g.fillRect(rng() * 1280, rng() * 720, sz, sz);
      }
      g.strokeStyle = 'rgba(120,140,255,0.06)';
      g.lineWidth = 1;
      for (let x = 0; x < 1280; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 720); g.stroke(); }
      for (let y = 0; y < 720; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke(); }
    }, 1);
  }

  function draw() {
    const r = NS.view.visible();
    ctx.fillStyle = '#04031a';
    ctx.fillRect(r.x0, r.y0, r.w, r.h);
    const bg = background();
    const k = Math.max(r.w / 1280, r.h / 720);
    ctx.drawImage(bg.canvas, (r.x0 + r.x1) / 2 - 640 * k, (r.y0 + r.y1) / 2 - 360 * k, 1280 * k, 720 * k);
    NS.backdrop.drawWeather(ctx);
    const sel = Math.min(G.ui.mapSel, WORLDS.length - 1);
    trail();
    for (let i = 0; i < WORLDS.length; ++i) island(i, sel);
    /* Pac-Man on the furthest island */
    const at = Math.min(G.profile.story.reached, WORLDS.length - 1);
    const p = WORLDS[at].mapPos;
    K.blitEx(ctx, AA.pac(G.profile.skin, AA.mouthIndex(G.time * 5)), p.x + 58, p.y + 44 + Math.sin(G.time * 4) * 4, 0, 1.4, 1.4);
    panel(sel);
    W.button('back', 'Back', 40, 650, 200, 46, { icon: 'back', action: () => scr.setScreen('title') });
    W.button('tree', 'Tech Tree', 1040, 650, 200, 46, { icon: 'tree', action: () => scr.openTree('map') });
    if (G.profile.seen.intro) W.button('intro', 'Replay intro', 820, 650, 200, 46, { icon: 'book', px: 15, action: () => NS.cinematics.play('intro', {}, () => scr.setScreen('map')) });
  }

  Object.assign(NS.map, {
    draw, worldOpen, stageOpen
  });
})();
