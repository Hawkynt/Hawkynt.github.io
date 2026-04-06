;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const { GameState, StateMachine, PRNG, TimeRotation, Renderer, InputHandler, SaveManager, SaveCrypto, Character, Roster, RACES, CLASSES, CombatEngine, CombatPhase, CombatUnit, CombatGrid, Terrain, D20, Pathfinding, AssetLoader, OverworldMap, OverworldTile, Spells, Shop, ShopType, Items, CombatUI } = TR;

  const CANVAS_W = 1280;
  const CANVAS_H = 720;
  const TILE_SIZE = 32;
  const MOVE_DURATION = 0.12;
  const COMBAT_TILE_SIZE = 44;
  const COMBAT_MOVE_STEP_DUR = 0.08;

  const MENU_ACTIONS = {
    'new'() { controller && controller.newGame(); },
    'combat-history'() { controller?.showCombatHistory(); },
    'exit'() { window.parent.postMessage({ type: 'sz:close' }, '*'); },
    'about'() {
      if (SZ.Dialog)
        SZ.Dialog.show('dlg-about');
    }
  };

  const TITLE_BUTTONS = [
    { label: 'New Game', x: 540, y: 370, w: 200, h: 44 },
    { label: 'Continue', x: 540, y: 430, w: 200, h: 44 },
  ];

  class Controller {
    #sm;
    #renderer;
    #input;
    #saveManager;
    #timeRotation;
    #prng;
    #running;
    #lastTime;
    #animFrame;
    #hoverTile;
    #playerPos;
    #overworldMap;
    #statusEls;
    #roster;
    #selectedSlots;
    #party;
    #partyFullFlash;
    #combatEngine;
    #combatTileSize;
    #combatOffsetX;
    #combatOffsetY;
    #combatHoverTile;
    #combatActionHover;
    #partyHp;
    #partyXp;
    #gold;
    #lastRewards;
    #moveTarget;
    #moveProgress;
    #moveFrom;
    #isMoving;
    #moveCooldown;
    #encounterMsg;
    #encounterTimer;
    #walkPath;
    #combatAnim;
    #enemyQueue;
    #combatFloats;
    #combatMovePath;
    #combatMoveUnit;
    #combatMoveIdx;
    #combatMoveProgress;
    #combatMoveCallback;
    #combatBiome;
    #spellMenuOpen;
    #spellMenuScroll;
    #spellMenuHover;
    #combatTime;
    #combatMoveStart;
    #combatTentativePos;
    #combatOriginalPos;
    #overworldCombat;
    #overworldCombatOrigin;
    #contextMenu;
    #contextMenuHover;
    #screenTime;
    #dimension;
    #inventory;
    #shopStock;
    #shopType;

    constructor() {
      this.#sm = null;
      this.#renderer = null;
      this.#input = null;
      this.#saveManager = null;
      this.#timeRotation = null;
      this.#prng = null;
      this.#running = false;
      this.#lastTime = 0;
      this.#animFrame = null;
      this.#hoverTile = null;
      this.#playerPos = { col: 0, row: 0 };
      this.#overworldMap = null;
      this.#statusEls = null;
      this.#roster = null;
      this.#selectedSlots = new Set();
      this.#party = null;
      this.#partyFullFlash = 0;
      this.#combatEngine = null;
      this.#combatTileSize = 32;
      this.#combatOffsetX = 10;
      this.#combatOffsetY = 46;
      this.#combatHoverTile = null;
      this.#combatActionHover = -1;
      this.#partyHp = null;
      this.#partyXp = null;
      this.#gold = 0;
      this.#lastRewards = null;
      this.#moveTarget = null;
      this.#moveProgress = 0;
      this.#moveFrom = null;
      this.#isMoving = false;
      this.#moveCooldown = 0;
      this.#encounterMsg = null;
      this.#encounterTimer = 0;
      this.#walkPath = null;
      this.#combatAnim = null;
      this.#enemyQueue = [];
      this.#combatFloats = [];
      this.#combatMovePath = null;
      this.#combatMoveUnit = null;
      this.#combatMoveIdx = 0;
      this.#combatMoveProgress = 0;
      this.#combatMoveCallback = null;
      this.#combatBiome = 'plains';
      this.#spellMenuOpen = false;
      this.#spellMenuScroll = 0;
      this.#spellMenuHover = -1;
      this.#combatTime = 0;
      this.#combatMoveStart = null;
      this.#combatTentativePos = null;
      this.#combatOriginalPos = null;
      this.#overworldCombat = false;
      this.#overworldCombatOrigin = null;
      this.#contextMenu = null;
      this.#contextMenuHover = -1;
      this.#screenTime = 0;
      this.#dimension = 'material';
      this.#inventory = [];
      this.#shopStock = null;
      this.#shopType = null;
    }

    async init() {
      const canvas = document.getElementById('gameCanvas');
      if (!canvas)
        return;

      this.#renderer = new Renderer(canvas, { width: CANVAS_W, height: CANVAS_H, tileSize: TILE_SIZE });
      this.#input = new InputHandler(canvas, { width: CANVAS_W, height: CANVAS_H, tileSize: TILE_SIZE });
      this.#saveManager = new SaveManager({ crypto: new SaveCrypto() });
      this.#timeRotation = new TimeRotation();

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
      this.#prng = PRNG.fromDate(this.#timeRotation.dailySeed());

      this.#sm = new StateMachine(GameState.TITLE);
      this.#sm.on('afterTransition', (e) => this.#onTransition(e));

      this.#input.on('click', (e) => this.#onClick(e));
      this.#input.on('doubleClick', (e) => this.#onDoubleClick(e));
      this.#input.on('hover', (e) => this.#onHover(e));
      this.#input.on('rightClick', (e) => this.#onRightClick(e));

      this.#statusEls = {
        state: document.getElementById('statusState'),
        pos: document.getElementById('statusPos')
      };

      this.#setupMenu();
      this.#setupCombatLogPanel();

      // Initialize floating combat UI
      const canvasWrap = document.getElementById('canvasWrap');
      if (canvasWrap && CombatUI) {
        this._combatUI = new CombatUI(canvasWrap);
        this._combatUI.onAction = (action) => this.#onCombatUIAction(action);
        this._combatUI.hide();
      }

      if (AssetLoader) {
        const loader = new AssetLoader();
        loader.loadAll().then(() => {
          this.#renderer.assets = loader;
          if (TR.generateTerrainTransitions)
            TR.generateTerrainTransitions(loader.get('overworld'));
          if (TR.SpriteResolver)
            TR.spriteResolver = new TR.SpriteResolver(loader);
        });
      }

      canvas.focus();
      this.#start();

      if (TR.Debug)
        TR.Debug._registerController({
          getParty: () => this.#party,
          getPartyHp: () => this.#partyHp,
          getPartyXp: () => this.#partyXp,
          getGold: () => this.#gold,
          getInventory: () => this.#inventory,
          getPlayerPos: () => this.#playerPos,
          getOverworldMap: () => this.#overworldMap,
          getCombatEngine: () => this.#combatEngine,
          getStateMachine: () => this.#sm,
          getRoster: () => this.#roster,
          getTimeRotation: () => this.#timeRotation,
          getPrng: () => this.#prng,
          setParty: (v) => { this.#party = v; },
          setPartyHp: (v) => { this.#partyHp = v; },
          setPartyXp: (v) => { this.#partyXp = v; },
          setGold: (v) => { this.#gold = v; },
          setInventory: (v) => { this.#inventory = v; },
          setPlayerPos: (v) => { this.#playerPos = v; },
          setRoster: (v) => { this.#roster = v; },
        });
    }

    #setupMenu() {
      if (SZ.MenuBar)
        new SZ.MenuBar({ onAction: (action) => { if (MENU_ACTIONS[action]) MENU_ACTIONS[action](); } });
    }

    #setupCombatLogPanel() {
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
        this._historyBtn.addEventListener('click', () => this.#showCombatHistory());
      const historyCopyAll = document.getElementById('combatHistoryCopyAll');
      if (historyCopyAll)
        historyCopyAll.addEventListener('click', () => {
          if (TR.CombatHistory)
            navigator.clipboard?.writeText(TR.CombatHistory.formatAll()).catch(() => {});
        });
    }

    #updateCombatLogPanel() {
      if (!this._combatLogPanel || !this._combatLogText) return;
      const eng = this.#combatEngine;
      const inCombat = this.#sm.current === GameState.COMBAT;
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

    #showCombatLogPanel() {
      if (this._combatLogPanel)
        this._combatLogPanel.hidden = false;
    }

    #hideCombatLogPanel() {
      if (this._combatLogPanel)
        this._combatLogPanel.hidden = true;
      this._combatLogLastLen = 0;
    }

    #archiveCombatLog() {
      if (!TR.CombatHistory || !this.#combatEngine) return;
      const eng = this.#combatEngine;
      TR.CombatHistory.archive(eng.combatLog, {
        location: this.#overworldCombat ? 'Overworld' : 'Dungeon',
        biome: this.#combatBiome || 'unknown',
        outcome: eng.phase === CombatPhase.VICTORY ? 'victory' : eng.phase === CombatPhase.DEFEAT ? 'defeat' : 'incomplete',
        rounds: eng.round || 0,
        partySize: eng.units.filter(u => u.faction === 'party').length,
        enemyCount: eng.units.filter(u => u.faction === 'enemy').length,
      });
    }

    #showCombatHistory() {
      const dlg = document.getElementById('dlg-combat-history');
      const list = document.getElementById('combatHistoryList');
      if (!dlg || !list) return;

      const CH = TR.CombatHistory;
      if (!CH || CH.count === 0) {
        list.innerHTML = '<p style="padding:12px;color:#888">No combat history this session.</p>';
      } else {
        // Build a clickable table of all combats
        const combats = CH.getAll();
        let html = '<table style="width:100%;border-collapse:collapse;font-size:12px;font-family:monospace">';
        html += '<tr style="background:#2a2e3a;color:#aaa"><th style="padding:4px 8px;text-align:left">#</th><th style="text-align:left;padding:4px">Time</th><th style="text-align:left;padding:4px">Location</th><th style="text-align:left;padding:4px">Result</th><th style="text-align:right;padding:4px 8px">Rounds</th></tr>';
        for (const c of combats) {
          const color = c.outcome === 'victory' ? '#4a4' : c.outcome === 'defeat' ? '#a44' : '#aa4';
          html += `<tr class="ch-row" data-combat-id="${c.id}" style="cursor:pointer;border-bottom:1px solid #333">`;
          html += `<td style="padding:4px 8px;color:#888">${c.id}</td>`;
          html += `<td style="padding:4px">${c.timestamp}</td>`;
          html += `<td style="padding:4px">${c.location} (${c.biome})</td>`;
          html += `<td style="padding:4px;color:${color}">${c.outcome}</td>`;
          html += `<td style="padding:4px 8px;text-align:right">${c.rounds}</td>`;
          html += '</tr>';
        }
        html += '</table>';
        html += '<pre id="combatHistoryDetail" style="display:none;padding:8px;border-top:1px solid #444;white-space:pre-wrap;color:#bbb;user-select:text;cursor:text;max-height:300px;overflow-y:auto"></pre>';
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

    #updateHistoryButton() {
      if (!this._historyBtn) return;
      const inCombat = this.#sm.current === GameState.COMBAT;
      this._historyBtn.hidden = !TR.CombatHistory || TR.CombatHistory.count === 0;
    }

    showCombatHistory() { this.#showCombatHistory(); }

    #onCombatUIAction(action) {
      if (!this.#combatEngine) return;
      const eng = this.#combatEngine;
      const unit = eng.currentUnit;
      if (!unit || unit.faction !== 'party') return;

      if (action === 'Attack') this.#onCombatAction('attack');
      else if (action === 'Cast' || action === 'Back') this.#onCombatAction('cast');
      else if (action === 'Wait') this.#onCombatAction('wait');
      else if (action === 'Flee') this.#onCombatAction('flee');
      else if (action === 'Undo Move') this.#onCombatAction('undo');
      else if (action === 'Cancel') this.#onCombatAction('cancel');
      else if (action.startsWith('spell:')) this.#onCombatAction(action);
    }

    #onCombatAction(type) {
      if (!this.#combatEngine) return;
      const eng = this.#combatEngine;
      if (type === 'attack') {
        this.#spellMenuOpen = false;
        this.#commitTentativeMove();
        eng.selectAttack();
      } else if (type === 'cast') {
        this.#spellMenuOpen = !this.#spellMenuOpen;
        if (this.#spellMenuOpen && this._combatUI)
          this.#showSpellButtons();
      } else if (type === 'wait') {
        this.#spellMenuOpen = false;
        this.#commitTentativeMove();
        eng.selectWait();
        eng.nextTurn();
        eng.startTurn();
        if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
          this.#processEnemyTurns();
      } else if (type === 'flee') {
        this.#spellMenuOpen = false;
        this.#attemptFlee();
      } else if (type === 'undo') {
        this.#spellMenuOpen = false;
        this.#combatTentativePos = null;
        this.#combatOriginalPos = null;
        eng.undoMove();
      } else if (type === 'cancel') {
        this.#spellMenuOpen = false;
        eng.cancelTarget();
      } else if (type.startsWith('spell:')) {
        const spellId = type.substring(6);
        this.#spellMenuOpen = false;
        this.#commitTentativeMove();
        eng.selectSpell(spellId);
      }
    }

    #showSpellButtons() {
      if (!this._combatUI || !this.#combatEngine) return;
      const unit = this.#combatEngine.currentUnit;
      if (!unit) return;
      const spellBtns = this.#getSpellMenuButtons(unit);
      const buttons = spellBtns.map(s => ({
        label: s.label,
        disabled: s.disabled,
        action: `spell:${s.spellId}`,
      }));
      buttons.push({ label: 'Back', disabled: false, action: 'cast' });
      this._combatUI.updateActions(buttons);
    }

    async newGame() {
      this.#prng = PRNG.fromDate(this.#timeRotation.dailySeed());
      if (this.#sm.current !== GameState.TITLE && this.#sm.current !== GameState.CHARACTER_SELECT) {
        this.#sm = new StateMachine(GameState.TITLE);
        this.#sm.on('afterTransition', (e) => this.#onTransition(e));
      }

      const season = this.#timeRotation.currentSeason();
      this.#roster = Roster.generateDailyRoster(this.#timeRotation.dailySeed(), season, this.#prng);
      this.#selectedSlots = new Set();
      this.#party = null;
      this.#partyFullFlash = 0;

      if (this.#sm.current === GameState.TITLE)
        this.#sm.transition(GameState.CHARACTER_SELECT);
    }

    #start() {
      this.#running = true;
      this.#lastTime = performance.now();
      this.#loop(this.#lastTime);
    }

    #loop(now) {
      if (!this.#running)
        return;
      const dt = Math.min((now - this.#lastTime) / 1000, 0.05);
      this.#lastTime = now;

      this.#update(dt);
      this.#render();

      this.#animFrame = requestAnimationFrame((t) => this.#loop(t));
    }

    #update(dt) {
      this.#updateStatus();
      this.#screenTime += dt;

      if (this.#sm.current === GameState.COMBAT)
        this.#combatTime += dt;

      if (this.#encounterTimer > 0)
        this.#encounterTimer = Math.max(0, this.#encounterTimer - dt);

      for (let i = this.#combatFloats.length - 1; i >= 0; --i) {
        this.#combatFloats[i].timer -= dt;
        this.#combatFloats[i].y -= 30 * dt;
        if (this.#combatFloats[i].timer <= 0)
          this.#combatFloats.splice(i, 1);
      }

      if (this.#combatMovePath) {
        this.#combatMoveProgress += dt / COMBAT_MOVE_STEP_DUR;
        if (this.#combatMoveProgress >= 1) {
          this.#combatMoveProgress = 0;
          ++this.#combatMoveIdx;
          if (this.#combatMoveIdx >= this.#combatMovePath.length) {
            const cb = this.#combatMoveCallback;
            this.#combatMovePath = null;
            this.#combatMoveUnit = null;
            this.#combatMoveCallback = null;
            this.#combatMoveStart = null;
            if (cb) cb();
          }
        }
        return;
      }

      if (this.#combatAnim) {
        this.#combatAnim.timer -= dt;
        if (this.#combatAnim.timer <= 0)
          this.#finishCombatAnim();
        return;
      }

      if (this.#enemyQueue.length > 0 && !this.#combatAnim) {
        this.#executeNextEnemy();
        return;
      }

      if ((this.#sm.current === GameState.OVERWORLD || this.#sm.current === GameState.DUNGEON) && this.#overworldMap) {
        if (this.#isMoving) {
          this.#moveProgress += dt / MOVE_DURATION;
          if (this.#moveProgress >= 1) {
            this.#playerPos = { col: this.#moveTarget.col, row: this.#moveTarget.row };
            this.#isMoving = false;
            this.#moveTarget = null;
            this.#moveFrom = null;
            this.#moveProgress = 0;
            this.#onArrivedAtTile();
          }
        }

        if (!this.#isMoving && this.#input) {
          this.#moveCooldown = Math.max(0, this.#moveCooldown - dt);
          if (this.#moveCooldown <= 0) {
            const dir = this.#input.getMovementDirection();
            if (dir.dx !== 0 || dir.dy !== 0) {
              this.#walkPath = null;
              this.#tryMove(this.#playerPos.col + dir.dx, this.#playerPos.row + dir.dy);
            } else if (this.#walkPath && this.#walkPath.length > 0) {
              const next = this.#walkPath[0];
              if (this.#tryMove(next.col, next.row))
                this.#walkPath.shift();
              else
                this.#walkPath = null;
            }
          }
        }
      }
    }

    #tryMove(col, row) {
      if (!this.#overworldMap || this.#isMoving)
        return false;
      if (!this.#overworldMap.isPassable(col, row))
        return false;
      this.#moveFrom = { col: this.#playerPos.col, row: this.#playerPos.row };
      this.#moveTarget = { col, row };
      this.#moveProgress = 0;
      this.#isMoving = true;
      this.#moveCooldown = MOVE_DURATION * 0.5;
      return true;
    }

    #onArrivedAtTile() {
      if (!this.#overworldMap)
        return;
      if (this.#sm.current === GameState.COMBAT)
        return;
      // Invalidate path cache when player reaches a new tile (positions shifted)
      this.#overworldMap.clearPathCache();
      const col = this.#playerPos.col;
      const row = this.#playerPos.row;
      const loc = this.#overworldMap.getLocation(col, row);

      if (loc) {
        this.#walkPath = null;
        if (loc.tile === OverworldTile.TOWN) {
          this.#sm.transition(GameState.TOWN);
          return;
        }
        if (loc.tile === OverworldTile.CAMP) {
          this.#sm.transition(GameState.CAMP);
          return;
        }
        if (loc.tile === OverworldTile.DUNGEON) {
          this.#overworldCombat = false;
          this.#sm.transition(GameState.DUNGEON);
          this.#sm.transition(GameState.COMBAT);
          const pool = loc.enemies || ['goblin', 'skeleton'];
          const minCount = loc.minCount || 1;
          const maxCount = loc.maxCount || 3;
          const biome = loc.biome || 'plains';
          const enemyCount = this.#prng.nextInt(minCount, maxCount);
          const enemies = [];
          for (let i = 0; i < enemyCount; ++i)
            enemies.push({ templateId: this.#prng.pick(pool) });
          const aiTier = TR.EnemyAI ? TR.EnemyAI.difficultyToAiTier(loc.difficulty || 1) : 0;
          this.#startCombat(enemies, biome, aiTier);
          return;
        }
      }

      const chance = this.#overworldMap.encounterChance(col, row);
      if (chance > 0 && this.#prng.next() < chance) {
        this.#walkPath = null;
        const avgLevel = this.#party.length > 0 ? Math.round(this.#party.reduce((s, c) => s + c.level, 0) / this.#party.length) : 1;
        const enemies = this.#overworldMap.encounterEnemies(col, row, this.#prng, avgLevel);
        const biome = this.#overworldMap.encounterBiome(col, row);
        this.#encounterMsg = 'Ambush!';
        this.#encounterTimer = 0.5;
        this.#overworldCombat = true;
        this.#overworldCombatOrigin = { col, row };
        this.#sm.transition(GameState.COMBAT);
        const aiTier = this.#overworldMap.encounterAiTier(col, row);
        this.#startOverworldCombat(enemies, biome, aiTier);
      }
    }

    #render() {
      this.#renderer.beginFrame();

      switch (this.#sm.current) {
        case GameState.TITLE:
          this.#renderTitle();
          break;
        case GameState.CHARACTER_SELECT:
          this.#renderCharacterSelect();
          break;
        case GameState.OVERWORLD:
        case GameState.DUNGEON:
          this.#renderOverworld();
          break;
        case GameState.CAMP:
          this.#renderCamp();
          break;
        case GameState.TOWN:
          this.#renderTown();
          break;
        case GameState.COMBAT:
          this.#renderCombat();
          break;
        case GameState.VICTORY:
          this.#renderVictory();
          break;
        case GameState.DEFEAT:
          this.#renderDefeat();
          break;
        default:
          this.#renderTitle();
      }

      this.#renderer.endFrame();
    }

    #renderTitle() {
      this.#renderer.drawTitleScreen(this.#screenTime);

      const daily = this.#timeRotation.dailyBonusStat();
      const season = this.#timeRotation.currentSeason();
      const holiday = this.#timeRotation.isHoliday();

      this.#renderer.drawScreenText(CANVAS_W / 2, 265, `Daily Bonus: ${daily}  |  Season: ${season}`, { color: '#88a', font: '16px monospace', align: 'center' });
      if (holiday)
        this.#renderer.drawScreenText(CANVAS_W / 2, 295, `\u2605 ${holiday.name} \u2605`, { color: '#ffd700', font: 'bold 18px serif', align: 'center' });

      const hasSave = this.#saveManager.hasSave();
      this.#renderer.drawButton(TITLE_BUTTONS[0].x, TITLE_BUTTONS[0].y, TITLE_BUTTONS[0].w, TITLE_BUTTONS[0].h, 'New Game', { bg: '#2a4a2a', font: '16px monospace' });
      if (hasSave)
        this.#renderer.drawButton(TITLE_BUTTONS[1].x, TITLE_BUTTONS[1].y, TITLE_BUTTONS[1].w, TITLE_BUTTONS[1].h, 'Continue', { bg: '#2a2a4a', font: '16px monospace' });
    }

    #renderCharacterSelect() {
      this.#renderer.drawPanel(0, 0, CANVAS_W, CANVAS_H, { bg: '#1a1e2a' });
      this.#renderer.drawScreenText(CANVAS_W / 2, 38, 'SELECT YOUR PARTY', { color: '#c8a84e', font: 'bold 32px serif', align: 'center' });

      const daily = this.#timeRotation.dailyBonusStat();
      const season = this.#timeRotation.currentSeason();
      this.#renderer.drawScreenText(CANVAS_W / 2, 62, `Daily Bonus: ${daily}  |  Season: ${season}`, { color: '#88a', font: '13px monospace', align: 'center' });

      if (!this.#roster)
        return;

      const cardW = 220;
      const cardH = 290;
      const cols = 4;
      const gapX = 20;
      const gapY = 16;
      const totalW = cols * cardW + (cols - 1) * gapX;
      const startX = Math.floor((CANVAS_W - totalW) / 2);
      const startY = 80;

      for (let i = 0; i < this.#roster.length; ++i) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);
        const char = this.#roster[i];

        const raceDef = RACES.find(r => r.id === char.race);
        const classDef = CLASSES.find(c => c.id === char.class);
        const debugAllSeasons = this.#timeRotation._debugAllSeasons === true;
        const raceLocked = !debugAllSeasons && raceDef && raceDef.season && raceDef.season !== season;
        const classLocked = !debugAllSeasons && classDef && classDef.season && classDef.season !== season;
        const locked = raceLocked || classLocked;
        const selected = this.#selectedSlots.has(i);

        this.#renderer.drawCharacterCard(x, y, cardW, cardH, char, { selected, locked });
      }

      if (this.#partyFullFlash > 0) {
        this.#renderer.drawScreenText(CANVAS_W / 2, CANVAS_H - 76, 'Party Full (max 4)', { color: '#f44', font: 'bold 16px monospace', align: 'center' });
        this.#partyFullFlash = Math.max(0, this.#partyFullFlash - 0.016);
      }

      const selCount = this.#selectedSlots.size;
      this.#renderer.drawScreenText(CANVAS_W / 2, CANVAS_H - 54, `Selected: ${selCount} / 4`, { color: selCount > 0 ? '#ccc' : '#666', font: '14px monospace', align: 'center' });

      if (selCount >= 1 && selCount <= 4)
        this.#renderer.drawButton(540, CANVAS_H - 42, 200, 36, 'Begin Adventure', { bg: '#2a4a2a', font: '15px monospace' });
    }

    #renderOverworld() {
      const ts = TILE_SIZE;
      const visualCol = this.#isMoving
        ? this.#moveFrom.col + (this.#moveTarget.col - this.#moveFrom.col) * Math.min(1, this.#moveProgress)
        : this.#playerPos.col;
      const visualRow = this.#isMoving
        ? this.#moveFrom.row + (this.#moveTarget.row - this.#moveFrom.row) * Math.min(1, this.#moveProgress)
        : this.#playerPos.row;

      this.#renderer.centerOn(
        visualCol * ts + ts / 2,
        visualRow * ts + ts / 2
      );

      if (this.#overworldMap)
        this.#renderer.drawInfiniteMap((c, r) => this.#overworldMap.getTile(c, r), this.#dimension);

      if (this.#overworldMap) {
        const cam = this.#renderer.camera;
        const locs = this.#overworldMap.getVisibleLocations(cam.x, cam.y, CANVAS_W, CANVAS_H, ts);
        for (const loc of locs) {
          const name = loc.name || '';
          const color = loc.tile === OverworldTile.DUNGEON ? '#f88' : loc.tile === OverworldTile.TOWN ? '#ff8' : '#8ff';
          this.#renderer.drawText(
            loc.col * ts + ts / 2, loc.row * ts - 3,
            name,
            { color, font: 'bold 11px monospace', align: 'center' }
          );
        }
      }

      const px = visualCol * ts;
      const py = visualRow * ts;
      const camX = this.#renderer.camera.x;
      const camY = this.#renderer.camera.y;
      let drawnSprite = false;
      if (TR.spriteResolver) {
        const sprite = TR.spriteResolver.resolve('paladin', 'party');
        if (sprite) {
          const ctx = this.#renderer.bufCtx;
          ctx.imageSmoothingEnabled = false;
          if (sprite.tint)
            this.#renderer.compositor.drawComposite(ctx,
              [{ img: sprite.img, rect: { x: sprite.srcX, y: sprite.srcY, w: sprite.srcW, h: sprite.srcH }, tint: sprite.tint }],
              ts - 4, px - camX + 2, py - camY + 2);
          else
            ctx.drawImage(sprite.img, sprite.srcX, sprite.srcY, sprite.srcW, sprite.srcH,
              px - camX + 2, py - camY + 2, ts - 4, ts - 4);
          drawnSprite = true;
        }
      }
      if (!drawnSprite) {
        const assets = this.#renderer.assets;
        const playerSprite = (TR.resolveSprite && TR.resolveSprite('paladin', 'party')) || TR.PLAYER_SPRITE;
        const playerSheet = (playerSprite && playerSprite.sheet) || 'dungeon';
        if (assets && assets.ready && assets.has(playerSheet) && playerSprite)
          drawnSprite = assets.drawSprite(this.#renderer.bufCtx, playerSheet, playerSprite, px - camX + 2, py - camY + 2, ts - 4);
      }
      if (!drawnSprite)
        this.#renderer.drawRect(px + 4, py + 4, ts - 8, ts - 8, '#ff4444');

      if (this.#walkPath && this.#walkPath.length > 0)
        for (const step of this.#walkPath)
          this.#renderer.highlightTile(step.col, step.row, 'rgba(255,255,100,0.2)');

      if (this.#hoverTile && this.#overworldMap) {
        const passable = this.#overworldMap.isPassable(this.#hoverTile.col, this.#hoverTile.row);
        const color = passable ? 'rgba(255,255,0,0.3)' : 'rgba(255,100,100,0.15)';
        this.#renderer.highlightTile(this.#hoverTile.col, this.#hoverTile.row, color);
      }

      this.#renderOverworldPartyStatus();

      if (this.#encounterTimer > 0 && this.#encounterMsg) {
        this.#renderer.drawScreenText(CANVAS_W / 2, CANVAS_H / 2, this.#encounterMsg, { color: '#f44', font: 'bold 28px serif', align: 'center' });
      }

      this.#renderer.drawScreenText(10, CANVAS_H - 8, 'Arrow keys / WASD to move, Click to walk', { color: 'rgba(200,200,200,0.5)', font: '12px monospace' });
    }

    #renderOverworldPartyStatus() {
      if (!this.#party || !this.#partyHp)
        return;
      const x = CANVAS_W - 200;
      const y = 8;
      const w = 192;
      const lineH = 22;
      const h = 40 + this.#party.length * lineH;

      this.#renderer.drawPanel(x, y, w, h, { bg: 'rgba(0,0,0,0.75)' });
      this.#renderer.drawScreenText(x + w / 2, y + 16, `Party  Gold: ${this.#gold}`, { color: '#c8a84e', font: 'bold 12px monospace', align: 'center' });

      for (let i = 0; i < this.#party.length; ++i) {
        const c = this.#party[i];
        const hp = this.#partyHp[i];
        const sy = y + 24 + i * lineH;
        const hpColor = hp >= c.maxHp ? '#4a4' : hp > c.maxHp * 0.25 ? '#aa4' : '#a44';
        this.#renderer.drawScreenText(x + 6, sy + 14, `${c.name.substring(0, 8)} L${c.level}`, { color: '#ccc', font: '11px monospace' });
        this.#renderer.drawScreenText(x + w - 6, sy + 14, `${hp}/${c.maxHp}`, { color: hpColor, font: '11px monospace', align: 'right' });
      }
    }

    #renderCamp() {
      this.#renderer.drawPanel(0, 0, CANVAS_W, CANVAS_H, { bg: '#1a1a1a' });
      this.#renderer.drawScreenText(CANVAS_W / 2, 54, 'CAMP', { color: '#c8a84e', font: 'bold 36px serif', align: 'center' });
      this.#renderer.drawScreenText(CANVAS_W / 2, 86, 'Rest and manage your party', { color: '#888', font: '16px monospace', align: 'center' });

      if (this.#party && this.#partyHp) {
        const cardW = 120;
        const startX = Math.floor(CANVAS_W / 2 - (this.#party.length * (cardW + 14)) / 2);
        for (let i = 0; i < this.#party.length; ++i) {
          const c = this.#party[i];
          const hp = this.#partyHp[i];
          const x = startX + i * (cardW + 14);
          const y = 110;
          this.#renderer.drawPanel(x, y, cardW, 58, { bg: '#222' });
          this.#renderer.drawScreenText(x + cardW / 2, y + 22, c.name.substring(0, 10), { color: '#ccc', font: '12px monospace', align: 'center' });
          const hpColor = hp >= c.maxHp ? '#4a4' : hp > c.maxHp * 0.25 ? '#aa4' : '#a44';
          this.#renderer.drawScreenText(x + cardW / 2, y + 44, `HP: ${hp}/${c.maxHp}`, { color: hpColor, font: '12px monospace', align: 'center' });
        }
      }

      const labels = ['Inventory', 'Equipment', 'Rest (Heal Party)', 'Return to Overworld'];
      for (let i = 0; i < labels.length; ++i)
        this.#renderer.drawButton(520, 210 + i * 60, 240, 44, labels[i], { bg: i === 2 ? '#2a4a2a' : '#333', font: '15px monospace' });
    }

    #renderTown() {
      this.#renderer.drawPanel(0, 0, CANVAS_W, CANVAS_H, { bg: '#1e1a14' });

      if (this.#shopStock) {
        this.#renderShop();
        return;
      }

      this.#renderer.drawScreenText(CANVAS_W / 2, 54, 'TOWN', { color: '#c8a84e', font: 'bold 36px serif', align: 'center' });
      this.#renderer.drawScreenText(CANVAS_W / 2, 86, 'Visit town facilities', { color: '#888', font: '16px monospace', align: 'center' });

      if (this.#party && this.#partyHp) {
        const cardW = 120;
        const startX = Math.floor(CANVAS_W / 2 - (this.#party.length * (cardW + 14)) / 2);
        for (let i = 0; i < this.#party.length; ++i) {
          const c = this.#party[i];
          const hp = this.#partyHp[i];
          const x = startX + i * (cardW + 14);
          const y = 110;
          this.#renderer.drawPanel(x, y, cardW, 58, { bg: '#222' });
          this.#renderer.drawScreenText(x + cardW / 2, y + 22, c.name.substring(0, 10), { color: '#ccc', font: '12px monospace', align: 'center' });
          const hpColor = hp >= c.maxHp ? '#4a4' : hp > c.maxHp * 0.25 ? '#aa4' : '#a44';
          this.#renderer.drawScreenText(x + cardW / 2, y + 44, `HP: ${hp}/${c.maxHp}`, { color: hpColor, font: '12px monospace', align: 'center' });
        }
      }

      this.#renderer.drawScreenText(CANVAS_W / 2, 190, `Gold: ${this.#gold}  |  Inventory: ${this.#inventory.length} items`, { color: '#aaa', font: '13px monospace', align: 'center' });

      const labels = ['Weaponsmith', 'Armorer', 'General Store', 'Inn (Heal Party)', 'Leave Town'];
      for (let i = 0; i < labels.length; ++i)
        this.#renderer.drawButton(520, 210 + i * 50, 240, 40, labels[i], { bg: i === 3 ? '#2a4a2a' : '#333', font: '14px monospace' });
    }

    #renderShop() {
      const cfg = Shop && ShopType ? TR.SHOP_CONFIGS[this.#shopType] : null;
      const title = cfg ? cfg.name : 'Shop';
      this.#renderer.drawScreenText(CANVAS_W / 2, 36, title, { color: '#c8a84e', font: 'bold 28px serif', align: 'center' });
      this.#renderer.drawScreenText(CANVAS_W / 2, 60, `Gold: ${this.#gold}`, { color: '#daa520', font: 'bold 14px monospace', align: 'center' });

      // Shop stock on left
      this.#renderer.drawScreenText(200, 90, 'For Sale', { color: '#8a8', font: 'bold 16px monospace', align: 'center' });
      const stock = this.#shopStock || [];
      for (let i = 0; i < stock.length; ++i) {
        const item = stock[i];
        const y = 110 + i * 36;
        const price = Shop ? Shop.buyPrice(item) : item.value;
        const canBuy = this.#gold >= price;
        this.#renderer.drawPanel(40, y, 320, 30, { bg: '#1a1a1a' });
        this.#renderer.drawScreenText(50, y + 20, item.name, { color: canBuy ? '#ccc' : '#666', font: '12px monospace', align: 'left' });
        this.#renderer.drawScreenText(340, y + 20, `${price}g`, { color: canBuy ? '#daa520' : '#644', font: '12px monospace', align: 'right' });
      }

      // Inventory on right
      this.#renderer.drawScreenText(800, 90, 'Inventory', { color: '#88a', font: 'bold 16px monospace', align: 'center' });
      for (let i = 0; i < this.#inventory.length && i < 14; ++i) {
        const item = this.#inventory[i];
        const y = 110 + i * 36;
        const sell = Shop ? Shop.sellPrice(item) : Math.floor(item.value * 0.5);
        this.#renderer.drawPanel(600, y, 380, 30, { bg: '#1a1a1a' });
        this.#renderer.drawScreenText(610, y + 20, `${item.name}${item.quantity > 1 ? ' x' + item.quantity : ''}`, { color: '#ccc', font: '12px monospace', align: 'left' });
        this.#renderer.drawScreenText(960, y + 20, `Sell: ${sell}g`, { color: '#a86', font: '12px monospace', align: 'right' });
      }

      this.#renderer.drawButton(CANVAS_W / 2 - 80, CANVAS_H - 60, 160, 40, 'Back', { bg: '#444', font: '15px monospace' });
    }

    #renderCombat() {
      const eng = this.#combatEngine;
      if (!eng || !eng.grid) {
        this.#renderer.drawPanel(0, 0, CANVAS_W, CANVAS_H, { bg: '#0a0a1a' });
        this.#renderer.drawScreenText(CANVAS_W / 2, CANVAS_H / 2, 'Loading combat...', { color: '#888', font: '16px monospace', align: 'center' });
        return;
      }

      const ts = this.#combatTileSize;
      let ox = this.#combatOffsetX;
      let oy = this.#combatOffsetY;

      if (this.#overworldCombat && this.#overworldMap) {
        const origin = this.#overworldCombatOrigin || this.#playerPos;
        this.#renderer.centerOn(
          origin.col * TILE_SIZE + TILE_SIZE / 2,
          origin.row * TILE_SIZE + TILE_SIZE / 2
        );
        this.#renderer.drawInfiniteMap((c, r) => this.#overworldMap.getTile(c, r), this.#dimension);

        const cam = this.#renderer.camera;
        const tileRect = this.#overworldMap.extractTileRect(origin.col, origin.row, eng.grid.cols, eng.grid.rows);
        ox = tileRect.startCol * TILE_SIZE - cam.x;
        oy = tileRect.startRow * TILE_SIZE - cam.y;
        this.#combatOffsetX = ox;
        this.#combatOffsetY = oy;
      } else {
        this.#renderer.drawPanel(0, 0, CANVAS_W, CANVAS_H, { bg: '#0a0a1a' });
        this.#renderer.drawCombatGrid(eng.grid, ts, ox, oy, this.#combatBiome);
      }

      const gridPxW = eng.grid.cols * ts;
      const menuX = ox + gridPxW + 20;
      const logY = oy + eng.grid.rows * ts + 12;

      // HUD drawn via HTML floating windows (CombatUI), not canvas
      if (this._combatUI) {
        this._combatUI.updateActiveChar(eng.currentUnit);
        this._combatUI.updateLog(eng.combatLog);
        this._combatUI.updateInitBar(eng.turnOrder, eng.turnIndex, eng.round, (id) => eng.unitById(id));

        // Reset spell menu when turn changes
        const curId = eng.currentUnit?.id || '';
        if (this._lastActiveUnitId !== curId) {
          this._lastActiveUnitId = curId;
          this.#spellMenuOpen = false;
        }

        // Update action buttons (skip when spell menu is open to preserve spell list)
        if (!this.#spellMenuOpen) {
          const actionBtns = this.#getActionButtons();
          this._combatUI.updateActions(actionBtns.map(b => ({
            label: b.label, disabled: b.disabled, action: b.label
          })));
        }
      }

      const phase = eng.phase;
      if (phase === CombatPhase.AWAITING_MOVE && eng.moveRange) {
        const pulseAlpha = (0.15 + 0.15 * Math.sin(this.#combatTime * 3)).toFixed(3);
        this.#renderer.highlightTiles(eng.moveRange, ts, ox, oy, `rgba(80,140,255,${pulseAlpha})`);
      }

      if (phase === CombatPhase.AWAITING_TARGET) {
        const targets = eng.getAttackTargets(eng.currentUnit.id);
        this.#renderer.highlightAttackTargets(targets, eng.units, ts, ox, oy);
      }

      if (phase === CombatPhase.AWAITING_SPELL_TARGET && eng.selectedSpell) {
        const spell = eng.selectedSpell;
        const isAoe = spell.aoe && spell.aoe > 0;
        const rangeColor = spell.target === 'ally' ? 'rgba(80,255,140,0.15)' : 'rgba(200,80,255,0.15)';
        const blastColor = spell.target === 'ally' ? 'rgba(80,255,140,0.35)' : 'rgba(200,80,255,0.35)';

        if (isAoe) {
          const rangeTiles = eng.getAoeSpellRange(eng.currentUnit.id, spell.id);
          for (const t of rangeTiles)
            this.#renderer.drawScreenRect(ox + t.col * ts, oy + t.row * ts, ts, ts, rangeColor);

          const hover = this.#combatHoverTile;
          if (hover) {
            const casterPos = eng.currentUnit.position;
            const hoverDist = Math.abs(hover.col - casterPos.col) + Math.abs(hover.row - casterPos.row);
            if (hoverDist <= spell.range)
              this.#renderer.drawAoeRadius(ox, oy, ts, hover.col, hover.row, spell.aoe, eng.grid.cols, eng.grid.rows, blastColor);
          }
        } else {
          const targets = eng.getSpellTargets(eng.currentUnit.id, spell.id);
          for (const tid of targets) {
            const u = eng.unitById(tid);
            if (u) {
              const p = u.position;
              this.#renderer.drawScreenRect(ox + p.col * ts, oy + p.row * ts, ts, ts, blastColor);
            }
          }
        }
      }

      for (const u of eng.units) {
        if (this.#combatMovePath && this.#combatMoveUnit === u.id) continue;
        const isActive = eng.currentUnit && eng.currentUnit.id === u.id;
        const pos = (isActive && this.#combatTentativePos) ? this.#combatTentativePos : u.position;
        this.#renderer.drawUnitToken(pos.col, pos.row, u, ts, ox, oy, { active: isActive, dead: !u.isAlive });
      }

      if (this.#combatMovePath && this.#combatMoveUnit) {
        const u = eng.unitById(this.#combatMoveUnit);
        if (u) {
          const idx = Math.min(this.#combatMoveIdx, this.#combatMovePath.length - 1);
          const from = idx > 0 ? this.#combatMovePath[idx - 1] : (this.#combatMoveStart || u.position);
          const to = this.#combatMovePath[idx];
          const t = Math.min(1, this.#combatMoveProgress);
          const vc = from.col + (to.col - from.col) * t;
          const vr = from.row + (to.row - from.row) * t;
          const isActive = eng.currentUnit && eng.currentUnit.id === u.id;
          this.#renderer.drawUnitTokenAt(vc, vr, u, ts, ox, oy, { active: isActive });
        }
      }

      if (this.#combatAnim) {
        const anim = this.#combatAnim;
        if ((anim.type === 'player_attack' || anim.type === 'enemy_attack' || anim.type === 'spell_cast') && anim.result && anim.defender) {
          const dur = anim.duration || 2.0;
          const progress = 1 - (anim.timer / dur);
          this.#renderer.drawBattleScene(anim.attacker, anim.defender, anim.result, progress, anim.type);
        } else {
          if (anim.defender && anim.defender.position) {
            const dp = anim.defender.position;
            const dx = ox + dp.col * ts;
            const dy = oy + dp.row * ts;
            const flash = Math.sin(anim.timer * 20) > 0;
            if (flash)
              this.#renderer.drawScreenRect(dx, dy, ts, ts, 'rgba(255,255,255,0.4)');
          }
          if (anim.attacker && anim.attacker.position) {
            const ap = anim.attacker.position;
            const ax = ox + ap.col * ts;
            const ay = oy + ap.row * ts;
            const pulse = 0.5 + 0.5 * Math.sin(anim.timer * 15);
            const auraColor = `rgba(255,200,0,${(pulse * 0.3).toFixed(2)})`;
            this.#renderer.drawScreenRect(ax, ay, ts, ts, auraColor);
          }
        }
      }

      for (const f of this.#combatFloats)
        this.#renderer.drawScreenText(f.x, f.y, f.text, { color: f.color, font: 'bold 16px monospace', align: 'center' });

      // Canvas-rendered panels removed — now handled by CombatUI HTML overlays

      if (this.#combatHoverTile && eng.grid.inBounds(this.#combatHoverTile.col, this.#combatHoverTile.row)) {
        const ht = this.#combatHoverTile;
        const terrain = eng.grid.terrainAt(ht.col, ht.row);
        const uid = eng.grid.unitAt(ht.col, ht.row);
        const lines = [];
        if (terrain)
          lines.push(`${terrain.name} (cost ${terrain.moveCost})`);
        if (uid) {
          const u = eng.unitById(uid);
          if (u)
            lines.push(`${u.name} HP:${u.currentHp}/${u.maxHp} AC:${u.ac}`);
        }
        if (lines.length > 0) {
          const mx = ox + ht.col * ts + ts + 4;
          const my = oy + ht.row * ts;
          this.#renderer.drawTooltip(mx, my, lines);
        }
      }

      if (this.#contextMenu)
        this.#renderer.drawContextMenu(this.#contextMenu.x, this.#contextMenu.y, this.#contextMenu.items, this.#contextMenuHover);

      if (phase === CombatPhase.VICTORY) {
        this.#renderer.drawPanel(CANVAS_W / 2 - 160, CANVAS_H / 2 - 65, 320, 130, { bg: 'rgba(20,40,20,0.95)', border: '#4c4' });
        this.#renderer.drawScreenText(CANVAS_W / 2, CANVAS_H / 2 - 22, 'VICTORY!', { color: '#4c4', font: 'bold 36px serif', align: 'center' });
        this.#renderer.drawButton(CANVAS_W / 2 - 80, CANVAS_H / 2 + 14, 160, 40, 'Continue', { bg: '#2a4a2a', font: '15px monospace' });
      } else if (phase === CombatPhase.DEFEAT) {
        this.#renderer.drawPanel(CANVAS_W / 2 - 160, CANVAS_H / 2 - 65, 320, 130, { bg: 'rgba(40,20,20,0.95)', border: '#c44' });
        this.#renderer.drawScreenText(CANVAS_W / 2, CANVAS_H / 2 - 22, 'DEFEAT', { color: '#c44', font: 'bold 36px serif', align: 'center' });
        this.#renderer.drawButton(CANVAS_W / 2 - 80, CANVAS_H / 2 + 14, 160, 40, 'Title Screen', { bg: '#4a2a2a', font: '15px monospace' });
      }
    }

    #getActionButtons() {
      const eng = this.#combatEngine;
      if (!eng || !eng.currentUnit || eng.currentUnit.faction !== 'party' || this.#combatAnim || this.#combatMovePath)
        return [];
      const phase = eng.phase;
      const unit = eng.currentUnit;
      const buttons = [];

      const effectivePos = this.#combatTentativePos || unit.position;
      const hasSpells = unit.spells && unit.spells.length > 0;
      const canCastAnyWithTargets = hasSpells && unit.spells.some(id => {
        const sp = Spells ? Spells.byId(id) : null;
        if (!sp || !unit.canCastSpell(sp))
          return false;
        if (this.#combatTentativePos) {
          const targets = Spells.getSpellTargetsInRange(eng.grid, effectivePos, sp, unit.faction, eng.units);
          return targets.length > 0;
        }
        return eng.getSpellTargets(unit.id, sp.id).length > 0;
      });

      if (phase === CombatPhase.AWAITING_MOVE) {
        if (!this.#combatTentativePos)
          buttons.push({ label: 'Click tile to move', disabled: true, bg: '#1a2a3a' });
        const targets = this.#getAttackTargetsFromPos(eng, unit, effectivePos);
        if (targets.length > 0)
          buttons.push({ label: 'Attack', disabled: false, bg: '#5a2a2a' });
        if (canCastAnyWithTargets)
          buttons.push({ label: 'Cast', disabled: false, bg: '#2a2a5a' });
        buttons.push({ label: 'Wait', disabled: false, bg: '#3a3a3a' });
        buttons.push({ label: 'Flee', disabled: false, bg: '#4a3a1a' });
      } else if (phase === CombatPhase.AWAITING_ACTION) {
        const targets = this.#getAttackTargetsFromPos(eng, unit, effectivePos);
        if (targets.length > 0)
          buttons.push({ label: 'Attack', disabled: false, bg: '#5a2a2a' });
        if (canCastAnyWithTargets)
          buttons.push({ label: 'Cast', disabled: false, bg: '#2a2a5a' });
        buttons.push({ label: 'Undo Move', disabled: false, bg: '#4a4a2a' });
        buttons.push({ label: 'Wait', disabled: false, bg: '#3a3a3a' });
        buttons.push({ label: 'Flee', disabled: false, bg: '#4a3a1a' });
      } else if (phase === CombatPhase.AWAITING_TARGET) {
        buttons.push({ label: 'Cancel', disabled: false, bg: '#4a3a2a' });
      } else if (phase === CombatPhase.AWAITING_SPELL_TARGET) {
        const spellName = eng.selectedSpell ? eng.selectedSpell.name : 'Spell';
        buttons.push({ label: `${spellName}`, disabled: true, bg: '#2a2a5a' });
        buttons.push({ label: 'Cancel', disabled: false, bg: '#4a3a2a' });
      }
      return buttons;
    }

    #getSpellMenuButtons(unit) {
      if (!unit || !unit.spells || !Spells)
        return [];
      const buttons = [];
      for (const spellId of unit.spells) {
        const spell = Spells.byId(spellId);
        if (!spell)
          continue;
        const canCast = unit.canCastSpell(spell);
        const costStr = spell.level === 0 ? '' : ` (${spell.mpCost} MP)`;
        buttons.push({
          label: `${spell.name}${costStr}`,
          spellId: spell.id,
          disabled: !canCast,
          bg: canCast ? '#2a2a5a' : '#1a1a2a',
          description: spell.description,
          range: spell.range,
          target: spell.target,
        });
      }
      return buttons;
    }

    #startCombat(enemies, biome, aiTier) {
      if (TR.spriteResolver)
        TR.spriteResolver.preloadCreatures(enemies.map(e => e.templateId));

      const prng = PRNG.random();
      this.#combatEngine = new CombatEngine(prng);
      if (aiTier != null) this.#combatEngine.setAiTier(aiTier);
      // Vary combat grid size by encounter
      const enemyCount = enemies.length;
      const gridCols = enemyCount >= 4 ? 14 : aiTier >= 3 ? 16 : 12;
      const gridRows = enemyCount >= 4 ? 12 : aiTier >= 3 ? 14 : 10;
      biome = biome || 'plains';
      this.#combatBiome = biome;

      const partyWithHp = this.#party.map((c, i) => {
        const hp = this.#partyHp ? this.#partyHp[i] : c.maxHp;
        if (hp >= c.maxHp)
          return c;
        return Object.freeze({ ...c, hp });
      });

      this.#combatEngine.initCombat(partyWithHp, enemies, gridCols, gridRows, biome);
      this.#combatEngine.startTurn();
      // Tiles fill the canvas: reserve 36px top (active char) + 36px bottom (init bar)
      const availW = CANVAS_W - 8;
      const availH = CANVAS_H - 72;
      this.#combatTileSize = Math.min(Math.floor(availW / gridCols), Math.floor(availH / gridRows));
      const gridPxW = gridCols * this.#combatTileSize;
      const gridPxH = gridRows * this.#combatTileSize;
      this.#combatOffsetX = Math.floor((CANVAS_W - gridPxW) / 2);
      this.#combatOffsetY = 36 + Math.floor((availH - gridPxH) / 2);
      this.#combatMovePath = null;
      this.#combatMoveUnit = null;

      if (this._combatUI) this._combatUI.show();

      if (this.#combatEngine.currentUnit && this.#combatEngine.currentUnit.faction === 'enemy')
        this.#processEnemyTurns();
    }

    #startOverworldCombat(enemies, biome, aiTier) {
      if (TR.spriteResolver)
        TR.spriteResolver.preloadCreatures(enemies.map(e => e.templateId));

      const prng = PRNG.random();
      this.#combatEngine = new CombatEngine(prng);
      if (aiTier != null) this.#combatEngine.setAiTier(aiTier);
      const gridCols = 14;
      const gridRows = 12;
      biome = biome || 'plains';
      this.#combatBiome = biome;

      const partyWithHp = this.#party.map((c, i) => {
        const hp = this.#partyHp ? this.#partyHp[i] : c.maxHp;
        if (hp >= c.maxHp)
          return c;
        return Object.freeze({ ...c, hp });
      });

      const origin = this.#overworldCombatOrigin || this.#playerPos;
      const tileRect = this.#overworldMap.extractTileRect(origin.col, origin.row, gridCols, gridRows);
      const grid = CombatGrid.fromOverworldTiles(tileRect.tiles, gridCols, gridRows);
      const partyGridPos = { col: Math.floor(gridCols / 2), row: Math.floor(gridRows / 2) };

      this.#combatEngine.initCombatWithGrid(partyWithHp, enemies, grid, biome, partyGridPos);
      this.#combatEngine.startTurn();
      // Overworld combat uses the overworld tile size since background is the actual map
      this.#combatTileSize = TILE_SIZE;
      this.#combatOffsetX = 0;
      this.#combatOffsetY = 0;

      if (this._combatUI) this._combatUI.show();
      this.#combatMovePath = null;
      this.#combatMoveUnit = null;

      if (this.#combatEngine.currentUnit && this.#combatEngine.currentUnit.faction === 'enemy')
        this.#processEnemyTurns();
    }

    #syncPartyHpFromCombat() {
      if (!this.#combatEngine || !this.#partyHp)
        return;
      const partyUnits = this.#combatEngine.units.filter(u => u.faction === 'party');
      for (let i = 0; i < partyUnits.length && i < this.#partyHp.length; ++i)
        this.#partyHp[i] = partyUnits[i].currentHp;
    }

    #distributeRewards() {
      if (!this.#combatEngine || !this.#party || !this.#partyXp)
        return;
      const rewards = this.#combatEngine.getRewards();
      this.#gold += rewards.gold;
      const survivors = this.#combatEngine.units.filter(u => u.faction === 'party' && u.isAlive);
      const xpEach = survivors.length > 0 ? Math.floor(rewards.xp / survivors.length) : 0;
      const levelUps = [];

      for (let i = 0; i < this.#party.length; ++i) {
        const unit = this.#combatEngine.units.find(u => u.id === `party_${i}`);
        if (!unit || !unit.isAlive)
          continue;
        this.#partyXp[i] += xpEach;
        const oldLevel = this.#party[i].level;
        const newLevel = Character.levelFromXp(this.#partyXp[i]);
        if (newLevel > oldLevel) {
          let c = this.#party[i];
          for (let l = oldLevel; l < newLevel; ++l)
            c = Character.levelUp(c);
          const arr = [...this.#party];
          arr[i] = c;
          this.#party = Object.freeze(arr);
          this.#partyHp[i] = c.maxHp;
          levelUps.push(c.name);
        }
      }

      if (Items && rewards.loot)
        for (const item of rewards.loot)
          this.#inventory = Items.addToInventory(this.#inventory, item);

      this.#lastRewards = { xp: rewards.xp, xpEach, gold: rewards.gold, levelUps, loot: rewards.loot || [] };
    }

    #restParty() {
      if (!this.#party || !this.#partyHp)
        return;
      for (let i = 0; i < this.#party.length; ++i)
        this.#partyHp[i] = this.#party[i].maxHp;
    }

    #processEnemyTurns() {
      this.#enemyQueue = [true];
      this.#executeNextEnemy();
    }

    #executeNextEnemy() {
      this.#enemyQueue = [];
      const eng = this.#combatEngine;
      if (!eng || eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT)
        return;

      const unit = eng.currentUnit;
      if (!unit || unit.faction !== 'enemy' || !unit.isAlive) {
        if (unit && !unit.isAlive) {
          eng.nextTurn();
          eng.startTurn();
          if (eng.currentUnit && eng.currentUnit.faction === 'enemy') {
            this.#enemyQueue = [true];
            this.#executeNextEnemy();
          }
        }
        return;
      }

      const prevPos = { col: unit.position.col, row: unit.position.row };
      let attackEvent = null;
      const captureAttack = (e) => { attackEvent = e; };
      eng.on('attackResolved', captureAttack);
      eng.executeEnemyTurn(unit.id);
      eng.off('attackResolved', captureAttack);

      const newPos = unit.position;
      const moved = prevPos.col !== newPos.col || prevPos.row !== newPos.row;

      const showAttack = () => {
        if (attackEvent) {
          const def = attackEvent.defender;
          const pos = def.position;
          const ts = this.#combatTileSize;
          const ox = this.#combatOffsetX;
          const oy = this.#combatOffsetY;
          const dmg = attackEvent.damage;
          const crit = attackEvent.critical;
          const hit = attackEvent.result.hit;

          if (hit) {
            this.#combatFloats.push({
              x: ox + pos.col * ts + ts / 2,
              y: oy + pos.row * ts,
              text: crit ? `CRIT -${dmg}!` : `-${dmg}`,
              color: crit ? '#ffd700' : '#ff4444',
              timer: 1.0,
            });
          } else {
            this.#combatFloats.push({
              x: ox + pos.col * ts + ts / 2,
              y: oy + pos.row * ts,
              text: 'MISS',
              color: '#888',
              timer: 0.8,
            });
          }

          this.#combatAnim = {
            type: 'enemy_attack',
            timer: 2.0,
            duration: 2.0,
            attacker: unit,
            defender: def,
            result: {
              hit,
              damage: dmg,
              critical: crit,
              flanking: attackEvent.flanking,
              d20: attackEvent.result.d20,
              total: attackEvent.result.total,
              natural1: attackEvent.result.natural1,
              natural20: attackEvent.result.natural20,
            },
          };
        } else {
          this.#combatAnim = {
            type: 'enemy_move',
            timer: 0.15,
            attacker: unit,
          };
        }
      };

      if (moved) {
        const path = Pathfinding.findPath(eng.grid, prevPos, newPos, 'enemy');
        if (path && path.length > 1) {
          this.#combatMoveStart = { ...prevPos };
          this.#combatMovePath = path.slice(1);
          this.#combatMoveUnit = unit.id;
          this.#combatMoveIdx = 0;
          this.#combatMoveProgress = 0;
          this.#combatMoveCallback = showAttack;
          return;
        }
      }
      showAttack();
    }

    #finishCombatAnim() {
      const animType = this.#combatAnim ? this.#combatAnim.type : null;
      this.#combatAnim = null;
      this.#combatTentativePos = null;
      this.#combatOriginalPos = null;
      const eng = this.#combatEngine;
      if (!eng || eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT)
        return;

      if (animType === 'player_attack' || animType === 'spell_cast') {
        eng.nextTurn();
        eng.startTurn();
        if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
          this.#processEnemyTurns();
        return;
      }

      eng.nextTurn();
      eng.startTurn();
      if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
        this.#processEnemyTurns();
    }

    #startAttackAnim(attackerId, defenderId, result) {
      const eng = this.#combatEngine;
      const attacker = eng.unitById(attackerId);
      const defender = eng.unitById(defenderId);
      if (!attacker || !defender)
        return;

      const pos = defender.position;
      const ts = this.#combatTileSize;
      const ox = this.#combatOffsetX;
      const oy = this.#combatOffsetY;

      if (result.hit) {
        this.#combatFloats.push({
          x: ox + pos.col * ts + ts / 2,
          y: oy + pos.row * ts,
          text: result.critical ? `CRIT -${result.damage}!` : `-${result.damage}`,
          color: result.critical ? '#ffd700' : '#ff4444',
          timer: 1.2,
        });
      } else {
        this.#combatFloats.push({
          x: ox + pos.col * ts + ts / 2,
          y: oy + pos.row * ts,
          text: 'MISS',
          color: '#888888',
          timer: 0.8,
        });
      }

      this.#combatAnim = {
        type: 'player_attack',
        timer: 2.0,
        duration: 2.0,
        attacker,
        defender,
        result,
      };
    }

    #startSpellAnim(caster, target, result) {
      if (!caster || !target)
        return;

      const pos = target.position;
      const ts = this.#combatTileSize;
      const ox = this.#combatOffsetX;
      const oy = this.#combatOffsetY;
      const spell = result.spell;
      const spellName = spell ? spell.name : 'Spell';

      if (result.damage > 0) {
        this.#combatFloats.push({
          x: ox + pos.col * ts + ts / 2,
          y: oy + pos.row * ts,
          text: `-${result.damage}`,
          color: '#bb44ff',
          timer: 1.2,
        });
      }
      if (result.heal > 0) {
        this.#combatFloats.push({
          x: ox + pos.col * ts + ts / 2,
          y: oy + pos.row * ts,
          text: `+${result.heal}`,
          color: '#44ff88',
          timer: 1.2,
        });
      }

      this.#combatAnim = {
        type: 'spell_cast',
        timer: 2.0,
        duration: 2.0,
        attacker: caster,
        defender: target,
        result: { ...result, hit: true, d20: 0, total: 0, natural20: false, natural1: false, critical: false, spellName },
      };
    }

    #startAoeSpellAnim(caster, result) {
      if (!caster || !result || !result.targets)
        return;

      const ts = this.#combatTileSize;
      const ox = this.#combatOffsetX;
      const oy = this.#combatOffsetY;
      const eng = this.#combatEngine;
      const spell = result.spell;
      const spellName = spell ? spell.name : 'AoE Spell';

      for (const t of result.targets) {
        const u = eng ? eng.unitById(t.unitId) : null;
        if (!u) continue;
        const pos = u.position;
        if (t.damage > 0)
          this.#combatFloats.push({ x: ox + pos.col * ts + ts / 2, y: oy + pos.row * ts, text: `-${t.damage}`, color: '#bb44ff', timer: 1.2 });
        if (t.heal > 0)
          this.#combatFloats.push({ x: ox + pos.col * ts + ts / 2, y: oy + pos.row * ts, text: `+${t.heal}`, color: '#44ff88', timer: 1.2 });
      }

      const firstTarget = result.targets.length > 0 ? (eng ? eng.unitById(result.targets[0].unitId) : null) : null;
      this.#combatAnim = {
        type: 'spell_cast',
        timer: 2.0,
        duration: 2.0,
        attacker: caster,
        defender: firstTarget || caster,
        result: { ...result, hit: true, d20: 0, total: 0, natural20: false, natural1: false, critical: false, spellName: `${spellName} (${result.targets.length} hit)` },
      };
    }

    #renderVictory() {
      const xpGained = this.#lastRewards ? this.#lastRewards.xp : 0;
      const goldGained = this.#lastRewards ? this.#lastRewards.gold : 0;
      this.#renderer.drawVictoryScreen(this.#party, xpGained, goldGained, Math.min(1, this.#screenTime * 0.5));

      let y = 250;
      if (this.#lastRewards) {
        const r = this.#lastRewards;
        this.#renderer.drawScreenText(CANVAS_W / 2, y, `+${r.xp} XP (${r.xpEach} each)  +${r.gold} Gold`, { color: '#daa520', font: 'bold 18px monospace', align: 'center' });
        y += 32;
        if (r.levelUps.length > 0) {
          this.#renderer.drawScreenText(CANVAS_W / 2, y, `LEVEL UP: ${r.levelUps.join(', ')}!`, { color: '#ffd700', font: 'bold 18px serif', align: 'center' });
          y += 32;
        }
      }

      if (this.#lastRewards && this.#lastRewards.loot && this.#lastRewards.loot.length > 0) {
        const lootNames = this.#lastRewards.loot.map(i => i.name).join(', ');
        this.#renderer.drawScreenText(CANVAS_W / 2, y, `Loot: ${lootNames}`, { color: '#8cf', font: '14px monospace', align: 'center' });
        y += 24;
      }

      this.#renderer.drawScreenText(CANVAS_W / 2, y, `Gold: ${this.#gold}`, { color: '#aaa', font: '15px monospace', align: 'center' });
      y += 26;

      if (this.#party && this.#partyXp)
        for (let i = 0; i < this.#party.length; ++i) {
          const c = this.#party[i];
          const xp = this.#partyXp[i];
          const needed = Character.xpForNextLevel(c.level);
          const xpInLevel = xp - Character.totalXpForLevel(c.level);
          this.#renderer.drawScreenText(CANVAS_W / 2, y, `${c.name} Lv${c.level}  XP: ${xpInLevel}/${needed}`, { color: '#ccc', font: '14px monospace', align: 'center' });
          y += 22;
        }

      y += 14;
      this.#renderer.drawButton(540, y, 200, 44, 'Continue', { bg: '#2a4a2a', font: '15px monospace' });
      this._victoryBtnY = y;
    }

    #renderDefeat() {
      this.#renderer.drawDefeatScreen(this.#screenTime);
      this.#renderer.drawButton(440, 360, 160, 44, 'Retreat', { bg: '#4a4a2a', font: '15px monospace' });
      this.#renderer.drawButton(680, 360, 160, 44, 'Title', { bg: '#4a2a2a', font: '15px monospace' });
    }

    #onClick(e) {
      switch (this.#sm.current) {
        case GameState.TITLE:
          this.#onClickTitle(e);
          break;
        case GameState.CHARACTER_SELECT:
          this.#onClickCharSelect(e);
          break;
        case GameState.OVERWORLD:
          this.#onClickOverworld(e);
          break;
        case GameState.CAMP:
          this.#onClickCamp(e);
          break;
        case GameState.TOWN:
          this.#onClickTown(e);
          break;
        case GameState.COMBAT:
          this.#onClickCombat(e);
          break;
        case GameState.VICTORY:
          this.#onClickVictory(e);
          break;
        case GameState.DEFEAT:
          this.#onClickDefeat(e);
          break;
      }
    }

    #hitButton(e, btn) {
      return e.x >= btn.x && e.x <= btn.x + btn.w && e.y >= btn.y && e.y <= btn.y + btn.h;
    }

    #onClickTitle(e) {
      if (this.#hitButton(e, TITLE_BUTTONS[0]))
        this.newGame();
      else if (this.#saveManager.hasSave() && this.#hitButton(e, TITLE_BUTTONS[1]))
        this.#loadGame();
    }

    async #loadGame() {
      this.#sm.transition(GameState.LOAD_GAME);
      try {
        const data = await this.#saveManager.load();
        if (data && data.state) {
          if (data.state.playerPos)
            this.#playerPos = data.state.playerPos;
          if (data.state.overworldSeed != null)
            this.#overworldMap = new OverworldMap(data.state.overworldSeed);
          else
            this.#overworldMap = new OverworldMap(this.#prng.state);
          if (data.state.party && Array.isArray(data.state.party)) {
            const restored = data.state.party.map(c => Character.deserialize(c)).filter(c => c !== null);
            this.#party = Object.freeze(restored);
          }
          if (data.state.partyHp && Array.isArray(data.state.partyHp))
            this.#partyHp = data.state.partyHp.slice();
          if (data.state.partyXp && Array.isArray(data.state.partyXp))
            this.#partyXp = data.state.partyXp.slice();
          if (typeof data.state.gold === 'number')
            this.#gold = data.state.gold;
          if (Items && Array.isArray(data.state.inventory))
            this.#inventory = Items.deserializeInventory(data.state.inventory);
          const target = data.state.lastState || GameState.OVERWORLD;
          if (this.#sm.canTransition(target))
            this.#sm.transition(target);
          else
            this.#sm.transition(GameState.OVERWORLD);
        } else {
          this.#sm.transition(GameState.TITLE);
        }
      } catch (_) {
        this.#sm.transition(GameState.TITLE);
      }
    }

    #onClickCharSelect(e) {
      if (!this.#roster)
        return;

      const season = this.#timeRotation.currentSeason();
      const cardW = 220;
      const cardH = 290;
      const cols = 4;
      const gapX = 20;
      const gapY = 16;
      const totalW = cols * cardW + (cols - 1) * gapX;
      const startX = Math.floor((CANVAS_W - totalW) / 2);
      const startY = 80;

      for (let i = 0; i < this.#roster.length; ++i) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        if (e.x >= x && e.x <= x + cardW && e.y >= y && e.y <= y + cardH) {
          const char = this.#roster[i];
          const raceDef = RACES.find(r => r.id === char.race);
          const classDef = CLASSES.find(c => c.id === char.class);
          const debugAllSeasons = this.#timeRotation._debugAllSeasons === true;
          const raceLocked = !debugAllSeasons && raceDef && raceDef.season && raceDef.season !== season;
          const classLocked = !debugAllSeasons && classDef && classDef.season && classDef.season !== season;
          if (raceLocked || classLocked)
            return;

          const result = Roster.toggleSelection(this.#selectedSlots, i, 4);
          this.#selectedSlots = result.selected;
          if (result.full)
            this.#partyFullFlash = 1.5;
          return;
        }
      }

      const selCount = this.#selectedSlots.size;
      if (selCount >= 1 && selCount <= 4) {
        const btn = { x: 540, y: CANVAS_H - 42, w: 200, h: 36 };
        if (this.#hitButton(e, btn)) {
          this.#party = Roster.selectParty(this.#roster, this.#selectedSlots);
          this.#partyHp = this.#party.map(c => c.maxHp);
          this.#partyXp = this.#party.map(() => 0);
          this.#gold = 0;
          this.#inventory = [];
          this.#lastRewards = null;
          this.#overworldMap = new OverworldMap(this.#prng.state);
          this.#playerPos = { col: 0, row: 0 };
          this.#isMoving = false;
          this.#moveTarget = null;
          this.#moveFrom = null;
          this.#walkPath = null;
          this.#sm.transition(GameState.OVERWORLD);
          if (this.#input && this.#input.keysDown)
            this.#input.keysDown.clear();
        }
      }
    }

    #onClickOverworld(e) {
      const tile = this.#input.screenToTile(e.x, e.y, this.#renderer.camera);
      if (tile.col === this.#playerPos.col && tile.row === this.#playerPos.row)
        return;
      if (!this.#overworldMap || !this.#overworldMap.isPassable(tile.col, tile.row))
        return;
      const path = this.#overworldMap.findPath(this.#playerPos, tile, 100);
      if (!path || path.length < 2)
        return;
      this.#walkPath = path.slice(1);
      if (!this.#isMoving && this.#walkPath.length > 0) {
        const next = this.#walkPath.shift();
        this.#tryMove(next.col, next.row);
      }
    }

    #onClickCamp(e) {
      const buttons = [
        { x: 520, y: 210, w: 240, h: 44 },
        { x: 520, y: 270, w: 240, h: 44 },
        { x: 520, y: 330, w: 240, h: 44 },
        { x: 520, y: 390, w: 240, h: 44 },
      ];
      if (this.#hitButton(e, buttons[2]))
        this.#restParty();
      else if (this.#hitButton(e, buttons[3]))
        this.#sm.transition(GameState.OVERWORLD);
    }

    #onClickTown(e) {
      if (this.#shopStock) {
        this.#onClickShop(e);
        return;
      }

      const buttons = [
        { x: 520, y: 210, w: 240, h: 40 },
        { x: 520, y: 260, w: 240, h: 40 },
        { x: 520, y: 310, w: 240, h: 40 },
        { x: 520, y: 360, w: 240, h: 40 },
        { x: 520, y: 410, w: 240, h: 40 },
      ];
      if (this.#hitButton(e, buttons[0]))
        this.#openShop(ShopType.WEAPONSMITH);
      else if (this.#hitButton(e, buttons[1]))
        this.#openShop(ShopType.ARMORER);
      else if (this.#hitButton(e, buttons[2]))
        this.#openShop(ShopType.GENERAL);
      else if (this.#hitButton(e, buttons[3]))
        this.#restParty();
      else if (this.#hitButton(e, buttons[4]))
        this.#sm.transition(GameState.OVERWORLD);
    }

    #openShop(type) {
      if (!Shop) return;
      const avgLevel = this.#party ? Math.floor(this.#party.reduce((s, c) => s + c.level, 0) / this.#party.length) : 1;
      this.#shopType = type;
      this.#shopStock = Shop.generateStock(new PRNG(Date.now()), type, avgLevel);
    }

    #onClickShop(e) {
      // Back button
      const back = { x: CANVAS_W / 2 - 80, y: CANVAS_H - 60, w: 160, h: 40 };
      if (this.#hitButton(e, back)) {
        this.#shopStock = null;
        this.#shopType = null;
        return;
      }

      const stock = this.#shopStock || [];

      // Buy from stock
      for (let i = 0; i < stock.length; ++i) {
        const btn = { x: 40, y: 110 + i * 36, w: 320, h: 30 };
        if (this.#hitButton(e, btn)) {
          const result = Shop.buyItem(stock, stock[i].id, this.#gold);
          if (result) {
            this.#gold = result.newGold;
            this.#shopStock = result.newStock;
            this.#inventory = Items.addToInventory(this.#inventory, result.item);
          }
          return;
        }
      }

      // Sell from inventory
      for (let i = 0; i < this.#inventory.length && i < 14; ++i) {
        const btn = { x: 600, y: 110 + i * 36, w: 380, h: 30 };
        if (this.#hitButton(e, btn)) {
          const result = Shop.sellItem(this.#inventory, this.#inventory[i].id, this.#gold);
          if (result) {
            this.#gold = result.newGold;
            this.#inventory = result.newInventory;
          }
          return;
        }
      }
    }

    #onClickCombat(e) {
      const eng = this.#combatEngine;
      if (!eng || this.#combatAnim || this.#enemyQueue.length > 0 || this.#combatMovePath)
        return;

      if (this.#contextMenu) {
        const menu = this.#contextMenu;
        const itemH = 28;
        const menuW = 200;
        const padY = 4;
        const mx = Math.min(menu.x, CANVAS_W - menuW - 4);
        const my = Math.min(menu.y, CANVAS_H - (menu.items.length * itemH + padY * 2) - 4);
        for (let i = 0; i < menu.items.length; ++i) {
          const iy = my + padY + i * itemH;
          if (e.x >= mx && e.x <= mx + menuW && e.y >= iy && e.y <= iy + itemH) {
            const item = menu.items[i];
            this.#contextMenu = null;
            this.#contextMenuHover = -1;
            this.#executeContextMenuItem(eng, item, menu.targetId);
            return;
          }
        }
        this.#contextMenu = null;
        this.#contextMenuHover = -1;
        return;
      }

      const phase = eng.phase;

      if (phase === CombatPhase.VICTORY) {
        const btn = { x: CANVAS_W / 2 - 80, y: CANVAS_H / 2 + 14, w: 160, h: 40 };
        if (this.#hitButton(e, btn)) {
          this.#archiveCombatLog();
          this.#hideCombatLogPanel();
          this.#syncPartyHpFromCombat();
          this.#distributeRewards();
          this.#sm.transition(GameState.VICTORY);
          this.#updateHistoryButton();
        }
        return;
      }
      if (phase === CombatPhase.DEFEAT) {
        const btn = { x: CANVAS_W / 2 - 80, y: CANVAS_H / 2 + 14, w: 160, h: 40 };
        if (this.#hitButton(e, btn)) {
          this.#archiveCombatLog();
          this.#hideCombatLogPanel();
          this.#syncPartyHpFromCombat();
          this.#sm.transition(GameState.DEFEAT);
          this.#updateHistoryButton();
        }
        return;
      }

      const ts = this.#combatTileSize;
      const ox = this.#combatOffsetX;
      const oy = this.#combatOffsetY;
      const menuX = ox + eng.grid.cols * ts + 20;

      const actionBtns = this.#getActionButtons();
      const btnW = 170;
      const btnH = 36;
      const btnGap = 6;
      for (let i = 0; i < actionBtns.length; ++i) {
        const btn = actionBtns[i];
        if (btn.disabled)
          continue;
        const by = oy + 5 + i * (btnH + btnGap);
        if (this.#hitButton(e, { x: menuX + 5, y: by, w: btnW, h: btnH })) {
          this.#handleActionButton(btn.label);
          return;
        }
      }

      if (this.#spellMenuOpen && eng.currentUnit) {
        const spellBtns = this.#getSpellMenuButtons(eng.currentUnit);
        const smY = oy + actionBtns.length * (btnH + btnGap) + 15;
        const sBtnH = 28;
        const sGap = 3;
        for (let i = 0; i < spellBtns.length; ++i) {
          const sb = spellBtns[i];
          if (sb.disabled)
            continue;
          const sby = smY + 4 + i * (sBtnH + sGap);
          if (this.#hitButton(e, { x: menuX + 4, y: sby, w: 172, h: sBtnH })) {
            this.#spellMenuOpen = false;
            this.#commitTentativeMove();
            eng.selectSpell(sb.spellId);
            return;
          }
        }
      }

      const gridCol = Math.floor((e.x - ox) / ts);
      const gridRow = Math.floor((e.y - oy) / ts);
      if (!eng.grid.inBounds(gridCol, gridRow))
        return;

      if (phase === CombatPhase.AWAITING_SPELL_TARGET && eng.selectedSpell) {
        const spell = eng.selectedSpell;
        const caster = eng.currentUnit;
        if (spell.aoe && spell.aoe > 0) {
          const result = eng.selectAoeSpellTarget(gridCol, gridRow);
          if (result)
            this.#startAoeSpellAnim(caster, result);
        } else {
          const targetId = eng.grid.unitAt(gridCol, gridRow);
          const target = targetId ? eng.unitById(targetId) : null;
          const result = eng.selectSpellTarget(gridCol, gridRow);
          if (result)
            this.#startSpellAnim(caster, target, result);
        }
        return;
      }

      if (phase === CombatPhase.AWAITING_MOVE) {
        const clickedUnit = eng.grid.unitAt(gridCol, gridRow);
        if (clickedUnit) {
          const target = eng.unitById(clickedUnit);
          if (target && target.faction === 'enemy' && target.isAlive)
            return this.#approachAndAttack(target);
        }
        const key = `${gridCol},${gridRow}`;
        if (eng.moveRange && eng.moveRange.has(key)) {
          if (eng.grid.isOccupied(gridCol, gridRow) && eng.grid.unitAt(gridCol, gridRow) !== eng.currentUnit.id)
            return;
          if (!this.#combatOriginalPos)
            this.#combatOriginalPos = { ...eng.currentUnit.position };
          const visualFrom = this.#combatTentativePos || eng.currentUnit.position;
          const dest = { col: gridCol, row: gridRow };
          if (visualFrom.col !== dest.col || visualFrom.row !== dest.row) {
            const path = Pathfinding.findPath(eng.grid, visualFrom, dest, 'party');
            if (path && path.length > 1) {
              this.#combatMoveStart = { ...visualFrom };
              this.#combatMovePath = path.slice(1);
              this.#combatMoveUnit = eng.currentUnit.id;
              this.#combatMoveIdx = 0;
              this.#combatMoveProgress = 0;
              this.#combatMoveCallback = null;
            }
          }
          this.#combatTentativePos = dest;
        }
      } else if (phase === CombatPhase.AWAITING_TARGET) {
        const attackerId = eng.currentUnit.id;
        const targetId = eng.grid.unitAt(gridCol, gridRow);
        const result = eng.selectTarget(gridCol, gridRow);
        if (result)
          this.#startAttackAnim(attackerId, targetId, result);
      }
    }

    #approachAndAttack(target) {
      const eng = this.#combatEngine;
      const unit = eng.currentUnit;
      if (!unit || !eng.moveRange) return;
      if (this.#combatTentativePos)
        this.#commitTentativeMove();

      const tp = target.position;
      const adjacent = [
        { col: tp.col - 1, row: tp.row },
        { col: tp.col + 1, row: tp.row },
        { col: tp.col, row: tp.row - 1 },
        { col: tp.col, row: tp.row + 1 },
      ];

      let bestTile = null;
      let bestCost = Infinity;
      for (const adj of adjacent) {
        const key = `${adj.col},${adj.row}`;
        if (!eng.moveRange.has(key)) continue;
        if (eng.grid.isOccupied(adj.col, adj.row) && eng.grid.unitAt(adj.col, adj.row) !== unit.id) continue;
        const cost = eng.moveRange.get(key);
        if (cost < bestCost) {
          bestCost = cost;
          bestTile = adj;
        }
      }

      if (!bestTile) {
        let closestTile = null;
        let closestDist = Infinity;
        for (const [key] of eng.moveRange) {
          const [c, r] = key.split(',').map(Number);
          if (eng.grid.isOccupied(c, r) && eng.grid.unitAt(c, r) !== unit.id) continue;
          const dist = Math.abs(c - tp.col) + Math.abs(c - tp.row);
          if (dist < closestDist) {
            closestDist = dist;
            closestTile = { col: c, row: r };
          }
        }
        if (closestTile && (closestTile.col !== unit.position.col || closestTile.row !== unit.position.row)) {
          const prevPos = { ...unit.position };
          this.#combatMoveStart = prevPos;
          eng.selectMoveTile(closestTile.col, closestTile.row);
          eng.confirmMove();
          const path = Pathfinding.findPath(eng.grid, prevPos, closestTile, 'party');
          if (path && path.length > 1) {
            this.#combatMovePath = path.slice(1);
            this.#combatMoveUnit = unit.id;
            this.#combatMoveIdx = 0;
            this.#combatMoveProgress = 0;
            this.#combatMoveCallback = null;
          }
        }
        return;
      }

      const prevPos = { ...unit.position };
      this.#combatMoveStart = prevPos;
      eng.selectMoveTile(bestTile.col, bestTile.row);
      eng.confirmMove();

      const afterMove = () => {
        eng.selectAttack();
        const attackerId = unit.id;
        const targetId = target.id;
        const result = eng.selectTarget(tp.col, tp.row);
        if (result)
          this.#startAttackAnim(attackerId, targetId, result);
      };

      if (prevPos.col !== bestTile.col || prevPos.row !== bestTile.row) {
        const path = Pathfinding.findPath(eng.grid, prevPos, bestTile, 'party');
        if (path && path.length > 1) {
          this.#combatMovePath = path.slice(1);
          this.#combatMoveUnit = unit.id;
          this.#combatMoveIdx = 0;
          this.#combatMoveProgress = 0;
          this.#combatMoveCallback = afterMove;
          return;
        }
      }
      afterMove();
    }

    #getAttackTargetsFromPos(eng, unit, pos) {
      const targets = [];
      for (const other of eng.units) {
        if (other.faction === unit.faction || !other.isAlive)
          continue;
        if (D20.isAdjacent(pos, other.position))
          targets.push(other.id);
      }
      return targets;
    }

    #commitTentativeMove() {
      const eng = this.#combatEngine;
      if (!eng || !this.#combatTentativePos)
        return;
      const pos = this.#combatTentativePos;
      eng.selectMoveTile(pos.col, pos.row);
      eng.confirmMove();
      this.#combatTentativePos = null;
      this.#combatOriginalPos = null;
    }

    #handleActionButton(label) {
      const eng = this.#combatEngine;
      if (!eng || this.#combatAnim || this.#combatMovePath)
        return;

      if (label === 'Wait') {
        this.#spellMenuOpen = false;
        this.#commitTentativeMove();
        eng.selectWait();
        eng.nextTurn();
        eng.startTurn();
        if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
          this.#processEnemyTurns();
      } else if (label === 'Attack') {
        this.#spellMenuOpen = false;
        this.#commitTentativeMove();
        eng.selectAttack();
      } else if (label === 'Cast') {
        this.#spellMenuOpen = !this.#spellMenuOpen;
        this.#spellMenuScroll = 0;
        this.#spellMenuHover = -1;
      } else if (label === 'Undo Move') {
        this.#spellMenuOpen = false;
        this.#combatTentativePos = null;
        this.#combatOriginalPos = null;
        eng.undoMove();
      } else if (label === 'Cancel') {
        this.#spellMenuOpen = false;
        eng.cancelTarget();
      } else if (label === 'Flee') {
        this.#spellMenuOpen = false;
        this.#commitTentativeMove();
        this.#attemptFlee();
      }
    }

    #attemptFlee() {
      const eng = this.#combatEngine;
      if (!eng) return;
      const unit = eng.currentUnit;
      if (!unit) return;

      const dexMod = unit.dexMod;
      const roll = this.#prng.nextInt(1, 20);
      const dc = 12;
      const total = roll + dexMod;

      const pos = this.#combatTentativePos || unit.position;
      const ts = this.#combatTileSize;
      const ox = this.#combatOffsetX;
      const oy = this.#combatOffsetY;
      const fx = ox + pos.col * ts + ts / 2;
      const fy = oy + pos.row * ts;

      if (total >= dc) {
        eng.combatLog.push(`${unit.logName} flees! (d20=${roll}+${dexMod}=${total} vs DC ${dc} - SUCCESS)`);
        this.#combatFloats.push({ x: fx, y: fy, text: 'Fled!', color: '#4c4', timer: 1.0 });
        // Map the fleeing unit's combat grid position back to overworld coordinates
        if (this.#overworldCombatOrigin && eng.grid) {
          const gridCenterCol = Math.floor(eng.grid.cols / 2);
          const gridCenterRow = Math.floor(eng.grid.rows / 2);
          const unitPos = this.#combatTentativePos || unit.position;
          const newCol = this.#overworldCombatOrigin.col - gridCenterCol + unitPos.col;
          const newRow = this.#overworldCombatOrigin.row - gridCenterRow + unitPos.row;
          this.#playerPos = { col: newCol, row: newRow };
        }
        this.#combatTentativePos = null;
        this.#combatOriginalPos = null;
        this.#combatMoveStart = null;
        this.#combatTime = 0;
        this.#syncPartyHpFromCombat();
        this.#combatEngine = null;
        this.#overworldCombat = false;
        this.#overworldCombatOrigin = null;
        this.#sm.transition(GameState.OVERWORLD);
      } else {
        const modStr = dexMod >= 0 ? `+${dexMod}` : `${dexMod}`;
        this.#combatFloats.push({ x: fx, y: fy, text: `Flee failed! (${roll}${modStr}=${total} vs DC ${dc})`, color: '#c44', timer: 1.5 });
        eng.combatLog.push(`${unit.logName} fails to flee! (d20=${roll}+${dexMod}=${total} vs DC ${dc} - FAIL)`);
        eng.selectWait();
        eng.nextTurn();
        eng.startTurn();
        if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
          this.#processEnemyTurns();
      }
    }

    #onRightClick(e) {
      if (this.#sm.current !== GameState.COMBAT)
        return;
      const eng = this.#combatEngine;
      if (!eng)
        return;

      if (this.#contextMenu) {
        this.#contextMenu = null;
        this.#contextMenuHover = -1;
        return;
      }
      if (this.#spellMenuOpen) {
        this.#spellMenuOpen = false;
        return;
      }
      if (eng.phase === CombatPhase.AWAITING_TARGET || eng.phase === CombatPhase.AWAITING_SPELL_TARGET) {
        eng.cancelTarget();
        return;
      }
      if (eng.phase === CombatPhase.AWAITING_ACTION) {
        eng.undoMove();
        return;
      }

      if (eng.phase === CombatPhase.AWAITING_MOVE) {
        const unit = eng.currentUnit;
        if (!unit || unit.faction !== 'party' || this.#combatAnim || this.#combatMovePath)
          return;

        const ts = this.#combatTileSize;
        const ox = this.#combatOffsetX;
        const oy = this.#combatOffsetY;
        const gridCol = Math.floor((e.x - ox) / ts);
        const gridRow = Math.floor((e.y - oy) / ts);
        const effectivePos = this.#combatTentativePos || unit.position;

        if (eng.grid.inBounds(gridCol, gridRow)) {
          const targetId = eng.grid.unitAt(gridCol, gridRow);
          if (targetId) {
            const target = eng.unitById(targetId);
            if (target && target.isAlive) {
              const items = this.#buildContextMenuItems(eng, unit, target, effectivePos);
              if (items.length > 0) {
                this.#contextMenu = { x: e.x, y: e.y, targetId: target.id, items };
                this.#contextMenuHover = -1;
                return;
              }
            }
          } else {
            const items = this.#buildAoeContextMenuItems(eng, unit, effectivePos, gridCol, gridRow);
            if (items.length > 0) {
              this.#contextMenu = { x: e.x, y: e.y, targetId: null, targetTile: { col: gridCol, row: gridRow }, items };
              this.#contextMenuHover = -1;
              return;
            }
          }
        }

        if (this.#combatTentativePos && this.#combatOriginalPos) {
          const from = this.#combatTentativePos;
          const to = this.#combatOriginalPos;
          if (from.col !== to.col || from.row !== to.row) {
            const path = Pathfinding.findPath(eng.grid, from, to, 'party');
            if (path && path.length > 1) {
              this.#combatMoveStart = { ...from };
              this.#combatMovePath = path.slice(1);
              this.#combatMoveUnit = eng.currentUnit.id;
              this.#combatMoveIdx = 0;
              this.#combatMoveProgress = 0;
              this.#combatMoveCallback = null;
            }
          }
          this.#combatTentativePos = null;
          this.#combatOriginalPos = null;
        }
      }
    }

    #buildAoeContextMenuItems(eng, unit, effectivePos, tileCol, tileRow) {
      const items = [];
      if (!Spells || !unit.spells)
        return items;

      for (const spellId of unit.spells) {
        const spell = Spells.byId(spellId);
        if (!spell || !spell.aoe || spell.aoe <= 0 || !unit.canCastSpell(spell))
          continue;
        if (!Spells.isInRange(effectivePos.col, effectivePos.row, tileCol, tileRow, spell.range))
          continue;

        let hasTargets = false;
        for (const u of eng.units) {
          if (!u.isAlive) continue;
          const d = Math.abs(u.position.col - tileCol) + Math.abs(u.position.row - tileRow);
          if (d > spell.aoe) continue;
          if (spell.target === 'enemy' && u.faction === unit.faction) continue;
          if (spell.target === 'ally' && u.faction !== unit.faction) continue;
          hasTargets = true;
          break;
        }
        if (hasTargets)
          items.push({ label: `${spell.name} (AoE)`, action: 'aoe_tile', spellId: spell.id, tileCol, tileRow });
      }
      return items;
    }

    #buildContextMenuItems(eng, unit, target, effectivePos) {
      const items = [];

      if (target.faction !== unit.faction && D20.isAdjacent(effectivePos, target.position))
        items.push({ label: 'Attack', action: 'attack' });

      if (Spells && unit.spells) {
        for (const spellId of unit.spells) {
          const spell = Spells.byId(spellId);
          if (!spell || !unit.canCastSpell(spell))
            continue;
          if (spell.target === 'enemy' && target.faction === unit.faction)
            continue;
          if (spell.target === 'ally' && target.faction !== unit.faction)
            continue;
          if (spell.target === 'self' && target.id !== unit.id)
            continue;
          if (!Spells.isInRange(effectivePos.col, effectivePos.row, target.position.col, target.position.row, spell.range))
            continue;
          const aoeTag = (spell.aoe && spell.aoe > 0) ? ' (AoE)' : '';
          items.push({ label: `${spell.name}${aoeTag}`, action: 'spell', spellId: spell.id });
        }
      }

      return items;
    }

    #executeContextMenuItem(eng, item, targetId) {
      this.#spellMenuOpen = false;
      this.#commitTentativeMove();

      if (item.action === 'aoe_tile' && item.spellId) {
        const caster = eng.currentUnit;
        if (!caster) return;
        eng.selectSpell(item.spellId);
        const result = eng.selectAoeSpellTarget(item.tileCol, item.tileRow);
        if (result)
          this.#startAoeSpellAnim(caster, result);
        return;
      }

      const target = eng.unitById(targetId);
      if (!target || !target.isAlive)
        return;

      if (item.action === 'attack') {
        eng.selectAttack();
        const pos = target.position;
        const attackerId = eng.currentUnit.id;
        const result = eng.selectTarget(pos.col, pos.row);
        if (result)
          this.#startAttackAnim(attackerId, targetId, result);
      } else if (item.action === 'spell' && item.spellId) {
        const spell = Spells ? Spells.byId(item.spellId) : null;
        if (!spell)
          return;
        const caster = eng.currentUnit;
        if (spell.aoe && spell.aoe > 0) {
          eng.selectSpell(item.spellId);
          const result = eng.selectAoeSpellTarget(target.position.col, target.position.row);
          if (result)
            this.#startAoeSpellAnim(caster, result);
        } else {
          eng.selectSpell(item.spellId);
          const result = eng.selectSpellTarget(target.position.col, target.position.row);
          if (result)
            this.#startSpellAnim(caster, target, result);
        }
      }
    }

    #onDoubleClick(e) {
      if (this.#sm.current !== GameState.COMBAT)
        return;
      const eng = this.#combatEngine;
      if (!eng || this.#combatAnim || this.#combatMovePath || this.#enemyQueue.length > 0)
        return;
      if (eng.phase !== CombatPhase.AWAITING_MOVE)
        return;
      const unit = eng.currentUnit;
      if (!unit || unit.faction !== 'party')
        return;

      const ts = this.#combatTileSize;
      const ox = this.#combatOffsetX;
      const oy = this.#combatOffsetY;
      const gridCol = Math.floor((e.x - ox) / ts);
      const gridRow = Math.floor((e.y - oy) / ts);
      if (!eng.grid.inBounds(gridCol, gridRow))
        return;
      const key = `${gridCol},${gridRow}`;
      if (!eng.moveRange || !eng.moveRange.has(key))
        return;
      if (eng.grid.isOccupied(gridCol, gridRow) && eng.grid.unitAt(gridCol, gridRow) !== unit.id)
        return;

      if (!this.#combatOriginalPos)
        this.#combatOriginalPos = { ...unit.position };
      this.#combatTentativePos = { col: gridCol, row: gridRow };

      this.#spellMenuOpen = false;
      this.#commitTentativeMove();
      eng.selectWait();
      eng.nextTurn();
      eng.startTurn();
      if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
        this.#processEnemyTurns();
    }

    #onClickVictory(e) {
      const btnY = this._victoryBtnY || 370;
      const btn = { x: 540, y: btnY, w: 200, h: 44 };
      if (this.#hitButton(e, btn)) {
        this.#overworldCombat = false;
        this.#overworldCombatOrigin = null;
        this.#sm.transition(GameState.CAMP);
      }
    }

    #onClickDefeat(e) {
      const retreatBtn = { x: 440, y: 360, w: 160, h: 44 };
      const titleBtn = { x: 680, y: 360, w: 160, h: 44 };
      if (this.#hitButton(e, retreatBtn)) {
        this.#restParty();
        this.#overworldCombat = false;
        this.#overworldCombatOrigin = null;
        this.#sm.transition(GameState.CAMP);
      } else if (this.#hitButton(e, titleBtn)) {
        this.#overworldCombat = false;
        this.#overworldCombatOrigin = null;
        this.#sm.transition(GameState.TITLE);
      }
    }

    #onHover(e) {
      if ((this.#sm.current === GameState.OVERWORLD || this.#sm.current === GameState.DUNGEON) && this.#overworldMap) {
        this.#hoverTile = this.#input.screenToTile(e.x, e.y, this.#renderer.camera);
      } else if (this.#sm.current === GameState.COMBAT && this.#combatEngine) {
        const ts = this.#combatTileSize;
        const ox = this.#combatOffsetX;
        const oy = this.#combatOffsetY;
        const col = Math.floor((e.x - ox) / ts);
        const row = Math.floor((e.y - oy) / ts);
        if (this.#combatEngine.grid.inBounds(col, row))
          this.#combatHoverTile = { col, row };
        else
          this.#combatHoverTile = null;

        const menuX = ox + this.#combatEngine.grid.cols * ts + 20;
        const actionBtns = this.#getActionButtons();
        const btnH = 36;
        const btnGap = 6;
        this.#combatActionHover = -1;
        for (let i = 0; i < actionBtns.length; ++i) {
          const by = oy + 5 + i * (btnH + btnGap);
          if (e.x >= menuX + 5 && e.x <= menuX + 175 && e.y >= by && e.y <= by + btnH) {
            this.#combatActionHover = i;
            break;
          }
        }

        this.#spellMenuHover = -1;
        if (this.#spellMenuOpen && this.#combatEngine.currentUnit) {
          const spellBtns = this.#getSpellMenuButtons(this.#combatEngine.currentUnit);
          const smY = oy + actionBtns.length * (btnH + btnGap) + 15;
          const sBtnH = 28;
          const sGap = 3;
          for (let i = 0; i < spellBtns.length; ++i) {
            const sby = smY + 4 + i * (sBtnH + sGap);
            if (e.x >= menuX + 4 && e.x <= menuX + 176 && e.y >= sby && e.y <= sby + sBtnH) {
              this.#spellMenuHover = i;
              break;
            }
          }
        }

        this.#contextMenuHover = -1;
        if (this.#contextMenu) {
          const cmW = 200;
          const cmItemH = 28;
          const cmPadY = 4;
          const cmX = Math.min(this.#contextMenu.x, CANVAS_W - cmW - 4);
          const cmY = Math.min(this.#contextMenu.y, CANVAS_H - (this.#contextMenu.items.length * cmItemH + cmPadY * 2) - 4);
          for (let i = 0; i < this.#contextMenu.items.length; ++i) {
            const iy = cmY + cmPadY + i * cmItemH;
            if (e.x >= cmX && e.x <= cmX + cmW && e.y >= iy && e.y <= iy + cmItemH) {
              this.#contextMenuHover = i;
              break;
            }
          }
        }
      } else {
        this.#hoverTile = null;
        this.#combatHoverTile = null;
      }
    }

    async #onTransition(e) {
      this.#screenTime = 0;
      if (e.to !== GameState.COMBAT) {
        this.#hideCombatLogPanel();
        if (this._combatUI) this._combatUI.hide();
      }
      this.#updateHistoryButton();
      if (e.autoSave) {
        try {
          await this.#saveManager.save({
            lastState: e.to,
            playerPos: this.#playerPos,
            overworldSeed: this.#overworldMap ? this.#overworldMap.worldSeed : null,
            party: this.#party ? this.#party.map(c => Character.serialize(c)) : null,
            partyHp: this.#partyHp ? this.#partyHp.slice() : null,
            partyXp: this.#partyXp ? this.#partyXp.slice() : null,
            gold: this.#gold,
            inventory: Items ? Items.serializeInventory(this.#inventory) : [],
            timestamp: Date.now()
          });
        } catch (err) {
          console.warn('Auto-save failed:', err);
        }
      }
    }

    #updateStatus() {
      if (!this.#statusEls)
        return;
      if (this.#statusEls.state)
        this.#statusEls.state.textContent = `State: ${this.#sm.current}`;
      if (this.#statusEls.pos)
        this.#statusEls.pos.textContent = `Pos: (${this.#playerPos.col}, ${this.#playerPos.row})`;
    }
  }

  let controller = null;

  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas)
      return;
    controller = new Controller();
    controller.init();
  });

  TR.Controller = Controller;
})();
