;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { GameState, StateMachine, PRNG, TimeRotation, Renderer, InputHandler, SaveManager, SaveCrypto, Character, Roster, RACES, CLASSES, CombatEngine, CombatPhase, CombatUnit, CombatGrid, Terrain, D20, Pathfinding, AssetLoader, OverworldMap, OverworldTile, Spells, Shop, ShopType, Items, CombatUI } = TR;
  const { CANVAS_W, CANVAS_H, TILE_SIZE, MOVE_DURATION, COMBAT_TILE_SIZE, COMBAT_MOVE_STEP_DUR, REVEAL_TIME, CRAWL_TILE, CRAWL_STEP, DEPLOY_BUTTON, UNDERGROUND_LIGHT, TRAIT_COLORS, HAZARD_COLORS, BATTLE_SCENE_KEY, BATTLE_SCENE_MODES, loadBattleSceneMode, MENU_ACTIONS, CAMP_BUTTONS, TOWN_BUTTONS, TITLE_BUTTONS } = TR.app;

  class Controller {
    _sm;
    _renderer;
    _input;
    _saveManager;
    _timeRotation;
    _prng;
    _running;
    _lastTime;
    _animFrame;
    _hoverTile;
    _mouse = null;
    _stepsSinceEncounter = 0;
    _playerPos;
    _overworldMap;
    _statusEls;
    _roster;
    _selectedSlots;
    _party;
    _partyFullFlash;
    _combatEngine;
    _combatTileSize;
    _combatOffsetX;
    _combatOffsetY;
    _combatHoverTile;
    _combatActionHover;
    _partyHp;
    _partyXp;
    _gold;
    _lastRewards;
    _moveTarget;
    _moveProgress;
    _moveFrom;
    _isMoving;
    _moveCooldown;
    _encounterMsg;
    _encounterTimer;
    _walkPath;
    _combatAnim;
    _enemyQueue;
    _combatFx;
    _battleSceneMode;
    // dungeon crawl
    _crawl = null;
    _crawlCache = new Map();
    _crawlTrail = [];
    _crawlWalk = null;
    _crawlPath = null;
    _crawlCooldown = 0;
    _crawlBattle = null;
    _toasts = [];
    _deploying = false;
    _deploySelected = null;
    _combatCam = null;
    _crawlPrompt = null;
    _combatMovePath;
    _combatMoveUnit;
    _combatMoveIdx;
    _combatMoveProgress;
    _combatMoveCallback;
    _combatBiome;
    _spellMenuOpen;
    _spellMenuScroll;
    _spellMenuHover;
    _combatTime;
    _combatMoveStart;
    _combatTentativePos;
    _combatOriginalPos;
    _overworldCombat;
    _overworldCombatOrigin;
    _contextMenu;
    _contextMenuHover;
    _screenTime;
    // the plane the party walks (a data/planes.js id)
    _dimension;
    // every plane visited keeps its map, where the party last stood on it
    // and which plane its gate home leads back to
    _planeMaps = new Map();
    _cinematic = false;
    _planePositions = {};
    _planeReturn = {};
    // the swirl of stepping through a portal: { t, dur, target, returning, switched }
    _planeShift = null;
    _inventory;
    _shopStock;
    _shopType;

    constructor() {
      this._sm = null;
      this._renderer = null;
      this._input = null;
      this._saveManager = null;
      this._timeRotation = null;
      this._prng = null;
      this._running = false;
      this._lastTime = 0;
      this._animFrame = null;
      this._hoverTile = null;
      this._playerPos = { col: 0, row: 0 };
      this._overworldMap = null;
      this._statusEls = null;
      this._roster = null;
      this._selectedSlots = new Set();
      this._party = null;
      this._partyFullFlash = 0;
      this._combatEngine = null;
      this._combatTileSize = 32;
      this._combatOffsetX = 10;
      this._combatOffsetY = 46;
      this._combatHoverTile = null;
      this._combatActionHover = -1;
      this._partyHp = null;
      this._partyXp = null;
      this._gold = 0;
      this._lastRewards = null;
      this._moveTarget = null;
      this._moveProgress = 0;
      this._moveFrom = null;
      this._isMoving = false;
      this._moveCooldown = 0;
      this._encounterMsg = null;
      this._encounterTimer = 0;
      this._walkPath = null;
      this._combatAnim = null;
      this._enemyQueue = [];
      this._combatFx = TR.CombatFx ? new TR.CombatFx() : null;
      this._battleSceneMode = loadBattleSceneMode();
      this._combatMovePath = null;
      this._combatMoveUnit = null;
      this._combatMoveIdx = 0;
      this._combatMoveProgress = 0;
      this._combatMoveCallback = null;
      this._combatBiome = 'plains';
      this._spellMenuOpen = false;
      this._spellMenuScroll = 0;
      this._spellMenuHover = -1;
      this._combatTime = 0;
      this._combatMoveStart = null;
      this._combatTentativePos = null;
      this._combatOriginalPos = null;
      this._overworldCombat = false;
      this._overworldCombatOrigin = null;
      this._contextMenu = null;
      this._contextMenuHover = -1;
      this._screenTime = 0;
      this._dimension = 'material';
      this._inventory = [];
      this._shopStock = null;
      this._shopType = null;
    }

    async init() {
      const canvas = document.getElementById('gameCanvas');
      if (!canvas)
        return;

      this._renderer = new Renderer(canvas, { width: CANVAS_W, height: CANVAS_H, tileSize: TILE_SIZE });
      this._input = new InputHandler(canvas, { width: CANVAS_W, height: CANVAS_H, tileSize: TILE_SIZE });
      this._saveManager = new SaveManager({ crypto: new SaveCrypto() });
      this._timeRotation = new TimeRotation();

      // Scale canvas to fill window while maintaining 16:9 aspect ratio
      const gameFrame = document.querySelector('.game-frame');
      if (gameFrame) {
        const aspect = CANVAS_W / CANVAS_H;
        const resizeCanvas = () => {
          const fw = gameFrame.clientWidth || CANVAS_W;
          const fh = gameFrame.clientHeight || CANVAS_H;
          let w, h;
          if (fw / fh > aspect) { h = fh; w = Math.floor(h * aspect); }
          else { w = fw; h = Math.floor(w / aspect); }
          canvas.style.width = Math.max(320, w) + 'px';
          canvas.style.height = Math.max(180, h) + 'px';
        };
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        // Re-run after layout settles (SZ desktop may inject styles after load)
        requestAnimationFrame(resizeCanvas);
      }
      this._prng = PRNG.fromDate(this._timeRotation.dailySeed());

      this._sm = new StateMachine(GameState.TITLE);
      this._sm.on('afterTransition', (e) => this._onTransition(e));

      this._input.on('click', (e) => this._onClick(e));
      this._input.on('doubleClick', (e) => this._onDoubleClick(e));
      this._input.on('hover', (e) => this._onHover(e));
      this._input.on('rightClick', (e) => this._onRightClick(e));
      this._input.on('key', (e) => this._onKey(e));

      this._statusEls = {
        state: document.getElementById('statusState'),
        pos: document.getElementById('statusPos')
      };

      this._setupMenu();
      this._syncBattleSceneMenu();
      this._setupCombatLogPanel();

      // Initialize floating combat UI
      const canvasWrap = document.getElementById('canvasWrap');
      if (canvasWrap && CombatUI) {
        this._combatUI = new CombatUI(canvasWrap);
        this._combatUI.onAction = (action) => this._onCombatUIAction(action);
        this._combatUI.hide();
      }

      if (AssetLoader) {
        const loader = new AssetLoader();
        loader.loadAll().then(() => {
          this._renderer.assets = loader;
          if (TR.generateTerrainTransitions)
            TR.generateTerrainTransitions(loader.get('overworld'));
          if (TR.SpriteResolver)
            TR.spriteResolver = new TR.SpriteResolver(loader);
        });
      }

      canvas.focus();
      this._start();

      if (TR.Debug)
        TR.Debug._registerController({
          getParty: () => this._party,
          getPartyHp: () => this._partyHp,
          getPartyXp: () => this._partyXp,
          getGold: () => this._gold,
          getInventory: () => this._inventory,
          getPlayerPos: () => this._playerPos,
          getOverworldMap: () => this._overworldMap,
          getCombatEngine: () => this._combatEngine,
          getCrawl: () => this._crawl,
          getStateMachine: () => this._sm,
          getRoster: () => this._roster,
          getTimeRotation: () => this._timeRotation,
          getPrng: () => this._prng,
          setParty: (v) => { this._party = v; },
          setPartyHp: (v) => { this._partyHp = v; },
          setPartyXp: (v) => { this._partyXp = v; },
          setGold: (v) => { this._gold = v; },
          setInventory: (v) => { this._inventory = v; },
          setPlayerPos: (v) => { this._playerPos = v; },
          getPlane: () => this._dimension,
          travelToPlane: (id) => this._beginPlaneShift(id, false),
          setRoster: (v) => { this._roster = v; },
        });
    }

    _setupMenu() {
      if (SZ.MenuBar)
        new SZ.MenuBar({ onAction: (action) => { if (MENU_ACTIONS[action]) MENU_ACTIONS[action](); } });
    }

    _setupCombatLogPanel() {
      this._combatLogPanel = document.getElementById('combatLogPanel');
      this._combatLogText = document.getElementById('combatLogText');
      this._combatLogLastLen = 0;
      this._historyBtn = document.getElementById('btnCombatHistory');
      const copyBtn = document.getElementById('combatLogCopy');
      if (copyBtn)
        copyBtn.addEventListener('click', () => {
          if (this._combatLogText)
            navigator.clipboard?.writeText(this._combatLogText.textContent).catch(() => {});
        });
      if (this._historyBtn)
        this._historyBtn.addEventListener('click', () => this._showCombatHistory());
      const historyCopyAll = document.getElementById('combatHistoryCopyAll');
      if (historyCopyAll)
        historyCopyAll.addEventListener('click', () => {
          if (TR.CombatHistory)
            navigator.clipboard?.writeText(TR.CombatHistory.formatAll()).catch(() => {});
        });
    }

    _updateCombatLogPanel() {
      if (!this._combatLogPanel || !this._combatLogText) return;
      const eng = this._combatEngine;
      const inCombat = this._sm.current === GameState.COMBAT;
      if (!eng || !inCombat) {
        this._combatLogPanel.hidden = true;
        return;
      }
      this._combatLogPanel.hidden = false;
      const log = eng.combatLog;
      if (log.length !== this._combatLogLastLen) {
        this._combatLogText.textContent = log.join('\n');
        this._combatLogLastLen = log.length;
        this._combatLogText.scrollTop = this._combatLogText.scrollHeight;
      }
    }

    _showCombatLogPanel() {
      if (this._combatLogPanel)
        this._combatLogPanel.hidden = false;
    }

    _hideCombatLogPanel() {
      if (this._combatLogPanel)
        this._combatLogPanel.hidden = true;
      this._combatLogLastLen = 0;
    }

    _archiveCombatLog() {
      if (!TR.CombatHistory || !this._combatEngine) return;
      const eng = this._combatEngine;
      TR.CombatHistory.archive(eng.combatLog, {
        location: this._overworldCombat ? 'Overworld' : 'Dungeon',
        biome: this._combatBiome || 'unknown',
        outcome: eng.phase === CombatPhase.VICTORY ? 'victory' : eng.phase === CombatPhase.DEFEAT ? 'defeat' : 'incomplete',
        rounds: eng.round || 0,
        partySize: eng.units.filter(u => u.faction === 'party').length,
        enemyCount: eng.units.filter(u => u.faction === 'enemy').length,
      });
    }

    _showCombatHistory() {
      const dlg = document.getElementById('dlg-combat-history');
      const list = document.getElementById('combatHistoryList');
      if (!dlg || !list) return;

      const CH = TR.CombatHistory;
      if (!CH || CH.count === 0) {
        list.innerHTML = '<p style="padding:20px;color:#99a;font-size:14px;text-align:center">No combat history this session.</p>';
      } else {
        // Build a clickable table of all combats
        const combats = CH.getAll();
        let html = '<table style="width:100%;border-collapse:collapse;font-size:13px;font-family:monospace">';
        html += '<tr style="background:#2a3050;color:#bbd"><th style="padding:6px 10px;text-align:left">#</th><th style="text-align:left;padding:6px">Time</th><th style="text-align:left;padding:6px">Location</th><th style="text-align:left;padding:6px">Result</th><th style="text-align:right;padding:6px 10px">Rounds</th></tr>';
        for (const c of combats) {
          const color = c.outcome === 'victory' ? '#4a4' : c.outcome === 'defeat' ? '#a44' : '#aa4';
          html += `<tr class="ch-row" data-combat-id="${c.id}" style="cursor:pointer;border-bottom:1px solid #333">`;
          html += `<td style="padding:6px 10px;color:#99a">${c.id}</td>`;
          html += `<td style="padding:6px;color:#ccc">${c.timestamp}</td>`;
          html += `<td style="padding:6px;color:#ccc">${c.location} (${c.biome})</td>`;
          html += `<td style="padding:6px;color:${color};font-weight:bold">${c.outcome}</td>`;
          html += `<td style="padding:6px 10px;text-align:right;color:#ccc">${c.rounds}</td>`;
          html += '</tr>';
        }
        html += '</table>';
        html += '<pre id="combatHistoryDetail" style="display:none;padding:10px;margin:8px;border:1px solid #445;border-radius:3px;background:#151825;white-space:pre-wrap;color:#ccc;user-select:text;cursor:text;max-height:300px;overflow-y:auto;font-size:12px;line-height:1.4"></pre>';
        list.innerHTML = html;

        // Wire row clicks to show combat log detail
        list.querySelectorAll('.ch-row').forEach(row => {
          row.addEventListener('click', () => {
            const id = +row.dataset.combatId;
            const combat = CH.get(id - 1);
            const detail = list.querySelector('#combatHistoryDetail');
            if (detail && combat) {
              detail.textContent = CH.formatLog(combat);
              detail.style.display = 'block';
              detail.scrollIntoView({ behavior: 'smooth' });
            }
          });
          row.addEventListener('pointerenter', () => row.style.background = 'rgba(80,120,200,0.2)');
          row.addEventListener('pointerleave', () => row.style.background = '');
        });
      }

      // Use shared Dialog API to show the overlay
      if (SZ.Dialog)
        SZ.Dialog.show('dlg-combat-history');
      else {
        dlg.hidden = false;
        dlg.classList.add('visible');
      }
    }

    _updateHistoryButton() {
      if (!this._historyBtn) return;
      const inCombat = this._sm.current === GameState.COMBAT;
      this._historyBtn.hidden = !TR.CombatHistory || TR.CombatHistory.count === 0;
    }

    showCombatHistory() { this._showCombatHistory(); }

    _onCombatUIAction(action) {
      if (!this._combatEngine) return;
      const eng = this._combatEngine;
      const unit = eng.currentUnit;
      if (!unit || unit.faction !== 'party') return;

      if (action === 'Attack') this._onCombatAction('attack');
      else if (action === 'Cast' || action === 'Back') this._onCombatAction('cast');
      else if (action === 'Wait') this._onCombatAction('wait');
      else if (action === 'Flee') this._onCombatAction('flee');
      else if (action === 'Undo Move') this._onCombatAction('undo');
      else if (action === 'Cancel') this._onCombatAction('cancel');
      else if (action.startsWith('spell:')) this._onCombatAction(action);
    }

    _onCombatAction(type) {
      if (!this._combatEngine) return;
      const eng = this._combatEngine;
      if (type === 'attack') {
        this._spellMenuOpen = false;
        this._commitTentativeMove();
        eng.selectAttack();
      } else if (type === 'cast') {
        this._spellMenuOpen = !this._spellMenuOpen;
        if (this._spellMenuOpen && this._combatUI)
          this._showSpellButtons();
      } else if (type === 'wait') {
        this._spellMenuOpen = false;
        this._commitTentativeMove();
        eng.selectWait();
        eng.nextTurn();
        eng.startTurn();
        if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
          this._processEnemyTurns();
      } else if (type === 'flee') {
        this._spellMenuOpen = false;
        this._attemptFlee();
      } else if (type === 'undo') {
        this._spellMenuOpen = false;
        this._combatTentativePos = null;
        this._combatOriginalPos = null;
        eng.undoMove();
      } else if (type === 'cancel') {
        this._spellMenuOpen = false;
        eng.cancelTarget();
      } else if (type.startsWith('spell:')) {
        const spellId = type.substring(6);
        this._spellMenuOpen = false;
        this._commitTentativeMove();
        eng.selectSpell(spellId);
      }
    }

    _showSpellButtons() {
      if (!this._combatUI || !this._combatEngine) return;
      const unit = this._combatEngine.currentUnit;
      if (!unit) return;
      const spellBtns = this._getSpellMenuButtons(unit);
      const buttons = spellBtns.map(s => ({
        label: s.label,
        disabled: s.disabled,
        action: `spell:${s.spellId}`,
      }));
      buttons.push({ label: 'Back', disabled: false, action: 'cast' });
      this._combatUI.updateActions(buttons);
    }

    async newGame() {
      this._prng = PRNG.fromDate(this._timeRotation.dailySeed());
      if (this._sm.current !== GameState.TITLE && this._sm.current !== GameState.CHARACTER_SELECT) {
        this._sm = new StateMachine(GameState.TITLE);
        this._sm.on('afterTransition', (e) => this._onTransition(e));
      }

      const season = this._timeRotation.currentSeason();
      this._roster = Roster.generateDailyRoster(this._timeRotation.dailySeed(), season, this._prng);
      this._selectedSlots = new Set();
      this._party = null;
      this._partyFullFlash = 0;

      if (this._sm.current === GameState.TITLE)
        this._sm.transition(GameState.CHARACTER_SELECT);
    }

    _start() {
      this._running = true;
      this._lastTime = performance.now();
      this._loop(this._lastTime);
    }

    _loop(now) {
      if (!this._running)
        return;
      const dt = Math.min((now - this._lastTime) / 1000, 0.05);
      this._lastTime = now;

      this._update(dt);
      this._render();

      this._animFrame = requestAnimationFrame((t) => this._loop(t));
    }

    _update(dt) {
      this._updateStatus();
      this._screenTime += dt;

      if (this._sm.current === GameState.COMBAT)
        this._combatTime += dt;

      if (this._encounterTimer > 0)
        this._encounterTimer = Math.max(0, this._encounterTimer - dt);

      if (this._combatFx)
        this._combatFx.update(dt);
      for (let i = this._toasts.length - 1; i >= 0; --i)
        if ((this._toasts[i].t += dt) > 3.2)
          this._toasts.splice(i, 1);
      if (this._sm.current === GameState.COMBAT && this._combatCam)
        this._updateCombatCamera(dt);

      if (this._combatMovePath) {
        this._combatMoveProgress += dt / COMBAT_MOVE_STEP_DUR;
        if (this._combatMoveProgress >= 1) {
          this._combatMoveProgress = 0;
          ++this._combatMoveIdx;
          if (this._combatMoveIdx >= this._combatMovePath.length) {
            const cb = this._combatMoveCallback;
            this._combatMovePath = null;
            this._combatMoveUnit = null;
            this._combatMoveCallback = null;
            this._combatMoveStart = null;
            if (cb) cb();
          }
        }
        return;
      }

      if (this._combatAnim) {
        const scene = this._combatAnim.scene;
        if (scene) {
          scene.update(dt);
          if (scene.done)
            this._finishCombatAnim();
        } else {
          this._combatAnim.timer -= dt;
          if (this._combatAnim.timer <= 0)
            this._finishCombatAnim();
        }
        return;
      }

      if (this._enemyQueue.length > 0 && !this._combatAnim) {
        this._executeNextEnemy();
        return;
      }

      if (this._sm.current === GameState.DUNGEON && this._crawl)
        this._updateCrawl(dt);

      if (this._planeShift)
        this._updatePlaneShift(dt);

      if (this._sm.current === GameState.OVERWORLD && this._overworldMap && !this._planeShift && !this._crawlPrompt) {
        if (this._isMoving) {
          this._moveProgress += dt / MOVE_DURATION;
          if (this._moveProgress >= 1) {
            this._playerPos = { col: this._moveTarget.col, row: this._moveTarget.row };
            this._isMoving = false;
            this._moveTarget = null;
            this._moveFrom = null;
            this._moveProgress = 0;
            this._onArrivedAtTile();
          }
        }

        if (!this._isMoving && this._input) {
          this._moveCooldown = Math.max(0, this._moveCooldown - dt);
          if (this._moveCooldown <= 0) {
            const dir = this._input.getMovementDirection();
            if (dir.dx !== 0 || dir.dy !== 0) {
              this._walkPath = null;
              this._tryMove(this._playerPos.col + dir.dx, this._playerPos.row + dir.dy);
            } else if (this._walkPath && this._walkPath.length > 0) {
              const next = this._walkPath[0];
              if (this._tryMove(next.col, next.row))
                this._walkPath.shift();
              else
                this._walkPath = null;
            }
          }
        }
      }
    }

  }

  TR.Controller = Controller;
})();
