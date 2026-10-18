;(function() {
  'use strict';

  /* The four help pages with their illustrations. Owns G.helpPage. */

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookingGame || (SZ.CookingGame = {});
  const G = NS.state;
  const { HELP_PAGES } = NS.C;
  const { ctx, ui } = NS.view;
  const { sfx } = NS.juice;
  const { bubbleSprite, trashSprite } = NS.sprites;
  const { drawButton, drawMenuBackdrop } = NS.menu;

  function helpLines(px, py, lines) {
    for (let i = 0; i < lines.length; ++i) {
      const y = py + i * 96;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ui.fitText(lines[i][0], px, y, 560, 21, { weight: 'bold', color: ui.UI.gold, outline: 'rgba(30,10,0,0.7)' });
      ui.drawTextBlock(lines[i][1], px, y + 14, 560, 60, 15, { color: ui.UI.text });
    }
  }

  function drawHelp() {
    drawMenuBackdrop('diner', 0.6);
    const pw = 1000, ph = 560, px = 140, py = 74;
    ui.drawPanel(px, py, pw, ph, { title: 'Help · ' + HELP_PAGES[G.helpPage], accent: '#ffd23f', titlePx: 22, headerH: 40 });
    for (let i = 0; i < HELP_PAGES.length; ++i) {
      ui.roundRectPath(px + pw - 120 + i * 24, py + 15, 14, 14, 7);
      ctx.fillStyle = i === G.helpPage ? '#ffd23f' : 'rgba(0,0,0,0.45)';
      ctx.fill();
    }

    const ix = px + pw - 250;
    if (G.helpPage === 0) {
      helpLines(px + 40, py + 92, [
        ['Take the order', 'Click a seated customer, or the bubble over their head, to take the order. A ticket appears in the rail above the kitchen.'],
        ['Patience ring', 'The ring around the bubble drains as they wait: green, then yellow, then red. At zero they walk out and your combo breaks.'],
        ['Moods', 'Happy guests tip well, impatient ones start tapping their fingers, angry ones leave a mark on the day.'],
      ]);
      ui.drawPanel(ix - 40, py + 70, 260, 400, { style: 'chalk', radius: 8 });
      SZ.PeopleArt.drawCustomer(ctx, G.titleLooks[0], ix + 90, py + 360, 'sit', G.animT, 1);
      const bx = ix + 90, by = py + 190;
      ctx.drawImage(bubbleSprite(), bx - 48, by - 48, 96, 104);
      SZ.FoodArt.drawDish(ctx, 'burger', bx, by + 2, 56, 1, 'good');
      ctx.strokeStyle = '#5ad04a';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(bx, by, 34, -Math.PI / 2, -Math.PI / 2 + (0.5 + 0.5 * Math.sin(G.animT)) * Math.PI * 2);
      ctx.stroke();
      ctx.lineCap = 'butt';
      const moods = ['happy', 'ok', 'impatient', 'angry'];
      for (let i = 0; i < moods.length; ++i)
        SZ.PeopleArt.drawMood(ctx, ix + 6 + i * 56, py + 420, moods[i], 34);
    } else if (G.helpPage === 1) {
      helpLines(px + 40, py + 92, [
        ['Tickets move themselves', 'Once an order is taken, its ticket walks through the stations on its own and waits at each one.'],
        ['Catch the green', 'Click a station, or press 1-5, when its needle is inside the green zone for a perfect step.'],
        ['Red burns', 'Let the needle run into the red field and the step burns — a burnt or raw step ruins the dish.'],
        ['Second slots', 'Kitchen upgrades add a second grill, burner, prep board and oven so two steps can run at once.'],
      ]);
      ui.drawPanel(ix - 40, py + 70, 260, 400, { style: 'chalk', radius: 8 });
      const sp = (0.5 + 0.5 * Math.sin(G.animT * 2));
      const prog = 0.55 + 0.25 * sp;
      SZ.FoodArt.drawStation(ctx, 'grill', ix + 15, py + 170, prog > 0.6 && prog < 0.8 ? 'ready' : 'working', G.animT, 'burger', prog);
      SZ.FoodArt.drawStationFx(ctx, 'grill', ix + 15, py + 170, 'working', G.animT, prog);
      const bw = 150, bx = ix + 15, by = py + 340;
      ui.roundRectPath(bx, by, bw, 12, 6);
      ctx.fillStyle = '#0a0604';
      ctx.fill();
      ctx.fillStyle = 'rgba(80,230,100,0.7)';
      ctx.fillRect(bx + 0.55 * bw / 1.25, by, 0.25 * bw / 1.25, 12);
      ctx.fillStyle = '#c8281e';
      ctx.fillRect(bx + bw / 1.25, by, 0.25 * bw / 1.25, 12);
      const nx = bx + prog * bw / 1.25;
      ctx.fillStyle = '#b8ffb0';
      ctx.fillRect(nx - 2, by - 4, 4, 20);
      ui.drawKeycap('1', bx, by + 26, 12);
    } else if (G.helpPage === 2) {
      helpLines(px + 40, py + 92, [
        ['Serve from the pass', 'Finished dishes land on the pass. Click one to carry it to the guest waiting for that dish.'],
        ['Combo', 'Perfect dishes build a combo multiplier on the tips; a walkout or a ruined serve resets it.'],
        ['Trash', 'Click the bin to toss a ruined dish before it reaches a guest.'],
        ['Waiter', 'The Waiter upgrade carries finished dishes to waiting guests by itself.'],
      ]);
      ui.drawPanel(ix - 40, py + 70, 260, 400, { style: 'chalk', radius: 8 });
      SZ.FoodArt.drawDish(ctx, 'pasta', ix + 30, py + 190, 90, 1, 'perfect');
      ctx.drawImage(trashSprite(), ix + 120, py + 160, 56, 63);
      SZ.PeopleArt.drawChef(ctx, ix + 90, py + 430, 'cheer', G.animT);
    } else {
      helpLines(px + 40, py + 92, [
        ['Career', 'Thirty days across five venues. Earn at least one star to unlock the next day; a full venue of stars opens the next. Stars land at $-goal thresholds.'],
        ['Endless Rush', 'Serve until three walkouts or three ruined dishes. The venue rotates and the clock tightens every eight guests; your best run is kept.'],
        ['Daily Special', 'One seeded menu per day — the same kitchen, guests and orders for everyone, twenty guests in.'],
        ['Kitchen tree', 'Coins from every day buy upgrades in five branches: Stations, Gear, Service, Charm and Pantry. They carry into every mode.'],
      ]);
    }

    if (G.helpPage > 0)
      drawButton('help-prev', '←', px + 24, py + ph - 66, 90, 46, { px: 22, color: 'wood', action: () => { G.helpPage = Math.max(0, G.helpPage - 1); sfx('click', { volume: 0.4 }); } });
    if (G.helpPage < HELP_PAGES.length - 1)
      drawButton('help-next', '→', px + pw - 114, py + ph - 66, 90, 46, { px: 22, color: 'orange', action: () => { G.helpPage = Math.min(HELP_PAGES.length - 1, G.helpPage + 1); sfx('click', { volume: 0.4 }); } });
    ui.drawKeyHints([
      { key: '←→', label: 'Pages' },
      { key: 'Esc', label: 'Back' },
    ], 640, 690, 900, 1);
  }

  NS.helpScreen = { drawHelp };

})();
