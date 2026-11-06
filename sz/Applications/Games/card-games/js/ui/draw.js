/* Frame composition: the table across the whole window (bleeding into the
   letterbox bars), the lobby or the active variant, moving cards, particles,
   floating texts, the table buttons, overlays, cinematics and the style panel. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const CE = SZ.CardEngine;
  const K = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  const A = NS.animations;
  const PA = NS.paint;
  const FX = NS.fx;
  const DR = NS.draw = NS.draw || {};

  const W = K.CANVAS_W, H = K.CANVAS_H;
  let time = 0;

  /* ── table buttons ── */
  DR.drawMenuButton = function() {
    const btn = (r, label, on) => CE.drawButton(D.ctx, r.x, r.y, r.w, r.h, label,
      { bg: on ? '#2f6a32' : '#3a3226', border: 'rgba(214,170,80,0.75)', fontSize: 11, textColor: '#fff4d6' });
    if (SZ.CardThemes) btn(K.STYLE_BTN, '✿ Style', false);
    if (S.activeVariantModule?.sortPlayerHand)
      btn(K.SORT_BTN, (S.autoSortHand ? '✔' : '☐') + ' Sort', S.autoSortHand);
    btn(K.HINT_BTN, (S.hintsEnabled ? '✔' : '☐') + ' Hints', S.hintsEnabled);
    btn(K.MENU_BTN, '☰ Lobby', false);
  };

  function dim(alpha) {
    const ext = D.extent();
    D.ctx.fillStyle = 'rgba(0,0,0,' + alpha + ')';
    D.ctx.fillRect(ext.x, ext.y, ext.w, ext.h);
  }

  DR.drawPauseOverlay = function() {
    dim(0.6);
    PA.panel(D.ctx, W / 2 - 170, H / 2 - 70, 340, 130, { radius: 14 });
    PA.goldText(D.ctx, 'Paused', W / 2, H / 2 - 20, 40);
    PA.text(D.ctx, 'Press Escape to resume', W / 2, H / 2 + 28, 14, '#e8dcc0', { weight: 'normal' });
  };

  DR.drawGameOverOverlay = function() {
    if (NS.scenes && NS.scenes.active()) return;
    if (NS.outcomes && NS.outcomes.busy()) return;
    dim(0.45);
    const over = S.state === K.STATE_GAME_OVER;
    PA.panel(D.ctx, W / 2 - 180, H / 2 - 80, 360, 150, { radius: 14 });
    PA.goldText(D.ctx, over ? 'Game Over' : 'Round Complete', W / 2, H / 2 - 36, 32);
    PA.text(D.ctx, 'Score ' + S.score, W / 2, H / 2 + 6, 18, '#ffd54f');
    D.ctx.save();
    D.ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4);
    PA.text(D.ctx, over ? 'Click to return to the lobby' : 'Click to deal the next round', W / 2, H / 2 + 40, 13, '#e8dcc0', { weight: 'normal' });
    D.ctx.restore();
  };

  /* the table spans the full visible extent so it bleeds into the bars */
  DR.drawTable = function() {
    const ext = D.extent();
    const CT = SZ.CardThemes;
    const theme = CT && (CT.TABLE_THEMES[CT.activeTheme.table] || CT.TABLE_THEMES.green);
    D.ctx.save();
    D.ctx.translate(ext.x, ext.y);
    if (theme) theme.draw(D.ctx, ext.w, ext.h);
    else {
      D.ctx.fillStyle = '#1b5a24';
      D.ctx.fillRect(0, 0, ext.w, ext.h);
    }
    D.ctx.restore();
  };

  /* full-board fills by a variant (backgrounds, dim layers) cover the bars too */
  function runVariantDraw() {
    const ctx = D.ctx;
    const ext = D.extent();
    const fillRect = ctx.fillRect;
    const fillText = ctx.fillText;
    const scan = NS.outcomes ? NS.outcomes.scanText : null;
    ctx.fillRect = function(x, y, w, h) {
      if (x <= 0 && y <= 0 && x + w >= W && y + h >= H)
        return fillRect.call(this, ext.x, ext.y, ext.w, ext.h);
      return fillRect.call(this, x, y, w, h);
    };
    if (scan && S.state === K.STATE_PLAYING)
      ctx.fillText = function(t, x, y, mw) {
        scan(t);
        return mw === undefined ? fillText.call(this, t, x, y) : fillText.call(this, t, x, y, mw);
      };
    try {
      S.activeVariantModule.draw(ctx, W, H);
    } finally {
      delete ctx.fillRect;
      delete ctx.fillText;
      if (ctx.fillRect !== fillRect) ctx.fillRect = fillRect;
      if (ctx.fillText !== fillText) ctx.fillText = fillText;
    }
  }

  DR.update = function(dt) {
    time += dt;
  };

  DR.draw = function() {
    const ctx = D.ctx;
    D.applyBoard();
    DR.drawTable();
    const ext = D.extent();

    if (S.state === K.STATE_MENU) {
      NS.lobby.draw(ctx);
      FX.draw(ctx);
    } else {
      E.screenShake.apply(ctx);
      const titleOnly = NS.scenes && NS.scenes.active() && NS.scenes.active().type === 'title';
      if (S.activeVariantModule && !titleOnly)
        runVariantDraw();
      CE.flushFlyingCards();

      A.drawDealAnimations();
      A.drawGlowEffects();
      if (SZ.CardThemes) SZ.CardThemes.drawShimmers(ctx);
      E.particles.draw(ctx);
      FX.draw(ctx);
      E.floatingText.draw(ctx);
      E.screenShake.restore(ctx);

      if (S.state === K.STATE_PLAYING) DR.drawMenuButton();
      if (S.state === K.STATE_PAUSED) DR.drawPauseOverlay();
      if (S.state === K.STATE_ROUND_OVER || S.state === K.STATE_GAME_OVER) DR.drawGameOverOverlay();
    }

    if (NS.scenes) NS.scenes.draw(ctx, ext);
    if (SZ.CardThemes) SZ.CardThemes.drawSettingsPanel(ctx, W, H);
  };
})();
