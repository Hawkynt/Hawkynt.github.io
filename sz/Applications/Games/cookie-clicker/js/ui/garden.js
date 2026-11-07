/* The Sugar Garden screen: the plot on the left (grown plants sway, ripe ones sparkle, hover
   shows growth and bonus), the seed log on the right (known seeds to pick, sprouted-but-unknown
   ones as silhouettes, the rest as question marks with a hint of their parents once seen), the
   selected seed's details, the four soils, a shovel, Harvest All and the garden's bonus total.
   Click an empty plot to plant, a ripe plant to harvest, right-click (or the shovel) to pull. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const { UI, TAU } = NS.constants;
  const K = NS.artKit;
  const kit = NS.kit;
  const W = NS.widgets;
  const fmt = NS.format;
  const GD = NS.gardenData;
  const { PLANTS, BY_ID, SOILS, RARITY } = GD;
  const { ctx } = NS.view;

  let shovel = false;
  let hoverPlot = -1;

  function open(ret) {
    G.ui.panelReturn = ret || 'game';
    shovel = false;
    NS.screens.setScreen('garden');
  }

  function grid() {
    const n = NS.garden.size();
    const t = Math.min(92, Math.floor(552 / n));
    const w = t * n;
    return { n: n, t: t, x: 40 + (600 - w) / 2, y: 104 + (552 - w) / 2 };
  }

  function plotCenter(i) {
    const gr = grid();
    return { x: gr.x + (i % 6) * gr.t + gr.t / 2, y: gr.y + Math.floor(i / 6) * gr.t + gr.t / 2 };
  }

  function clickPlot(i, alt) {
    const g = G.profile.garden;
    const pl = g.plots[i];
    const c = plotCenter(i);
    if (!pl) {
      if (alt) return;
      if (NS.garden.plant(i)) NS.fx.burst(c.x, c.y + 20, 12, ['#8a6a40', '#c09a60', '#7be08a'], 'crumbs', 140, 300, 4);
      else if (G.run.cookies < NS.garden.plantCost(g.seed)) NS.screens.toast('Not enough treats to plant ' + BY_ID[g.seed].name, UI.bad, 'cookie');
      return;
    }
    const ripe = NS.garden.isMature(pl);
    if (!ripe && !alt && !shovel) {
      const e = NS.garden.eta(pl);
      NS.screens.toast(BY_ID[pl.p].name + ' ripens in ' + fmt.duration(e.ripe * 60) + ' - right-click or use the shovel to pull it', UI.textDim, 'leaf');
      return;
    }
    const r = NS.garden.harvest(i, alt || shovel);
    if (!r) return;
    const col = RARITY[r.plant.rarity];
    if (r.kind === 'harvest') {
      NS.fx.burst(c.x, c.y, r.learned ? 50 : 22, [r.plant.color, '#ffffff', col], r.learned ? 'stars' : 'spark', r.learned ? 420 : 240, 160, 5);
      NS.fx.ring(c.x, c.y, 8, r.learned ? 160 : 90, 0.8, col, 4);
      if (r.reward.length) NS.fx.text(c.x, c.y - 30, r.reward.join('  '), '#ffffff', 18, 1.6);
      if (r.learned) {
        NS.fx.flash(0.35, col);
        NS.fx.shake(6);
        NS.screens.toast('New seed: ' + r.plant.name + ' (' + r.plant.rarity + ')!', col, 'leaf');
      }
    } else NS.fx.burst(c.x, c.y + 20, 10, ['#6a4a30', '#9a7a50'], 'crumbs', 160, 300, 4);
  }

  function onEvents(events) {
    for (let i = 0; i < events.length; ++i) {
      const e = events[i];
      const c = plotCenter(e.i);
      if (e.kind === 'sprout') {
        NS.fx.burst(c.x, c.y, e.plant.weed ? 6 : 26, [RARITY[e.plant.rarity], '#ffffff'], 'stars', 220, 60, 4);
        NS.fx.ring(c.x, c.y, 6, 70, 0.8, RARITY[e.plant.rarity], 3);
      } else if (e.kind === 'ripe') NS.fx.burst(c.x, c.y - 10, 10, [e.plant.color, '#fff4c0'], 'spark', 120, 40, 3);
    }
  }

  function draw() {
    const p = G.profile;
    const g = p.garden;
    G.ui.gardenHover = null;
    kit.text('SUGAR GARDEN', 40, 42, 34, '#ffffff', { weight: 'bold', shadow: true });
    const nk = NS.garden.knownCount();
    kit.text(nk + ' / ' + PLANTS.length + ' seeds known  -  the plot grows with every four seeds  -  one garden tick per minute, also while you are away', 40, 76, 14, UI.textDim);
    drawPlot(g);
    drawLog(g);
    drawDetails(g);
    drawTools(g);
    W.button('back', G.ui.panelReturn === 'title' ? 'Back to the title' : 'Back to the bakery', 40, 664, 280, 44, { icon: 'back', accent: UI.good, action: () => NS.screens.back() });
    drawHover(g);
  }

  function drawPlot(g) {
    const gr = grid();
    const tile = NS.gardenArt.soilTile(g.soil);
    const S = NS.gardenArt.SIZE;
    kit.panel(gr.x - 14, gr.y - 14, gr.t * gr.n + 28, gr.t * gr.n + 28, { radius: 16, accent: '#7be08a' });
    hoverPlot = -1;
    for (let yy = 0; yy < gr.n; ++yy)
      for (let xx = 0; xx < gr.n; ++xx) {
        const i = yy * 6 + xx;
        const x = gr.x + xx * gr.t, y = gr.y + yy * gr.t;
        const hot = W.area('plot' + i, x, y, gr.t, gr.t, () => clickPlot(i, false), { alt: () => clickPlot(i, true), nonav: false });
        ctx.drawImage(tile, x, y, gr.t, gr.t);
        if (hot) {
          hoverPlot = i;
          ctx.fillStyle = 'rgba(255,240,200,0.14)';
          ctx.fillRect(x + 4, y + 4, gr.t - 8, gr.t - 8);
        }
        const pl = g.plots[i];
        if (!pl || !BY_ID[pl.p]) {
          if (hot && !shovel) {
            ctx.globalAlpha = 0.35;
            ctx.drawImage(NS.gardenArt.plant(g.seed, 3), x, y, gr.t, gr.t);
            ctx.globalAlpha = 1;
          }
          continue;
        }
        const ph = NS.gardenArt.phaseOf(pl);
        const def = BY_ID[pl.p];
        if (ph === 3) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.28 + Math.sin(G.time * 3 + i) * 0.08;
          K.blit(ctx, K.glow(RARITY[def.rarity]), x + gr.t / 2, y + gr.t * 0.55, gr.t / 120);
          ctx.restore();
        }
        const sway = ph >= 2 ? Math.sin(G.time * 1.6 + i * 1.7) * 0.05 : 0;
        ctx.save();
        ctx.translate(x + gr.t / 2, y + gr.t - 6 * gr.t / S);
        ctx.rotate(sway);
        ctx.drawImage(NS.gardenArt.plant(pl.p, ph), -gr.t / 2, -gr.t + 6 * gr.t / S, gr.t, gr.t);
        ctx.restore();
        /* growth ring */
        const f = Math.min(1, pl.age / def.grow);
        if (f < 1) {
          ctx.strokeStyle = 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.arc(x + gr.t - 14, y + 14, 8, 0, TAU); ctx.stroke();
          ctx.strokeStyle = '#7be08a';
          ctx.beginPath(); ctx.arc(x + gr.t - 14, y + 14, 8, -Math.PI / 2, -Math.PI / 2 + f * TAU); ctx.stroke();
        } else {
          const life = 1 - (pl.age - def.grow) / def.life;
          if (life < 0.2) kit.icon('zzz', x + gr.t - 14, y + 14, 12, '#ffb45a');
          else if (Math.sin(G.time * 4 + i * 2) > 0.7) kit.icon('sparkle', x + gr.t - 16 + Math.sin(i) * 6, y + 16, 12, '#fff4c0');
        }
      }
  }

  function drawLog(g) {
    const x0 = 690, y0 = 104, cw = 140, ch = 50, cols = 4;
    kit.text('SEED LOG', x0, y0 - 8, 15, UI.gold, { weight: 'bold' });
    for (let i = 0; i < PLANTS.length; ++i) {
      const d = PLANTS[i];
      const x = x0 + (i % cols) * (cw + 6), y = y0 + Math.floor(i / cols) * (ch + 6);
      const known = !!g.known[d.id], seen = !!g.sprouted[d.id];
      const sel = g.seed === d.id && !shovel;
      const plantable = known && !d.weed;
      const hot = W.area('seed' + i, x, y, cw, ch, plantable ? () => { shovel = false; NS.garden.selectSeed(d.id); } : null, { disabled: !plantable });
      kit.panel(x, y, cw, ch, { radius: 10, accent: sel ? UI.gold : known ? RARITY[d.rarity] : '#4a3a30', glow: sel || hot, alpha: known ? 1 : 0.6,
        top: sel ? 'rgba(110,70,30,0.97)' : undefined });
      if (known || seen) {
        ctx.save();
        if (!known) ctx.globalAlpha = 0.35;
        ctx.drawImage(NS.gardenArt.plant(d.id, 3), x + 2, y + 2, ch - 4, ch - 4);
        ctx.restore();
      } else kit.text('?', x + 25, y + ch / 2 + 1, 24, '#8a7a70', { align: 'center', weight: 'bold' });
      kit.fitText(known ? d.name : seen ? '??? (sprouted)' : '???', x + ch, y + 18, cw - ch - 6, 13, { weight: 'bold', color: known ? '#ffffff' : UI.textMute });
      kit.fitText(known ? (d.weed ? 'weed' : fmt.short(NS.garden.plantCost(d.id))) : d.rarity, x + ch, y + 36, cw - ch - 6, 11, { color: known ? (d.weed ? UI.bad : UI.textDim) : RARITY[d.rarity] });
      if (hot) G.ui.gardenHover = { seed: d.id, known: known, seen: seen };
    }
  }

  function effectText(e, k) {
    const v = e.v * (e.v > 0 ? k : 1);
    if (e.k === 'prod') return (v > 0 ? '+' : '') + Math.round(v * 1000) / 10 + '% production';
    if (e.k === 'click') return '+' + Math.round(v * 1000) / 10 + '% click power';
    if (e.k === 'goldenFreq') return '+' + Math.round(v * 1000) / 10 + '% golden treat frequency';
    if (e.k === 'goldenDur') return '+' + Math.round(v * 1000) / 10 + '% golden buff duration';
    return '+' + Math.round(v) + ' combo cap';
  }

  function harvestText(h) {
    const out = [];
    if (h.cps) out.push(h.cps + ' min of production');
    if (h.notes) out.push(h.notes + ' recipe note' + (h.notes > 1 ? 's' : ''));
    if (h.golden) out.push('a golden treat effect');
    if (h.crystals) out.push(h.crystals + ' sugar crystal');
    return out.join(' + ');
  }

  function drawDetails(g) {
    const x = 690, y = 398, w = 570, h = 132;
    const id = (G.ui.gardenHover && G.ui.gardenHover.seed) || g.seed;
    const d = BY_ID[id];
    const known = !!g.known[id];
    const so = NS.garden.soil();
    kit.panel(x, y, w, h, { accent: RARITY[d.rarity] });
    if (!known) {
      kit.text('Unknown seed  -  ' + d.rarity, x + 18, y + 26, 17, RARITY[d.rarity], { weight: 'bold' });
      const r = NS.garden.recipeOf(id);
      const seen = !!g.sprouted[id];
      kit.wrap(seen ? 'It has sprouted in your garden. Let it ripen and harvest it to learn the seed.' :
        r ? 'Grows between two ripe parents: ' + (g.known[r.parents[0]] ? BY_ID[r.parents[0]].name : '???') + ' and ' + (g.known[r.parents[1]] ? BY_ID[r.parents[1]].name : '???') + '.' : 'Creeps into empty plots on its own.',
      x + 18, y + 56, w - 36, 14, UI.textDim);
      return;
    }
    ctx.drawImage(NS.gardenArt.plant(id, 3), x + 8, y + 18, 96, 96);
    kit.text(d.name, x + 112, y + 24, 19, '#ffffff', { weight: 'bold' });
    kit.text(d.rarity.toUpperCase(), x + w - 16, y + 24, 12, RARITY[d.rarity], { weight: 'bold', align: 'right' });
    kit.fitText(d.desc, x + 112, y + 48, w - 128, 13, { color: UI.textDim });
    kit.text('While ripe: ' + effectText(d.effect, so.effect), x + 112, y + 72, 14, d.effect.v < 0 ? UI.bad : UI.good, { weight: 'bold' });
    kit.text('Harvest: ' + harvestText(d.harvest), x + 112, y + 94, 13, UI.notes);
    const gm = Math.ceil(d.grow / so.grow), lm = Math.ceil(d.life / so.grow);
    kit.text('Ripens in ' + fmt.duration(gm * 60) + ', stays ripe ' + fmt.duration(lm * 60) + (d.weed ? '' : '  -  plant for ' + fmt.short(NS.garden.plantCost(id))), x + 112, y + 116, 12, UI.textMute);
  }

  function drawTools(g) {
    const x = 690, y = 542;
    for (let i = 0; i < SOILS.length; ++i) {
      const so = SOILS[i];
      W.button('soil' + i, so.name, x + i * 144, y, 138, 40, { px: 13, selected: g.soil === so.id, sub: undefined, action: () => NS.garden.setSoil(so.id) });
    }
    const so = NS.garden.soil();
    kit.fitText(so.desc, x, y + 56, 570, 13, { color: UI.textDim });
    W.button('shovel', shovel ? 'Shovel (on)' : 'Shovel', x, y + 72, 180, 44, { icon: 'back', selected: shovel, action: () => { shovel = !shovel; } });
    let ripe = 0;
    for (let i = 0; i < 36; ++i) if (NS.garden.inside(g, i) && NS.garden.isMature(g.plots[i])) ++ripe;
    W.button('harvestall', 'Harvest all ripe' + (ripe ? ' (' + ripe + ')' : ''), x + 190, y + 72, 200, 44, { icon: 'leaf', accent: UI.good, disabled: !ripe, action: () => {
      for (let i = 0; i < 36; ++i) if (NS.garden.inside(g, i) && NS.garden.isMature(g.plots[i])) clickPlot(i, false);
    } });
    const e = NS.garden.effects();
    const parts = [];
    if (e.prod) parts.push((e.prod > 0 ? '+' : '') + Math.round(e.prod * 1000) / 10 + '% prod');
    if (e.click) parts.push('+' + Math.round(e.click * 1000) / 10 + '% click');
    if (e.goldenFreq) parts.push('+' + Math.round(e.goldenFreq * 1000) / 10 + '% golden');
    if (e.goldenDur) parts.push('+' + Math.round(e.goldenDur * 1000) / 10 + '% buffs');
    if (e.comboCap) parts.push('+' + e.comboCap + ' combo');
    kit.panel(x + 400, y + 72, 170, 44, { radius: 10, accent: '#7be08a' });
    kit.fitText('Garden bonus', x + 485, y + 86, 160, 11, { color: UI.textDim, align: 'center' });
    kit.fitText(parts.length ? parts.join(', ') : 'none yet', x + 485, y + 104, 160, 12, { color: '#ffffff', weight: 'bold', align: 'center' });
  }

  function drawHover(g) {
    if (hoverPlot < 0) return;
    const pl = g.plots[hoverPlot];
    if (!pl || !BY_ID[pl.p]) return;
    const d = BY_ID[pl.p];
    const c = plotCenter(hoverPlot);
    const e = NS.garden.eta(pl);
    const known = !!g.known[d.id];
    const ripe = NS.garden.isMature(pl);
    const lines = [ripe ? 'Ripe - click to harvest' + (e.wither <= 3 ? ' (withers soon!)' : ', withers in ' + fmt.duration(e.wither * 60)) : 'Ripens in ' + fmt.duration(e.ripe * 60)];
    if (known) lines.push((ripe ? '' : 'When ripe: ') + effectText(d.effect, NS.garden.soil().effect));
    const w = 300, h = 40 + lines.length * 18;
    const x = Math.min(c.x + 40, 1240 - w), y = Math.max(20, c.y - h / 2);
    kit.panel(x, y, w, h, { radius: 10, accent: RARITY[d.rarity], glow: true });
    kit.text(known ? d.name : '??? (unknown ' + d.rarity + ')', x + 14, y + 20, 15, RARITY[d.rarity], { weight: 'bold' });
    for (let i = 0; i < lines.length; ++i) kit.fitText(lines[i], x + 14, y + 42 + i * 18, w - 28, 13, { color: '#ffffff' });
  }

  Object.assign(NS.gardenUi, { open, grid, plotCenter, clickPlot, onEvents, draw, get shovel() { return shovel; }, set shovel(v) { shovel = !!v; } });
})();
