/* Win check and the win celebration / multi-phase death animation. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Minesweeper || (SZ.Minesweeper = {});
  const C = NS.constants;
  const T = NS.data;
  const S = NS.state;
  const D = NS.dom;
  const ST = NS.store;
  const TI = NS.timer;
  const LED = NS.led;
  const FL = NS.flash;
  const SM = NS.smiley;
  const EF = NS.effects;
  const F = NS.field;
  const GO = NS.gameover;

  /* ---- Win / Lose ---- */
  GO.checkWin = function checkWin() {
    if (S.revealedCount === S.rows * S.cols - S.mineCount) {
      GO.doGameOver(true);
      return true;
    }
    return false;
  };

  GO.doGameOver = async function doGameOver(won) {
    S.gameOver = true;
    S.gameWon = won;
    TI.stopTimer();

    if (S.gameStarted)
      ST.recordGameResult(won);

    if (won) {
      SM.setSmiley(C.FACE_WIN);

      // Auto-flag remaining mines
      for (let r = 0; r < S.rows; ++r)
        for (let c = 0; c < S.cols; ++c)
          if (S.grid[r][c].mine && !S.grid[r][c].flagged) {
            S.grid[r][c].flagged = true;
            ++S.flagCount;
            F.renderCell(r, c);
          }
      LED.updateMineCounter();
      SZ.GameAudio.play('win');

      // Canvas confetti from 3 burst points
      EF.ensureEffectsCanvas();
      const themeColors = T.THEME_CONFIG[S.currentTheme].confetti;
      const w = S.effectsCanvas.width;
      S.particles.confetti(w * 0.2, 0, 40, { colors: themeColors });
      S.particles.confetti(w * 0.5, 0, 40, { colors: themeColors });
      S.particles.confetti(w * 0.8, 0, 40, { colors: themeColors });
      EF.startEffectsLoop();

      // Gold flash
      FL.screenFlash('#ffd700', 600);

      // Victory bounce on smiley
      D.smileyBtn.classList.add('victory-bounce');
      D.smileyBtn.addEventListener('animationend', function handler() {
        D.smileyBtn.classList.remove('victory-bounce');
        D.smileyBtn.removeEventListener('animationend', handler);
      });

      // Best time check
      if (S.difficulty !== 'custom' && S.bestTimes[S.difficulty] && S.timerValue < S.bestTimes[S.difficulty].time) {
        S.bestTimes[S.difficulty].time = S.timerValue;
        const name = await SZ.Dialog.prompt('You have the fastest time for ' + S.difficulty + ' level.\nPlease enter your name:', 'Anonymous', 'Minesweeper');
        S.bestTimes[S.difficulty].name = name || 'Anonymous';
        ST.saveBestTimes();
      }
    } else {
      // ---- DEATH ANIMATION SEQUENCE ----
      const currentGrid = S.grid;
      const themeParticles = T.THEME_CONFIG[S.currentTheme].particles;

      // Phase 1: Impact
      SM.setSmiley(C.FACE_DEAD);
      FL.screenFlash('#f00', 400);

      // CSS screen shake on field border
      const fieldBorder = document.querySelector('.field-border');
      fieldBorder.classList.add('mine-shake');
      fieldBorder.addEventListener('animationend', function handler() {
        fieldBorder.classList.remove('mine-shake');
        fieldBorder.removeEventListener('animationend', handler);
      });

      // Find hit mine
      let hitR = -1;
      let hitC = -1;
      for (let r = 0; r < S.rows; ++r)
        for (let c = 0; c < S.cols; ++c)
          if (S.grid[r][c].hitMine) {
            hitR = r;
            hitC = c;
          }

      // Canvas: screen shake + large particle burst at hit mine
      EF.ensureEffectsCanvas();
      S.shake.trigger(6, 400);
      if (hitR >= 0) {
        const center = EF.getCellCenter(hitR, hitC);
        for (let i = 0; i < 30; ++i)
          S.particles.burst(center.x, center.y, 1, {
            speed: 6,
            color: EF.pickColor(themeParticles),
            gravity: 0.1,
            life: 0.8 + Math.random() * 0.4,
            size: 2 + Math.random() * 4
          });
      }
      EF.startEffectsLoop();

      // Phase 2: Chain detonation -- reveal mines outward with staggered particle bursts
      let maxDist = 0;
      for (let r = 0; r < S.rows; ++r)
        for (let c = 0; c < S.cols; ++c) {
          const d = S.grid[r][c];
          if (d.mine && !d.revealed && !d.flagged) {
            d.revealed = true;
            const dist = hitR >= 0 ? Math.abs(r - hitR) + Math.abs(c - hitC) : 0;
            if (dist > maxDist)
              maxDist = dist;
            ((row, col, distance) => {
              const tid = setTimeout(() => {
                if (S.grid !== currentGrid)
                  return;
                F.renderCell(row, col);
                currentGrid[row][col].el.classList.add('mine-reveal-stagger');
                currentGrid[row][col].el.addEventListener('animationend', function handler() {
                  currentGrid[row][col].el.classList.remove('mine-reveal-stagger');
                  currentGrid[row][col].el.removeEventListener('animationend', handler);
                });
                SZ.GameAudio.play('smallExplode', { pitch: 0.8 + Math.random() * 0.4, volume: 0.4 });
                // Canvas particle burst for each mine (8 particles)
                EF.ensureEffectsCanvas();
                const center = EF.getCellCenter(row, col);
                S.particles.burst(center.x, center.y, 8, {
                  speed: 3,
                  color: EF.pickColor(themeParticles),
                  gravity: 0.08,
                  life: 0.5 + Math.random() * 0.3,
                  size: 1.5 + Math.random() * 2
                });
                EF.startEffectsLoop();
              }, distance * 40);
              S.mineRevealTimeouts.push(tid);
            })(r, c, dist);
          } else if (d.flagged && !d.mine) {
            d.flagged = false;
            d.wrongFlag = true;
            F.renderCell(r, c);
          }
        }

      // Phase 3: Aftermath -- board darkens, hit mine glows
      const aftermathDelay = maxDist * 40 + 500;
      const darkTid = setTimeout(() => {
        if (S.grid !== currentGrid)
          return;
        D.minefield.classList.add('board-darkened');
        if (hitR >= 0 && currentGrid[hitR] && currentGrid[hitR][hitC] && currentGrid[hitR][hitC].el)
          currentGrid[hitR][hitC].el.classList.add('mine-hit-glow');
      }, aftermathDelay);
      S.mineRevealTimeouts.push(darkTid);

      // Phase 4: Skull transition -- smiley shrinks away, swaps to skull, grows back
      const skullDelay = aftermathDelay + 300;
      const skullTid = setTimeout(() => {
        if (S.grid !== currentGrid)
          return;
        D.smileyBtn.classList.add('smiley-shrink-away');
        const onShrinkEnd = () => {
          D.smileyBtn.classList.remove('smiley-shrink-away');
          D.smileyBtn.removeEventListener('animationend', onShrinkEnd);
          // Swap to skull at midpoint
          D.smileyBtn.dataset.face = 'skull';
          D.smileyBtn.classList.add('smiley-skull-grow');
          const onGrowEnd = () => {
            D.smileyBtn.classList.remove('smiley-skull-grow');
            D.smileyBtn.removeEventListener('animationend', onGrowEnd);
            // Phase 5: Skull pulses red indefinitely
            D.smileyBtn.classList.add('skull-pulse');
          };
          D.smileyBtn.addEventListener('animationend', onGrowEnd);
        };
        D.smileyBtn.addEventListener('animationend', onShrinkEnd);
      }, skullDelay);
      S.mineRevealTimeouts.push(skullTid);
    }
  };
})();
