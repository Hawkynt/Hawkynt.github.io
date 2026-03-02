;(function() {
  'use strict';

  const SZ = window.SZ;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

  const CANVAS_W = 900;
  const CANVAS_H = 640;
  const MAX_DT = 0.05;

  /* ── Game states ── */
  const STATE_SONG_SELECT = 'SONG_SELECT';
  const STATE_PLAYING = 'PLAYING';
  const STATE_PAUSED = 'PAUSED';
  const STATE_RESULTS = 'RESULTS';

  /* ── Storage ── */
  const STORAGE_PREFIX = 'sz-rhythm-game';
  const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
  const MAX_HIGH_SCORES = 20;

  /* ── Lane config ── */
  const LANE_COUNT = 4;
  const LANE_KEYS = ['d', 'f', 'j', 'k'];
  const LANE_COLORS = ['#f44', '#4f4', '#44f', '#ff4'];
  const LANE_LABELS = ['D', 'F', 'J', 'K'];
  const laneWidth = CANVAS_W / (LANE_COUNT + 2);
  const LANE_START_X = laneWidth;
  const HIT_ZONE_Y = CANVAS_H - 80;
  const NOTE_RADIUS = 18;

  /* ── Timing windows (seconds) ── */
  const PERFECT_WINDOW = 0.04;
  const GREAT_WINDOW = 0.08;
  const GOOD_WINDOW = 0.14;
  const MISS_WINDOW = 0.2;

  /* ── Scoring ── */
  const SCORE_PERFECT = 300;
  const SCORE_GREAT = 200;
  const SCORE_GOOD = 100;

  /* ── Note scroll speed (pixels per second) ── */
  const NOTE_SPEED = 400;

  /* ══════════════════════════════════════════════════════════════════
     SONGS — 5+ built-in, procedurally generated patterns
     ══════════════════════════════════════════════════════════════════ */

  function generateNotes(melody, bpm) {
    const beatDuration = 60 / bpm;
    const notes = [];
    for (let i = 0; i < melody.length; ++i) {
      const beat = melody[i];
      if (beat < 0) continue;
      notes.push({ lane: beat % LANE_COUNT, time: i * beatDuration * 0.5, hit: false, missed: false });
    }
    return notes;
  }

  const SONGS = [
    {
      name: 'Neon Pulse',
      bpm: 120,
      difficulty: 1,
      melody: [0,1,2,3, 0,-1,2,-1, 1,3,0,2, 3,-1,1,-1, 0,2,1,3, 2,0,3,1, 0,-1,1,-1, 2,3,0,1, 3,1,2,0, 0,-1,3,-1, 1,2,0,3, 2,-1,1,0, 3,0,2,1, 0,1,3,2, 1,-1,0,-1, 2,3,1,0]
    },
    {
      name: 'Cyber Drift',
      bpm: 130,
      difficulty: 2,
      melody: [0,2,1,3, 2,0,3,1, 1,3,0,2, 3,1,2,0, 0,0,2,2, 1,1,3,3, 0,3,1,2, 2,1,3,0, 0,2,0,2, 1,3,1,3, 3,0,2,1, 0,1,2,3, 1,2,3,0, 2,3,0,1, 3,0,1,2, 0,1,2,3]
    },
    {
      name: 'Star Circuit',
      bpm: 140,
      difficulty: 2,
      melody: [0,1,-1,3, 2,0,-1,1, 3,2,0,-1, 1,3,2,0, 0,2,1,3, 3,1,0,2, 2,0,3,1, 1,3,2,0, 0,-1,2,3, 1,0,-1,2, 3,2,1,0, 0,3,2,1, 1,0,3,2, 2,1,0,3, 3,2,1,0, 0,1,2,3]
    },
    {
      name: 'Midnight Blaze',
      bpm: 150,
      difficulty: 3,
      melody: [0,1,2,3, 3,2,1,0, 0,2,1,3, 3,1,2,0, 0,0,1,1, 2,2,3,3, 3,3,2,2, 1,1,0,0, 0,3,0,3, 1,2,1,2, 0,1,0,1, 2,3,2,3, 0,1,2,3, 3,2,1,0, 0,3,1,2, 2,1,3,0]
    },
    {
      name: 'Thunder Rush',
      bpm: 160,
      difficulty: 3,
      melody: [0,1,2,3, 0,1,2,3, 3,2,1,0, 3,2,1,0, 0,2,0,2, 1,3,1,3, 0,1,0,1, 2,3,2,3, 0,3,1,2, 2,1,3,0, 0,2,3,1, 1,0,2,3, 3,1,0,2, 2,3,1,0, 0,1,2,3, 3,2,1,0]
    },
    {
      name: 'Cosmic Flow',
      bpm: 110,
      difficulty: 1,
      melody: [0,-1,1,-1, 2,-1,3,-1, 0,-1,2,-1, 1,-1,3,-1, 0,1,-1,2, 3,-1,0,1, 2,3,-1,0, 1,2,3,-1, 0,-1,1,2, 3,-1,0,-1, 1,2,-1,3, 0,-1,2,1, 3,0,-1,1, 2,3,0,-1, 1,0,3,2, 0,1,2,3]
    }
  ];

  /* ══════════════════════════════════════════════════════════════════
     CANVAS SETUP
     ══════════════════════════════════════════════════════════════════ */

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const User32 = SZ.Dlls?.User32;

  function setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ══════════════════════════════════════════════════════════════════
     VISUAL EFFECTS
     ══════════════════════════════════════════════════════════════════ */

  const particles = new SZ.GameEffects.ParticleSystem();
  const screenShake = new SZ.GameEffects.ScreenShake();
  const floatingText = new SZ.GameEffects.FloatingText();

  /* ══════════════════════════════════════════════════════════════════
     GAME STATE
     ══════════════════════════════════════════════════════════════════ */

  let state = STATE_SONG_SELECT;
  let selectedSongIndex = 0;
  let lastTimestamp = 0;

  /* ── Playing state ── */
  let currentSong = null;
  let activeNotes = [];
  let songTime = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let perfectCount = 0;
  let greatCount = 0;
  let goodCount = 0;
  let missCount = 0;
  let totalNotes = 0;

  /* ── Streak glow ── */
  let comboGlowIntensity = 0;

  /* ══════════════════════════════════════════════════════════════════
     LANE HELPERS
     ══════════════════════════════════════════════════════════════════ */

  function laneX(lane) {
    return LANE_START_X + lane * laneWidth + laneWidth / 2;
  }

  /* ══════════════════════════════════════════════════════════════════
     TIMING & SCORING
     ══════════════════════════════════════════════════════════════════ */

  function getMultiplier() {
    if (combo >= 50) return 4;
    if (combo >= 30) return 3;
    if (combo >= 10) return 2;
    return 1;
  }

  function judgeNote(timeDiff) {
    const diff = Math.abs(timeDiff);
    if (diff <= PERFECT_WINDOW) return { rank: 'PERFECT', score: SCORE_PERFECT, color: '#ff0' };
    if (diff <= GREAT_WINDOW) return { rank: 'GREAT', score: SCORE_GREAT, color: '#4f4' };
    if (diff <= GOOD_WINDOW) return { rank: 'GOOD', score: SCORE_GOOD, color: '#4af' };
    return null;
  }

  function hitNote(lane) {
    if (state !== STATE_PLAYING) return;

    let bestNote = null;
    let bestDiff = Infinity;

    for (const note of activeNotes) {
      if (note.lane !== lane || note.hit || note.missed) continue;
      const diff = Math.abs(songTime - note.time);
      if (diff < bestDiff && diff <= MISS_WINDOW) {
        bestDiff = diff;
        bestNote = note;
      }
    }

    if (!bestNote) {
      // Pressed key but no note nearby — penalize
      registerMiss(lane);
      return;
    }

    const judgment = judgeNote(songTime - bestNote.time);
    if (!judgment) {
      registerMiss(lane);
      return;
    }

    bestNote.hit = true;
    const mult = getMultiplier();
    score += judgment.score * mult;
    ++combo;
    if (combo > maxCombo) maxCombo = combo;

    if (judgment.rank === 'PERFECT') ++perfectCount;
    else if (judgment.rank === 'GREAT') ++greatCount;
    else ++goodCount;

    // Combo glow intensifies with streak
    comboGlowIntensity = Math.min(1, combo / 30);

    const x = laneX(lane);
    floatingText.add(x, HIT_ZONE_Y - 40, judgment.rank, { color: judgment.color, size: 20 });
    particles.burst(x, HIT_ZONE_Y, 10, { color: LANE_COLORS[lane], speed: 3, life: 0.5 });

    updateStatus();
  }

  function registerMiss(lane) {
    combo = 0;
    comboGlowIntensity = 0;
    ++missCount;
    const x = laneX(lane);
    floatingText.add(x, HIT_ZONE_Y - 40, 'Miss', { color: '#f44', size: 18 });
    screenShake.trigger(3, 150);
    updateStatus();
  }

  /* ══════════════════════════════════════════════════════════════════
     GRADING
     ══════════════════════════════════════════════════════════════════ */

  function calculateGrade() {
    if (totalNotes === 0) return 'D';
    const ratio = (perfectCount * 3 + greatCount * 2 + goodCount) / (totalNotes * 3);
    if (ratio >= 0.95 && missCount === 0) return 'S';
    if (ratio >= 0.85) return 'A';
    if (ratio >= 0.7) return 'B';
    if (ratio >= 0.5) return 'C';
    return 'D';
  }

  /* ══════════════════════════════════════════════════════════════════
     SONG MANAGEMENT
     ══════════════════════════════════════════════════════════════════ */

  function startSong(index) {
    currentSong = SONGS[index];
    activeNotes = generateNotes(currentSong.melody, currentSong.bpm);
    totalNotes = activeNotes.length;
    songTime = -2;  // 2-second lead-in
    score = 0;
    combo = 0;
    maxCombo = 0;
    perfectCount = 0;
    greatCount = 0;
    goodCount = 0;
    missCount = 0;
    comboGlowIntensity = 0;
    state = STATE_PLAYING;
    updateWindowTitle();
    updateStatus();
  }

  function endSong() {
    state = STATE_RESULTS;
    const grade = calculateGrade();
    saveHighScore(currentSong.name, score, grade);
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 100, `Grade: ${grade}`, { color: '#ff0', size: 36 });
    floatingText.add(CANVAS_W / 2, CANVAS_H / 2 - 60, `Score: ${score}`, { color: '#fff', size: 24 });
    particles.confetti(CANVAS_W / 2, CANVAS_H / 2, 30);
    updateWindowTitle();
  }

  /* ══════════════════════════════════════════════════════════════════
     SONG SELECT
     ══════════════════════════════════════════════════════════════════ */

  function selectSong(direction) {
    selectedSongIndex = (selectedSongIndex + direction + SONGS.length) % SONGS.length;
  }

  /* ══════════════════════════════════════════════════════════════════
     UPDATE LOOP
     ══════════════════════════════════════════════════════════════════ */

  function updatePlaying(dt) {
    songTime += dt;

    // Check for notes that scrolled past hit zone (missed)
    for (const note of activeNotes) {
      if (!note.hit && !note.missed && songTime - note.time > MISS_WINDOW) {
        note.missed = true;
        combo = 0;
        comboGlowIntensity = 0;
        ++missCount;
      }
    }

    // Check if song is over (all notes resolved)
    if (activeNotes.length > 0) {
      const allResolved = activeNotes.every(n => n.hit || n.missed);
      const lastNoteTime = activeNotes[activeNotes.length - 1].time;
      if (allResolved && songTime > lastNoteTime + 1.5)
        endSong();
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     DRAWING
     ══════════════════════════════════════════════════════════════════ */

  function drawLaneBackground() {
    // Dark background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Lane separators
    for (let i = 0; i <= LANE_COUNT; ++i) {
      const x = LANE_START_X + i * laneWidth;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_H);
      ctx.stroke();
    }

    // Lane labels at bottom
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < LANE_COUNT; ++i) {
      ctx.fillStyle = LANE_COLORS[i];
      ctx.globalAlpha = 0.4;
      ctx.fillText(LANE_LABELS[i], laneX(i), CANVAS_H - 15);
    }
    ctx.globalAlpha = 1;
  }

  function drawHitZone() {
    // Hit zone line
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(LANE_START_X, HIT_ZONE_Y);
    ctx.lineTo(LANE_START_X + LANE_COUNT * laneWidth, HIT_ZONE_Y);
    ctx.stroke();

    // Hit zone circles per lane
    for (let i = 0; i < LANE_COUNT; ++i) {
      const x = laneX(i);
      ctx.strokeStyle = LANE_COLORS[i];
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x, HIT_ZONE_Y, NOTE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Combo glow on hit zone — intensifies with longer streaks
    if (comboGlowIntensity > 0) {
      ctx.save();
      const glowAlpha = comboGlowIntensity * 0.6;
      ctx.globalAlpha = glowAlpha;
      ctx.shadowColor = '#ff0';
      ctx.shadowBlur = 15 + comboGlowIntensity * 20;
      ctx.strokeStyle = '#ff0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(LANE_START_X, HIT_ZONE_Y);
      ctx.lineTo(LANE_START_X + LANE_COUNT * laneWidth, HIT_ZONE_Y);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawNotes() {
    for (const note of activeNotes) {
      if (note.hit || note.missed) continue;
      const elapsed = songTime - note.time;
      const y = HIT_ZONE_Y + elapsed * NOTE_SPEED;
      if (y < -NOTE_RADIUS * 2 || y > CANVAS_H + NOTE_RADIUS) continue;

      const x = laneX(note.lane);
      const color = LANE_COLORS[note.lane];

      // Note body
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, NOTE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Note highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(x - 4, y - 4, NOTE_RADIUS * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSongSelectScreen() {
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Select a Song', CANVAS_W / 2, 60);

    const startY = 110;
    const rowH = 60;
    for (let i = 0; i < SONGS.length; ++i) {
      const y = startY + i * rowH;
      const selected = i === selectedSongIndex;

      ctx.fillStyle = selected ? '#2a2a6a' : '#1a1a2a';
      ctx.strokeStyle = selected ? '#88f' : '#333';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.fillRect(CANVAS_W / 2 - 200, y, 400, 50);
      ctx.strokeRect(CANVAS_W / 2 - 200, y, 400, 50);

      ctx.fillStyle = selected ? '#fff' : '#aaa';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(SONGS[i].name, CANVAS_W / 2 - 180, y + 22);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = selected ? '#88f' : '#666';
      ctx.fillText(`BPM: ${SONGS[i].bpm} • Difficulty: ${'★'.repeat(SONGS[i].difficulty)}${'☆'.repeat(3 - SONGS[i].difficulty)}`, CANVAS_W / 2 - 180, y + 40);

      // Show high score if available
      const hs = getHighScoreForSong(SONGS[i].name);
      if (hs) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fa0';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(`Best: ${hs.score} (${hs.grade})`, CANVAS_W / 2 + 180, y + 30);
      }
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('↑/↓ to navigate • Enter to start', CANVAS_W / 2, CANVAS_H - 40);
  }

  function drawResultsScreen() {
    ctx.fillStyle = '#0a0a2a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const grade = calculateGrade();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Song Complete!', CANVAS_W / 2, 60);

    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText(currentSong.name, CANVAS_W / 2, 95);

    // Grade display
    const gradeColor = grade === 'S' ? '#ff0' : grade === 'A' ? '#4f4' : grade === 'B' ? '#4af' : grade === 'C' ? '#fa0' : '#f44';
    ctx.font = 'bold 72px sans-serif';
    ctx.fillStyle = gradeColor;
    ctx.fillText(grade, CANVAS_W / 2, 200);

    // Stats
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    const statsX = CANVAS_W / 2 - 100;
    let statsY = 250;
    const lineH = 28;

    ctx.fillStyle = '#fa0';
    ctx.fillText(`Score: ${score}`, statsX, statsY); statsY += lineH;
    ctx.fillStyle = '#fff';
    ctx.fillText(`Max Combo: ${maxCombo}`, statsX, statsY); statsY += lineH;
    ctx.fillStyle = '#ff0';
    ctx.fillText(`Perfect: ${perfectCount}`, statsX, statsY); statsY += lineH;
    ctx.fillStyle = '#4f4';
    ctx.fillText(`Great: ${greatCount}`, statsX, statsY); statsY += lineH;
    ctx.fillStyle = '#4af';
    ctx.fillText(`Good: ${goodCount}`, statsX, statsY); statsY += lineH;
    ctx.fillStyle = '#f44';
    ctx.fillText(`Miss: ${missCount}`, statsX, statsY); statsY += lineH;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa';
    ctx.font = '14px sans-serif';
    ctx.fillText('Press Enter or click to continue', CANVAS_W / 2, CANVAS_H - 40);
  }

  function drawPauseOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', CANVAS_W / 2, CANVAS_H / 2 - 10);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Press Escape to resume', CANVAS_W / 2, CANVAS_H / 2 + 20);
  }

  function drawComboDisplay() {
    if (combo > 1) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText(`${combo} Combo`, CANVAS_W - 30, 40);

      const mult = getMultiplier();
      if (mult > 1) {
        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#fa0';
        ctx.fillText(`x${mult}`, CANVAS_W - 30, 62);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    if (state === STATE_SONG_SELECT) {
      drawSongSelectScreen();
      return;
    }

    if (state === STATE_RESULTS) {
      drawResultsScreen();
      particles.draw(ctx);
      floatingText.draw(ctx);
      return;
    }

    screenShake.apply(ctx);
    drawLaneBackground();
    drawHitZone();
    drawNotes();
    drawComboDisplay();

    // Score display
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Score: ${score}`, 20, 30);

    // Song progress
    if (currentSong && activeNotes.length > 0) {
      const lastTime = activeNotes[activeNotes.length - 1].time;
      const progress = Math.max(0, Math.min(1, songTime / lastTime));
      ctx.fillStyle = '#333';
      ctx.fillRect(20, CANVAS_H - 40, CANVAS_W - 40, 6);
      ctx.fillStyle = '#88f';
      ctx.fillRect(20, CANVAS_H - 40, (CANVAS_W - 40) * progress, 6);
    }

    particles.draw(ctx);
    floatingText.draw(ctx);

    if (state === STATE_PAUSED) drawPauseOverlay();
  }

  /* ══════════════════════════════════════════════════════════════════
     GAME LOOP
     ══════════════════════════════════════════════════════════════════ */

  function gameLoop(timestamp) {
    const rawDt = lastTimestamp ? (timestamp - lastTimestamp) / 1000 : 0;
    const dt = Math.min(rawDt, MAX_DT);
    lastTimestamp = timestamp;

    if (state === STATE_PLAYING)
      updatePlaying(dt);

    particles.update();
    screenShake.update(dt * 1000);
    floatingText.update();

    draw();
    requestAnimationFrame(gameLoop);
  }

  /* ══════════════════════════════════════════════════════════════════
     INPUT HANDLING
     ══════════════════════════════════════════════════════════════════ */

  window.addEventListener('keydown', (e) => {
    if (e.key === 'F2') {
      e.preventDefault();
      initGame();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      if (state === STATE_PLAYING) {
        state = STATE_PAUSED;
        updateWindowTitle();
      } else if (state === STATE_PAUSED) {
        state = STATE_PLAYING;
        updateWindowTitle();
      }
      return;
    }

    if (state === STATE_SONG_SELECT) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectSong(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectSong(1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        startSong(selectedSongIndex);
      }
      return;
    }

    if (state === STATE_RESULTS) {
      if (e.key === 'Enter') {
        e.preventDefault();
        initGame();
      }
      return;
    }

    if (state !== STATE_PLAYING) return;

    const laneIndex = LANE_KEYS.indexOf(e.key.toLowerCase());
    if (laneIndex >= 0) {
      e.preventDefault();
      hitNote(laneIndex);
    }
  });

  canvas.addEventListener('pointerdown', () => {
    if (state === STATE_RESULTS)
      initGame();
  });

  /* ══════════════════════════════════════════════════════════════════
     STATUS & PERSISTENCE
     ══════════════════════════════════════════════════════════════════ */

  function updateStatus() {
    const scoreEl = document.getElementById('statusScore');
    const comboEl = document.getElementById('statusCombo');
    const songEl = document.getElementById('statusSong');
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (comboEl) comboEl.textContent = `Combo: ${combo}`;
    if (songEl) songEl.textContent = currentSong ? currentSong.name : 'Select a song';
  }

  function loadHighScores() {
    try {
      const raw = localStorage.getItem(STORAGE_HIGHSCORES);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveHighScore(songName, finalScore, grade) {
    try {
      const scores = loadHighScores();
      scores.push({ song: songName, score: finalScore, grade, date: Date.now() });
      scores.sort((a, b) => b.score - a.score);
      while (scores.length > MAX_HIGH_SCORES) scores.pop();
      localStorage.setItem(STORAGE_HIGHSCORES, JSON.stringify(scores));
    } catch { /* file:// may block */ }
  }

  function getHighScoreForSong(songName) {
    const scores = loadHighScores();
    return scores.find(s => s.song === songName) || null;
  }

  function showHighScores() {
    const scores = loadHighScores();
    const tbody = document.getElementById('highScoresBody');
    if (tbody) {
      tbody.innerHTML = scores.map((s, i) =>
        `<tr><td>${i + 1}</td><td>${s.song}</td><td>${s.score}</td><td>${s.grade}</td></tr>`
      ).join('');
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     MENU BAR ACTIONS
     ══════════════════════════════════════════════════════════════════ */

  function handleAction(action) {
    switch (action) {
      case 'new':
        initGame();
        break;
      case 'pause':
        if (state === STATE_PLAYING)
          state = STATE_PAUSED;
        else if (state === STATE_PAUSED)
          state = STATE_PLAYING;
        updateWindowTitle();
        break;
      case 'high-scores':
        showHighScores();
        break;
      case 'exit':
        if (window.parent !== window)
          window.parent.postMessage({ type: 'sz:close' }, '*');
        break;
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     OS INTEGRATION
     ══════════════════════════════════════════════════════════════════ */

  function updateWindowTitle() {
    const suffix = state === STATE_PAUSED ? ' — Paused'
      : state === STATE_RESULTS ? ' — Results'
      : state === STATE_SONG_SELECT ? ' — Song Select'
      : currentSong ? ` — ${currentSong.name}`
      : '';
    const title = `Rhythm Game${suffix}`;
    document.title = title;
    if (User32?.SetWindowText)
      User32.SetWindowText(title);
  }

  if (User32?.RegisterWindowProc) {
    User32.RegisterWindowProc((msg) => {
      if (msg === 'WM_SIZE' || msg === 'WM_THEMECHANGED')
        setupCanvas();
    });
  }

  window.addEventListener('resize', setupCanvas);

  /* ══════════════════════════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════════════════════════ */

  function initGame() {
    state = STATE_SONG_SELECT;
    currentSong = null;
    activeNotes = [];
    score = 0;
    combo = 0;
    maxCombo = 0;
    perfectCount = 0;
    greatCount = 0;
    goodCount = 0;
    missCount = 0;
    comboGlowIntensity = 0;
    updateWindowTitle();
    updateStatus();
  }

  SZ.Dialog.wireAll();

  const menuBar = new SZ.MenuBar({
    onAction: handleAction
  });

  setupCanvas();
  initGame();

  lastTimestamp = 0;
  requestAnimationFrame(gameLoop);

})();
