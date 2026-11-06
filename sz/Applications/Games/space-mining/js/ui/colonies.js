/* Two station tabs. Colonies: today's daily contract with the streak it builds, this week's
   anomaly belt and the running season, and every belt's outpost at a glance (founded,
   infected, abandoned, a hive; buildings, crew, waves held, fleet, stock) with a launch button.
   Log: the captain's log - the chapters unlocked so far, their text, and replaying one. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { ZONES, ORE_BY_ID } = NS.ores;
  const { COMP_BY_ID } = NS.colonyData;
  const { CHAPTERS } = NS.eventData;
  const kit = NS.kit;
  const W = NS.widgets;
  const C = NS.colony;
  const eco = NS.economy;
  const cal = NS.calendar;
  const { ctx } = NS.view;
  const { sfx } = NS.audio;

  function contractText(c) {
    if (c.kind === 'waves') return 'Repel ' + c.qty + ' attack waves at any outpost';
    if (c.kind === 'comp') return 'Deliver ' + c.qty + ' ' + COMP_BY_ID[c.ore].name;
    return 'Deliver ' + c.qty + ' ' + (c.kind === 'bar' ? ORE_BY_ID[c.ore].bar : ORE_BY_ID[c.ore].name);
  }

  function drawColonies(px, py, pw, ph) {
    const save = G.save;
    const day = NS.rng.dayKey();
    const daily = eco.dailyContract(save, day);
    const streak = cal.liveStreak(save.daily, day);
    /* daily contract */
    const x = px + 16, y = py + 14;
    const w1 = pw * 0.56 - 24;
    kit.panel(x, y, w1, 120, { radius: 8, brackets: false, accent: UI.cyan, alpha: 0.9 });
    kit.icon('calendar', x + 22, y + 22, 20, UI.cyan);
    kit.text('DAILY CONTRACT  -  ' + day, x + 40, y + 22, 13, UI.cyan, { weight: 'bold' });
    if (daily) {
      kit.fitText(contractText(daily), x + 14, y + 48, w1 - 28, 15, { weight: 'bold', color: '#ffffff' });
      const have = eco.progress(save, daily);
      kit.bar(x + 14, y + 64, w1 - 160, 8, have / daily.qty, eco.canFulfil(save, daily) ? UI.good : UI.cyan);
      kit.text(Math.min(have, daily.qty) + ' / ' + daily.qty, x + w1 - 140, y + 68, 12, UI.textDim);
      kit.credits(daily.reward, x + 14, y + 88, 14);
      kit.amount(daily.rd, x + 110, y + 88, 13, 'left', 'rd');
      const ok = eco.canFulfil(save, daily);
      W.button('dailyGo', ok ? 'Deliver' : 'In progress', x + w1 - 128, y + 80, 116, 30, { disabled: !ok, accent: UI.good, px: 13, action: () => {
        const done = eco.fulfil(save, save.contracts.indexOf(daily));
        if (done) {
          NS.station.payout(x + w1 - 70, y + 90, done.reward);
          sfx('win', { volume: 0.6 });
          NS.save.writeSave();
        }
      } });
    } else kit.text('Done for today - come back tomorrow to keep the streak', x + 14, y + 52, 13, UI.good);
    kit.fitText('Streak ' + streak + ' day' + (streak === 1 ? '' : 's') + '  -  next pays x' + cal.streakMul(streak + 1).toFixed(2), x + 14, y + 108, w1 - 160, 12, { color: streak ? UI.gold : UI.textMute, weight: 'bold' });
    /* anomaly and season */
    const ax = px + pw * 0.56, aw = pw * 0.44 - 16;
    const an = cal.anomaly(cal.weekKey());
    kit.panel(ax, y, aw, 120, { radius: 8, brackets: false, accent: an.def.color, alpha: 0.9 });
    kit.text('ANOMALY OF THE WEEK  ' + cal.weekKey().slice(5), ax + 14, y + 20, 12, an.def.color, { weight: 'bold' });
    kit.text(an.def.name + '  -  ' + ZONES[an.zone].name, ax + 14, y + 42, 15, '#ffffff', { weight: 'bold' });
    kit.wrap(an.def.text + '. Rewards x' + an.def.reward.toFixed(2) + '.', ax + 14, y + 54, aw - 28, 12, 16, UI.textDim);
    const se = cal.season();
    kit.text(se ? se.name + ': ' + se.text : 'No festival running', ax + 14, y + 104, 11, se ? se.color : UI.textMute);
    /* the outposts */
    let ry = y + 136;
    kit.text('BELT', x + 40, ry, 11, UI.textMute, { weight: 'bold' });
    kit.text('OUTPOST', x + 190, ry, 11, UI.textMute, { weight: 'bold' });
    kit.text('BLDG', x + 330, ry, 11, UI.textMute, { weight: 'bold' });
    kit.text('CREW', x + 380, ry, 11, UI.textMute, { weight: 'bold' });
    kit.text('WAVES', x + 432, ry, 11, UI.textMute, { weight: 'bold' });
    kit.text('FLEET', x + 486, ry, 11, UI.textMute, { weight: 'bold' });
    ry += 12;
    for (let i = 0; i < ZONES.length; ++i) {
      const z = ZONES[i];
      const b = save.bases[z.id];
      const open = save.licenses.indexOf(z.id) >= 0;
      const ty = ry + i * 49;
      ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.18)';
      ctx.fillRect(x - 4, ty, pw - 24, 46);
      kit.icon(open ? 'map' : 'star', x + 14, ty + 23, 18, open ? z.theme.accent : UI.textMute);
      kit.text(z.name, x + 30, ty + 16, 14, open ? '#ffffff' : UI.textMute, { weight: 'bold' });
      kit.text('danger ' + '*****'.slice(0, z.danger), x + 30, ty + 33, 11, UI.textDim);
      let st = open ? 'Site free' : 'No licence', col = UI.textMute;
      const claimed = b && b.buildings.some(o => o.type === 'hub');
      if (claimed) {
        if (b.hive) { st = 'Overrun by a hive'; col = '#ff8ae0'; }
        else if (b.abandoned) { st = 'ABANDONED'; col = UI.bad; }
        else if (b.buildings.some(o => o.rogue)) { st = 'Lattice hijack'; col = '#3affd0'; }
        else if (b.infected > 0.02) { st = 'Outbreak'; col = '#9ae04a'; }
        else { st = 'Operational'; col = UI.good; }
      }
      kit.text(st, x + 190, ty + 16, 13, col, { weight: 'bold' });
      if (claimed) {
        kit.text('value ' + kit.group(C.baseValue(b)) + '  -  stock ' + C.stockCount(b.stock), x + 190, ty + 33, 11, UI.textDim);
        kit.text(String(b.buildings.length), x + 330, ty + 23, 13, UI.text);
        kit.text(b.crew + '/' + C.housing(b), x + 380, ty + 23, 13, UI.text);
        kit.text(String(b.wave), x + 432, ty + 23, 13, UI.text);
        kit.text(String(b.units.length), x + 486, ty + 23, 13, UI.text);
      }
      if (open) W.button('go_' + z.id, 'Fly', x + pw - 98, ty + 7, 62, 32, { accent: z.theme.accent, px: 13, action: () => NS.screens.launch('career', i) });
    }
    kit.text('Outposts produce a little while you are away (upkeep is charged each cycle); waves only come while you are in the belt.', x, py + ph - 14, 11, UI.textMute);
  }

  function drawLog(px, py, pw, ph) {
    const save = G.save;
    const x = px + 16, y = py + 16;
    kit.text('CAPTAIN\'S LOG  -  ' + save.log.length + ' of ' + CHAPTERS.length + ' chapters', x, y + 6, 14, UI.accent, { weight: 'bold' });
    const sel = Math.max(0, Math.min(CHAPTERS.length - 1, G.ui.logSel));
    for (let i = 0; i < CHAPTERS.length; ++i) {
      const ch = CHAPTERS[i];
      const got = save.log.indexOf(ch.id) >= 0;
      const ty = y + 24 + i * 44;
      const on = i === sel;
      const hot = W.area('ch' + i, x, ty, 230, 40, () => { G.ui.logSel = i; });
      kit.panel(x, ty, 230, 40, { radius: 6, brackets: false, accent: on || hot ? ch.color : UI.textMute, glow: on, alpha: 0.9 });
      kit.icon(got ? 'log' : 'lock', x + 18, ty + 20, 16, got ? ch.color : UI.textMute);
      kit.fitText(got ? ch.title.split(' - ')[1] : '???', x + 36, ty + 14, 186, 13, { weight: 'bold', color: got ? '#ffffff' : UI.textMute });
      kit.text(ch.title.split(' - ')[0], x + 36, ty + 30, 10, UI.textDim);
    }
    const ch = CHAPTERS[sel];
    const got = save.log.indexOf(ch.id) >= 0;
    const tx = x + 250, tw = pw - 290;
    kit.panel(tx, y + 24, tw, ph - 90, { radius: 8, brackets: false, accent: got ? ch.color : UI.textMute, alpha: 0.9 });
    if (!got) {
      kit.text('Not yet written', tx + 20, y + 54, 16, UI.textMute, { weight: 'bold' });
      kit.wrap(hint(ch), tx + 20, y + 74, tw - 40, 13, 18, UI.textDim);
      return;
    }
    kit.text(ch.title, tx + 20, y + 52, 17, '#ffffff', { weight: 'bold' });
    let yy = y + 76;
    for (let i = 0; i < ch.lines.length; ++i) yy += kit.wrap(ch.lines[i], tx + 20, yy, tw - 40, 14, 20, UI.text) + 10;
    W.button('replay', 'Replay entry', tx + tw - 170, y + ph - 116, 150, 34, { accent: ch.color, px: 13, action: () => NS.events.playLog(ch.id, () => NS.screens.setScreen('station')) });
  }

  function hint(ch) {
    const h = { bases: 'Found an outpost.', infections: 'Something in the outer belts is alive.', reclaims: 'Answer a distress call.',
      corruptions: 'Something rewrites machines.', bosses: 'Bring down what commands the swarms.', crown: 'The heart of the Void Crown.', waves: 'Hold the line - forty times.' };
    return h[ch.stat] || '';
  }

  Object.assign(NS.colonies, {
    drawColonies, drawLog, contractText
  });
})();
