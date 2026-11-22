/* Draws the escort: the lanes from the dock to the trading posts (faint dashes flowing toward
   the post, choke points marked once sprung), the posts with their names, freighters with
   their cargo and hull bars and the reactor stop's ring, the hired wing, and on the HUD an
   arrow on the screen edge toward every freighter in flight (red while it is under attack).
   Reads only. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { TAU, UI } = NS.constants;
  const K = NS.artKit;
  const PA = NS.propArt;
  const { ctx } = NS.view;
  const kit = NS.kit;
  const tmp = { x: 0, y: 0 };

  /* lanes and posts, under the rocks */
  function drawLanes() {
    if (!G.posts.length) return;
    ctx.save();
    for (let i = 0; i < G.posts.length; ++i) {
      const p = G.posts[i];
      if (p.path) {
        ctx.strokeStyle = K.rgba('#7cf0ff', 0.16);
        ctx.lineWidth = 3;
        ctx.setLineDash([22, 18]);
        ctx.lineDashOffset = -G.time * 30;
        ctx.beginPath();
        ctx.moveTo(p.path[0].x, p.path[0].y);
        for (let k = 1; k < p.path.length; ++k) ctx.lineTo(p.path[k].x, p.path[k].y);
        ctx.stroke();
        ctx.setLineDash([]);
        for (let k = 0; k < p.chokes.length; ++k) {
          const c = p.chokes[k];
          if (!c.sprung) continue;
          ctx.strokeStyle = K.rgba('#ff5c6c', 0.25);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(c.x, c.y, 60, 0, TAU);
          ctx.stroke();
        }
      }
      if (p.hub) continue;
      K.blitRot(ctx, PA.post(), p.x, p.y, G.time * 0.1, p.path ? 1 : 0.8);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 + Math.sin(G.time * 3 + i) * 0.3;
      K.blit(ctx, K.glow(p.path ? '#ffb44a' : '#8a7a5a'), p.x, p.y, 0.5);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      kit.text(p.name.toUpperCase(), p.x, p.y + 104, 14, p.path ? '#ffd8a0' : '#8a7a5a', { align: 'center', weight: 'bold' });
    }
    ctx.restore();
  }

  function bar(x, y, w, k, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 6);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, w * Math.max(0, Math.min(1, k)), 4);
  }

  /* freighters and the wing, above the pirates */
  function drawShips() {
    for (let i = 0; i < G.freighters.length; ++i) {
      const f = G.freighters[i];
      if (!f.alive) continue;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.6;
      K.blit(ctx, K.glow('#7cc8ff'), f.x - Math.cos(f.angle) * f.r * 1.6, f.y - Math.sin(f.angle) * f.r * 1.6, 0.6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      K.blitRot(ctx, PA.freighter(), f.x, f.y, f.angle, 1);
      if (f.flash > 0) {
        ctx.globalAlpha = 0.7;
        K.blitRot(ctx, K.silhouette('freighter', PA.freighter()), f.x, f.y, f.angle, 1);
        ctx.globalAlpha = 1;
      }
      if (f.state === 'wait') continue;
      kit.text(f.name.toUpperCase(), f.x, f.y - 66, 12, f.hitT > 0 ? UI.bad : '#bfe8ff', { align: 'center', weight: 'bold' });
      bar(f.x, f.y - 56, 80, f.cargo, '#ffd25a');
      bar(f.x, f.y - 49, 80, f.hp / f.maxHp, f.hp / f.maxHp > 0.4 ? '#5cff9a' : '#ff5c6c');
      if (f.state === 'need') {
        const nd = f.need;
        ctx.strokeStyle = K.rgba('#ffb44a', 0.5 + Math.sin(G.time * 6) * 0.3);
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.arc(f.x, f.y, NS.escort.FREIGHTER.reach, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        kit.text('NEEDS ' + (nd.n - nd.got) + ' ' + NS.ores.ORE_BY_ID[nd.ore].name.toUpperCase(), f.x, f.y + 62, 13, '#ffb44a', { align: 'center', weight: 'bold' });
      }
    }
    for (let i = 0; i < G.wing.length; ++i) {
      const w = G.wing[i];
      if (!w.alive) continue;
      K.blitRot(ctx, NS.fleetArt.unit('fighter'), w.x, w.y, w.angle, 1, 1 - Math.abs(w.bank) * 0.15);
      if (w.hp < w.maxHp) bar(w.x, w.y - 22, 26, w.hp / w.maxHp, '#5cff9a');
    }
  }

  /* HUD: arrows on the screen edge toward freighters out of sight */
  function arrows(v) {
    for (let i = 0; i < G.freighters.length; ++i) {
      const f = G.freighters[i];
      if (!NS.freighters.flying(f)) continue;
      NS.camera.toView(f.x, f.y, tmp);
      const m = 50;
      if (tmp.x > v.x0 + m && tmp.x < v.x1 - m && tmp.y > v.y0 + m && tmp.y < v.y1 - m) continue;
      const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
      const a = Math.atan2(tmp.y - cy, tmp.x - cx);
      const hw = v.w / 2 - 70, hh = v.h / 2 - 84;
      const t = Math.min(hw / Math.abs(Math.cos(a) || 1e-6), hh / Math.abs(Math.sin(a) || 1e-6));
      const x = cx + Math.cos(a) * t, y = cy + Math.sin(a) * t;
      const hot = f.hitT > 0 || f.state === 'need';
      const col = f.hitT > 0 ? (Math.sin(G.time * 10) > 0 ? '#ff5c6c' : '#ff9a8a') : f.state === 'need' ? '#ffb44a' : '#7cf0ff';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.scale(hot ? 1.15 : 1, hot ? 1.15 : 1);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(-7, -9);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-7, 9);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      kit.text(f.name.slice(-1) + ' ' + Math.round(f.cargo * 100) + '%', x - Math.cos(a) * 28, y - Math.sin(a) * 24, 11, col, { align: 'center', weight: 'bold' });
    }
  }

  Object.assign(NS.escortRender, {
    drawLanes, drawShips, arrows
  });
})();
