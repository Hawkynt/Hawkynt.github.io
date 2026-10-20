/* The New Game options dialog: configuration persistence, applying and reading the
   dialog controls, the preset buttons and starting a game from the dialog. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});
  const C = NS.constants;
  const S = NS.state;
  const { newGame } = NS.game;

  /* ---- Config Persistence ---- */
  function loadConfig() {
    try {
      const raw = localStorage.getItem(C.CONFIG_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.tronMode && !saved.visualTheme) {
          saved.visualTheme = 'tron';
          delete saved.tronMode;
        }
        S.gameConfig = { ...C.DEFAULT_CONFIG, ...saved };
      }
    } catch (_) {
      S.gameConfig = { ...C.DEFAULT_CONFIG };
    }
  }

  function saveConfig() {
    try { localStorage.setItem(C.CONFIG_KEY, JSON.stringify(S.gameConfig)); } catch (_) {}
  }

  /* ---- Options Dialog ---- */
  function applyConfigToDialog() {
    const cfg = S.gameConfig;
    const q = (sel) => document.querySelector(sel);
    q('input[name="walls"][value="' + cfg.walls + '"]').checked = true;
    q('input[name="obstacles"][value="' + cfg.obstacles + '"]').checked = true;
    q('input[name="enemies"][value="' + cfg.enemies + '"]').checked = true;
    document.getElementById('optPowerups').checked = cfg.powerups;
    q('input[name="fieldSize"][value="' + cfg.fieldSize + '"]').checked = true;
    q('input[name="speed"][value="' + cfg.speed + '"]').checked = true;
    S.pendingVisualTheme = cfg.visualTheme || null;
  }

  function readDialogConfig() {
    const q = (sel) => document.querySelector(sel);
    return {
      walls:     q('input[name="walls"]:checked').value,
      obstacles: q('input[name="obstacles"]:checked').value,
      enemies:   parseInt(q('input[name="enemies"]:checked').value, 10),
      powerups:  document.getElementById('optPowerups').checked,
      fieldSize: q('input[name="fieldSize"]:checked').value,
      speed:     q('input[name="speed"]:checked').value
    };
  }

  function applyPreset(name) {
    const preset = C.PRESETS[name];
    if (!preset)
      return;
    const q = (sel) => document.querySelector(sel);
    q('input[name="walls"][value="' + preset.walls + '"]').checked = true;
    q('input[name="obstacles"][value="' + preset.obstacles + '"]').checked = true;
    q('input[name="enemies"][value="' + preset.enemies + '"]').checked = true;
    document.getElementById('optPowerups').checked = preset.powerups;
    q('input[name="fieldSize"][value="' + preset.fieldSize + '"]').checked = true;
    q('input[name="speed"][value="' + preset.speed + '"]').checked = true;
    S.pendingVisualTheme = preset.visualTheme || null;
  }

  function showOptionsDialog() {
    if (S.gameActive && !S.gamePaused && !S.gameOverFlag) {
      S.gamePaused = true;
      S.pausedForDialog = true;
    }

    applyConfigToDialog();
    const gen = ++S.dialogGen;

    SZ.Dialog.show('optionsBackdrop').then(result => {
      if (gen !== S.dialogGen)
        return;
      if (result === 'start') {
        S.gameConfig = readDialogConfig();
        S.gameConfig.visualTheme = S.pendingVisualTheme;
        saveConfig();
        S.pausedForDialog = false;
        newGame();
      } else {
        if (S.pausedForDialog) {
          S.gamePaused = false;
          S.pausedForDialog = false;
          S.lastMoveTime = performance.now();
        }
      }
    });
  }

  function setupPresetButtons() {
    const container = document.getElementById('optionsBackdrop');
    if (!container)
      return;
    container.addEventListener('click', function(e) {
      const btn = e.target.closest('[data-preset]');
      if (btn)
        applyPreset(btn.dataset.preset);
    });
  }

  Object.assign(NS.options, { loadConfig, saveConfig, applyConfigToDialog, readDialogConfig,
    applyPreset, showOptionsDialog, setupPresetButtons });
})();
