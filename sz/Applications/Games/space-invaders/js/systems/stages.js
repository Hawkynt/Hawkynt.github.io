/* Campaign stages and run results: armored rows, starting and finishing a stage, the run end payout.
   Owns G.stage*, G.runResult; writes G.save. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceInvaders || (SZ.SpaceInvaders = {});
  const G = NS.state;
  const { GAME_W, GAME_H } = NS.constants;
  const { ALIEN_TYPE_INFO, FORMATIONS } = NS.data;
  const { writeSave, todayKey } = NS.save;
  const { updateStatusBar } = NS.statusBar;
  const { playSfx } = NS.audio;
  const { maxSpecialCharges } = NS.progress;
  const { setBackdrop } = NS.backdrop;
  const { particles, floatingText } = NS.fx;
  const { calcMoveInterval } = NS.fleet;
  const { createWaveFromFormation, createShields, newGame, startBossPhase } = NS.waves;

  let bossStart = 0;

  function applyArmored(share) {
    if (!(share > 0) || G.aliens.length === 0) return;
    let lowestRow = 0;
    for (const a of G.aliens)
      if (a.row > lowestRow)
        lowestRow = a.row;
    const info = ALIEN_TYPE_INFO[6];
    for (const a of G.aliens) {
      if (a.row !== lowestRow || G.rand() >= share) continue;
      a.species = 6;
      a.points = info.points;
      a.color = info.color;
      a.typeIndex = Math.min(info.drawIndex, 2);
      a.hp = 2;
      a.isDiver = false;
    }
  }

  function startStage(index) {
    G.stageIndex = index;
    G.stageInfo = SZ.InvaderCampaign.STAGES[index];
    G.livesLost = 0;
    G.maxMultiplier = 1;
    G.stageResult = null;
    newGame('campaign', true);
    setBackdrop(G.stageInfo.theme);

    if (G.stageInfo.boss) {
      startBossPhase();
      bossStart = G.gameTime;
      const carried = G.save.carry && G.save.carry.stage === G.stageInfo.id ? Math.min(G.save.carry.charges, maxSpecialCharges()) : 0;
      if (carried > 0) {
        G.specialCharges = carried;
        floatingText.add(GAME_W / 2, GAME_H - 190, carried === 1 ? 'Special charge carried over' : carried + ' special charges carried over', { color: '#ffd23f', font: 'bold 24px sans-serif', decay: 0.008 });
      }
    } else {
      createWaveFromFormation(FORMATIONS[G.stageInfo.formation]);
      applyArmored(G.stageInfo.armored);
      createShields();
      G.alienMoveInterval = calcMoveInterval();
      G.alienShootInterval = 2000 / G.stageInfo.fire;
      G.waveNameText = G.stageInfo.id + ' · ' + G.stageInfo.name;
      G.waveNameTimer = 2000;
      G.gameState = 'playing';
    }

    updateStatusBar();
  }

  function finishStage() {
    const stars = SZ.InvaderCampaign.starsFor(G.stageInfo, {
      cleared: true,
      livesLost: G.livesLost,
      maxMultiplier: G.maxMultiplier,
      bossSeconds: (G.gameTime - bossStart) / 1000,
    });
    const id = G.stageInfo.id;
    G.save.stars[id] = Math.max(G.save.stars[id] || 0, stars);
    const credits = SZ.InvaderCampaign.creditsFor(G.score, G.stageInfo, stars);
    G.save.credits += credits;
    ++G.save.stats.runs;
    // charges built up right before a boss carry into that boss fight; beating the boss uses them up
    const nextInfo = SZ.InvaderCampaign.nextStage(id);
    if (nextInfo && nextInfo.boss)
      G.save.carry = { stage: nextInfo.id, charges: G.specialCharges };
    else if (G.stageInfo.boss && G.save.carry && G.save.carry.stage === id)
      G.save.carry = null;
    G.stageResult = { stars, credits, score: G.score, livesLost: G.livesLost, maxMultiplier: G.maxMultiplier };
    writeSave();
    G.gameState = 'stageClear';
    G.menuCursor = 0;
    G.sweep = 0.6;
    particles.confetti(GAME_W / 2, GAME_H * 0.4, 30);
    playSfx('win');
    G.stageStarBeats = 0;
    G.stageClearTime = G.gameTime;
  }

  /* Run end: credits from the score, per-mode best, stats — written once */
  function endRun() {
    const credits = SZ.InvaderCampaign.creditsFor(G.score, null, 0);
    G.save.credits += credits;
    ++G.save.stats.runs;

    let newBest = false;
    if (G.gameMode === 'daily') {
      const today = todayKey();
      if (G.save.best.daily.date !== today) {
        G.save.best.daily = { date: today, score: G.score };
        newBest = true;
      } else if (G.score > G.save.best.daily.score) {
        G.save.best.daily.score = G.score;
        newBest = true;
      }
    } else if (G.save.best[G.gameMode] !== undefined && G.score > G.save.best[G.gameMode]) {
      G.save.best[G.gameMode] = G.score;
      newBest = true;
    }

    if (G.gameMode === 'campaign')
      G.stageResult = { stars: 0, credits, score: G.score, livesLost: G.livesLost, maxMultiplier: G.maxMultiplier };
    G.runResult = { credits, newBest };
    writeSave();
  }

  Object.assign(NS.stages, {
    startStage, finishStage, endRun
  });
})();
