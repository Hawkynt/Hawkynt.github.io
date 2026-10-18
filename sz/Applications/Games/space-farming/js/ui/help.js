/* Space Farming - the illustrated How to play pages.
   Reads: G.uiTime, G.helpPage */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceFarming || (SZ.SpaceFarming = {});
  const G = NS.state;
  const { TWO_PI, ctx, drawSprite, uiFont, fitText, drawTextBlock, UI, roundRectPath, addRegion, drawButton,
    openDialog, closeDialog, beginDialog, endDialog } = NS;

  /* ── Help ── */

  const HELP_PAGES = [
    { icon: 'seedbag', title: 'Welcome, farmer!', strip: [['wheat', 'Plant'], ['basket', 'Harvest'], ['coin', 'Sell'], ['techtree', 'Upgrade']],
      text: 'Your little farm sits on an alien planet. Plant seeds, harvest what grows, sell it for credits and turn those credits into a thriving space farm.\n\nPick a crop in the dock at the bottom (or press 1-9, 0), then click empty soil. Drag across the field to plant or harvest a whole area at once.' },
    { icon: 'coin', title: 'Harvest & sell', strip: [['basket', 'Storage'], ['coin', 'Sell all'], ['market', 'Market']],
      text: 'Ripe crops glow and sparkle. Click them to harvest; the produce flies into your storage. Storage is limited, so sell regularly with S, or open the market with M to sell single crops.\n\nPrices drift every minute: a green ▲ in the dock means a crop sells above its normal price, a red ▼ below.' },
    { icon: 'flask', title: 'Soil & terrain', strip: [['soil', 'Nutrients'], ['drop', 'Water'], ['hoe', 'Hoe'], ['rockpile', 'Rock']],
      text: 'Every plot has its own nutrients: the pips under empty plots show them (one pip per 30%), pale dusty soil is poor and dark soil is rich. Press N to colour every plot by its nutrients.\n\nNo crop grows on rock, but buildings can stand on it, or break it up with the Hoe (T) for 25 credits. The hoe also enriches soil beside water and turns sand into farmland.' },
    { icon: 'map', title: 'More land', strip: [['map', 'Expand'], ['coin', 'Pay'], ['wheat', 'Plant']],
      text: 'The field grows one strip at a time. The glowing + beside the field marks where the next strip goes: hover it to see the price, click it (or press E) to buy it. Strips are added west, east, north and south in turn, and every one costs a bit more.\n\nThe same upgrade is Expand Field in the Engineering branch of the tech tree.' },
    { icon: 'hammer', title: 'Buildings', strip: [['sprinkler', 'Water'], ['greenhouse', 'Shelter'], ['silo', 'Store'], ['harvester', 'Harvest'], ['turbine', 'Power']],
      text: 'Press B for the build dock. Sprinklers and wind turbines speed up crops around them, greenhouses shield them from weather, silos add storage, harvesters and planters work on their own.\n\nClick a building to inspect, upgrade (up to level 6) or remove it. Right-click upgrades directly, Shift+right-click removes.' },
    { icon: 'paw', title: 'Livestock', strip: [['hen', 'Eggs'], ['goat', 'Wool'], ['cow', 'Milk'], ['bee', 'Honey']],
      text: 'Animals live in pens around the field. Press L to buy them. When their produce is ready a bubble pops up: click the pen to collect it. Auto-collectors next to the pens do this for you, and star bees make nearby crops grow faster.' },
    { icon: 'storm', title: 'Weather', strip: [['rain', 'Rain'], ['flare', 'Flare'], ['storm', 'Storm'], ['meteor', 'Meteors'], ['snow', 'Snow'], ['dust', 'Dust']],
      text: 'Rain and solar flares make crops grow faster, snow and dust storms slow them down. Meteors and lightning hit real spots on the farm and can destroy crops that no greenhouse protects.\n\nVoid mushrooms ignore the weather, plasma peppers hate meteors, astral flowers and solar vines love the sun.' },
    { icon: 'spring', title: 'Seasons & day', strip: [['spring', 'Spring'], ['sun', 'Summer'], ['autumn', 'Autumn'], ['winter', 'Winter']],
      text: 'A day lasts 30 seconds and a season four days. Spring and summer speed up growth, autumn gives bigger harvests, winter slows everything down.\n\nEvery crop loves one season and grows 30% faster in it: look for the season badge in the dock. Lunar moss only grows at night, solar vines only by day or under a grow lamp.' },
    { icon: 'target', title: 'Goals & orders', strip: [['target', 'Goals'], ['order', 'Orders'], ['market', 'Market']],
      text: 'The Goals & orders panel shows your next milestone; reaching it pays a credit reward.\n\nTraders also post orders for a batch of produce. Orders pay far more than the market, but they expire after a few days: click an order to deliver it, or open the market with M.' },
    { icon: 'mouse', title: 'Pests & energy', strip: [['mouse', 'Mice'], ['scarecrow', 'Scare'], ['fence', 'Block'], ['zapper', 'Zap'], ['bolt', 'Energy']],
      text: 'Space mice sneak in from the edges and eat crops. Click a mouse to chase it off for a reward; scarecrows, fences and pest zappers keep them out.\n\nEnergy powers harvesters and drones. Solar panels charge by day, wind turbines at night and in storms.' },
    { icon: 'techtree', title: 'Tech tree', strip: [['growth', 'Crops'], ['paw', 'Animals'], ['hammer', 'Build'], ['flask', 'Science'], ['coin', 'Trade']],
      text: 'Press U for the tech tree. Its five branches improve crops, animals, buildings, science and trade, and unlock new crops, animals and buildings. Upgrades cost credits and produce, so keep some harvest in storage.\n\nThe Next upgrades panel always shows the best next step of every branch: click a row to buy it straight away.' },
    { icon: 'book', title: 'Controls', keys: [
      ['Click', 'Plant, harvest, collect, inspect'], ['Drag', 'Plant or harvest an area'],
      ['Right-drag', 'Pan the view'], ['Wheel  + −', 'Zoom'],
      ['Right-click', 'Upgrade building'], ['Shift+Right', 'Remove building'],
      ['←↑→↓  Space', 'Tile cursor and act'], ['Home', 'Fit the farm'],
      ['1-9  0', 'Pick crop or building'], ['P  B  T', 'Seeds, build, hoe'],
      ['S  M', 'Sell all, market'], ['L  U', 'Animals, tech tree'],
      ['N  E', 'Nutrients, expand field'], ['H', 'This help'], ['Esc  F2', 'Pause, new farm']
    ] }
  ];

  function drawHelpDialog() {
    const c = beginDialog('How to play', 660, 470, { icon: 'book', accent: UI.accent, titleRight: `${G.helpPage + 1} / ${HELP_PAGES.length}` });
    const page = HELP_PAGES[G.helpPage];
    roundRectPath(c.x, c.y, 96, 96, 14);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,184,255,0.35)';
    ctx.stroke();
    drawSprite(page.icon, c.x + 48, c.y + 48 + Math.sin(G.uiTime * 2) * 2, 64);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    fitText(page.title, c.x + 112, c.y + 20, c.w - 112, 22, { weight: 'bold', color: UI.gold });
    const bottom = c.y + c.h - 52;
    if (page.keys) {
      // two columns of keycaps with their actions
      const colW = (c.w - 112) / 2, rowH = Math.min(30, (bottom - c.y - 46) / Math.ceil(page.keys.length / 2));
      page.keys.forEach(([key, label], i) => {
        const x = c.x + 112 + (i % 2) * colW, y = c.y + 50 + Math.floor(i / 2) * rowH;
        ctx.font = uiFont(11, 'bold');
        const kw = Math.min(colW * 0.45, ctx.measureText(key).width + 14);
        roundRectPath(x, y - 10, kw, 20, 5);
        ctx.fillStyle = 'rgba(20,26,42,0.9)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(170,190,230,0.35)';
        ctx.stroke();
        ctx.textAlign = 'center';
        fitText(key, x + kw / 2, y + 1, kw - 8, 11, { weight: 'bold', color: '#dfe6f5' });
        ctx.textAlign = 'left';
        fitText(label, x + kw + 8, y + 1, colW - kw - 16, 13, { color: UI.text });
      });
    } else {
      const stripH = page.strip ? 64 : 0;
      drawTextBlock(page.text, c.x + 112, c.y + 42, c.w - 112, bottom - c.y - 42 - stripH, 14, { color: UI.text, lineGap: 1.4 });
      if (page.strip) {
        const n = page.strip.length, gap = 10;
        const w = Math.min(84, (c.w - 112 - gap * (n - 1)) / n);
        const x0 = c.x + 112;
        page.strip.forEach(([icon, label], i) => {
          const x = x0 + i * (w + gap), y = bottom - stripH + 4;
          roundRectPath(x, y, w, stripH - 8, 10);
          ctx.fillStyle = 'rgba(255,255,255,0.05)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.1)';
          ctx.stroke();
          drawSprite(icon, x + w / 2, y + 20 + Math.sin(G.uiTime * 2.5 + i) * 1.5, 28);
          ctx.textAlign = 'center';
          fitText(label, x + w / 2, y + stripH - 18, w - 8, 11, { weight: 'bold', color: UI.textDim });
        });
      }
    }
    // Page dots
    const dotsW = HELP_PAGES.length * 14;
    for (let i = 0; i < HELP_PAGES.length; ++i) {
      const dx = c.x + c.w / 2 - dotsW / 2 + i * 14 + 7, dy = c.y + c.h - 24;
      ctx.beginPath();
      ctx.arc(dx, dy, i === G.helpPage ? 4.5 : 3, 0, TWO_PI);
      ctx.fillStyle = i === G.helpPage ? UI.gold : 'rgba(255,255,255,0.25)';
      ctx.fill();
      addRegion({ id: 'help-dot-' + i, x: dx - 7, y: dy - 9, w: 14, h: 18, modal: true, onClick: () => { G.helpPage = i; SZ.GameAudio.play('click'); }, tip: () => [HELP_PAGES[i].title] });
    }
    const by = c.y + c.h - 40;
    drawButton({ id: 'help-prev', x: c.x, y: by, w: 110, h: 32 }, { label: '‹ Back', px: 13, disabled: G.helpPage === 0, onClick: () => { G.helpPage = Math.max(0, G.helpPage - 1); SZ.GameAudio.play('click'); } });
    const last = G.helpPage >= HELP_PAGES.length - 1;
    drawButton({ id: 'help-next', x: c.x + c.w - 110, y: by, w: 110, h: 32 }, { label: last ? 'Done' : 'Next ›', primary: true, px: 13, onClick: () => helpNext() });
    endDialog();
  }

  function helpNext() {
    if (G.helpPage >= HELP_PAGES.length - 1)
      closeDialog();
    else {
      ++G.helpPage;
      SZ.GameAudio.play('click');
    }
  }

  function openHelp(page) {
    G.helpPage = page || 0;
    openDialog('help');
  }

  Object.assign(NS, { drawHelpDialog, helpNext, openHelp });

})();
