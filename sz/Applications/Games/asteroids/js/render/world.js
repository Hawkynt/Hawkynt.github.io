/* Draws the play field from cached art, every object at each wrapped copy that is visible (so
   the letterbox bars show the field continuing around the torus): frost and fire patches, wells,
   lightning warnings, pods, pickups and stardust, glowing rocks with damage cracks, raiders and
   mines, the titan with its parts, beams and links, shots, the ship with shield, blades, drones
   and the Sunbeam, then the pooled effects - all under camera shake and punch. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Asteroids || (SZ.Asteroids = {});
  const G = NS.state;
  const { TAU, FIELD_W, FIELD_H } = NS.constants;
  const { ROCK_TYPES } = NS.rockData;
  const { BOSSES } = NS.enemyData;
  const K = NS.artKit;
  const RA = NS.rockArt;
  const SA = NS.shipArt;
  const EA = NS.enemyArt;
  const P = NS.propArt;
  const { ctx, visible } = NS.view;
  const R = NS.rng.fx;

  const blade = { x: 0, y: 0, a: 0 };
  let v = null;

  /* calls fn(x, y) for every wrapped copy of (x, y) with radius r that touches the view */
  function each(x, y, r, fn) {
    for (let oy = -FIELD_H; oy <= FIELD_H; oy += FIELD_H) {
      const yy = y + oy;
      if (yy + r < v.y0 || yy - r > v.y1) continue;
      for (let ox = -FIELD_W; ox <= FIELD_W; ox += FIELD_W) {
        const xx = x + ox;
        if (xx + r < v.x0 || xx - r > v.x1) continue;
        fn(xx, yy);
      }
    }
  }

  function draw() {
    v = visible();
    const cam = G.cam;
    const k = G.save ? G.save.settings.shake : 1;
    const tr = cam.trauma * cam.trauma * k;
    cam.ox = (R() - 0.5) * 2 * NS.constants.MAX_SHAKE * tr;
    cam.oy = (R() - 0.5) * 2 * NS.constants.MAX_SHAKE * tr;
    ctx.save();
    ctx.translate(cam.ox, cam.oy);
    if (cam.punch > 0) {
      const z = 1 + cam.punch;
      ctx.translate(FIELD_W / 2, FIELD_H / 2);
      ctx.scale(z, z);
      ctx.translate(-FIELD_W / 2, -FIELD_H / 2);
    }
    zones();
    pods();
    pickups();
    rocks();
    enemies();
    boss();
    shots();
    ship();
    NS.fxRender.draw(v);
    arcs();
    ctx.restore();
    border();
  }

  function zones() {
    for (let i = 0; i < G.zones.length; ++i) {
      const z = G.zones[i];
      const a = Math.min(1, z.life / 0.6) * Math.min(1, (z.max - z.life) / 0.25 + 0.2);
      const spr = P.patch(z.kind);
      const s = z.r * 2 / 64 * (z.kind === 'fire' ? 1 + Math.sin(G.time * 9 + z.seed) * 0.06 : 1);
      ctx.globalAlpha = a;
      if (z.kind === 'fire') ctx.globalCompositeOperation = 'lighter';
      each(z.x, z.y, z.r, (x, y) => K.blit(ctx, spr, x, y, s));
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < G.holes.length; ++i) {
      const h = G.holes[i];
      const grow = Math.min(1, h.t * 2) * (h.friendly ? Math.min(1, h.life) : 1);
      each(h.x, h.y, 90, (x, y) => {
        K.blitRot(ctx, P.hole(), x, y, G.time * (h.friendly ? 2 : 0.6), (h.friendly ? 0.9 : 1.15) * grow);
      });
    }
    for (let i = 0; i < G.strikes.length; ++i) {
      const s = G.strikes[i];
      if (s.hit) {
        bolt(s.x, s.y - 400, s.x, s.y, '#f0ffc0', 4);
        continue;
      }
      const k = s.t / s.warn;
      ctx.strokeStyle = 'rgba(230,255,160,' + (0.3 + 0.5 * Math.abs(Math.sin(G.time * 18))) + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(230,255,160,' + 0.25 * k + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * k, 0, TAU);
      ctx.fill();
    }
  }

  function pods() {
    for (let i = 0; i < G.pods.length; ++i) {
      const p = G.pods[i];
      each(p.x, p.y, 40, (x, y) => {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.4 + 0.3 * Math.sin(G.time * 5 + i);
        K.blit(ctx, K.glow('#6dff9a'), x, y, 0.9);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        K.blitRot(ctx, SA.pod(), x, y, p.a, 1.5);
        if (Math.sin(G.time * 6) > 0.6) {
          ctx.strokeStyle = 'rgba(109,255,154,0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, 24 + (G.time * 30) % 16, 0, TAU);
          ctx.stroke();
        }
      });
    }
  }

  function pickups() {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < G.motes.length; ++i) {
      const m = G.motes[i];
      const tw = 0.7 + 0.3 * Math.sin(G.time * 12 + i);
      ctx.globalAlpha = Math.min(1, m.life) * tw;
      each(m.x, m.y, 8, (x, y) => K.blit(ctx, K.glow(m.col), x, y, 0.22 + Math.min(0.2, m.v * 0.02)));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < G.pickups.length; ++i) {
      const p = G.pickups[i];
      const blink = p.life < 3 && Math.sin(G.time * 18) > 0;
      if (blink) continue;
      const bob = Math.sin(G.time * 3 + i) * 2;
      const pop = Math.min(1, p.t * 4);
      const col = p.kind === 'power' ? NS.powerData.POWERUPS[p.pk].col : p.kind === 'shard' ? '#ffd25a' : G.cal.seasonDef.tokenCol;
      each(p.x, p.y, 30, (x, y) => {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5;
        K.blit(ctx, K.glow(col), x, y + bob, 0.9 * pop);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        const spr = p.kind === 'power' ? P.capsule(p.pk) : p.kind === 'shard' ? P.shard() : P.token(G.cal.season);
        K.blitRot(ctx, spr, x, y + bob, p.kind === 'shard' ? G.time * 2 : Math.sin(G.time * 2 + i) * 0.2, pop);
      });
    }
  }

  function rocks() {
    const list = G.rocks;
    /* glows first, additively, under the bodies */
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < list.length; ++i) {
      const r = list[i];
      const sh = RA.shine(r.type);
      if (!sh) continue;
      ctx.globalAlpha = (r.type === 'gold' ? 0.35 : 0.45) + 0.12 * Math.sin(G.time * 4 + r.id);
      each(r.x, r.y, r.r * 2, (x, y) => K.blit(ctx, K.glow(sh), x, y, r.r / 16));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < list.length; ++i) {
      const r = list[i];
      const spr = RA.rock(r.type, r.size, r.variant);
      const stage = r.hp < r.maxHp ? (r.hp <= r.maxHp * 0.4 ? 2 : 1) : 0;
      const pop = r.spawnT > 0 ? 1 - r.spawnT : 1;
      const sq = r.hitT > 0 ? 1 + r.hitT * 1.2 : 1;
      if (r.comet) cometTail(r);
      each(r.x, r.y, r.r + 6, (x, y) => {
        K.blitRot(ctx, spr, x, y, r.a, pop * sq);
        if (stage) K.blitRot(ctx, RA.cracks(r.size, r.variant, stage), x, y, r.a, pop);
        if (r.hitT > 0) {
          ctx.globalAlpha = r.hitT / 0.12 * 0.7;
          ctx.globalCompositeOperation = 'lighter';
          K.blitRot(ctx, spr, x, y, r.a, pop * sq);
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        }
        if (r.type === 'electric' && R() < 0.25) crackle(x, y, r.r);
      });
    }
  }

  function cometTail(r) {
    const sp = Math.sqrt(r.vx * r.vx + r.vy * r.vy) || 1;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < 8; ++i) {
      ctx.globalAlpha = 0.4 * (1 - i / 8);
      K.blit(ctx, K.glow('#ff8a30'), r.x - r.vx / sp * i * 9, r.y - r.vy / sp * i * 9, (1 - i / 10) * 0.7);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function crackle(x, y, r) {
    const a = R() * TAU;
    bolt(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3, x + Math.cos(a) * r * 1.3, y + Math.sin(a) * r * 1.3, '#c8f8ff', 1.5);
  }

  /* a jagged lightning bolt */
  function bolt(x0, y0, x1, y1, col, w) {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    const n = 7;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    for (let i = 1; i < n; ++i) {
      const t = i / n;
      const j = (R() - 0.5) * len * 0.18;
      ctx.lineTo(x0 + dx * t - dy / len * j, y0 + dy * t + dx / len * j);
    }
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = w * 3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  function enemies() {
    for (let i = 0; i < G.enemies.length; ++i) {
      const e = G.enemies[i];
      const D = NS.enemyData.ENEMIES[e.kind];
      let alpha = e.enterT > 0 ? 1 - e.enterT / 0.6 : 1;
      if (e.kind === 'phantom') {
        const cyc = e.cloak % 4.4;
        alpha *= e.phase === 1 ? 0.08 + 0.06 * Math.sin(G.time * 20) : Math.min(1, cyc * 4);
      }
      const ang = e.kind === 'saucer' || e.kind === 'sniper' ? 0 : e.a;
      each(e.x, e.y, e.r + 10, (x, y) => {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.3 * alpha;
        K.blit(ctx, K.glow(D.col), x, y, e.r / 14);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = alpha;
        K.blitRot(ctx, EA.enemySprite(e.kind), x, y, ang, 1);
        if (e.hitT > 0) {
          ctx.globalAlpha = alpha * 0.85;
          K.blitRot(ctx, EA.enemyFlash(e.kind), x, y, ang, 1);
        }
        ctx.globalAlpha = 1;
        if (e.maxHp > 2 && e.hp < e.maxHp) {
          ctx.fillStyle = 'rgba(0,0,0,0.6)';
          ctx.fillRect(x - 14, y - e.r - 9, 28, 4);
          ctx.fillStyle = D.col;
          ctx.fillRect(x - 14, y - e.r - 9, 28 * e.hp / e.maxHp, 4);
        }
      });
    }
    for (let i = 0; i < G.mines.length; ++i) {
      const m = G.mines[i];
      const lit = m.arm <= 0 && Math.sin(m.t * 8) > 0;
      each(m.x, m.y, 60, (x, y) => {
        K.blitRot(ctx, P.mine(lit), x, y, m.t * 0.6, 1);
        if (m.arm <= 0) {
          ctx.strokeStyle = 'rgba(255,74,58,0.18)';
          ctx.setLineDash([3, 6]);
          ctx.beginPath();
          ctx.arc(x, y, 60, 0, TAU);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      });
    }
  }

  function boss() {
    const b = G.boss;
    if (!b) return;
    const D = BOSSES[b.kind];
    /* links and beams under the body */
    const links = NS.bosses.tempestLinks(b);
    for (let i = 0; i < links.length; ++i) {
      const l = links[i];
      if (l.live) bolt(l.x0, l.y0, l.x1, l.y1, '#f0ffc0', 3);
      else {
        ctx.strokeStyle = 'rgba(240,255,192,' + (0.2 + 0.3 * Math.abs(Math.sin(G.time * 25))) + ')';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(l.x0, l.y0);
        ctx.lineTo(l.x1, l.y1);
        ctx.stroke();
      }
    }
    for (let i = 0; i < b.beams.length; ++i) {
      const bm = b.beams[i];
      const x1 = b.x + Math.cos(bm.a) * 1500, y1 = b.y + Math.sin(bm.a) * 1500;
      if (bm.warn > 0) {
        ctx.strokeStyle = 'rgba(200,160,255,' + (0.25 + 0.35 * Math.abs(Math.sin(G.time * 20))) + ')';
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (bm.on > 0) beamLine(b.x, b.y, x1, y1, ['#ffffff', '#e0c0ff', '#a060ff'], 14);
    }
    const intro = b.intro > 0 ? Math.max(0, 1 - b.intro / 2.6) : 1;
    const dying = b.dying > 0 ? b.dying / 2.6 : 1;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.45 * intro;
    K.blit(ctx, K.glow(D.pal[3]), b.x, b.y, b.r / 10);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (b.kind !== 'maw') parts(b, intro);
    const spr = EA.boss(b.kind);
    const ang = b.kind === 'wyrm' ? b.a : b.kind === 'maw' ? 0 : b.a;
    const shake = b.dying > 0 ? (R() - 0.5) * 6 : 0;
    each(b.x, b.y, b.r * 1.4, (x, y) => {
      ctx.globalAlpha = intro;
      if (b.kind === 'maw') maw(b, x + shake, y);
      else K.blitRot(ctx, spr, x + shake, y, ang, 1 + (1 - dying) * 0.1);
      if (b.hitT > 0) {
        ctx.globalAlpha = 0.6;
        K.blitRot(ctx, EA.bossFlash(b.kind), x + shake, y, ang, 1);
      }
      if (b.kind === 'tempest' && b.shield) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 + 0.2 * Math.sin(G.time * 6);
        K.blitRot(ctx, SA.shield(), x, y, G.time, b.r / 26);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = 1;
    });
    if (b.kind === 'maw') parts(b, intro);
  }

  /* the titan's parts: plates, segments, facets, pylons, eyes */
  function parts(b, intro) {
    for (let i = b.parts.length - 1; i >= 0; --i) {
      const p = b.parts[i];
      if (!p.alive) continue;
      const spr = EA.partSprite(p.kind, b.kind);
      const sc = p.r / 24;
      const ang = p.kind === 'segment' || p.kind === 'pylon' || p.kind === 'eye' ? 0 : G.time + i;
      each(p.x, p.y, p.r + 8, (x, y) => {
        ctx.globalAlpha = intro;
        K.blitRot(ctx, spr, x, y, ang, sc);
        if (p.hitT > 0) {
          ctx.globalCompositeOperation = 'lighter';
          K.blitRot(ctx, spr, x, y, ang, sc);
          ctx.globalCompositeOperation = 'source-over';
        }
        ctx.globalAlpha = 1;
      });
    }
  }

  function maw(b, x, y) {
    const spr = EA.boss('maw');
    const open = b.open;
    K.blit(ctx, spr, x, y);
    /* the gullet opens in the lower half */
    if (open > 0.02) {
      const g = EA.gullet();
      ctx.save();
      ctx.translate(x, y + 30);
      ctx.scale(1, Math.max(0.05, open));
      K.blit(ctx, g, 0, 0, 0.9);
      ctx.restore();
    } else {
      ctx.strokeStyle = '#3a0410';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x - 80, y + 30);
      ctx.quadraticCurveTo(x, y + 50, x + 80, y + 30);
      ctx.stroke();
    }
  }

  function beamLine(x0, y0, x1, y1, ramp, w) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const f = 0.85 + Math.sin(G.time * 40) * 0.15;
    ctx.strokeStyle = K.rgba(ramp[2], 0.35);
    ctx.lineWidth = w * 2.2 * f;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.strokeStyle = K.rgba(ramp[1], 0.8);
    ctx.lineWidth = w * f;
    ctx.stroke();
    ctx.strokeStyle = ramp[0];
    ctx.lineWidth = w * 0.35;
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
  }

  function shots() {
    const ramp = NS.weapons.shotRamp();
    const key = G.save.look.shot;
    ctx.globalCompositeOperation = 'lighter';
    const spr = K.bolt('p:' + key, ramp, 18, 4);
    const dspr = K.bolt('drone', ['#ffffff', '#f0c0ff', '#a040ff'], 14, 3);
    for (let i = 0; i < G.bullets.length; ++i) {
      const b = G.bullets[i];
      const a = Math.atan2(b.vy, b.vx);
      each(b.x, b.y, 20, (x, y) => K.blitRot(ctx, b.drone ? dspr : spr, x - Math.cos(a) * 8, y - Math.sin(a) * 8, a, b.pierce ? 1.4 : 1));
    }
    for (let i = 0; i < G.eBullets.length; ++i) {
      const b = G.eBullets[i];
      const s = P.enemyShot(b.kind);
      each(b.x, b.y, 16, (x, y) => K.blitRot(ctx, s, x, y, b.spin, b.r / 6 * (1 + Math.sin(G.time * 20 + i) * 0.1)));
    }
    for (let i = 0; i < G.beams.length; ++i) {
      const bm = G.beams[i];
      beamLine(bm.x0, bm.y0, bm.x1, bm.y1, ['#ffffff', '#fff0a0', '#ffb020'], 9);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function ship() {
    const s = G.ship;
    if (!s || s.dead) return;
    const skin = G.save.look.skin;
    if (s.hyperT > 0) return;
    const blink = s.invuln > 0 && s.invuln < 1e6 && Math.sin(G.time * 30) > 0.3;
    const sq = 1 + s.squash * 0.25;
    const sy = 1 - Math.abs(s.bank) * 0.22;
    each(s.x, s.y, 60, (x, y) => {
      if (s.thrusting) {
        ctx.globalCompositeOperation = 'lighter';
        const look = NS.cosmetics.find('trail', G.save.look.trail) || NS.cosmetics.TRAILS[0];
        const fl = 0.8 + R() * 0.4;
        K.blitRot(ctx, K.bolt('flame:' + look.id, [look.cols[0], look.cols[1], look.cols[2] || look.cols[1]], 20, 6), x - Math.cos(s.a) * 22 * fl, y - Math.sin(s.a) * 22 * fl, s.a + Math.PI, fl);
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = blink ? 0.35 : 1;
      K.blitRot(ctx, SA.shipSprite(skin), x, y, s.a, sq, sy);
      if (s.hitT > 0) {
        ctx.globalAlpha = s.hitT * 2;
        K.blitRot(ctx, SA.shipFlash(skin), x, y, s.a, sq, sy);
      }
      ctx.globalAlpha = 1;
      if (s.shield) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.65 + 0.25 * Math.sin(G.time * 5);
        K.blitRot(ctx, SA.shield(), x, y, G.time * 0.8, 1);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      if (s.odT > 0) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = s.odT;
        K.blit(ctx, K.glow('#d08aff'), x, y, 3);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
    });
    if (s.power.orbit) {
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; ++i) {
        NS.weapons.bladeAt(i, blade);
        each(blade.x, blade.y, 20, (x, y) => {
          ctx.globalAlpha = 0.5;
          K.blit(ctx, K.glow('#a0ff60'), x, y, 0.6);
          ctx.globalAlpha = 1;
          K.blitRot(ctx, P.blade(), x, y, G.time * 12, 1);
        });
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    for (let i = 0; i < G.drones.length; ++i) {
      const d = G.drones[i];
      each(d.x, d.y, 16, (x, y) => K.blitRot(ctx, SA.drone(), x, y, d.a, 1));
    }
  }

  function arcs() {
    for (let i = 0; i < G.arcs.length; ++i) {
      const a = G.arcs[i];
      ctx.globalAlpha = Math.min(1, a.t * 4);
      bolt(a.x0, a.y0, a.x1, a.y1, '#d8f8ff', 2.5);
    }
    ctx.globalAlpha = 1;
  }

  /* a faint frame where the field wraps, only when the view shows past it */
  function border() {
    if (v.x0 > -2 && v.y0 > -2 && v.x1 < FIELD_W + 2 && v.y1 < FIELD_H + 2) return;
    ctx.strokeStyle = 'rgba(120,180,255,0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 14]);
    ctx.strokeRect(0, 0, FIELD_W, FIELD_H);
    ctx.setLineDash([]);
  }

  Object.assign(NS.world, {
    draw, each, bolt, beamLine
  });
})();
