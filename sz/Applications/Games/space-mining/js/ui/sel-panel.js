/* The selection panel of the command view. A building: name, level, hit points, status (under
   construction, online, unpowered, understaffed, infected, corrupted, hijacked, quarantined),
   what it makes, and its actions (upgrade, demolish, quarantine, sterilise, purge, recipe,
   unit production with the queue, crew, EMP, reclaim). Units: counts by type (click one to keep
   only that type), a single unit's rank and kills, the four formations and the orders (attack-
   move, patrol, escort, return, hold). Nothing: the controls. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceMining || (SZ.SpaceMining = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { BUILDING_BY_ID, RECIPES, RECIPE_BY_ID, COMP_BY_ID } = NS.colonyData;
  const { UNIT_BY_ID, UNITS, FORMATIONS, VET_NAMES, VET_KILLS } = NS.fleetData;
  const { ORE_BY_ID } = NS.ores;
  const kit = NS.kit;
  const C = NS.colony;
  const B = NS.base;
  const { ctx } = NS.view;

  const PW = 392, PH = 214;

  function area(v) {
    return { x: v.x1 - PW - 10, y: v.y1 - PH - 10, w: PW, h: PH };
  }

  function draw(v) {
    const a = area(v);
    kit.panel(a.x, a.y, a.w, a.h, { radius: 8, brackets: false, alpha: 0.94 });
    const c = G.cmd;
    const sel = NS.command.liveSel();
    if (c.selB) building(a, c.selB);
    else if (sel.length) units(a, sel);
    else idle(a);
  }

  function result(r) {
    if (r && r.ok === false) NS.command.say(r.reason, '#ff6a5c');
  }

  function status(o, b) {
    if (o.prog < 1) return ['Under construction ' + Math.round(o.prog * 100) + '%', UI.cyan];
    if (o.rogue) return ['HIJACKED by the Lattice', '#3affd0'];
    if (o.quarantine) return ['Quarantined - cut from the grid', UI.bad];
    if (b.data.abandoned) return ['Abandoned', UI.bad];
    const i = b.data.buildings.indexOf(o);
    if (!b.net.on[i]) return ['Out of link range', UI.warn];
    const def = BUILDING_BY_ID[o.type];
    if (def.crew && (o._staff || 0) < def.crew) return ['Understaffed - ' + (o._staff || 0) + ' / ' + def.crew + ' crew', UI.warn];
    if (def.power < 0 && b.pw.ratio < 0.95) return ['Low power - ' + Math.round(b.pw.ratio * 100) + '%', UI.warn];
    if (o._blocked) return ['Storage full', UI.warn];
    return ['Online - ' + Math.round((o._eff === undefined ? 1 : o._eff) * 100) + '% efficiency', UI.good];
  }

  function building(a, o) {
    const b = G.base;
    const def = BUILDING_BY_ID[o.type];
    const btn = NS.commandHud.btn;
    const sp = NS.colonyArt.building(o.type, o.lvl);
    const s = 52 / sp.w;
    ctx.drawImage(sp.canvas, a.x + 12, a.y + 12, sp.w * s, sp.h * s);
    kit.text(def.name, a.x + 74, a.y + 22, 17, '#ffffff', { weight: 'bold' });
    kit.text('Level ' + o.lvl + ' / ' + NS.colonyData.MAX_LEVEL, a.x + a.w - 14, a.y + 22, 12, UI.gold, { align: 'right', weight: 'bold' });
    kit.bar(a.x + 74, a.y + 36, a.w - 90, 8, o.hp / o.maxHp, o.hp < o.maxHp * 0.35 ? UI.bad : UI.good);
    const st = status(o, b);
    kit.text(st[0], a.x + 74, a.y + 56, 12, st[1], { weight: 'bold' });
    const line = info(o, def, b);
    kit.wrap(line, a.x + 14, a.y + 68, a.w - 28, 12, 15, UI.textDim);
    if ((o.inf || 0) > 0.01) {
      kit.text('Infection', a.x + 14, a.y + 98, 11, '#9ae04a', { weight: 'bold' });
      kit.bar(a.x + 80, a.y + 94, 120, 7, o.inf, '#9ae04a');
    }
    if ((o.cor || 0) > 0.01 && !o.rogue) {
      kit.text('Corruption', a.x + 210, a.y + 98, 11, '#3affd0', { weight: 'bold' });
      kit.bar(a.x + 280, a.y + 94, 96, 7, o.cor, '#3affd0');
    }
    /* actions */
    let x = a.x + 12, y = a.y + 112;
    const row = (w) => {
      if (x + w > a.x + a.w - 10) { x = a.x + 12; y += 36; }
      const r = { x: x, y: y };
      x += w + 6;
      return r;
    };
    if (def.makes && o.prog >= 1 && !o.rogue) {
      for (let i = 0; i < def.makes.length; ++i) {
        const u = UNIT_BY_ID[def.makes[i]];
        const p = row(84);
        const ok = C.canAfford(B.wallet(), b.data.stock, u.cost);
        btn('mk_' + u.id, p.x, p.y, 84, 32, { icon: u.icon, label: u.name.split(' ').pop(), sub: NS.kit.group(u.cost.cr) + ' cr', color: ok ? u.color : UI.textMute, px: 11,
          action: () => result(B.queueUnit(o, u.id)), tip: { title: u.name, text: u.role, lines: NS.buildMenu.costLines(u.cost, b.data.stock, B.wallet()).concat([[u.supply + ' supply  -  ' + u.build + 's to build', UI.textDim]]), color: u.color } });
      }
      if (o.queue && o.queue.length) {
        const p = row(84);
        kit.text('Queue ' + o.queue.length, p.x + 4, p.y + 9, 11, UI.textDim, { weight: 'bold' });
        kit.bar(p.x + 4, p.y + 18, 76, 6, (o._qt || 0) / UNIT_BY_ID[o.queue[0]].build, UI.cyan);
      }
    }
    if (o.type === 'fabricator' && o.prog >= 1) {
      const p = row(120);
      const r = o.recipe && o.recipe !== 'auto' ? RECIPE_BY_ID[o.recipe] : null;
      btn('recipe', p.x, p.y, 120, 32, { icon: r ? COMP_BY_ID[r.out].icon : 'chip', label: r ? COMP_BY_ID[r.out].name : 'Auto (best)', sub: 'recipe', px: 11, color: UI.good,
        action: () => {
          const ids = ['auto'].concat(RECIPES.map(q => q.id));
          o.recipe = ids[(ids.indexOf(o.recipe || 'auto') + 1) % ids.length];
        }, tip: { title: 'Recipe', text: r ? recipeText(r) : 'Makes the most valuable component it has bars for.' } });
    }
    if (o.type === 'hub' && !b.data.abandoned) {
      let p = row(100);
      btn('recruit', p.x, p.y, 100, 32, { icon: 'crew', label: 'Crew +2', sub: '200 cr', px: 12, color: UI.gold, disabled: b.data.crew + 2 > C.housing(b.data),
        action: () => { if (!B.recruit()) NS.command.say('Needs 200 credits and free housing', '#ff6a5c'); }, tip: { title: 'Recruit crew', text: 'Hire two crew for 200 credits. Habitats raise the housing limit.' } });
      if (G.stats.emp) {
        p = row(90);
        btn('emp', p.x, p.y, 90, 32, { icon: 'blast', label: 'EMP', sub: b.empCd > 0 ? Math.ceil(b.empCd) + 's' : 'ready', px: 12, color: '#3affd0', disabled: b.empCd > 0,
          action: () => B.empPulse(), tip: { title: 'Purge Pulse', text: 'Purges corruption from every building near the hub and fries nanoprobes in reach.' } });
      }
    }
    if (o.type === 'hub' && b.data.abandoned) {
      const p = row(150);
      btn('reclaim', p.x, p.y, 150, 32, { icon: 'crew', label: 'Reclaim', sub: '800 cr - 4 crew', px: 12, color: UI.gold,
        action: () => { if (!B.reclaim(0)) NS.command.say('Kill the hive first - and bring 800 credits', '#ff6a5c'); } });
    }
    if (o.prog >= 1 && !o.rogue) {
      const up = C.upgradeCost(o, G.stats);
      if (up) {
        const p = row(92);
        btn('upgrade', p.x, p.y, 92, 32, { icon: 'upgrade', label: 'Upgrade', sub: NS.kit.group(up.cr) + ' cr', px: 12, color: UI.gold,
          action: () => result(B.upgrade(o)), tip: { title: 'Upgrade to level ' + (o.lvl + 1), text: 'Half again as strong per level.', lines: NS.buildMenu.costLines(up, b.data.stock, B.wallet()) } });
      }
    }
    if ((o.inf || 0) > 0.01) {
      const p = row(96);
      btn('steril', p.x, p.y, 96, 32, { icon: 'serum', label: 'Sterilise', sub: 'kills some crew', px: 12, color: '#9ae04a',
        action: () => { const k = B.sterilize(o); NS.command.say(k ? 'Sterilised - ' + k + ' crew lost' : 'Sterilised', '#9ae04a'); } });
    }
    if ((o.cor || 0) > 0.01 || o.rogue) {
      const p = row(96);
      btn('purge', p.x, p.y, 96, 32, { icon: 'glitch', label: 'Purge', sub: '1 circuit', px: 12, color: '#3affd0', disabled: !b.data.stock.comp.circuit,
        action: () => { if (!B.purge(o)) NS.command.say('A purge needs a circuit in stock', '#ff6a5c'); } });
    }
    if (o.type !== 'hub') {
      let p = row(42);
      btn('quar', p.x, p.y, 42, 32, { icon: 'quarantine', color: o.quarantine ? UI.bad : UI.textDim, on: o.quarantine, action: () => B.quarantine(o),
        tip: { title: o.quarantine ? 'Lift quarantine' : 'Quarantine', text: 'Cut the building from the link network: infection and nanoprobes cannot travel through it - but neither can power.' } });
      p = row(42);
      btn('demo', p.x, p.y, 42, 32, { icon: 'demolish', color: UI.bad, action: () => { B.demolish(o); G.cmd.selB = null; },
        tip: { title: 'Demolish (Delete)', text: 'Half the cost comes back.' } });
    }
  }

  function recipeText(r) {
    const parts = [];
    for (const id in r.bar) parts.push(r.bar[id] + ' ' + ORE_BY_ID[id].bar);
    for (const id in r.comp) parts.push(r.comp[id] + ' ' + COMP_BY_ID[id].name);
    return parts.join(' + ') + '  ->  1 ' + COMP_BY_ID[r.out].name + ' (' + r.time + 's)';
  }

  function info(o, def, b) {
    if (def.deposit) {
      const d = C.depositUnder(o, b.deps);
      return d ? 'Extracting ' + ORE_BY_ID[d.res].name + ' - one every ' + (def.rate / C.levelMul(o.lvl)).toFixed(1) + 's at full speed' : 'No deposit';
    }
    if (o.type === 'smelter' || o.type === 'refinery') return o._idle ? 'Waiting for 3 ore it can take - ' + (o.type === 'smelter' ? 'bulk ore or scrap' : 'precious ore, gas, crystal, bio-matter')
      : 'Smelting 3 ore into one bar every ' + (def.rate / C.levelMul(o.lvl)).toFixed(1) + 's';
    if (o.type === 'fabricator') return o._making ? 'Making ' + COMP_BY_ID[RECIPE_BY_ID[o._making].out].name : 'Idle - no bars for any recipe';
    if (o.type === 'fusion') return G.base.fuel[o.id] === false ? 'NO FUEL - needs hydrogen or helium-3' : 'Burning gas - ' + Math.round(C.buildingPower(o, b.zone, G.stats, true)) + ' power';
    if (o.type === 'shield') return 'Dome ' + Math.round(o._shield || 0) + ' / ' + Math.round(def.cap * C.levelMul(o.lvl) * G.stats.shieldMul);
    if (o.type === 'hub') return 'Crew ' + b.data.crew + ' / ' + C.housing(b.data) + '  -  storage ' + C.stockCount(b.data.stock) + ' / ' + C.storageCap(b.data, G.stats) + '  -  value ' + NS.kit.group(b.value);
    if (def.makes) return 'Right-click the map to set a rally point';
    return def.desc;
  }

  function units(a, sel) {
    const btn = NS.commandHud.btn;
    const counts = {};
    for (let i = 0; i < sel.length; ++i) counts[sel[i].type] = (counts[sel[i].type] || 0) + 1;
    if (sel.length === 1) {
      const u = sel[0];
      K().blitRot(ctx, NS.fleetArt.unit(u.type), a.x + 38, a.y + 36, -Math.PI / 2, 1.6);
      kit.text(u.def.name, a.x + 74, a.y + 22, 17, '#ffffff', { weight: 'bold' });
      kit.text(VET_NAMES[u.rank] + '  -  ' + u.kills + ' kills' + (u.rank < 3 ? '  (' + VET_KILLS[u.rank + 1] + ' for next rank)' : ''), a.x + 74, a.y + 42, 12, UI.gold);
      kit.bar(a.x + 74, a.y + 54, a.w - 90, 7, u.hp / u.maxHp, UI.good);
      kit.fitText(u.def.role, a.x + 14, a.y + 78, a.w - 28, 12, { color: UI.textDim });
    } else {
      kit.text(sel.length + ' units selected', a.x + 14, a.y + 18, 15, '#ffffff', { weight: 'bold' });
      let x = a.x + 14;
      for (let i = 0; i < UNITS.length; ++i) {
        const t = UNITS[i];
        if (!counts[t.id]) continue;
        btn('only_' + t.id, x, a.y + 32, 52, 44, { icon: t.icon, sub: 'x' + counts[t.id], color: t.color,
          action: () => NS.command.select(sel.filter(u => u.type === t.id), false), tip: { title: t.name, text: 'Keep only these selected (double-click a unit selects all of its type in view).' } });
        x += 56;
      }
    }
    const fy = a.y + 96;
    kit.text('FORMATION', a.x + 14, fy, 10, UI.textMute, { weight: 'bold' });
    for (let i = 0; i < FORMATIONS.length; ++i) {
      const f = FORMATIONS[i];
      btn('form_' + f.id, a.x + 14 + i * 48, fy + 8, 44, 32, { icon: f.icon, color: UI.cyan, on: G.cmd.form === f.id, action: () => NS.command.setFormation(f.id),
        tip: { title: f.name + ' (' + f.key + ')', text: 'Units take slots around the target, facing the way they travel, at the slowest member\'s speed.' } });
    }
    const oy = fy + 46;
    const P = NS.command;
    const orders = [
      ['amove', 'attack', 'Attack', 'F', () => { G.cmd.pending = 'amove'; P.say('Right-click where to attack-move'); }, 'Attack-move: engage everything on the way'],
      ['patrol', 'patrol', 'Patrol', 'Q', () => { G.cmd.pending = 'patrol'; P.say('Right-click the far end of the patrol'); }, 'Patrol between here and a point, fighting what comes'],
      ['escort', 'escort', 'Escort', 'E', () => P.order('escort', 0, 0, G.ship, false), 'Form up on your ship and follow it'],
      ['return', 'home', 'Return', 'R', () => P.order('return', 0, 0, null, false), 'Back to the command hub'],
      ['hold', 'hold', 'Hold', 'G', () => P.hold(), 'Stop and hold position'],
    ];
    for (let i = 0; i < orders.length; ++i) {
      const o = orders[i];
      btn('ord_' + o[0], a.x + 14 + i * 74, oy, 70, 32, { icon: o[1], label: o[2], sub: o[3], px: 11, color: i === 0 ? UI.bad : UI.accent, on: G.cmd.pending === o[0],
        action: o[4], tip: { title: o[2] + ' (' + o[3] + ')', text: o[5] + '. Right-click orders a move; Shift queues waypoints.' } });
    }
    if (sel.length === 1) return;
    kit.fitText(sel.some(u => u.type === 'miner') ? 'Right-click a rock to mine it' : 'Right-click: invader attacks, ship escorts', a.x + a.w - 14, fy, 190, 10, { color: UI.textMute, align: 'right' });
  }

  function K() {
    return NS.artKit;
  }

  function idle(a) {
    const b = G.base;
    kit.text('COMMAND', a.x + 14, a.y + 20, 13, UI.accent, { weight: 'bold' });
    const lines = [
      'Left click / drag: select units or a building',
      'Double-click: every unit of that type in view',
      'Right click: move, attack, escort, mine, rally',
      'Shift + right click: queue a waypoint',
      'Ctrl+1-9 make a group, 1-9 recall it, Ctrl+A all combat',
      'Z X C V: line, wedge, box, circle formation',
      'WASD / arrows pan, wheel zooms, Space pauses',
    ];
    for (let i = 0; i < lines.length; ++i) kit.text(lines[i], a.x + 14, a.y + 44 + i * 20, 12, UI.textDim);
    if (b && NS.base.claimed()) kit.text('Units ' + NS.units.count('player') + '  -  value ' + NS.kit.group(b.value), a.x + a.w - 14, a.y + 20, 11, UI.textDim, { align: 'right' });
  }

  Object.assign(NS.selPanel, {
    PW, PH, area, draw
  });
})();
