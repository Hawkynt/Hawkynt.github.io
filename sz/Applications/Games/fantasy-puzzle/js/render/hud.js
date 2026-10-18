/* The in-level HUD: realm and level panel, mana and casts, chips, the element bar, key hints, the
   Grimoire button and the hint banner. Owns G.elementButtons, G.grimoireChip. */
;(function() {
  'use strict';

  const SZ = window.SZ;
  const NS = SZ.FantasyPuzzle || (SZ.FantasyPuzzle = {});
  const G = NS.state;
  const { VIEW_W, HINT_BANNER_Y, HINT_BANNER_H, ELEMENTS } = NS.consts;
  const { ctx, ui, Fx } = NS.context;
  const { treeLevel } = NS.grimoire;
  const { levelList, realmInfo, realmElements } = NS.session;
  const { drawLock } = NS.widgets;

  const BAR_Y = 646, BAR_BTN = 64, BAR_GAP = 12;
  const HUD_CHIP_Y = 16, HUD_CHIP_H = 28, HUD_CHIP_GAP = 12, HUD_RIGHT = 1240;

  // the width drawChip gives this text, so chips can be placed side by side
  function chipWidth(text, h, px) {
    ctx.font = ui.uiFont(px || Math.round(h * 0.62), 'bold');
    return Math.ceil(ctx.measureText(text).width) + h * 0.8;
  }

  function drawManaCrystals(cx, cy, total, left) {
    const gap = Math.min(15, 150 / Math.max(1, total));
    const s = Math.min(6.5, gap * 0.45);
    const x0 = cx - (total - 1) * gap / 2;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < left; ++i) {
      ctx.globalAlpha = 0.45 + 0.15 * Math.sin(G.time * 3 + i * 0.7);
      ctx.drawImage(Fx.sprite('glow', '#3a9aff'), x0 + i * gap - 12, cy - 12, 24, 24);
    }
    ctx.restore();
    for (let i = 0; i < total; ++i) {
      const x = x0 + i * gap;
      ctx.beginPath();
      ctx.moveTo(x, cy - s);
      ctx.lineTo(x + s * 0.7, cy);
      ctx.lineTo(x, cy + s);
      ctx.lineTo(x - s * 0.7, cy);
      ctx.closePath();
      if (i < left) {
        ctx.fillStyle = '#7ac8ff';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#e8f8ff';
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  function drawHUD() {
    const realm = realmInfo();
    const list = levelList(G.levelKind);

    /* top-left: realm and level */
    ui.drawPanel(32, 14, 330, 62, {
      title: realm.name,
      titlePx: 15,
      titleRight: `${G.levelIndex + 1} / ${list.length}`,
      accent: realm.color
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ui.fitText(G.level.name, 44, 58, 306, 17, { weight: 'bold', color: ui.UI.text });
    if (G.sessionMode === 'daily')
      ui.drawChip('Daily', 374, 20, 26, { align: 'left', px: 13, color: ui.UI.gold, bg: 'rgba(255,215,90,0.12)', border: ui.hexToRgba(ui.UI.gold, 0.5) });

    /* top-centre: mana and casts; the Oracle reveals the par */
    const oracle = treeLevel('i_oracle') > 0;
    ctx.textBaseline = 'middle';
    ui.drawPanel(462, 8, 356, 66, { accent: '#5ab8ff', radius: 12 });
    ui.drawChip(`${G.mana} / ${G.manaTotal}`, 560, 16, 28, { align: 'center', color: G.mana > 0 ? '#8fd0ff' : ui.UI.bad, border: 'rgba(90,184,255,0.35)' });
    drawManaCrystals(560, 56, G.manaTotal, G.mana);
    ui.drawChip(`Casts ${G.casts} / ${oracle ? G.level.par : '?'}`, 730, 16, 28, { align: 'center', color: G.casts <= G.level.par ? ui.UI.text : ui.UI.warn });
    if (oracle && G.hintFx) {
      /* the Oracle names the next optimal element while a hint glows */
      ctx.textAlign = 'right';
      ui.fitText('Next', 850, 56, 60, 12, { color: ui.UI.textMute });
      SZ.PuzzleScene.drawElementIcon(ctx, G.hintFx.action.element, 880, 56, 26, true);
    }

    /* top-right: three separate chips, each measured to its own text and laid
       out right to left with a fixed gap, the row ending at x 1240 */
    const chips = [
      { text: `Hints ${G.hintsLeft}`, color: G.hintsLeft > 0 ? '#e0c88f' : ui.UI.warn },
      { text: `Undos ${G.undosLeft === Infinity ? '∞' : G.undosLeft}`, color: '#6fe08a' },
      { text: `Runes ${G.puzzle.runes.size} / ${SZ.PuzzleCore.totalRunes(G.puzzle)}`, color: '#e0a8ff' }
    ];
    let chipRight = HUD_RIGHT;
    for (let i = chips.length - 1; i >= 0; --i) {
      const w = chipWidth(chips[i].text, HUD_CHIP_H);
      ui.drawChip(chips[i].text, chipRight - w, HUD_CHIP_Y, HUD_CHIP_H, { color: chips[i].color });
      chipRight -= w + HUD_CHIP_GAP;
    }

    /* bottom: element bar */
    G.elementButtons = [];
    const total = ELEMENTS.length * BAR_BTN + (ELEMENTS.length - 1) * BAR_GAP;
    const x0 = (VIEW_W - total) / 2;
    for (let i = 0; i < ELEMENTS.length; ++i) {
      const el = ELEMENTS[i];
      const bx = x0 + i * (BAR_BTN + BAR_GAP);
      const enabled = realmElements().indexOf(el.id) >= 0;
      const selected = el.id === G.selectedElement;
      ctx.save();
      if (!enabled)
        ctx.globalAlpha = 0.35;
      if (selected) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= 0.55 + 0.15 * Math.sin(G.time * 3);
        ctx.drawImage(Fx.sprite('glow', el.color), bx - 34, BAR_Y - 34, BAR_BTN + 68, BAR_BTN + 68);
        ctx.restore();
      }
      ui.drawPanel(bx, BAR_Y, BAR_BTN, BAR_BTN, {
        radius: 10, noStuds: true, accent: el.color, glow: selected,
        top: selected ? 'rgba(60,46,96,0.96)' : 'rgba(26,22,44,0.94)', bottom: selected ? 'rgba(20,14,38,0.97)' : 'rgba(10,8,20,0.95)'
      });
      /* a freshly selected element's icon bounces from 1.25 down to 1 */
      let iconScale = 1;
      if (G.elementBounce && G.elementBounce.id === el.id) {
        const bk = (G.time - G.elementBounce.at) / 0.2;
        if (bk >= 0 && bk < 1)
          iconScale = 1.25 - 0.25 * bk;
      }
      SZ.PuzzleScene.drawElementIcon(ctx, el.id, bx + BAR_BTN / 2, BAR_Y + 26, 40 * iconScale, selected);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ui.fitText(el.name, bx + BAR_BTN / 2, BAR_Y + 54, BAR_BTN - 8, 10, { color: selected ? el.color : ui.UI.textDim });
      ui.drawKeycap(el.key, bx + 4, BAR_Y + 4, 9);
      if (!enabled)
        drawLock(bx + BAR_BTN / 2, BAR_Y + BAR_BTN / 2, 16);
      ctx.restore();
      G.elementButtons.push({ x: bx, y: BAR_Y, w: BAR_BTN, h: BAR_BTN, id: el.id });
    }

    /* bottom: key hints */
    ui.drawPanel(40, 664, 420, 30, { flat: true, noStuds: true, radius: 15, accent: '#e8c46a', top: 'rgba(12,8,24,0.72)', bottom: 'rgba(8,6,16,0.72)' });
    ui.drawKeyHints([
      { key: '1-4', label: 'element' },
      { key: 'Click', label: 'walk / cast' },
      { key: 'Z', label: 'undo' },
      { key: 'R', label: 'restart' },
      { key: 'H', label: 'hint' }
    ], 250, 678, 420, 1);

    /* Grimoire button: the tech tree is one click away during a level */
    G.grimoireChip = { x: 1060, y: 652, w: 190, h: 46 };
    const chipHot = G.mouseX >= G.grimoireChip.x && G.mouseX <= G.grimoireChip.x + G.grimoireChip.w && G.mouseY >= G.grimoireChip.y && G.mouseY <= G.grimoireChip.y + G.grimoireChip.h;
    ui.drawPanel(G.grimoireChip.x, G.grimoireChip.y, G.grimoireChip.w, G.grimoireChip.h, { radius: 12, noStuds: true, accent: chipHot ? ui.UI.gold : '#c04cff', glow: chipHot });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ui.fitText('Grimoire  ' + G.save.shards + ' \u2666', G.grimoireChip.x + G.grimoireChip.w / 2 - 10, G.grimoireChip.y + G.grimoireChip.h / 2 + 1, G.grimoireChip.w - 44, 17, { weight: 'bold', color: chipHot ? '#ffffff' : '#e0b8ff' });
    ui.drawKeycap('G', G.grimoireChip.x + G.grimoireChip.w - 28, G.grimoireChip.y + 13, 11);

    /* level hint banner: a slim strip above the board that fades out */
    if (G.hintBanner.t > 0 && G.hintBanner.text) {
      const alpha = Math.min(1, G.hintBanner.t / 0.8);
      const text = 'Hint: ' + G.hintBanner.text;
      const bw = ui.layoutLine(text, 520, 14, 11).width + 34;
      const bx = G.boardX + G.puzzle.cols * G.TS / 2;
      const by = HINT_BANNER_Y - HINT_BANNER_H / 2;
      ctx.save();
      ctx.globalAlpha = alpha;
      ui.drawPanel(bx - bw / 2, by, bw, HINT_BANNER_H, { accent: ui.UI.accent, noStuds: true, radius: 8 });
      ui.drawTextBlock(text, bx - bw / 2 + 14, by + 4, bw - 28, HINT_BANNER_H - 8, 14, { color: ui.UI.text, align: 'center', valign: 'middle' });
      ctx.restore();
    }
  }

  NS.hud = { drawHUD };
})();
