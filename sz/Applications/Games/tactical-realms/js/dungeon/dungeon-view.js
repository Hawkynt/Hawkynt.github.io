;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Draws a DungeonCrawl: themed tiles, walls with a lit face where the
  // floor lies below them, props, features, monsters in sight, the party in
  // file behind its leader, fog of war, torch-light and a minimap.

  const { Cell } = TR.DungeonCrawl || { Cell: { WALL: 0, FLOOR: 1, STAIRS_UP: 2, STAIRS_DOWN: 3 } };
  const FEATURE_SPRITES = Object.freeze({ treasure: 'chest', trap: 'trap', fountain: 'fountain', shrine: 'shrine', hoard: 'hoard' });

  function asMonster(m, groupId, i) {
    return {
      id: `m:${groupId}:${i}`, name: m.templateId, faction: 'enemy',
      character: { class: m.templateId, size: 'M' }, currentHp: 1, maxHp: 1, isAlive: true,
    };
  }

  // opts: { renderer, assets, ts, cam: {x, y}, w, h, time, party: [characters], trail: [{col,row}], walk: {from,to,t} }
  function draw(ctx, crawl, opts) {
    const { renderer, assets, ts, cam, w, h, time } = opts;
    const T = crawl.theme;
    const L = crawl.level;
    const TA = TR.TerrainArt, DA = TR.DungeonArt;
    const terrainImg = assets && assets.get('terrain');
    const propImg = assets && assets.get('props');
    const ox = -Math.round(cam.x), oy = -Math.round(cam.y);
    const c0 = Math.max(0, Math.floor(cam.x / ts) - 1), r0 = Math.max(0, Math.floor(cam.y / ts) - 1);
    const c1 = Math.min(L.w - 1, Math.ceil((cam.x + w) / ts) + 1), r1 = Math.min(L.h - 1, Math.ceil((cam.y + h) / ts) + 1);

    ctx.save();
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    const tile = (id, c, r, x, y) => {
      const q = TA && TA.has(id) ? TA.rect(id, c, r) : null;
      if (q && terrainImg)
        ctx.drawImage(terrainImg, q.x, q.y, q.w, q.h, x, y, ts, ts);
      return !!q;
    };
    const sprite = (id, x, y, size = ts) => {
      const q = DA && DA.rect(id);
      if (q && propImg)
        ctx.drawImage(propImg, q.x, q.y, q.w, q.h, x, y, size, size);
    };

    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c) {
        if (!crawl.isExplored(c, r))
          continue;
        const x = ox + c * ts, y = oy + r * ts;
        const cell = L.get(c, r);
        if (cell === Cell.WALL) {
          // a wall facing open floor shows its face; buried rock shows its top
          if (L.open(c, r + 1)) {
            tile(T.wallArt, c, r, x, y);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(x, y, ts, Math.round(ts * 0.18));
          } else {
            tile(T.wallArt, c, r, x, y);
            ctx.fillStyle = 'rgba(8,6,14,0.72)';
            ctx.fillRect(x, y, ts, ts);
          }
          continue;
        }
        tile(T.floorArt, c, r, x, y);
        // contact shadow under the wall above
        if (!L.open(c, r - 1)) {
          ctx.fillStyle = 'rgba(0,0,0,0.32)';
          ctx.fillRect(x, y, ts, Math.round(ts * 0.22));
        }
        if (cell === Cell.STAIRS_DOWN)
          sprite('stairs_down', x, y);
        else if (cell === Cell.STAIRS_UP)
          sprite('stairs_up', x, y);
      }

    for (const p of crawl.props)
      if (crawl.isExplored(p.col, p.row))
        sprite(p.kind, ox + p.col * ts, oy + p.row * ts);
    for (const f of crawl.features)
      if (crawl.isExplored(f.col, f.row) && !(f.hidden && !f.spotted)) {
        // treasure glints so it stands out in the gloom
        if (f.type === 'treasure' || f.type === 'hoard') {
          const glint = 0.5 + 0.5 * Math.sin(time * 3 + f.col);
          ctx.fillStyle = `rgba(255,220,120,${(0.15 * glint).toFixed(3)})`;
          ctx.fillRect(ox + f.col * ts, oy + f.row * ts, ts, ts);
        }
        sprite(FEATURE_SPRITES[f.type] || 'chest', ox + f.col * ts, oy + f.row * ts);
      }

    // fog over remembered but unseen ground
    ctx.fillStyle = 'rgba(6,5,14,0.58)';
    for (let r = r0; r <= r1; ++r)
      for (let c = c0; c <= c1; ++c)
        if (crawl.isExplored(c, r) && !crawl.isVisible(c, r))
          ctx.fillRect(ox + c * ts, oy + r * ts, ts, ts);

    // monsters only where the party can see them
    for (const g of crawl.groups)
      g.members.forEach((m, i) => {
        if (crawl.memberAlive(g, i) && crawl.isVisible(m.col, m.row))
          renderer.drawUnitToken(m.col, m.row, asMonster(m, g.id, i), ts, ox, oy, { time, active: false });
      });

    // the party walks in file: leader in front, the others on the trail
    const party = opts.party || [];
    const trail = opts.trail || [];
    const walk = opts.walk;
    for (let i = party.length - 1; i >= 0; --i) {
      const at = i === 0 ? crawl.position : trail[i - 1];
      if (!at)
        continue;
      let pc = at.col, pr = at.row;
      if (i === 0 && walk && walk.t < 1) {
        pc = walk.from.col + (walk.to.col - walk.from.col) * walk.t;
        pr = walk.from.row + (walk.to.row - walk.from.row) * walk.t;
      }
      const unit = { id: `p${i}`, name: party[i].name, faction: 'party', character: party[i], currentHp: 1, maxHp: 1, isAlive: true };
      renderer.drawUnitTokenAt(pc, pr, unit, ts, ox, oy, { active: i === 0, time });
    }

    // torch-light: darkness everywhere but around the party
    if (T.darkness > 0) {
      const p = crawl.position;
      renderer.drawLighting(0, 0, w, h, [{ x: ox + p.col * ts + ts / 2, y: oy + p.row * ts + ts / 2, radius: ts * 7.5 }], time, T.darkness);
    }
    ctx.restore();
  }

  // Explored map in a corner: walls dark, floors grey, party and stairs marked.
  function minimap(ctx, crawl, x, y, maxW, maxH) {
    const L = crawl.level;
    const s = Math.max(1, Math.floor(Math.min(maxW / L.w, maxH / L.h)));
    const mw = L.w * s, mh = L.h * s;
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,18,0.82)';
    ctx.fillRect(x - 4, y - 4, mw + 8, mh + 8);
    ctx.strokeStyle = '#c8a24e';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 4, y - 4, mw + 8, mh + 8);
    for (let r = 0; r < L.h; ++r)
      for (let c = 0; c < L.w; ++c) {
        if (!crawl.isExplored(c, r))
          continue;
        const cell = L.get(c, r);
        ctx.fillStyle = cell === Cell.WALL ? '#3a3448' : cell === Cell.STAIRS_DOWN ? '#ffd24a' : cell === Cell.STAIRS_UP ? '#8ad8ff' : '#8a8494';
        ctx.fillRect(x + c * s, y + r * s, s, s);
      }
    for (const g of crawl.groups)
      g.members.forEach((m, i) => {
        if (crawl.memberAlive(g, i) && crawl.isVisible(m.col, m.row)) {
          ctx.fillStyle = '#ff5a48';
          ctx.fillRect(x + m.col * s, y + m.row * s, s, s);
        }
      });
    const p = crawl.position;
    ctx.fillStyle = '#5ae0ff';
    ctx.fillRect(x + p.col * s - 1, y + p.row * s - 1, s + 2, s + 2);
    ctx.restore();
  }

  TR.DungeonView = Object.freeze({ draw, minimap });
})();
