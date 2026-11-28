/* The panels: the tech tree (five branches, nodes that light up along their links when bought), the
   collection (performers, note skins, highways and hit effects with live previews, rarities, what
   unlocks them, equip or buy), the journal (achievements with hidden ones, lifetime statistics with
   completion and the Fame tour, the codex of districts and cast, cinematics to replay, records), the
   results (the grade landing, the score rolling up, judgements, Early/Late with an offset tip, stars,
   the near miss, rewards, Retry and Next), pause and How to Play. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
  const G = NS.state;
  const C = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const P = NS.progress;
  const M = NS.metaData;
  const WD = NS.worldData;
  const ST = NS.storyData;
  const { UI, TAU } = C;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  function title(text, sub) {
    kit.text(text, 40, 40, 30, '#ffffff', { weight: 'bold', shadow: true });
    if (sub) kit.text(sub, 40, 70, 14, UI.gold, { weight: 'bold' });
  }

  function back() {
    W.button('back', 'Back', 40, 650, 200, 48, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
  }

  /* ---- tech tree ---- */
  function nodeRect(n) {
    const bi = M.BRANCHES.findIndex(b => b.id === n.branch);
    return { x: 40 + bi * 244 + n.x * 116, y: 120 + n.y * 112, w: 108, h: 84 };
  }

  const tree = {
    draw() {
      const p = G.profile;
      title('TECH TREE', P.treeLevels(p) + ' / ' + P.treeMax() + ' levels');
      kit.chip('disc', p.discs.toLocaleString('en-US'), 1100, 22, UI.disc, 140);
      M.BRANCHES.forEach((b, i) => kit.text(b.name.toUpperCase(), 40 + i * 244 + 112, 100, 15, b.color, { align: 'center', weight: 'bold' }));
      for (const n of M.TREE) for (const r of n.req) {
        const a = nodeRect(M.TREE_BY_ID[r[0]]), c = nodeRect(n);
        const lit = P.nodeLevel(p, r[0]) >= r[1];
        ctx.strokeStyle = lit ? M.BRANCHES.find(b => b.id === n.branch).color : 'rgba(120,110,160,0.35)';
        ctx.lineWidth = lit ? 3 : 2;
        ctx.beginPath(); ctx.moveTo(a.x + a.w / 2, a.y + a.h); ctx.lineTo(c.x + c.w / 2, c.y); ctx.stroke();
      }
      for (const n of M.TREE) {
        const r = nodeRect(n);
        const st = P.nodeState(p, n.id), lvl = P.nodeLevel(p, n.id);
        const color = M.BRANCHES.find(b => b.id === n.branch).color;
        const hot = W.area('node-' + n.id, r.x, r.y, r.w, r.h, () => { if (G.ui.treeSel === n.id) buy(n); else G.ui.treeSel = n.id; });
        if (hot) G.ui.treeSel = n.id;
        const sel = G.ui.treeSel === n.id;
        kit.panel(r.x, r.y, r.w, r.h, { radius: 10, accent: st === 'maxed' ? UI.gold : st === 'locked' ? '#3a3460' : color, glow: sel || st === 'available', alpha: st === 'locked' ? 0.55 : 1 });
        kit.fitText(n.name, r.x + r.w / 2, r.y + 20, r.w - 10, 13, { align: 'center', weight: 'bold', color: st === 'locked' ? UI.textMute : '#ffffff' });
        for (let k = 0; k < n.costs.length; ++k) K.circle(ctx, r.x + r.w / 2 + (k - (n.costs.length - 1) / 2) * 12, r.y + 42, 4, k < lvl ? color : 'rgba(255,255,255,0.15)');
        kit.text(st === 'maxed' ? 'MAX' : n.costs[lvl].toLocaleString('en-US'), r.x + r.w / 2, r.y + 64, 12, st === 'maxed' ? UI.gold : st === 'available' ? UI.disc : UI.textMute, { align: 'center', weight: 'bold' });
        if (st === 'locked') kit.lock(r.x + r.w - 12, r.y + 12, 12);
      }
      const n = M.TREE_BY_ID[G.ui.treeSel] || M.TREE[0];
      const st = P.nodeState(p, n.id), lvl = P.nodeLevel(p, n.id);
      kit.panel(280, 590, 720, 110, { accent: M.BRANCHES.find(b => b.id === n.branch).color });
      kit.text(n.name + '  (' + lvl + ' / ' + n.costs.length + ')', 300, 612, 18, '#ffffff', { weight: 'bold' });
      kit.wrap(P.nodeText(n, Math.min(n.costs.length, lvl + (st === 'maxed' ? 0 : 1))), 300, 640, 470, 14, UI.textDim);
      if (st === 'locked') kit.fitText('Needs ' + n.req.map(r => M.TREE_BY_ID[r[0]].name + ' ' + r[1]).join(', '), 300, 680, 470, 12, { color: UI.bad });
      W.button('buy-node', st === 'maxed' ? 'Maxed' : 'Buy ' + (st === 'maxed' ? '' : n.costs[lvl].toLocaleString('en-US')), 800, 610, 180, 70, { icon: 'disc', accent: UI.disc, disabled: st !== 'available', action: () => buy(n) });
      back();
    },
  };

  function buy(n) {
    const p = G.profile;
    if (!P.buyNode(p, n.id)) { sfx('error', { volume: 0.4 }); return; }
    const r = nodeRect(n);
    const color = M.BRANCHES.find(b => b.id === n.branch).color;
    NS.fx.burst(r.x + r.w / 2, r.y + r.h / 2, 30, [color, '#ffffff'], 'spark', 260, 0, 5);
    NS.fx.ring(r.x + r.w / 2, r.y + r.h / 2, 20, 90, 0.5, color, 3);
    for (const m of M.TREE) if (m.req.some(q => q[0] === n.id)) { const c = nodeRect(m); NS.fx.burst(c.x + c.w / 2, c.y, 10, [color], 'spark', 120, 0, 4); }
    sfx('powerup');
    NS.save.saveProfile(p);
  }

  /* ---- collection ---- */
  const SLOT_TABS = [['performer', 'Performers'], ['note', 'Note Skins'], ['highway', 'Highways'], ['effect', 'Hit Effects']];
  const wardrobe = {
    draw() {
      const p = G.profile;
      title('COLLECTION', P.cosmeticsOwned(p) + ' items - ' + Math.round(P.completion(p) * 100) + '% complete');
      kit.chip('crystal', p.crystals.toLocaleString('en-US'), 1110, 22, UI.crystal, 130);
      SLOT_TABS.forEach((t, i) => W.button('ward-tab-' + i, t[1], 320 + i * 180, 16, 170, 44, { selected: G.ui.wardTab === i, px: 14, action: () => { G.ui.wardTab = i; G.ui.pick = null; } }));
      const slot = SLOT_TABS[G.ui.wardTab][0];
      const list = M.SLOTS[slot];
      list.forEach((item, i) => {
        const x = 40 + (i % 5) * 170, y = 90 + Math.floor(i / 5) * 186, w = 160, h = 176;
        const owned = P.isUnlocked(p, item);
        const eq = p.equip[slot] === item.id;
        const R = M.RARITY[item.rarity];
        const hot = W.area('item-' + item.id, x, y, w, h, () => {
          G.ui.pick = item.id;
          if (owned) { P.equip(p, slot, item.id); sfx('select'); NS.save.saveProfile(p); }
        });
        kit.panel(x, y, w, h, { accent: eq ? UI.gold : R.color, glow: eq || hot, alpha: owned ? 1 : 0.65 });
        NS.shop.preview(slot, item, x + w / 2, y + 66, 0.9);
        kit.fitText(item.name, x + w / 2, y + 128, w - 16, 14, { align: 'center', weight: 'bold', color: owned ? '#ffffff' : UI.textDim });
        kit.text(eq ? 'EQUIPPED' : owned ? R.name : P.unlockText(item), x + w / 2, y + 152, 11, eq ? UI.gold : owned ? R.color : UI.textMute, { align: 'center', weight: 'bold' });
        if (!owned) kit.lock(x + w - 16, y + 16, 14);
      });
      const pick = list.find(i => i.id === (G.ui.pick || p.equip[slot])) || list[0];
      const owned = P.isUnlocked(p, pick);
      kit.panel(900, 90, 340, 540, { accent: M.RARITY[pick.rarity].color });
      NS.shop.preview(slot, pick, 1070, 250, 2);
      kit.text(pick.name, 1070, 420, 24, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text(M.RARITY[pick.rarity].name, 1070, 448, 14, M.RARITY[pick.rarity].color, { align: 'center', weight: 'bold' });
      if (pick.desc) kit.wrap(pick.desc, 920, 480, 300, 13, UI.textDim);
      if (!owned && pick.unlock.k === 'crystals') W.button('buy-cos', 'Buy for ' + pick.unlock.n, 940, 560, 260, 52, { icon: 'crystal', accent: UI.crystal, disabled: p.crystals < pick.unlock.n,
        action: () => { if (P.buyCosmetic(p, pick)) { sfx('powerup'); P.equip(p, slot, pick.id); NS.save.saveProfile(p); } } });
      else if (!owned) kit.fitText('Unlock: ' + P.unlockText(pick), 1070, 586, 300, 14, { align: 'center', color: UI.gold, weight: 'bold' });
      back();
    },
  };

  /* ---- journal ---- */
  const J_TABS = ['Achievements', 'Statistics', 'Codex', 'Cinematics', 'Records'];
  const journal = {
    draw() {
      const p = G.profile;
      title('JOURNAL', P.countAchievements(p) + ' / ' + M.ACHIEVEMENTS.length + ' achievements');
      J_TABS.forEach((t, i) => W.button('j-tab-' + i, t, 300 + i * 190, 16, 180, 44, { selected: G.ui.journalTab === i, px: 14, action: () => { G.ui.journalTab = i; G.ui.scroll = 0; } }));
      [achievements, stats, codex, cinematics, records][G.ui.journalTab]();
      back();
    },
  };

  function achievements() {
    const p = G.profile;
    const per = 24;
    const pages = Math.ceil(M.ACHIEVEMENTS.length / per);
    const page = Math.max(0, Math.min(pages - 1, G.ui.scroll | 0));
    M.ACHIEVEMENTS.slice(page * per, page * per + per).forEach((a, i) => {
      const x = 40 + (i % 4) * 302, y = 84 + Math.floor(i / 4) * 92;
      const got = !!p.achievements[a.id];
      const secret = a.hidden && !got;
      kit.panel(x, y, 292, 82, { accent: got ? UI.gold : '#3a3460', alpha: got ? 1 : 0.7 });
      kit.icon(secret ? 'help' : a.icon, x + 34, y + 41, 28, got ? UI.gold : UI.textMute);
      kit.fitText(secret ? 'Hidden achievement' : a.name, x + 62, y + 28, 220, 15, { weight: 'bold', color: got ? '#ffffff' : UI.textDim });
      kit.wrap(secret ? 'Keep playing to find it' : a.desc, x + 62, y + 50, 220, 12, UI.textDim);
    });
    if (pages > 1) {
      W.button('ach-prev', '<', 1080, 650, 70, 48, { action: () => { G.ui.scroll = Math.max(0, page - 1); } });
      W.button('ach-next', '>', 1160, 650, 70, 48, { action: () => { G.ui.scroll = Math.min(pages - 1, page + 1); } });
      kit.text('page ' + (page + 1) + ' / ' + pages, 1060, 674, 13, UI.textDim, { align: 'right' });
    }
  }

  function stats() {
    const p = G.profile, s = p.stats;
    const rows = [['Notes hit', s.hits], ['Perfects', s.perfects], ['Misses', s.misses], ['Best combo', s.bestCombo], ['Songs played', s.songs], ['Songs cleared', s.cleared],
      ['Full combos', s.fullCombos], ['S ranks', s.sRanks], ['S+ ranks', s.sPlus], ['Story stages', s.stages], ['Bosses', P.bossesBeaten(p)], ['Expert clears', s.expertClears],
      ['Marathon best', s.marathonBest + ' songs'], ['Daily Mixes', s.dailies], ['Surges', s.surges], ['Hush notes let pass', s.hushDodged], ['Holds kept', s.holds],
      ['Crates opened', s.crates], ['Quests done', s.quests], ['Best streak', p.streak.best + ' days'], ['Time played', Math.round(s.playSeconds / 60) + ' min'], ['Score, all time', s.score.toLocaleString('en-US')]];
    rows.forEach((r, i) => {
      const x = 40 + Math.floor(i / 11) * 420, y = 100 + (i % 11) * 44;
      kit.panel(x, y, 400, 38, { radius: 8 });
      kit.text(r[0], x + 16, y + 19, 14, UI.textDim);
      kit.text(typeof r[1] === 'number' ? r[1].toLocaleString('en-US') : r[1], x + 384, y + 19, 15, '#ffffff', { align: 'right', weight: 'bold' });
    });
    const x = 880, y = 100;
    kit.panel(x, y, 360, 300, { accent: UI.gold });
    kit.text('COMPLETION', x + 180, y + 30, 16, UI.gold, { align: 'center', weight: 'bold' });
    const c = P.completion(p);
    kit.text(Math.floor(c * 100) + '%', x + 180, y + 82, 48, '#ffffff', { align: 'center', weight: 'bold' });
    kit.bar(x + 30, y + 120, 300, 12, c, UI.gold);
    kit.wrap('Stars, bosses, the tech tree, the collection, achievements and the Record Shop. At 100% the legendary Prism note skin is yours.', x + 24, y + 150, 312, 12, UI.textDim);
    kit.panel(x, y + 320, 360, 210, { accent: UI.crystal });
    kit.text('FAME  ' + p.fame + ' / ' + P.FAME_MAX, x + 180, y + 350, 18, UI.crystal, { align: 'center', weight: 'bold' });
    kit.wrap('From level ' + P.FAME_LEVEL + ' you can go on Tour: your level starts over and every Fame star adds 10% discs and XP for good.', x + 24, y + 378, 312, 12, UI.textDim);
    W.button('tour', P.canTour(p) ? 'Go on Tour!' : 'Level ' + P.FAME_LEVEL + ' needed', x + 40, y + 450, 280, 56, { icon: 'crown', accent: UI.crystal, disabled: !P.canTour(p),
      action: () => NS.screens.confirm('Go on Tour?', 'Your player level goes back to 1. You keep everything else and gain a Fame star: +10% discs and XP for good, and 50 crystals.', () => {
        if (P.tour(p)) { NS.fx.burst(640, 360, 120, [UI.crystal, UI.gold, '#ffffff'], 'star', 500, 200, 8); sfx('win'); NS.screens.toast('Fame star ' + p.fame + '! Welcome to the big stages.', UI.crystal, 'crown'); NS.save.saveProfile(p); }
      }) });
  }

  function codex() {
    const p = G.profile;
    WD.WORLDS.forEach((w, i) => {
      const open = NS.map.worldOpen(i);
      const x = 40 + i * 244, y = 90;
      kit.panel(x, y, 232, 250, { accent: open ? w.color : '#3a3460', alpha: open ? 1 : 0.6 });
      ctx.save();
      K.roundRect(ctx, x + 8, y + 8, 216, 96, 8);
      ctx.clip();
      ctx.drawImage(NS.backdrop.sky(i), 0, 120, 1280, 600, x + 8, y + 8, 216, 96);
      ctx.restore();
      kit.text(open ? w.name : '???', x + 116, y + 126, 16, '#ffffff', { align: 'center', weight: 'bold' });
      kit.wrap(open ? ST.CODEX[w.id] : 'Clear the district before to read about it.', x + 14, y + 150, 204, 12, UI.textDim);
    });
    const cast = ['lyra', 'metro', 'reverb'].concat(ST.BOSS_KEYS);
    cast.forEach((k, i) => {
      const c = ST.CAST[k];
      const known = c.boss == null || p.seen.bosses[c.boss];
      const x = 40 + i * 152, y = 360;
      kit.panel(x, y, 144, 270, { accent: known ? c.accent : '#3a3460', alpha: known ? 1 : 0.6 });
      if (known) ctx.drawImage(NS.actors.portrait(k), x + 8, y + 8, 128, 128);
      else kit.icon('help', x + 72, y + 72, 48, UI.textMute);
      kit.fitText(known ? c.name : '???', x + 72, y + 156, 132, 15, { align: 'center', weight: 'bold', color: '#ffffff' });
      kit.wrap(known ? c.role : 'Not met yet', x + 10, y + 180, 124, 12, UI.textDim);
    });
  }

  function cinematics() {
    const p = G.profile;
    const list = [['Intro', p.seen.intro, () => ST.SHOTS.intro]];
    for (let w = 0; w < 5; ++w) {
      list.push([WD.WORLDS[w].name, !!p.seen.worlds[w], () => ST.worldIntro(w, WD.WORLDS[w])]);
      list.push([WD.BOSSES[w].short + ' appears', !!p.seen.bosses[w], () => ST.bossIntro(w, WD.BOSSES[w])]);
      list.push([WD.BOSSES[w].short + ' finds the beat', !!p.seen['won-' + w], () => ST.bossWin(w, WD.BOSSES[w])]);
    }
    list.push(['Finale and credits', p.seen.finale, () => ST.SHOTS.finale]);
    list.forEach((e, i) => {
      const x = 40 + (i % 4) * 302, y = 90 + Math.floor(i / 4) * 66;
      W.button('cine-' + i, e[1] ? e[0] : '???', x, y, 292, 56, { icon: 'play', disabled: !e[1], px: 15, action: () => NS.cine.play(e[2](), 'replay') });
    });
  }

  function records() {
    const p = G.profile;
    const col = (x, head, rows) => {
      kit.panel(x, 90, 380, 540, { accent: UI.gold });
      kit.text(head, x + 190, 116, 16, UI.gold, { align: 'center', weight: 'bold' });
      if (!rows.length) kit.text('nothing yet', x + 190, 160, 13, UI.textDim, { align: 'center' });
      rows.slice(0, 12).forEach((r, i) => {
        kit.fitText((i + 1) + '. ' + r[0], x + 20, 152 + i * 38, 240, 14, { color: '#ffffff' });
        kit.text(r[1], x + 360, 152 + i * 38, 14, UI.gold, { align: 'right', weight: 'bold' });
      });
    };
    col(40, 'MARATHON', p.scores.marathon.map(e => [e.songs + ' songs - ' + e.day, e.score.toLocaleString('en-US')]));
    col(450, 'BOSS RUSH', p.scores.rush.map(e => [e.duels + ' duels - ' + e.day, e.score.toLocaleString('en-US')]));
    const daily = Object.keys(p.scores.daily).sort().reverse().map(k => ['Daily ' + k, p.scores.daily[k].toLocaleString('en-US')]);
    col(860, p.scores.legacy.length ? 'DAILY + OLD RECORDS' : 'DAILY MIX', daily.concat(p.scores.legacy.map(e => [e.song + ' (old game)', e.score.toLocaleString('en-US') + ' ' + e.grade])));
  }

  /* ---- results ---- */
  const GRADE_COLOR = { 'S+': '#ffe85a', S: '#ffd25a', A: '#7bf0a0', B: '#5af0ff', C: '#c48aff', D: '#b8b0d8', F: '#ff5a7a' };
  const results = {
    draw() {
      const r = G.result;
      if (!r) return;
      const p = G.profile;
      if (G.ui.resFor !== r) { G.ui.resFor = r; G.ui.resStart = G.time; }
      const t = G.time - G.ui.resStart;
      kit.text(r.failed ? (r.boss ? 'THE DUEL IS LOST' : 'THE GROOVE RAN DRY') : r.boss ? 'DUEL WON!' : r.mode === 'marathon' ? 'MARATHON OVER' : 'SONG CLEAR!', 640, 50, 34, r.failed ? UI.bad : UI.gold, { align: 'center', weight: 'bold', shadow: true });
      kit.fitText(r.title, 640, 86, 700, 18, { align: 'center', color: '#ffffff' });
      /* grade */
      const k = Math.min(1, t * 2.2);
      const s = NS.rng.ease.back(k);
      ctx.save();
      ctx.translate(260, 270);
      ctx.scale(0.3 + s * 0.7, 0.3 + s * 0.7);
      ctx.rotate((1 - k) * -0.6);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5;
      K.blit(ctx, K.glow(GRADE_COLOR[r.grade]), 0, 0, 2.4);
      ctx.restore();
      ctx.save();
      ctx.translate(260, 270);
      ctx.scale(0.3 + s * 0.7, 0.3 + s * 0.7);
      kit.text(r.grade, 0, 0, 150, GRADE_COLOR[r.grade], { align: 'center', weight: 'bold', shadow: 'rgba(0,0,0,0.6)' });
      ctx.restore();
      if (r.fc) kit.text('FULL COMBO', 260, 380, 22, UI.gold, { align: 'center', weight: 'bold' });
      if (r.stars) {
        for (let i = 0; i < 3; ++i) {
          const land = Math.min(1, Math.max(0, (t - 0.6 - i * 0.3) * 4));
          if (land <= 0) continue;
          ctx.save();
          ctx.translate(200 + i * 60, 430);
          ctx.scale(1 + (1 - land) * 1.5, 1 + (1 - land) * 1.5);
          kit.icon('star', 0, 0, 44, r.stars[i] ? UI.gold : 'rgba(120,130,160,0.4)');
          ctx.restore();
        }
      }
      if (r.near) kit.fitText(r.near, 260, 480, 420, 16, { align: 'center', color: UI.gold, weight: 'bold' });
      /* numbers */
      const roll = Math.min(1, t / 1.2);
      kit.panel(500, 120, 360, 420, { accent: UI.accent });
      kit.text(Math.round(r.score * roll).toLocaleString('en-US'), 680, 160, 40, '#ffffff', { align: 'center', weight: 'bold' });
      kit.text(r.newBest ? 'NEW PERSONAL BEST!' : r.prevBest ? 'best ' + r.prevBest.toLocaleString('en-US') : '', 680, 196, 14, r.newBest ? UI.good : UI.textDim, { align: 'center', weight: 'bold' });
      const rows = [['Perfect', r.counts.perfect, '#ffe85a'], ['Great', r.counts.great, '#5af0ff'], ['Good', r.counts.good, '#7bf0a0'], ['Miss', r.counts.miss, '#ff5a7a'],
        ['Max combo', r.maxCombo, '#ffffff'], ['Accuracy', (Math.round(r.acc * 1000) / 10).toFixed(1) + '%', '#ffffff'], ['Early / Late', r.early + ' / ' + r.late, '#b8b0d8']];
      if (r.phraseN) rows.push(['Star phrases', r.phrases + ' / ' + r.phraseN, UI.gold]);
      if (r.totals && r.mode === 'marathon') rows.push(['Songs survived', r.totals.songs, UI.gold]);
      rows.forEach((row, i) => {
        kit.text(row[0], 530, 236 + i * 34, 15, UI.textDim);
        kit.text(String(row[1]), 830, 236 + i * 34, 17, row[2], { align: 'right', weight: 'bold' });
      });
      if (Math.abs(r.offset) > 0.018 && r.hits > 20) kit.fitText('You hit ' + Math.round(Math.abs(r.offset) * 1000) + ' ms ' + (r.offset > 0 ? 'late' : 'early') + ' on average - try Settings > Calibrate', 680, 520, 340, 12, { align: 'center', color: UI.textDim });
      /* rewards */
      kit.panel(900, 120, 340, 420, { accent: UI.disc });
      kit.text('REWARDS', 1070, 148, 16, UI.disc, { align: 'center', weight: 'bold' });
      const rw = [['disc', '+' + Math.round((r.discs || 0) * roll).toLocaleString('en-US') + ' discs', UI.disc], ['xp', '+' + (r.xp || 0) + ' XP', UI.xp]];
      if (r.crystals) rw.push(['crystal', '+' + r.crystals + ' crystals', UI.crystal]);
      if (G.season) rw.push(['gift', '+' + (r.tokens || 0) + ' ' + G.season.token, G.season.color]);
      rw.forEach((e, i) => { kit.icon(e[0], 940, 190 + i * 40, 22, e[2]); kit.text(e[1], 964, 191 + i * 40, 17, '#ffffff', { weight: 'bold' }); });
      kit.text('Level ' + p.level, 930, 380, 15, '#ffffff', { weight: 'bold' });
      kit.bar(930, 396, 280, 10, p.xp / P.xpFor(p.level), UI.xp);
      if (r.levelUps.length) kit.text('LEVEL UP!', 1210, 380, 15, UI.gold, { align: 'right', weight: 'bold' });
      if (r.quests.length) kit.fitText(r.quests.length + ' quest' + (r.quests.length > 1 ? 's' : '') + ' completed', 1070, 440, 300, 14, { align: 'center', color: UI.good, weight: 'bold' });
      if (p.crates.owned) W.button('res-crates', p.crates.owned + ' crate' + (p.crates.owned > 1 ? 's' : '') + ' to open', 930, 470, 280, 48, { icon: 'gift', accent: '#ff7ad8', px: 14, action: () => { G.ui.shopTab = 3; NS.screens.open('shop', 'results'); } });
      /* buttons */
      const st = r.stage;
      const next = st && r.cleared && (r.mode === 'story') && st.index + 1 < WD.STAGES.length ? WD.STAGES[st.index + 1] : null;
      W.button('retry', 'Retry  (R)', 330, 600, 200, 56, { icon: 'retry', accent: UI.accent, action: () => { NS.play.restart(); } });
      if (next) W.button('next', 'Next: ' + next.name, 550, 600, 300, 56, { icon: 'play', accent: UI.gold, action: () => { G.ui.world = next.world; G.ui.stage = next.stage; NS.play.start('story', { stage: next.id, boosters: [] }); } });
      W.button('res-back', st ? 'Map' : r.mode === 'free' ? 'Song List' : 'Modes', next ? 870 : 550, 600, 200, 56, { icon: 'back', accent: UI.good,
        action: () => { NS.screens.setScreen(st ? 'map' : r.mode === 'free' ? 'library' : 'modes', 'title'); } });
      if (G.menuCursor < 0) G.menuCursor = G.hitAreas.findIndex(a => a.id === (next ? 'next' : 'retry'));
    },
  };

  /* ---- pause ---- */
  const pause = {
    draw() {
      const v = NS.view.visible();
      ctx.fillStyle = 'rgba(4,2,12,0.6)';
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      kit.panel(440, 150, 400, 430, { accent: UI.accent, glow: true });
      kit.text('PAUSED', 640, 196, 34, '#ffffff', { align: 'center', weight: 'bold' });
      if (G.run) kit.fitText(G.run.title, 640, 232, 360, 15, { align: 'center', color: UI.textDim });
      const b = (id, label, icon, y, fn, accent) => W.button(id, label, 480, y, 320, 50, { icon: icon, action: fn, accent: accent });
      b('resume', 'Resume', 'play', 262, () => NS.screens.resume(), UI.gold);
      b('p-retry', 'Retry (R)', 'retry', 320, () => NS.play.restart());
      b('p-settings', 'Settings', 'gear', 378, () => NS.screens.open('settings', 'paused'));
      b('p-help', 'How to Play', 'help', 436, () => NS.screens.open('help', 'paused'));
      b('p-quit', 'Quit (saved for Continue)', 'back', 494, () => { NS.save.saveRun(G.run); NS.play.quit(); NS.screens.setScreen('title'); G.run = null; }, UI.bad);
      if (G.menuCursor < 0) G.menuCursor = 0;
    },
  };

  /* ---- help ---- */
  const PAGES = [
    ['Hitting notes', 'Notes fall down four lanes. Press D, F, J or K (or the arrow keys, or touch the lane) as a note crosses the line at the bottom. Within 45 ms it is Perfect, within 90 ms Great, within 135 ms Good - later, or never, is a Miss. Every hit says whether you were early or late.'],
    ['Combo and groove', 'Hits in a row build your combo: x2 from 10, x3 from 25, x4 from 50. The groove meter on the left fills with hits and drains with misses; if it runs dry, the song fails. Shields and the Safety Net save a combo.'],
    ['Note kinds', 'Holds: keep the key down until the tail. Chords: two lanes at once. Hush notes (dark, with a cross): do not press them - let them fall past. Drift notes slide over to the next lane before the line; an arrow shows where they go.'],
    ['Surge and pickups', 'Gold star phrases appear in the drops. Hit a whole phrase and the Surge meter on the right fills by a quarter; at half, press Space to unleash Surge - double score for eight beats. Notes with a badge carry a shield, groove, a Magnet (wider timing) or a multiplier.'],
    ['Boss duels', 'A boss loses health with every hit - bring it to zero before the song ends. Every eight bars it telegraphs an attack for a bar, then strikes: Bass Drop speeds the notes up, Glass Fog hides the far highway, Hammerfall throws Hush notes, Riptide sways the highway, and the Hush can take the music away. Below half health it rages and strikes every four bars.'],
    ['Getting better', 'Discs buy the tech tree, boosters and songs. Wider windows, more groove and an Encore make hard songs fair. If you always hit late or early, Settings > Calibrate measures your audio offset. Free Play has practice speeds, and Relaxed mode (Settings) cannot fail - it earns no third star, but still pays.'],
  ];
  const help = {
    draw() {
      title('HOW TO PLAY');
      PAGES.forEach((pg, i) => {
        const x = 40 + (i % 3) * 404, y = 90 + Math.floor(i / 3) * 270;
        kit.panel(x, y, 392, 258, { accent: UI.accent });
        kit.text(pg[0], x + 20, y + 28, 18, UI.gold, { weight: 'bold' });
        kit.wrap(pg[1], x + 20, y + 58, 352, 13, '#ffffff');
      });
      if (!G.profile.seen.help) G.profile.seen.help = true;
      back();
      void TAU;
    },
  };

  Object.assign(NS.tree, tree, { nodeRect, buy });
  Object.assign(NS.wardrobe, wardrobe);
  Object.assign(NS.journal, journal, { J_TABS });
  Object.assign(NS.results, results);
  Object.assign(NS.pause, pause);
  Object.assign(NS.help, help, { PAGES });
})();
