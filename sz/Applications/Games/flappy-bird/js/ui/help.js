;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Help pages. Owns HELP_PAGES and reads G.helpPage. */

  const { CANVAS_W, CANVAS_H, POWER_BY_ID } = NS.C;
  const { ctx, ui } = NS.services;
  const G = NS.state;
  const View = NS.view;

  const HELP_PAGES = [
    {
      title: 'Flying',
      lines: [
        'Space, W, Up, click or tap to flap.',
        'Hold the flap while falling to glide, once Glide is learned in the Nest.',
        'Steer through the gaps. Pipes move, close, and carry lasers.',
        'Storm crows flash a red ! and then dive at the height you were at.',
        'Esc or the pause button pauses; the Nest and Wardrobe open from there too.'
      ]
    },
    {
      title: 'Coins, combos & FEVER',
      lines: [
        'Coins pay for Nest upgrades, birds, hats and trails.',
        'A pass through the middle of a gap is PERFECT and builds the combo.',
        'Combo 5, 10 and 20 multiply coins x2, x3 and x4.',
        'PERFECT passes fill the FEVER meter: full, it pays double for 6 seconds.',
        'A close shave past a pipe pays a bonus coin.'
      ]
    },
    {
      title: 'Power-ups (1 / 2)',
      bubbles: ['shield', 'magnet', 'slow', 'ghost', 'double', 'tiny'],
      lines: []
    },
    {
      title: 'Power-ups (2 / 2)',
      bubbles: ['blast', 'rush', 'heart', 'freeze', 'gold', 'buddy'],
      lines: []
    },
    {
      title: 'Story & bosses',
      lines: [
        'Corvus the Storm Crow scattered the six Season Feathers - bring them home.',
        'Every land ends in a boss arena: dodge the attacks, grab the sun orbs.',
        'Each sun orb you touch fires a bolt at the boss.',
        'Stars: finish the stage, collect 60% of its coins, take no hits.',
        'Beaten bosses wait for you again in Boss Rush.'
      ]
    },
    {
      title: 'Modes',
      lines: [
        'Classic: the original, with medals - Bronze 10, Silver 25, Gold 50, Platinum 100.',
        'Arcade: points x multiplier - clean pipes raise it, a hit resets it. Top 10 table.',
        'Zen: wide gaps and soft chimes. Nothing hurts. Esc ends the flight.',
        'Time Attack: 60 seconds, every hit costs 3. Daily Challenge: one course and one twist per day.',
        'Your run is saved all the time - Continue on the title picks it up again.'
      ]
    },
    {
      title: 'Every day & every season',
      lines: [
        'Three new daily quests every day, plus a featured challenge each week.',
        'Play on consecutive days for a growing streak bonus.',
        'Seasonal events change the scenery and hide tokens between the pipes.',
        'Tokens fill the event track: coins, a trail, a hat and a bird to keep.',
        'Achievements pay coins and unlock more of the wardrobe.'
      ]
    }
  ];

  function drawHelpScreen() {
    const pw = 900, ph = 520;
    const px = (CANVAS_W - pw) / 2, py = (CANVAS_H - ph) / 2;
    ui.drawPanel(px, py, pw, ph, { title: 'Help', titlePx: 20, titleRight: (G.helpPage + 1) + ' / ' + HELP_PAGES.length });
    const page = HELP_PAGES[G.helpPage];
    ui.drawHeadline(page.title, 640, py + 84, pw - 120, 36, ui.UI.gold);
    let ly = py + 150;
    const n = page.bubbles ? page.bubbles.length : page.lines.length;
    if (page.bubbles)
      for (let i = 0; i < n; ++i) {
        ctx.save();
        ctx.translate(px + 100, py + 150 + i * 52);
        ctx.scale(0.55, 0.55);
        View.sceneFor('meadow').drawBubble(ctx, page.bubbles[i], 0, 0, G.globalTime);
        ctx.restore();
      }
    for (let i = 0; i < n; ++i) {
      if (page.bubbles) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ui.fitText(POWER_BY_ID[page.bubbles[i]].name + ' - ' + POWER_BY_ID[page.bubbles[i]].desc, px + 150, ly, pw - 270, 20, { color: ui.UI.text });
      } else {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ui.fitText(page.lines[i], 640, ly, pw - 160, 20, { color: ui.UI.text });
      }
      ly += 52;
    }
    ui.drawKeyHints([
      { key: '←→', label: 'Page' },
      { key: 'Esc', label: 'Close' }
    ], 640, py + ph - 26, 500, 1.1);
  }

  Object.assign(NS.help, { drawHelpScreen, HELP_PAGES });
})();
