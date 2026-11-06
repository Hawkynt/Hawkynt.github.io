/* Clicking the treat: value from click power, click buffs and the combo, the combo counter
   with its window, the squash spring, crumb particles in the chosen style, floating +N texts,
   rising-pitch blips and the click statistics. Ghost Hands use the same path without combo. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const E = NS.economy;
  const { LAYOUT, UI } = NS.constants;
  const fmt = NS.format;
  const { sfx } = NS.audio;

  const STYLE_COLORS = {
    crumbs: ['#c8884a', '#a0622c', '#e8b070'], sprinkles: ['#ff5a8a', '#5ab4ff', '#ffd25a', '#7be08a', '#ffffff'],
    stars: ['#fff4b0', '#ffd25a', '#c8b0ff'], hearts: ['#ff5a8a', '#ff9ac0'], coins: ['#ffd25a', '#e8a62a'],
    snow: ['#ffffff', '#d8ecff'], petals: ['#ffc0d8', '#ffffff'], leaves: ['#e8782a', '#c8402a', '#e8b02a'],
    confetti: ['#ff5a8a', '#5ab4ff', '#ffd25a', '#7be08a', '#c08aff'],
  };

  /* fast clicks feed one growing number instead of a pile of texts */
  let lastText = null, lastSum = 0;
  /* one combo banner at a time: a new milestone replaces the old one in place */
  let comboText = null;

  function value(run, st) {
    return st.click * E.buffMult(run, 'click') * E.comboMult(run, st);
  }

  /* x, y: where on the plane (defaults to a random spot on the treat) */
  function click(auto, x, y) {
    const run = G.active();
    const st = G.st;
    const p = G.profile;
    if (x == null) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * LAYOUT.treatR * 0.6;
      x = LAYOUT.treatX + Math.cos(a) * r;
      y = LAYOUT.treatY + Math.sin(a) * r;
    }
    const prevCombo = run.combo;
    if (!auto) {
      run.combo = Math.min(st.comboCap, run.combo + 1);
      run.comboTimer = st.comboWindow;
      if (run.combo > run.bestCombo) run.bestCombo = run.combo;
      if (run.combo > p.stats.bestCombo) p.stats.bestCombo = Math.floor(run.combo);
      ++run.clicks;
      ++p.stats.clicks;
    }
    const v = value(run, st);
    NS.production.earn(run, v);
    p.stats.handmade += v;
    G.treatSquashV -= auto ? 2 : 5;
    const style = STYLE_COLORS[p.particle] ? p.particle : 'crumbs';
    NS.fx.burst(x, y, auto ? 2 : 5, STYLE_COLORS[style], style, auto ? 160 : 240);
    const big = E.buffMult(run, 'click') > 1;
    if (!auto && lastText && lastText.on && lastText.max - lastText.life < 0.22) {
      lastSum += v;
      lastText.text = '+' + fmt.short(lastSum);
      lastText.pop = 1;
      lastText.life = lastText.max - 0.05;
    } else if (!auto) {
      lastSum = v;
      lastText = NS.fx.text(x + (Math.random() - 0.5) * 30, y - 20, '+' + fmt.short(v), big ? '#7fd8ff' : '#ffffff', big ? 30 : 22);
    } else NS.fx.text(x + (Math.random() - 0.5) * 30, y - 20, '+' + fmt.short(v), UI.textDim, 16);
    if (!auto) {
      const c = Math.floor(run.combo);
      const crossed = c > 0 && c % 25 === 0 && Math.floor(prevCombo) < c;
      sfx('blip', { pitch: 0.8 + Math.min(1.4, c * 0.012), volume: 0.35 });
      if (crossed) {
        NS.fx.ring(LAYOUT.treatX, LAYOUT.treatY, LAYOUT.treatR, LAYOUT.treatR * 1.6, 0.5, UI.gold, 4);
        if (comboText && comboText.on && comboText.text.indexOf('COMBO') === 0) {
          comboText.text = 'COMBO x' + c;
          comboText.y = LAYOUT.treatY - LAYOUT.treatR - 30;
          comboText.vy = -70;
          comboText.life = comboText.max;
          comboText.pop = 1;
        } else comboText = NS.fx.text(LAYOUT.treatX, LAYOUT.treatY - LAYOUT.treatR - 30, 'COMBO x' + c, UI.gold, 34, 1.4);
        sfx('powerup', { volume: 0.5 });
        NS.fx.shake(4);
      }
      NS.progression.quest('clicks', 1);
      NS.progression.quest('combo', Math.floor(run.combo), true);
    }
  }

  /* the combo meter's fill 0..1 */
  function comboFill(run, st) {
    return st ? Math.min(1, run.combo / st.comboCap) : 0;
  }

  Object.assign(NS.clicking, { STYLE_COLORS, value, click, comboFill });
})();
