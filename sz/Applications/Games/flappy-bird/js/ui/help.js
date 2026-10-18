;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.FlappyBird;

  /* Help pages. Owns HELP_PAGES and reads G.helpPage. */

  const { CANVAS_W, CANVAS_H } = NS.C;
  const { ctx, ui } = NS.services;
  const G = NS.state;
  const View = NS.view;

  const HELP_PAGES = [
    {
      title: 'Flying',
      lines: [
        'Space, click or tap to flap.',
        'Hold the flap while falling to glide, once Glide is learned.',
        'Steer through the gaps between the pipes.',
        'The pipes move and close — watch the openings.',
        'Esc pauses the run.'
      ]
    },
    {
      title: 'Coins & combos',
      lines: [
        'Coins pay for Nest upgrades and Aviary birds.',
        'A pass through the middle of a gap is PERFECT and builds the combo.',
        'Combo 5, 10 and 20 multiply coins x2, x3 and x4.',
        'A close shave past a pipe pays a bonus coin.',
        'A hit breaks the combo — the Combo Keeper can save it.'
      ]
    },
    {
      title: 'Power-ups',
      bubbles: ['shield', 'magnet', 'slow', 'ghost', 'double', 'tiny'],
      lines: [
        'Shield — eats the next hit.',
        'Magnet — pulls coins in for a while.',
        'Slow-mo — the whole world slows down.',
        'Ghost — pass through everything but the ground.',
        'Double coins — every coin pays twice.',
        'Tiny — the bird and its hitbox shrink.'
      ]
    },
    {
      title: 'Modes',
      lines: [
        'Adventure stars: finish the stage, collect 60% of the coins, take no hits.',
        'Classic medals: Bronze 10, Silver 25, Gold 50, Platinum 100.',
        'Time Attack: 60 seconds on the clock, every hit costs 3 seconds.',
        'Daily Run: the same course for everyone today.'
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
    for (let i = 0; i < page.lines.length; ++i) {
      if (page.bubbles) {
        ctx.save();
        ctx.translate(px + 100, ly);
        ctx.scale(0.55, 0.55);
        View.sceneFor('meadow').drawBubble(ctx, page.bubbles[i], 0, 0, G.globalTime);
        ctx.restore();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ui.fitText(page.lines[i], px + 150, ly, pw - 270, 20, { color: ui.UI.text });
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
