/* Application entry: the frame loop and the boot sequence. Loaded last. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;
  const S = NS.state;
  const D = NS.dom;
  const E = NS.effects;
  const A = NS.animations;
  const G = NS.game;
  const DR = NS.draw;
  const ME = NS.menu;

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  const CE = SZ.CardEngine;
  const FX = NS.fx;
  const SC = NS.scenes;
  const P = NS.profile;

  function gameLoop(timestamp) {
    const rawDt = S.lastTimestamp ? (timestamp - S.lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, K.MAX_DT);
    S.lastTimestamp = timestamp;

    CE.motion.beginFrame(dt);
    SC.update(dt);
    NS.outcomes.update(dt);
    if ((S.state === K.STATE_PLAYING || S.state === K.STATE_ROUND_OVER) && !SC.freezesGame()) {
      A.updateAnimations(dt);
      G.tickAi(dt);
      if (S.autoSortHand && S.activeVariantModule?.sortPlayerHand)
        S.activeVariantModule.sortPlayerHand();
      NS.host.hintTime += dt;
      if (SZ.CardThemes) SZ.CardThemes.updateShimmers(dt);
    }
    if (S.state === K.STATE_MENU) NS.lobby.update(dt);
    DR.update(dt);
    FX.update(dt);

    E.particles.update();
    E.screenShake.update(dt * 1000);
    E.floatingText.update();

    DR.draw();
    requestAnimationFrame(gameLoop);
  }

  /* profile events become toasts and the level-up medallion */
  const pendingUnlocks = [];
  P.on((ev) => {
    if (ev.type === 'achievement') SC.toast('Achievement: ' + ev.a.name, ev.a.desc + (ev.a.xp ? '  ·  +' + ev.a.xp + ' XP' : ''), ev.a.icon, '#ffd54f');
    else if (ev.type === 'unlock') { if (ev.cause === 'level') pendingUnlocks.push(ev.kind + ' "' + ev.name + '"'); SC.toast('New ' + ev.kind.toLowerCase(), ev.name + ' is ready in Table & Cards', '✿', '#9be7ff'); }
    else if (ev.type === 'level') SC.levelUp(ev.level, pendingUnlocks.splice(0));
    else if (ev.type === 'day' && ev.streak > 1) SC.toast('Day streak ' + ev.streak, 'Welcome back! Bonus XP for playing today', '♨', '#ffab40');
  });

  /* cards that fly far kick up a little felt dust */
  CE.motion.onLand = (x, y, w, h) => FX.dust(x, y, w, h);

  document.addEventListener('visibilitychange', () => { if (document.hidden) P.flush(); });

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  SZ.Dialog.wireAll();

  const menuBar = new SZ.MenuBar({
    onAction: ME.handleAction
  });

  D.setupCanvas();
  if (SZ.CardThemes) SZ.CardThemes.loadTheme();
  G.initGame();

  // In the status bar: a corner button would cover the variants' table buttons
  const statusBar = document.querySelector('.status-bar');
  const muteBtn = SZ.GameAudio.attachMuteButton(statusBar || undefined);
  if (statusBar)
    Object.assign(muteBtn.style, { position: 'static', marginLeft: 'auto', width: '18px', height: '16px', fontSize: '10px', lineHeight: '14px', borderRadius: '3px' });

  /* the intro plays once a day (any click or key skips it) */
  const d = P.data();
  if (d.seen.introDay !== P.today()) {
    d.seen.introDay = P.today();
    P.save();
    SC.intro();
  }

  S.lastTimestamp = 0;
  requestAnimationFrame(gameLoop);
})();
