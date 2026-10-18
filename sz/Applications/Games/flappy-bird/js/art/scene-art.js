;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const PARTS = SZ.FlappySceneParts;

  /*
   * Biome scenery for the flappy game. THEMES holds the six biome palettes;
   * create(biome) paints one opaque sky, three seamless silhouette strips
   * (far / mid / near), five cloud sprites and one ground tile into offscreen
   * canvases once, and the returned draw functions only blit. A frame is thus
   * a single full-screen image (the sky) plus cached strips that are only as
   * tall as their content - no gradients, no shadow blur and no shape work
   * happen per frame.
   *
   * The course objects follow the same rule: GATE_STYLES gives every biome a
   * pipe/pillar palette, and one 72 x 128 body tile plus one 88 x 30 cap are
   * built per biome. Icicles, bats, laser emitters, fireballs, the eight coin
   * frames and the six power-up bubbles are built once and shared by all
   * biomes. Only the gust streaks and the laser beam are drawn per frame, and
   * those are plain strokes.
   *
   * Everything is drawn in the game's logical 1280 x 720 space; the ground
   * top sits at y 640. The silhouette strips are PERIOD px wide and repeat
   * exactly, so they tile seamlessly at any parallax offset.
   *
   * Sky, backdrop and ground take an optional visible rect { x0, y0, x1, y1 }:
   * the logical area a canvas really shows when its aspect ratio is not 16:9.
   * Omitting it keeps the plain 1280 x 720 area, so the scenery never stops at
   * the game border and the letterbox bars are filled with scenery too.
   */

  const {
    SCREEN_W, SCREEN_H, GROUND_Y, GROUND_TILE, PERIOD, FAR_H, MID_H, NEAR_H, CLOUD_W, CLOUD_H, CLOUD_LOOP,
    GATE_W, GATE_TILE, CAP_W, CAP_H, ICICLE_W, ICICLE_H, BAT_W, BAT_H, FIRE_BALL, COIN_SIZE, BUBBLE_SIZE,
    BIOMES, THEMES, GATE_STYLES, rgba, mulberry32
  } = PARTS.kit;
  const { buildSky, buildFar, buildMid, buildNear, buildCloud, buildGround } = PARTS.backdrop;
  const { buildGateBody, buildGateCap, getShared } = PARTS.sprites;

  /* ── Per-biome cache set + the cheap per-frame draw functions ── */

  function beamLine(c, x, y1, y2) {
    c.beginPath();
    c.moveTo(x, y1);
    c.lineTo(x, y2);
    c.stroke();
  }

  /* hazards receive screen coordinates already computed by the game */
  function drawHazard(c, hz, t) {
    const sh = getShared();
    if (hz.type === 'gust') {
      const dir = hz.dir >= 0 ? 1 : -1;
      const w = Math.max(40, hz.w);
      const strength = hz.strength === undefined ? 0.6 : hz.strength;
      c.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 7; ++i) {
        const len = 60 + (i * 37) % 61;
        const x = hz.sx + 6 + (i * 97) % Math.max(1, w - len - 14);
        const phase = (t * 220 + i * 97) % 580;
        const y = (dir > 0 ? 40 : 620) + dir * phase;
        c.lineWidth = 1.5 + strength * 1.5 + (i % 2);
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(x + len * 0.5, y + dir * 12, x + len, y);
        c.stroke();
        const ax = x + len + 4;
        c.beginPath();
        c.moveTo(ax - 5, y - dir * 5);
        c.lineTo(ax, y + dir * 2);
        c.lineTo(ax + 5, y - dir * 5);
        c.stroke();
      }
    } else if (hz.type === 'icicle') {
      const len = Math.max(20, hz.len);
      c.drawImage(sh.icicle, 0, 0, ICICLE_W, ICICLE_H, hz.sx - ICICLE_W / 2, hz.sy - len, ICICLE_W, len);
    } else if (hz.type === 'bat') {
      let f = hz.frame === undefined ? Math.floor(t * 8) % 2 : hz.frame;
      f = ((f % 2) + 2) % 2;
      c.drawImage(sh.bats[f], hz.sx - BAT_W / 2, hz.sy - BAT_H / 2);
    } else if (hz.type === 'laser') {
      const bx = hz.sx + 36;
      c.drawImage(sh.emitters[0], bx - 12, hz.y1 - 8);
      c.drawImage(sh.emitters[1], bx - 12, hz.y2 - 8);
      if (hz.on) {
        c.strokeStyle = rgba('#ff2a6a', 0.25);
        c.lineWidth = 10;
        beamLine(c, bx, hz.y1, hz.y2);
        c.strokeStyle = rgba('#ff2a6a', 0.6);
        c.lineWidth = 5;
        beamLine(c, bx, hz.y1, hz.y2);
        c.strokeStyle = '#ffffff';
        c.lineWidth = 2;
        beamLine(c, bx, hz.y1, hz.y2);
      } else if (hz.warn) {
        c.strokeStyle = rgba('#ff2a6a', 0.5 + 0.5 * Math.sin(t * 30));
        c.lineWidth = 2;
        c.setLineDash([6, 8]);
        beamLine(c, bx, hz.y1, hz.y2);
        c.setLineDash([]);
      }
    } else if (hz.type === 'fireball') {
      // the sprite is blitted centred on the ball; a falling one hangs upside down
      c.save();
      c.translate(hz.sx, hz.sy);
      if (hz.vy > 0)
        c.rotate(Math.PI);
      c.drawImage(sh.fireball, -FIRE_BALL, -FIRE_BALL);
      c.restore();
      // two sparks flicker around the ball
      c.fillStyle = '#ffd23f';
      for (let k = 0; k < 2; ++k) {
        const px = hz.sx + (k === 0 ? -1 : 1) * (16 + 5 * Math.sin(t * 20 + k * 2.1));
        const py = hz.sy - 8 + 12 * Math.sin(t * 13 + k * 1.7);
        c.beginPath();
        c.arc(px, py, 2, 0, Math.PI * 2);
        c.fill();
      }
    }
  }

  function drawCoin(c, x, y, t) {
    const sh = getShared();
    let f = Math.floor(t * 12) % 8;
    if (f < 0) f += 8;
    c.drawImage(sh.coins[f], x - COIN_SIZE / 2, y - COIN_SIZE / 2);
  }

  function drawBubble(c, kind, x, y, t) {
    const sh = getShared();
    const img = sh.bubbles[kind] || sh.bubbles.shield;
    const s = 1 + 0.04 * Math.sin(t * 5);
    const w = BUBBLE_SIZE * s;
    c.drawImage(img, x - w / 2, y + Math.sin(t * 3) * 4 - w / 2, w, w);
  }

  /* the logical area a draw call has to cover — the game area unless the caller
   * hands in the rect the canvas shows (wider or taller than 16:9) */
  function fullView(view) {
    return view || { x0: 0, y0: 0, x1: SCREEN_W, y1: SCREEN_H };
  }

  function create(biomeId) {
    const biome = THEMES[biomeId] ? biomeId : 'meadow';
    const theme = THEMES[biome];
    const gateStyle = GATE_STYLES[biome];
    const rng = mulberry32(0x9e37 + 2654435761 * (BIOMES.indexOf(biome) + 1));

    const sky = buildSky(theme, rng);
    const far = buildFar(biome, theme, rng);
    const mid = buildMid(biome, theme, rng);
    const near = buildNear(biome, theme, rng);
    const ground = buildGround(biome, theme, rng);
    const gateBody = buildGateBody(gateStyle, rng);
    const gateCap = buildGateCap(gateStyle, rng);

    const clouds = [];
    for (let i = 0; i < 5; ++i) clouds.push(buildCloud(theme, rng));

    const placement = [];
    for (let i = 0; i < 7; ++i) {
      placement.push({
        sprite: clouds[Math.floor(rng() * clouds.length)],
        x: rng() * CLOUD_LOOP,
        y: 40 + rng() * 220,
        scale: 0.6 + rng() * 0.6
      });
    }

    /* the sky image, plus its outermost columns and rows stretched over the
     * bars a non-16:9 canvas shows; below the game area the ground continues */
    function drawSky(c, view) {
      const v = fullView(view);
      c.drawImage(sky, 0, 0);
      if (v.x0 < 0) c.drawImage(sky, 0, 0, 1, SCREEN_H, v.x0, 0, -v.x0, SCREEN_H);
      if (v.x1 > SCREEN_W) c.drawImage(sky, SCREEN_W - 1, 0, 1, SCREEN_H, SCREEN_W, 0, v.x1 - SCREEN_W, SCREEN_H);
      if (v.y0 < 0) c.drawImage(sky, 0, 0, SCREEN_W, 1, v.x0, v.y0, v.x1 - v.x0, -v.y0);
    }

    function drawStrip(c, img, height, scroll, v) {
      let x = -(scroll % PERIOD);
      while (x > v.x0) x -= PERIOD;
      for (; x < v.x1; x += PERIOD)
        c.drawImage(img, x, GROUND_Y - height);
    }

    function drawBackdrop(c, dist, t, view) {
      const v = fullView(view);
      for (let i = 0; i < placement.length; ++i) {
        const p = placement[i];
        const w = CLOUD_W * p.scale;
        const h = CLOUD_H * p.scale;
        const x = ((p.x - dist * 0.06) % CLOUD_LOOP + CLOUD_LOOP) % CLOUD_LOOP;
        if (x < v.x1) c.drawImage(p.sprite, x, p.y, w, h);
        else if (x - CLOUD_LOOP + w > v.x0) c.drawImage(p.sprite, x - CLOUD_LOOP, p.y, w, h);
      }
      drawStrip(c, far, FAR_H, dist * 0.15, v);
      drawStrip(c, mid, MID_H, dist * 0.35, v);
      drawStrip(c, near, NEAR_H, dist * 0.6, v);
    }

    function drawGround(c, dist, view) {
      const v = fullView(view);
      let x = -(dist % GROUND_TILE);
      while (x > v.x0) x -= GROUND_TILE;
      for (; x < v.x1; x += GROUND_TILE)
        c.drawImage(ground, x, GROUND_Y);
      if (v.y1 > SCREEN_H) {
        c.fillStyle = theme.groundDark;
        c.fillRect(v.x0, SCREEN_H, v.x1 - v.x0, v.y1 - SCREEN_H);
      }
    }

    /* the body tile is blitted per 128 px; the last one is clipped by the
     * 9-argument drawImage so no tile edge shows at the cap or the ground */
    function tileBody(c, x, y0, y1) {
      let y = y0;
      while (y < y1) {
        const h = Math.min(GATE_TILE, y1 - y);
        if (h === GATE_TILE) c.drawImage(gateBody, x, y);
        else c.drawImage(gateBody, 0, 0, GATE_W, h, x, y, GATE_W, h);
        y += h;
      }
    }

    function drawGate(c, x, topBottom, botTop) {
      const capTopY = topBottom - CAP_H;
      tileBody(c, x, 0, capTopY);
      c.drawImage(gateCap, x - 8, capTopY);
      c.drawImage(gateCap, x - 8, botTop);
      tileBody(c, x, botTop + CAP_H, GROUND_Y);
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(x - 8, topBottom - 2, CAP_W, 2);
      c.fillRect(x - 8, botTop, CAP_W, 2);
    }

    return Object.freeze({
      theme: theme,
      gateStyle: gateStyle,
      drawSky: drawSky,
      drawBackdrop: drawBackdrop,
      drawGround: drawGround,
      drawGate: drawGate,
      drawHazard: drawHazard,
      drawCoin: drawCoin,
      drawBubble: drawBubble
    });
  }

  SZ.FlappySceneArt = Object.freeze({ THEMES: THEMES, create: create });
})();
