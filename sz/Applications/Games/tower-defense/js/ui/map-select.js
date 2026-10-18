/* ui/map-select.js -- the campaign map screen with region pages, thumbnails and details.
   Owns state: G.mapSelectIndex
   Reads: constants, maps, env, pixelArt, text, widgets, research, bossRewards, progress, paths, waves,
      savegame, researchScreen, relicsPanel, actions and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { COLS, ROWS, STATE_MAP_SELECT, clamp, hexToRgba, shade } = NS.constants;
  const { BIOMES, MAPS, CAMPAIGN, MAP_RANK, REGIONS, regionOf } = NS.maps;
  const { ctx, audio, updateWindowTitle } = NS.env;
  const { makeCanvas, drawIcon } = NS.pixelArt;
  const { fitText, drawTextBlock } = NS.text;
  const { UI, roundRectPath, drawPanel, drawKeyHints, drawScrim, addRegion, uiButton } = NS.widgets;
  const { techLevel } = NS.research;
  const { RELICS } = NS.bossRewards;
  const { totalStars, mapUnlocked } = NS.progress;
  const { walkPath } = NS.paths;
  const { mapBountyMul, mapResearchMul } = NS.waves;
  const { requestNewGame } = NS.savegame;
  const { openResearch } = NS.researchScreen;
  const { openRelics } = NS.relicsPanel;

  function openMapSelect() {
    G.state = STATE_MAP_SELECT;
    G.mapSelectIndex = G.savedGameInfo ? G.savedGameInfo.map : Math.min(G.currentMap, MAPS.length - 1);
    if (!mapUnlocked(G.mapSelectIndex)) G.mapSelectIndex = 0;
    previewMap(G.mapSelectIndex);
    audio.play('select');
    updateWindowTitle();
  }

  function previewMap(i) {
    G.mapSelectIndex = i;
    G.currentMap = i;
    NS.actions.loadMapPreview();
  }

  function playSelectedMap() {
    if (!mapUnlocked(G.mapSelectIndex)) {
      audio.play('error');
      return;
    }
    G.currentMap = G.mapSelectIndex;
    G.introNext = true;
    requestNewGame();
  }

  // One to five skulls along the campaign
  function difficultyOf(i) {
    return 1 + Math.floor(MAP_RANK[i] * 5 / CAMPAIGN.length);
  }

  const thumbCache = {};
  const THUMB_FEATURE = { water: '#3a7ad8', ice: '#a8e0ff', lava: '#ff6a1a', bog: '#6e8a2e', chasm: '#06040c' };
  // Small overview of a map: ground, features, roads
  function mapThumb(i) {
    if (thumbCache[i]) return thumbCache[i];
    const k = 4;
    const c = makeCanvas(COLS * k, ROWS * k);
    const g = c.getContext('2d');
    const m = MAPS[i], b = BIOMES[m.biome];
    g.fillStyle = b.ground;
    g.fillRect(0, 0, c.width, c.height);
    const cells = new Set();
    for (const wp of m.paths) walkPath(wp, (x, y) => cells.add(x + ',' + y));
    for (const [type, c0, r0, c1, r1] of m.features) {
      g.fillStyle = THUMB_FEATURE[type] || shade(b.ground, -0.3);
      for (let r = r0; r <= r1; ++r) for (let cc = c0; cc <= c1; ++cc)
        if (!cells.has(cc + ',' + r)) g.fillRect(cc * k, r * k, k, k);
    }
    g.fillStyle = b.path;
    for (const key of cells) {
      const [x, y] = key.split(',').map(Number);
      g.fillRect(x * k, y * k, k, k);
    }
    for (const wp of m.paths) {
      g.fillStyle = '#5aff7a';
      g.fillRect(wp[0][0] * k, wp[0][1] * k, k, k);
      const e = wp[wp.length - 1];
      g.fillStyle = '#ff4a4a';
      g.fillRect(e[0] * k, e[1] * k, k, k);
    }
    thumbCache[i] = c;
    return c;
  }

  function drawThumb(i, x, y, w, h) {
    const img = mapThumb(i);
    ctx.save();
    roundRectPath(x, y, w, h, 6);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, x, y, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    roundRectPath(x, y, w, h, 6);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();
  }

  function drawStars(n, cx, cy, size, total) {
    total = total || 3;
    const gap = size * 1.05;
    for (let i = 0; i < total; ++i)
      drawIcon(i < n ? 'star' : 'starEmpty', cx + (i - (total - 1) / 2) * gap, cy, size);
  }

  // Regions side by side on a page: as many as fit, every page holding the same number
  let msPerPage = REGIONS.length;
  const MS_CARD_MIN_W = 140;

  function regionsPerPage(gw) {
    let per = clamp(Math.floor((gw + 8) / (MS_CARD_MIN_W + 8)), 1, REGIONS.length);
    while (REGIONS.length % per) --per;
    return per;
  }

  function mapSelectPages() {
    return Math.ceil(REGIONS.length / msPerPage);
  }

  function mapSelectPage() {
    return Math.floor(regionOf(G.mapSelectIndex) / msPerPage);
  }

  function regionStars(reg) {
    return REGIONS[reg].maps.reduce((a, i) => a + G.meta.maps[i].stars, 0);
  }

  // Shows another page of regions; the selection keeps its row in the page's first region
  function showMapSelectPage(page) {
    const pages = mapSelectPages();
    page = (page + pages) % pages;
    if (page === mapSelectPage()) return;
    const reg = regionOf(G.mapSelectIndex);
    const row = REGIONS[reg].maps.indexOf(G.mapSelectIndex);
    const maps = REGIONS[page * msPerPage].maps;
    previewMap(maps[Math.min(row, maps.length - 1)]);
    audio.play('click', { pitch: 1.1 });
  }

  function drawMapSelect() {
    drawScrim(0.72);
    const pad = 12;
    // Header
    const hh = 46;
    drawPanel(pad, 8, G.UW - pad * 2, hh, { accent: UI.gold, radius: 10 });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText('Campaign', pad + 16, 8 + hh / 2 + 1, 220, 22, { weight: 'bold', color: UI.gold });
    ctx.textAlign = 'right';
    fitText(`[[star]] ${totalStars()} / ${MAPS.length * 3}`, G.UW - pad - 410, 8 + hh / 2 + 1, Math.max(40, G.UW - pad - 410 - 150), 16, { weight: 'bold', color: '#ffffff' });
    uiButton('ms-relics', G.UW - pad - 400, 16, 120, hh - 16, `Relics ${(G.meta.relics || []).length}/${RELICS.length}`, { px: 12, icon: 'r_seal', key: 'K', onClick: openRelics });
    uiButton('ms-research', G.UW - pad - 274, 16, 156, hh - 16, `Research · ${G.meta.rp}`, { px: 12, icon: 'flask', key: 'R', onClick: () => openResearch() });
    uiButton('ms-back', G.UW - pad - 108, 16, 96, hh - 16, 'Back', { px: 13, key: 'Esc', onClick: () => NS.actions.quitToTitle() });

    // Layout: regions as columns, their maps as rows, details on the right
    let top = 8 + hh + 10;
    const bottom = G.UH - 34;
    const detailW = G.UW >= 900 ? Math.min(300, G.UW * 0.3) : 0;
    const gx = pad, gw = G.UW - pad * 2 - (detailW ? detailW + 10 : 0);
    msPerPage = regionsPerPage(gw);
    const pages = mapSelectPages(), page = mapSelectPage();
    if (pages > 1) {
      // Page tabs, each naming its regions, with arrows to either side
      const th = 30, aw = 34, gap = 6;
      uiButton('ms-prev', gx, top, aw, th, '<', { px: 15, onClick: () => showMapSelectPage(page - 1), tip: () => ['Previous regions', 'PgUp · Shift+Tab · mouse wheel'] });
      uiButton('ms-next', gx + gw - aw, top, aw, th, '>', { px: 15, onClick: () => showMapSelectPage(page + 1), tip: () => ['Next regions', 'PgDn · Tab · mouse wheel'] });
      const tw = (gw - 2 * (aw + gap) - (pages - 1) * gap) / pages;
      for (let p = 0; p < pages; ++p) {
        const regs = REGIONS.slice(p * msPerPage, (p + 1) * msPerPage);
        const stars = regs.reduce((a, R, k) => a + regionStars(p * msPerPage + k), 0);
        const max = regs.reduce((a, R) => a + R.maps.length * 3, 0);
        uiButton('ms-page' + p, gx + aw + gap + p * (tw + gap), top, tw, th, regs.map(R => BIOMES[R.biome].name).join(' · '), {
          style: p === page ? 'gold' : 'dark', px: 12, onClick: () => showMapSelectPage(p),
          tip: () => [regs.map(R => BIOMES[R.biome].name).join(', '), ...regs.map(R => `• ${BIOMES[R.biome].name}: ${R.maps.length} maps`), `★ ${stars} / ${max} stars`]
        });
      }
      top += th + 8;
    }
    const colGap = 8, rowGap = 8, headH = 24;
    const rows = Math.max(...REGIONS.map(R => R.maps.length));
    const cw = (gw - colGap * (msPerPage - 1)) / msPerPage;
    const ch = (bottom - top - headH - 6 - rowGap * (rows - 1) - (detailW ? 0 : 150)) / rows;
    for (let k = 0; k < msPerPage; ++k) {
      const reg = page * msPerPage + k;
      if (reg >= REGIONS.length) break;
      const R = REGIONS[reg], b = BIOMES[R.biome];
      const x = gx + k * (cw + colGap);
      roundRectPath(x, top, cw, headH, 6);
      ctx.fillStyle = hexToRgba(b.color, 0.2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(b.color, 0.6);
      ctx.lineWidth = 1;
      ctx.stroke();
      const starsW = cw >= 170 ? 58 : 0;
      ctx.textAlign = 'center';
      fitText(b.name, x + (cw - starsW) / 2, top + headH / 2 + 1, cw - 10 - starsW, 12, { weight: 'bold', color: b.color });
      if (starsW) {
        ctx.textAlign = 'right';
        fitText(`[[star]] ${regionStars(reg)}/${R.maps.length * 3}`, x + cw - 7, top + headH / 2 + 1, starsW - 4, 11, { weight: 'bold', color: '#ffffff' });
      }
      R.maps.forEach((i, j) => drawMapCard(i, x, top + headH + 6 + j * (ch + rowGap), cw, ch));
    }
    if (detailW)
      drawMapDetails(G.UW - pad - detailW, 8 + hh + 10, detailW, bottom - 8 - hh - 10);
    else
      drawMapDetails(gx, bottom - 144, gw, 140);
    const hints = [{ key: '←↑→↓', label: 'Choose' }, { key: 'Enter', label: 'Play' }];
    if (pages > 1) hints.push({ key: 'PgUp/PgDn', label: 'Regions' });
    hints.push({ key: 'Esc', label: 'Back' });
    drawKeyHints(hints, G.UW / 2, G.UH - 16, G.UW - 40);
  }

  function drawMapCard(i, x, y, w, h) {
    const m = MAPS[i];
    const id = 'mapcard' + i;
    const sel = G.mapSelectIndex === i;
    const hover = G.hoverId === id;
    const locked = !mapUnlocked(i);
    const rec = G.meta.maps[i];
    ctx.save();
    roundRectPath(x, y, w, h, 8);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, sel ? 'rgba(86,68,24,0.96)' : hover ? 'rgba(44,54,84,0.96)' : 'rgba(26,32,54,0.96)');
    g.addColorStop(1, sel ? 'rgba(40,28,8,0.96)' : 'rgba(12,15,28,0.96)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = sel ? 2.5 : 1;
    ctx.strokeStyle = sel ? UI.gold : hover ? 'rgba(255,215,90,0.5)' : 'rgba(150,180,255,0.18)';
    ctx.stroke();
    const tw = w - 12, th = Math.min(h - 40, tw * ROWS / COLS);
    const tx = x + 6, ty = y + 6;
    if (locked) ctx.globalAlpha *= 0.35;
    drawThumb(i, tx + (tw - th * COLS / ROWS) / 2, ty, th * COLS / ROWS, th);
    ctx.globalAlpha = 1;
    if (locked) drawIcon('lock', x + w / 2, ty + th / 2, Math.min(28, th * 0.5));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const ny = ty + th + (h - th - 6) / 2 - 1;
    fitText(`${MAP_RANK[i] + 1}. ${m.name}`, x + 8, ny - 7, w * 0.62, 12, { weight: 'bold', color: locked ? UI.textMute : '#ffffff' });
    fitText(rec.best ? `Best wave ${rec.best} · goal ${m.waves}` : `Goal ${m.waves} waves`, x + 8, ny + 8, w * 0.6, 10, { color: UI.textDim });
    drawStars(rec.stars, x + w - 8 - Math.min(13, w * 0.09) * 1.6, ny, Math.min(13, w * 0.09));
    ctx.restore();
    addRegion({ id, x, y, w, h, onClick: () => {
      if (G.mapSelectIndex === i && !locked) playSelectedMap();
      else { previewMap(i); audio.play('click'); }
    }, tip: () => locked ? [m.name, '✘ Win the previous map to unlock it.'] : null, sound: false });
  }

  function drawMapDetails(x, y, w, h) {
    const i = G.mapSelectIndex;
    const m = MAPS[i], b = BIOMES[m.biome], rec = G.meta.maps[i];
    const locked = !mapUnlocked(i);
    drawPanel(x, y, w, h, { title: m.name, titleRight: b.name, titleRightColor: b.color, accent: b.color, radius: 10 });
    const wide = h < 200;
    let cy = y + 38;
    if (!wide) {
      const tw = w - 24, th = tw * ROWS / COLS;
      drawThumb(i, x + 12, cy, tw, th);
      cy += th + 10;
      ctx.textAlign = 'left';
      drawTextBlock(m.desc, x + 12, cy, w - 24, 46, 12, { color: '#c4cde0' });
      cy += 52;
    }
    const rows = [
      ['flag', 'Waves to clear', String(m.waves)],
      ['up', 'Rewards', `+${Math.round((mapBountyMul(i) - 1) * 100)}% gold, +${Math.round((mapResearchMul(i) - 1) * 100)}% research`],
      ['coin', 'Starting gold', String(m.startGold + techLevel('chest') * 25)],
      ['heart', 'Lives', String(m.startLives + techLevel('fortify') * 3)],
      ['skull', 'Difficulty', '●'.repeat(difficultyOf(i)) + '○'.repeat(5 - difficultyOf(i))],
      ['range', 'Roads', m.paths.length > 1 ? `${m.paths.length} (enemies split)` : '1'],
      ['crown', 'Best', rec.best ? `wave ${rec.best}` : '—']
    ];
    const colW = wide ? (w - 24 - 170) / 2 : w - 24;
    rows.forEach((r, k) => {
      const col = wide ? Math.floor(k / 3) : 0, row = wide ? k % 3 : k;
      const rx = x + 12 + col * colW, ry = cy + row * 19;
      drawIcon(r[0], rx + 7, ry + 8, 13);
      ctx.textAlign = 'left';
      fitText(r[1], rx + 18, ry + 9, colW * 0.5 - 18, 11, { color: UI.textDim });
      ctx.textAlign = 'right';
      fitText(r[2], rx + colW - 6, ry + 9, colW * 0.5, 12, { weight: 'bold', color: '#ffffff' });
    });
    const by = wide ? y + h - 52 : y + h - 92;
    const bx = wide ? x + w - 170 : x + 12, bw = wide ? 158 : w - 24;
    if (!wide) {
      drawStars(rec.stars, x + w / 2, by - 8, 20);
    }
    uiButton('ms-play', bx, wide ? y + 34 : by + 10, bw, wide ? 40 : 44, locked ? 'Locked' : (G.savedGameInfo && G.savedGameInfo.map === i ? 'Restart' : 'Play'), {
      style: locked ? 'dark' : 'gold', icon: locked ? 'lock' : 'play', px: 15, key: 'Enter', disabled: locked,
      sub: locked ? 'Win the previous map first' : `${['', '★', '★★', '★★★'][rec.stars] || 'Not yet won'}`,
      onClick: () => playSelectedMap(), onDisabled: () => audio.play('error')
    });

    if (!wide && G.savedGameInfo && G.savedGameInfo.map !== i) {
      ctx.textAlign = 'center';
      fitText('⚠ Starting replaces your saved game', x + w / 2, by + 68, w - 20, 10, { color: UI.warn });
    }
  }

  // Left / right walk through the regions (turning the page at its edge), up / down through a region
  function moveMapSelect(dx, dy) {
    const reg0 = regionOf(G.mapSelectIndex);
    const reg = clamp(reg0 + dx, 0, REGIONS.length - 1);
    const maps = REGIONS[reg].maps;
    const row = clamp(REGIONS[reg0].maps.indexOf(G.mapSelectIndex) + dy, 0, maps.length - 1);
    const ni = maps[row];
    if (ni !== G.mapSelectIndex) {
      previewMap(ni);
      audio.play('click', { pitch: 1.3 });
    }
  }

  NS.mapSelect = { openMapSelect, previewMap, playSelectedMap, drawStars, mapSelectPages, mapSelectPage,
      showMapSelectPage, drawMapSelect, moveMapSelect };

})();
