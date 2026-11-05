/* The title screen: a live demo cave played by the autopilot behind the logo (cycling through
   the five depths), the main menu (Continue with what it resumes, Story, Arcade, Zen, Daily
   Cave, Time Attack, then Tech Tree, Wardrobe, Journal, How to Play), and cards for the current
   seasonal event, the play streak and today's quests. Owns G.demo. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.BoulderDash || (SZ.BoulderDash = {});
  const C = NS.constants;
  const G = NS.state;
  const P = NS.progression;
  const M = NS.meta;
  const kit = NS.kit;
  const CA = NS.creatureArt;
  const K = NS.artKit;
  const scr = NS.screens;
  const { ctx, visible } = NS.view;
  const UI = C.UI;

  const DEMO_THEMES = ['amber', 'frost', 'grotto', 'magma', 'crystal'];
  let demoIndex = 0;

  function newDemo() {
    const ch = demoIndex % 5;
    const p = NS.levels.caveParams(ch, 3, NS.rng.hash('demo' + demoIndex + G.today), {});
    p.w = 40; p.h = 22;
    p.tokens = G.season ? 2 : 0;
    p.dark = NS.story.THEMES[DEMO_THEMES[ch]].dark * 0.5;
    const cv = NS.levels.build(p);
    cv.perks = G.perks;
    cv.zen = true;
    G.demo = { params: p, cave: cv, t: 0 };
    ++demoIndex;
  }

  function updateDemo(dt) {
    if (!G.demo) newDemo();
    const d = G.demo, cv = d.cave;
    d.t += dt;
    const it = cv.player.moveT >= cv.playerPeriod - 1 ? NS.bot.decide(cv) : { dir: -1 };
    NS.sim.stepCave(cv, it);
    NS.fx.state.silent = true;
    NS.fx.onEvents(cv, cv.events, null);
    NS.fx.state.silent = false;
    cv.events.length = 0;
    if (cv.won && d.wonT === undefined) d.wonT = d.t;
    if ((d.wonT !== undefined && d.t - d.wonT > 2) || d.t > 75) { NS.fx.reset(); newDemo(); }
  }

  function continueLabel() {
    const snap = NS.save.readRun();
    if (!snap) return null;
    const r = snap.run;
    const mode = M.MODES[r.mode] ? M.MODES[r.mode].name : r.mode;
    if (r.mode === 'story') return mode + ' - ' + NS.story.CHAPTERS[r.ch].levels[r.lv];
    return mode + ' - cave ' + r.n + ' - ' + r.score + ' pts';
  }

  function draw(dt) {
    if (!G.demo) newDemo();
    const v = visible();
    const theme = DEMO_THEMES[(demoIndex + 4) % 5];
    NS.world.draw(G.demo.cave, theme, dt, false, G.save.skin);
    NS.backdrop.drawAmbient(theme, dt, 50);
    /* readable left column */
    const g = ctx.createLinearGradient(v.x0, 0, v.x0 + 560, 0);
    g.addColorStop(0, 'rgba(10,6,4,0.88)'); g.addColorStop(0.75, 'rgba(10,6,4,0.55)'); g.addColorStop(1, 'rgba(10,6,4,0)');
    ctx.fillStyle = g;
    ctx.fillRect(v.x0, v.y0, 560 + (0 - v.x0), v.h);
    const bob = Math.sin(G.time * 1.6) * 4;
    const s = G.season;
    if (s) {
      /* a seasonal wash over the scene and a ribbon under the logo */
      const wash = ctx.createLinearGradient(0, v.y0, 0, v.y1);
      wash.addColorStop(0, K.rgba(s.color2, 0.16)); wash.addColorStop(1, K.rgba(s.color, 0.06));
      ctx.fillStyle = wash;
      ctx.fillRect(v.x0, v.y0, v.w, v.h);
      ctx.drawImage(NS.backdrop.garland(s), 160, 30 + bob * 0.5, 280, 60);
    }
    kit.drawLogo(300, 108 + bob, 0.68);
    if (s) {
      kit.panel(150, 172, 300, 28, { accent: s.color, radius: 14, rivets: false, glow: true });
      ctx.drawImage(CA.icon(s.id), 160, 174, 24, 24);
      kit.fitText(s.name + ' is on!', 310, 186, 240, 15, { align: 'center', weight: 'bold', color: s.color });
    } else kit.text('Five depths. One light to bring home.', 300, 186, 16, UI.dim, { align: 'center' });

    let y = 214;
    const x = 70, w = 460;
    const cont = continueLabel();
    if (cont) {
      kit.button('Continue', x, y, w, 56, () => scr.continueRun(), { accent: '#7dff8a', sub: cont, size: 22 });
      y += 64;
    }
    const modes = ['story', 'arcade', 'zen', 'daily', 'time'];
    const subs = {
      story: P.starsTotal(G.save) + ' / 120 stars',
      arcade: 'Best ' + (G.save.high.arcade[0] ? G.save.high.arcade[0].score : 0),
      zen: 'No clock, no creatures',
      daily: P.dailyModifier(G.today).name + (G.save.high.daily[G.today] ? ' - best ' + G.save.high.daily[G.today] : ''),
      time: 'Best ' + (G.save.high.time[0] ? G.save.high.time[0].score : 0)
    };
    for (let k = 0; k < modes.length; ++k) {
      const m = modes[k], def = M.MODES[m];
      const col = k % 2, row = Math.floor(k / 2);
      const bw = k === 4 ? w : (w - 10) / 2;
      kit.button(def.name, x + col * (bw + 10), y + row * 58, bw, 50, () => scr.startMode(m), { accent: def.color, sub: subs[m], size: 20 });
    }
    y += 3 * 58 + 6;
    const small = [['Tech Tree', 'tree'], ['Wardrobe', 'wardrobe'], ['Journal', 'journal'], ['How to Play', 'help']];
    const sw = (w - 30) / 4;
    for (let k = 0; k < small.length; ++k)
      kit.button(small[k][0], x + k * (sw + 10), y, sw, 40, () => scr.openOverlay(small[k][1]), { size: 15 });
    kit.goldLabel(x + 4, y + 66, G.save.gold, 20);
    const tree = Object.keys(G.save.tree).length;
    kit.text(tree ? tree + ' upgrades owned' : 'Spend gold in the Tech Tree', x + 140, y + 66, 13, UI.dim);
    drawCards(v);
  }

  function drawCards(v) {
    const w = 330, x = v.x1 - w - 24;
    let y = v.y0 + 24;
    const s = G.season;
    if (s) {
      kit.panel(x, y, w, 132, { accent: s.color, glow: true });
      ctx.drawImage(CA.icon(s.id), x + 16, y + 16, 40, 40);
      kit.text(s.name, x + 66, y + 28, 20, s.color, { weight: 'bold' });
      kit.text('Seasonal event - find ' + s.token + 's', x + 66, y + 50, 13, UI.dim);
      const tier = M.TRACK.find((t) => G.save.season.tokens < t.need);
      const have = G.save.season.tokens;
      if (tier) {
        kit.bar(x + 16, y + 76, w - 32, 12, have / tier.need, s.color);
        kit.text(have + ' / ' + tier.need + ' tokens to the next reward', x + 16, y + 104, 13, UI.text);
      } else kit.text('Event track complete!', x + 16, y + 90, 15, UI.good, { weight: 'bold' });
      y += 146;
    }
    const q = G.save.quests.list;
    kit.panel(x, y, w, 64 + q.length * 30, { accent: '#5fd6ff' });
    kit.text('Daily quests', x + 16, y + 22, 18, '#5fd6ff', { weight: 'bold' });
    kit.text('Streak ' + G.save.streak.count + ' day' + (G.save.streak.count === 1 ? '' : 's'), x + w - 16, y + 22, 14, UI.gold, { align: 'right', weight: 'bold' });
    for (let k = 0; k < q.length; ++k) {
      const qq = q[k], yy = y + 50 + k * 30;
      kit.fitText(P.questText(qq), x + 16, yy, 190, 14, { color: qq.done ? UI.good : UI.text });
      kit.bar(x + 214, yy - 5, 70, 9, qq.progress / qq.target, qq.done ? '#7dff8a' : '#5fd6ff');
      kit.text(qq.claimed ? 'ok' : String(qq.gold), x + w - 16, yy, 13, qq.claimed ? UI.good : UI.gold, { align: 'right' });
    }
  }

  Object.assign(NS.title, { draw, updateDemo, newDemo });
})();
