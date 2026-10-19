/* DOM effects: the line-clear flash bands, the board shake, the score popup, the
   clear particles, the lock flash on cells and the level-up celebration. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Tetris || (SZ.Tetris = {});
  const C = NS.constants;
  const S = NS.state;
  const D = NS.dom;

  /* ---- Effects: Line Clear Flash ---- */
  function flashClearedRows(rows) {
    const cellSize = 20;
    for (const row of rows) {
      const band = document.createElement('div');
      band.className = 'clear-flash';
      band.style.top = (row * cellSize) + 'px';
      D.boardWrapper.appendChild(band);
      band.addEventListener('animationend', () => band.remove());
    }
    if (rows.length >= 4) {
      const flash = document.createElement('div');
      flash.className = 'tetris-flash';
      D.boardWrapper.appendChild(flash);
      flash.addEventListener('animationend', () => flash.remove());
    }
  }

  /* ---- Effects: Screen Shake ---- */
  function shakeBoard(intensity) {
    const cls = intensity >= 4 ? 'shaking-heavy' : intensity >= 2 ? 'shaking-medium' : 'shaking-light';
    D.boardBorder.classList.remove('shaking-light', 'shaking-medium', 'shaking-heavy');
    void D.boardBorder.offsetWidth;
    D.boardBorder.classList.add(cls);
    D.boardBorder.addEventListener('animationend', function handler() {
      D.boardBorder.classList.remove(cls);
      D.boardBorder.removeEventListener('animationend', handler);
    });
  }

  /* ---- Effects: Score Popup ---- */
  function showScorePopup(points, linesCleared, row) {
    const popup = document.createElement('div');
    popup.className = 'score-popup';
    if (linesCleared >= 4)
      popup.classList.add('tetris');
    const label = linesCleared >= 4 ? '+' + points + ' TETRIS!' : '+' + points;
    popup.textContent = label;
    const cellSize = 20;
    popup.style.left = (C.COLS * cellSize / 2 - 30) + 'px';
    popup.style.top = (row * cellSize) + 'px';
    D.boardWrapper.appendChild(popup);
    popup.addEventListener('animationend', () => popup.remove());
  }

  /* ---- Effects: Line Clear Particles ---- */
  function spawnClearParticles(rows) {
    const cellSize = 20;
    for (const row of rows)
      for (let c = 0; c < C.COLS; ++c) {
        const count = 3 + Math.floor(Math.random() * 2);
        for (let p = 0; p < count; ++p) {
          const particle = document.createElement('div');
          particle.className = 'clear-particle';
          const size = 2 + Math.random() * 4;
          particle.style.width = size + 'px';
          particle.style.height = size + 'px';
          particle.style.background = C.PARTICLE_COLORS[Math.floor(Math.random() * C.PARTICLE_COLORS.length)];
          const startX = c * cellSize + cellSize / 2;
          const startY = row * cellSize + cellSize / 2;
          particle.style.left = startX + 'px';
          particle.style.top = startY + 'px';
          D.boardWrapper.appendChild(particle);

          const vx = (Math.random() - 0.5) * 6;
          const vy = -(Math.random() * 4 + 1);
          const gravity = 0.15;
          let x = startX;
          let y = startY;
          let velX = vx;
          let velY = vy;
          let alpha = 1;
          let angle = Math.random() * 360;

          const animateParticle = () => {
            velY += gravity;
            x += velX;
            y += velY;
            alpha -= 0.018;
            angle += velX * 3;
            if (alpha <= 0) {
              particle.remove();
              return;
            }
            particle.style.left = x + 'px';
            particle.style.top = y + 'px';
            particle.style.opacity = alpha;
            particle.style.transform = 'rotate(' + angle + 'deg)';
            requestAnimationFrame(animateParticle);
          };
          requestAnimationFrame(animateParticle);
        }
      }
  }

  /* ---- Effects: Piece Lock Flash ---- */
  function flashLockedCells() {
    if (!S.currentPiece)
      return;
    const shape = NS.rules.getShape(S.currentPiece.type, S.currentPiece.rotation);
    const size = shape.length;
    for (let r = 0; r < size; ++r)
      for (let c = 0; c < size; ++c) {
        if (!shape[r][c])
          continue;
        const br = S.currentPiece.row + r;
        const bc = S.currentPiece.col + c;
        if (br >= 0 && br < C.ROWS && bc >= 0 && bc < C.COLS) {
          const idx = br * C.COLS + bc;
          D.boardCells[idx].classList.add('just-locked');
          D.boardCells[idx].addEventListener('animationend', function handler() {
            D.boardCells[idx].classList.remove('just-locked');
            D.boardCells[idx].removeEventListener('animationend', handler);
          });
        }
      }
  }

  /* ---- Effects: Level Up ---- */
  function showLevelUp() {
    D.levelDisplay.classList.remove('level-flash');
    void D.levelDisplay.offsetWidth;
    D.levelDisplay.classList.add('level-flash');
    D.levelDisplay.addEventListener('animationend', function handler() {
      D.levelDisplay.classList.remove('level-flash');
      D.levelDisplay.removeEventListener('animationend', handler);
    });

    D.boardBorder.classList.remove('level-border-pulse');
    void D.boardBorder.offsetWidth;
    D.boardBorder.classList.add('level-border-pulse');
    D.boardBorder.addEventListener('animationend', function handler() {
      D.boardBorder.classList.remove('level-border-pulse');
      D.boardBorder.removeEventListener('animationend', handler);
    });

    const text = document.createElement('div');
    text.className = 'level-up-text';
    text.textContent = 'LEVEL UP!';
    D.boardWrapper.appendChild(text);
    text.addEventListener('animationend', () => text.remove());
  }

  Object.assign(NS.effects, {
    flashClearedRows, shakeBoard, showScorePopup, spawnClearParticles, flashLockedCells, showLevelUp
  });
})();
