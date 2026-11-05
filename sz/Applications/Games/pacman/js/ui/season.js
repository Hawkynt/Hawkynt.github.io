/* The seasonal event screen: the running event (from the local date) with its days left, token
   count and the five-tier reward track (claimed, next, locked) including the event's own skin
   and trail; the year's event calendar; and this week's featured Arcade modifier, which can be
   switched on for the next Arcade run. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Pacman || (SZ.Pacman = {});
  const G = NS.state;
  const { UI } = NS.constants;
  const { SEASONS, SEASON_TRACK, SKIN_BY_ID } = NS.cosmetics;
  const K = NS.artKit;
  const AA = NS.actorArt;
  const IA = NS.itemArt;
  const kit = NS.kit;
  const W = NS.widgets;
  const scr = NS.screens;
  const SE = NS.seasons;
  const { ctx } = NS.view;

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function range(s) {
    return MONTHS[s.from[0] - 1] + ' ' + s.from[1] + ' - ' + MONTHS[s.to[0] - 1] + ' ' + (s.to[0] === 2 && s.to[1] === 29 ? 28 : s.to[1]);
  }

  function track(s) {
    const p = G.profile;
    const x = 40, y = 290, w = 1200, h = 190;
    kit.panel(x, y, w, h, { accent: s.color });
    kit.text('REWARD TRACK', x + 22, y + 24, 13, UI.textMute, { weight: 'bold' });
    const tier = SE.tierOf(p.season.tokens);
    const tw = (w - 80) / SEASON_TRACK.length;
    /* progress line */
    const prevNeed = (t) => (t === 0 ? 0 : SEASON_TRACK[t - 1]);
    let frac = 0;
    for (let t = 0; t < SEASON_TRACK.length; ++t) {
      if (p.season.tokens >= SEASON_TRACK[t]) frac = t + 1;
      else { frac = t + (p.season.tokens - prevNeed(t)) / (SEASON_TRACK[t] - prevNeed(t)); break; }
    }
    kit.bar(x + 40, y + 62, w - 80, 10, frac / SEASON_TRACK.length, s.color);
    for (let t = 0; t < SEASON_TRACK.length; ++t) {
      const cx = x + 40 + tw * (t + 1) - tw / 2;
      const got = t < tier;
      const r = s.rewards[t].split(':');
      kit.panel(cx - tw / 2 + 8, y + 86, tw - 16, 92, { accent: got ? UI.good : t === tier ? s.color : '#3a3a5a', glow: t === tier, radius: 10 });
      if (r[0] === 'skin') K.blitEx(ctx, AA.pac(r[1], 3), cx - 60, y + 128, 0, 1, 1);
      else if (r[0] === 'trail') kit.icon('star', cx - 60, y + 128, 30, s.color);
      else kit.icon('shard', cx - 60, y + 128, 30, UI.shard);
      kit.fitText(SE.rewardLabel(s, t), cx + 14, y + 116, tw - 110, 14, { align: 'center', weight: 'bold', color: got ? UI.good : '#ffffff' });
      kit.text(got ? 'Claimed' : SEASON_TRACK[t] + ' ' + s.tokenPlural, cx + 14, y + 142, 12, got ? UI.good : UI.textDim, { align: 'center' });
    }
  }

  function calendar(cur) {
    const x = 40, y = 494, w = 760, h = 146;
    kit.panel(x, y, w, h, { accent: UI.accent2 });
    kit.text('EVENTS THROUGH THE YEAR', x + 22, y + 22, 13, UI.textMute, { weight: 'bold' });
    for (let i = 0; i < SEASONS.length; ++i) {
      const s = SEASONS[i];
      const cx = x + 22 + (i % 3) * 246, cy = y + 56 + Math.floor(i / 3) * 50;
      K.blit(ctx, IA.token(s.token), cx + 14, cy, 0.7);
      kit.fitText(s.name, cx + 36, cy - 8, 200, 14, { weight: 'bold', color: s.id === cur.id ? s.color : UI.text });
      kit.text(range(s), cx + 36, cy + 10, 12, UI.textDim);
    }
  }

  function weekly() {
    const m = SE.weekly(G.date);
    const x = 820, y = 494, w = 420, h = 146;
    kit.panel(x, y, w, h, { accent: '#ff4ad8' });
    kit.text("THIS WEEK'S ARCADE TWIST", x + 22, y + 22, 13, UI.textMute, { weight: 'bold' });
    kit.text(m.name, x + 22, y + 52, 22, '#ff4ad8', { weight: 'bold' });
    kit.fitText(m.desc, x + 22, y + 78, w - 44, 14, { color: UI.text });
    W.button('weekly', G.ui.weeklyOn ? 'On for Arcade' : 'Off', x + 22, y + 96, 180, 38, {
      selected: !!G.ui.weeklyOn, px: 15, action: () => { G.ui.weeklyOn = !G.ui.weeklyOn; },
    });
  }

  function draw() {
    const v = NS.view.visible();
    const s = G.season;
    ctx.fillStyle = 'rgba(2,2,14,0.84)';
    ctx.fillRect(v.x0, v.y0, v.w, v.h);
    const p = G.profile;
    kit.panel(40, 30, 1200, 246, { accent: s.color, glow: true });
    K.blit(ctx, IA.token(s.token), 130, 150, 3.4 + Math.sin(G.time * 2) * 0.1);
    kit.text('SEASONAL EVENT', 240, 66, 14, UI.textMute, { weight: 'bold' });
    kit.text(s.name, 240, 106, 40, s.color, { weight: 'bold' });
    kit.text(range(s) + '  -  ' + SE.daysLeft(G.date) + ' days left', 240, 146, 16, UI.text);
    kit.wrap('Find ' + s.tokenPlural + ' hidden in every maze of every mode. Each one fills the track below - the event skin and trail are only available while it runs. The scenery and mazes wear the season\'s colours.', 240, 172, 640, 14, 20, UI.textDim);
    kit.text(String(p.season.tokens), 1150, 120, 60, s.color, { align: 'right', weight: 'bold' });
    kit.text(s.tokenName.toLowerCase() + 's found', 1150, 166, 14, UI.textDim, { align: 'right' });
    const skin = s.rewards.find(r => r.indexOf('skin:') === 0);
    if (skin) {
      const id = skin.split(':')[1];
      K.blitEx(ctx, AA.pac(id, AA.mouthIndex(G.time * 6)), 1000, 130, 0, 2.2, 2.2);
      kit.text(SKIN_BY_ID[id].name, 1000, 200, 13, UI.textDim, { align: 'center' });
    }
    track(s);
    calendar(s);
    weekly();
    W.button('back', 'Back', 40, 654, 240, 46, { icon: 'back', action: () => scr.back('seasonReturn') });
  }

  Object.assign(NS.season, {
    draw
  });
})();
