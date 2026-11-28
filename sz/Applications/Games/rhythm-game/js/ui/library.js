/* Free Play: the song list (story songs open once cleared, the Record Shop songs to buy, this
   festival's song and the festival archive) with a preview of the highlighted song, and its card -
   the four difficulties with the grade and score of each, the mastery badge, practice speeds, optional
   mutators that raise the payout, the booster picker and Play. boosterRow is shared with the story
   map: the boosters you own, picked up to your slots, and +1 to buy another. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const C = NS.constants;
  const kit = NS.kit;
  const W = NS.widgets;
  const P = NS.progress;
  const M = NS.metaData;
  const SE = NS.seasons;
  const { UI } = C;
  const { ctx } = NS.view;

  function boosterRow(x, y, w) {
    const p = G.profile;
    const sel = G.ui.boosters;
    const slots = P.slots(p);
    kit.text('BOOSTERS  ' + sel.length + ' / ' + slots, x, y + 8, 12, UI.textDim, { weight: 'bold' });
    const cw = (w - 10) / 3;
    M.BOOSTERS.forEach((b, i) => {
      const bx = x + (i % 3) * (cw + 5), by = y + 22 + Math.floor(i / 3) * 62;
      const n = p.boosters[b.id] || 0;
      const on = sel.indexOf(b.id) >= 0;
      W.button('boost-' + b.id, b.name, bx, by, cw, 38, { px: 11, accent: b.color, selected: on, icon: b.icon, disabled: !n && !on,
        action: () => { const k = sel.indexOf(b.id); if (k >= 0) sel.splice(k, 1); else if (n && sel.length < slots) sel.push(b.id); else if (n) { sel.shift(); sel.push(b.id); } } });
      kit.text('x' + n, bx + cw - 6, by + 46, 11, n ? '#ffffff' : UI.textMute, { align: 'right', weight: 'bold' });
      W.button('buy-' + b.id, '+1 ' + Math.round(b.price * P.discount(p)), bx, by + 40, cw - 34, 18, { px: 10, accent: UI.disc, disabled: p.discs < b.price * P.discount(p),
        action: () => { if (P.buyBooster(p, b.id, 1)) { NS.audio.sfx('coin'); NS.save.saveProfile(p); } } });
    });
    const hover = M.BOOSTERS.find(b => G.hitAreas[G.menuCursor] && G.hitAreas[G.menuCursor].id === 'boost-' + b.id);
    if (hover) kit.fitText(hover.desc, x, y + 154, w, 12, { color: UI.textDim });
  }

  function list() {
    return P.library(G.profile, new Date());
  }

  function draw() {
    const p = G.profile;
    const L = list();
    G.ui.lib = Math.max(0, Math.min(L.length - 1, G.ui.lib));
    kit.text('FREE PLAY', 40, 40, 30, '#ffffff', { weight: 'bold', shadow: true });
    kit.text(L.filter(e => e.owned).length + ' / ' + L.length + ' songs', 40, 70, 14, UI.gold, { weight: 'bold' });
    /* the list */
    const x = 40, y0 = 96, rowH = 40, rows = 13;
    const top = Math.max(0, Math.min(L.length - rows, G.ui.scroll | 0));
    G.ui.scroll = top;
    let lastGroup = '';
    for (let k = 0; k < rows && top + k < L.length; ++k) {
      const e = L[top + k];
      const y = y0 + k * rowH;
      const sel = G.ui.lib === top + k;
      const hot = W.area('song-' + (top + k), x, y, 520, rowH - 4, () => { G.ui.lib = top + k; G.ui.preview = e.owned ? e.song : null; }, { scroll: true });
      kit.panel(x, y, 520, rowH - 4, { radius: 8, accent: sel ? UI.gold : e.owned ? UI.accent : '#3a3460', glow: sel || hot, alpha: e.owned ? 1 : 0.7 });
      kit.icon(e.owned ? 'music' : e.price ? 'disc' : 'lock', x + 20, y + 18, 16, e.owned ? (e.festival ? G.season.color : '#ffffff') : UI.textMute);
      kit.fitText(e.name, x + 40, y + 18, 250, 15, { weight: 'bold', color: e.owned ? '#ffffff' : UI.textDim });
      if (e.group !== lastGroup || k === 0) kit.fitText(e.group, x + 300, y + 18, 120, 11, { color: UI.textDim });
      lastGroup = e.group;
      const m = P.masteryOf(p, e.id);
      if (m >= 0) kit.text(M.MASTERY[m].name, x + 508, y + 18, 11, M.MASTERY[m].color, { align: 'right', weight: 'bold' });
      else if (!e.owned && e.price) kit.text(e.price + ' discs', x + 508, y + 18, 11, UI.disc, { align: 'right', weight: 'bold' });
    }
    if (L.length > rows) {
      W.button('lib-up', '▲', x + 530, y0, 40, 40, { action: () => { G.ui.scroll = Math.max(0, top - 6); } });
      W.button('lib-dn', '▼', x + 530, y0 + rows * rowH - 44, 40, 40, { action: () => { G.ui.scroll = top + 6; } });
    }
    songCard(L[G.ui.lib]);
    W.button('back', 'Back', 40, 650, 200, 48, { icon: 'back', accent: UI.good, action: () => { G.ui.preview = null; NS.screens.back(); } });
  }

  function songCard(e) {
    const p = G.profile;
    const x = 640, y = 90, w = 600, h = 600;
    kit.panel(x, y, w, h, { accent: UI.accent });
    kit.fitText(e.name, x + 24, y + 32, w - 48, 26, { weight: 'bold', color: '#ffffff' });
    const R = SZ.GameMusic.resolve(e.song);
    kit.text(e.group + ' - ' + R.style + ' - ' + Math.round(R.bpm) + ' bpm', x + 24, y + 60, 13, UI.textDim);
    if (!e.owned) {
      if (e.price) {
        kit.wrap('A song for Free Play from the Record Shop. Buy it once and play it in every difficulty.', x + 24, y + 110, w - 48, 15, '#ffffff');
        W.button('buy-song', 'Buy for ' + e.price + ' discs', x + 24, y + 180, 300, 54, { icon: 'disc', accent: UI.disc, disabled: p.discs < e.price,
          action: () => { if (P.buySong(p, e.song)) { NS.audio.sfx('coin'); NS.screens.toast(e.name + ' is yours!', UI.disc, 'music'); NS.save.saveProfile(p); } } });
      } else kit.wrap(e.need || 'Locked', x + 24, y + 110, w - 48, 15, UI.textDim);
      return;
    }
    /* difficulties */
    M.DIFFS.forEach((d, i) => {
      const bx = x + 24 + i * 142, by = y + 90;
      const b = p.best[e.id + ':' + d.id];
      W.button('diff-' + d.id, d.name, bx, by, 134, 64, { accent: d.color, selected: G.ui.diff === d.id, sub: b ? b.grade + '  ' + b.score.toLocaleString('en-US') : 'not played', action: () => { G.ui.diff = d.id; p.settings.diff = d.id; } });
    });
    const m = P.masteryOf(p, e.id);
    kit.text('Mastery', x + 24, y + 186, 13, UI.textDim, { weight: 'bold' });
    M.MASTERY.forEach((ms, i) => { kit.icon('disc', x + 110 + i * 30, y + 186, 22, i <= m ? ms.color : 'rgba(120,120,150,0.35)'); });
    kit.text(m >= 0 ? M.MASTERY[m].name : 'Clear it to start', x + 270, y + 187, 13, m >= 0 ? M.MASTERY[m].color : UI.textDim, { weight: 'bold' });
    /* practice speed */
    kit.text('Speed', x + 24, y + 226, 13, UI.textDim, { weight: 'bold' });
    [1, 0.9, 0.75].forEach((sp, i) => W.button('speed-' + sp, sp === 1 ? 'Full' : sp + 'x', x + 110 + i * 92, y + 210, 84, 32, { px: 13, selected: (p.settings.practice || 1) === sp, action: () => { p.settings.practice = sp; } }));
    if ((p.settings.practice || 1) < 1 && !P.stat(p, 'practicePay')) kit.text('practice pays fewer discs', x + 400, y + 226, 11, UI.textDim);
    /* mutators */
    kit.text('Mutators', x + 24, y + 270, 13, UI.textDim, { weight: 'bold' });
    SE.MUTATORS.forEach((mu, i) => {
      const on = G.ui.mutators.indexOf(mu.id) >= 0;
      W.button('mut-' + mu.id, mu.name, x + 24 + (i % 4) * 140, y + 284 + Math.floor(i / 4) * 40, 132, 34, { px: 12, icon: mu.icon, selected: on,
        action: () => { const k = G.ui.mutators.indexOf(mu.id); if (k >= 0) G.ui.mutators.splice(k, 1); else G.ui.mutators.push(mu.id); } });
    });
    const mult = G.ui.mutators.reduce((a, id) => a * SE.MUT_BY_ID[id].discs, 1);
    if (mult > 1) kit.text('discs x' + mult.toFixed(2), x + w - 24, y + 270, 13, UI.disc, { align: 'right', weight: 'bold' });
    boosterRow(x + 24, y + 370, w - 48);
    W.button('play', 'Play', x + 24, y + h - 72, w - 48, 56, { icon: 'play', accent: UI.gold, px: 22,
      action: () => NS.play.start('free', { song: e.id, diff: G.ui.diff, speed: p.settings.practice || 1, mutators: G.ui.mutators.slice(), boosters: G.ui.boosters }) });
    void ctx;
  }

  Object.assign(NS.library, { boosterRow, list, draw, songCard });
})();
