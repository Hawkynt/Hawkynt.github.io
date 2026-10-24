;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { GameState, StateMachine, PRNG, TimeRotation, Renderer, InputHandler, SaveManager, SaveCrypto, Character, Roster, RACES, CLASSES, CombatEngine, CombatPhase, CombatUnit, CombatGrid, Terrain, D20, Pathfinding, AssetLoader, OverworldMap, OverworldTile, Spells, Shop, ShopType, Items, CombatUI } = TR;
  const { CANVAS_W, CANVAS_H, TILE_SIZE, MOVE_DURATION, COMBAT_TILE_SIZE, COMBAT_MOVE_STEP_DUR, REVEAL_TIME, CRAWL_TILE, CRAWL_STEP, DEPLOY_BUTTON, UNDERGROUND_LIGHT, TRAIT_COLORS, HAZARD_COLORS, BATTLE_SCENE_KEY, BATTLE_SCENE_MODES, loadBattleSceneMode, MENU_ACTIONS, CAMP_BUTTONS, TOWN_BUTTONS, TITLE_BUTTONS } = TR.app;
  const Controller = TR.Controller;

  Object.assign(Controller.prototype, {
    _renderVictory() {
      const xpGained = this._lastRewards ? this._lastRewards.xp : 0;
      const goldGained = this._lastRewards ? this._lastRewards.gold : 0;
      this._renderer.drawVictoryScreen(this._party, xpGained, goldGained, Math.min(1, this._screenTime * 0.5),
        { time: this._screenTime, biome: this._combatBiome, plane: this._dimension });

      let y = 250;
      if (this._lastRewards) {
        const r = this._lastRewards;
        this._renderer.drawScreenText(CANVAS_W / 2, y, `+${r.xp} XP (${r.xpEach} each)  +${r.gold} Gold`, { color: '#daa520', font: 'bold 18px monospace', align: 'center' });
        y += 32;
        if (r.levelUps.length > 0) {
          this._renderer.drawScreenText(CANVAS_W / 2, y, `LEVEL UP: ${r.levelUps.join(', ')}!`, { color: '#ffd700', font: 'bold 18px serif', align: 'center' });
          y += 32;
        }
      }

      if (this._lastRewards && this._lastRewards.loot && this._lastRewards.loot.length > 0) {
        const lootNames = this._lastRewards.loot.map(i => i.name).join(', ');
        this._renderer.drawScreenText(CANVAS_W / 2, y, `Loot: ${lootNames}`, { color: '#8cf', font: '14px monospace', align: 'center' });
        y += 24;
      }

      this._renderer.drawScreenText(CANVAS_W / 2, y, `Gold: ${this._gold}`, { color: '#aaa', font: '15px monospace', align: 'center' });
      y += 26;

      if (this._party && this._partyXp)
        for (let i = 0; i < this._party.length; ++i) {
          const c = this._party[i];
          const xp = this._partyXp[i];
          const needed = Character.xpForNextLevel(c.level);
          const xpInLevel = xp - Character.totalXpForLevel(c.level);
          this._renderer.drawScreenText(CANVAS_W / 2, y, `${c.name} Lv${c.level}  XP: ${xpInLevel}/${needed}`, { color: '#ccc', font: '14px monospace', align: 'center' });
          y += 22;
        }

      y += 14;
      this._renderer.drawButton(540, y, 200, 44, 'Continue', { bg: '#2a4a2a', font: '15px monospace' });
      this._victoryBtnY = y;
    },

    _renderDefeat() {
      this._renderer.drawDefeatScreen(this._screenTime, { party: this._party, biome: this._combatBiome, plane: this._dimension });
      this._renderer.drawButton(440, 360, 160, 44, 'Retreat', { bg: '#4a4a2a', font: '15px monospace' });
      this._renderer.drawButton(680, 360, 160, 44, 'Title', { bg: '#4a2a2a', font: '15px monospace' });
    },

    _onClick(e) {
      switch (this._sm.current) {
        case GameState.TITLE:
          this._onClickTitle(e);
          break;
        case GameState.CHARACTER_SELECT:
          this._onClickCharSelect(e);
          break;
        case GameState.OVERWORLD:
          this._onClickOverworld(e);
          break;
        case GameState.DUNGEON:
          this._onClickCrawl(e);
          break;
        case GameState.CAMP:
          this._onClickCamp(e);
          break;
        case GameState.TOWN:
          this._onClickTown(e);
          break;
        case GameState.COMBAT:
          this._onClickCombat(e);
          break;
        case GameState.VICTORY:
          this._onClickVictory(e);
          break;
        case GameState.DEFEAT:
          this._onClickDefeat(e);
          break;
      }
    },

    _hitButton(e, btn) {
      return e.x >= btn.x && e.x <= btn.x + btn.w && e.y >= btn.y && e.y <= btn.y + btn.h;
    },

    _onClickTitle(e) {
      if (this._hitButton(e, TITLE_BUTTONS[0]))
        this.newGame();
      else if (this._saveManager.hasSave() && this._hitButton(e, TITLE_BUTTONS[1]))
        this._loadGame();
    },

    async _loadGame() {
      this._sm.transition(GameState.LOAD_GAME);
      try {
        const data = await this._saveManager.load();
        if (data && data.state) {
          if (data.state.playerPos)
            this._playerPos = data.state.playerPos;
          this._dimension = TR.PlaneRegistry && TR.PlaneRegistry.has(data.state.plane) ? data.state.plane : 'material';
          this._planeMaps.clear();
          this._planePositions = data.state.planePositions && typeof data.state.planePositions === 'object' ? { ...data.state.planePositions } : {};
          this._planeReturn = data.state.planeReturn && typeof data.state.planeReturn === 'object' ? { ...data.state.planeReturn } : {};
          this._planeShift = null;
          this._crawlPrompt = null;
          if (data.state.overworldSeed != null)
            this._overworldMap = new OverworldMap(data.state.overworldSeed, this._dimension);
          else
            this._overworldMap = new OverworldMap(this._prng.state, this._dimension);
          if (data.state.party && Array.isArray(data.state.party)) {
            const restored = data.state.party.map(c => Character.deserialize(c)).filter(c => c !== null);
            this._party = Object.freeze(restored);
          }
          if (data.state.partyHp && Array.isArray(data.state.partyHp))
            this._partyHp = data.state.partyHp.slice();
          if (data.state.partyXp && Array.isArray(data.state.partyXp))
            this._partyXp = data.state.partyXp.slice();
          if (typeof data.state.gold === 'number')
            this._gold = data.state.gold;
          if (Items && Array.isArray(data.state.inventory))
            this._inventory = Items.deserializeInventory(data.state.inventory);
          let target = data.state.lastState || GameState.OVERWORLD;
          if (target === GameState.DUNGEON) {
            if (data.state.crawl && TR.DungeonCrawl) {
              this._crawl = TR.DungeonCrawl.deserialize(data.state.crawl.data);
              this._crawlCache.set(data.state.crawl.key, this._crawl);
              this._crawlTrail = [];
            } else
              target = GameState.OVERWORLD;
          }
          if (this._sm.canTransition(target))
            this._sm.transition(target);
          else
            this._sm.transition(GameState.OVERWORLD);
        } else {
          this._sm.transition(GameState.TITLE);
        }
      } catch (_) {
        this._sm.transition(GameState.TITLE);
      }
    },

    _onClickCharSelect(e) {
      if (!this._roster)
        return;

      const season = this._timeRotation.currentSeason();
      const cardW = 220;
      const cardH = 290;
      const cols = 4;
      const gapX = 20;
      const gapY = 16;
      const totalW = cols * cardW + (cols - 1) * gapX;
      const startX = Math.floor((CANVAS_W - totalW) / 2);
      const startY = 80;

      for (let i = 0; i < this._roster.length; ++i) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        if (e.x >= x && e.x <= x + cardW && e.y >= y && e.y <= y + cardH) {
          const char = this._roster[i];
          const raceDef = RACES.find(r => r.id === char.race);
          const classDef = CLASSES.find(c => c.id === char.class);
          const debugAllSeasons = this._timeRotation._debugAllSeasons === true;
          const raceLocked = !debugAllSeasons && raceDef && raceDef.season && raceDef.season !== season;
          const classLocked = !debugAllSeasons && classDef && classDef.season && classDef.season !== season;
          if (raceLocked || classLocked)
            return;

          const result = Roster.toggleSelection(this._selectedSlots, i, 4);
          this._selectedSlots = result.selected;
          if (result.full)
            this._partyFullFlash = 1.5;
          return;
        }
      }

      const selCount = this._selectedSlots.size;
      if (selCount >= 1 && selCount <= 4) {
        const btn = { x: 540, y: CANVAS_H - 42, w: 200, h: 36 };
        if (this._hitButton(e, btn)) {
          this._party = Roster.selectParty(this._roster, this._selectedSlots);
          this._partyHp = this._party.map(c => c.maxHp);
          this._partyXp = this._party.map(() => 0);
          this._gold = 0;
          this._inventory = [];
          this._lastRewards = null;
          this._overworldMap = new OverworldMap(this._prng.state);
          this._playerPos = { col: 0, row: 0 };
          this._dimension = 'material';
          this._crawlCache.clear();
          this._planeMaps.clear();
          this._planePositions = {};
          this._planeReturn = {};
          this._planeShift = null;
          this._crawlPrompt = null;
          this._isMoving = false;
          this._moveTarget = null;
          this._moveFrom = null;
          this._walkPath = null;
          this._sm.transition(GameState.OVERWORLD);
          if (this._input && this._input.keysDown)
            this._input.keysDown.clear();
        }
      }
    },

    _onClickOverworld(e) {
      if (this._planeShift)
        return;
      if (this._crawlPrompt) {
        const b = this._crawlPromptButtons();
        if (this._hitButton(e, b.yes))
          this._answerCrawlPrompt(true);
        else if (this._hitButton(e, b.no))
          this._answerCrawlPrompt(false);
        return;
      }
      const tile = this._input.screenToTile(e.x, e.y, this._renderer.camera);
      if (tile.col === this._playerPos.col && tile.row === this._playerPos.row)
        return;
      if (!this._overworldMap || !this._overworldMap.isPassable(tile.col, tile.row))
        return;
      const path = this._overworldMap.findPath(this._playerPos, tile, 100);
      if (!path || path.length < 2)
        return;
      this._walkPath = path.slice(1);
      if (!this._isMoving && this._walkPath.length > 0) {
        const next = this._walkPath.shift();
        this._tryMove(next.col, next.row);
      }
    },

    _onClickCamp(e) {
      const buttons = CAMP_BUTTONS;
      if (this._hitButton(e, buttons[2]))
        this._restParty();
      else if (this._hitButton(e, buttons[3]))
        this._sm.transition(GameState.OVERWORLD);
    },

    _onClickTown(e) {
      if (this._shopStock) {
        this._onClickShop(e);
        return;
      }

      const buttons = TOWN_BUTTONS;
      if (this._hitButton(e, buttons[0]))
        this._openShop(ShopType.WEAPONSMITH);
      else if (this._hitButton(e, buttons[1]))
        this._openShop(ShopType.ARMORER);
      else if (this._hitButton(e, buttons[2]))
        this._openShop(ShopType.GENERAL);
      else if (this._hitButton(e, buttons[3]))
        this._restParty();
      else if (this._hitButton(e, buttons[4]))
        this._sm.transition(GameState.OVERWORLD);
    },

    _openShop(type) {
      if (!Shop) return;
      const avgLevel = this._party ? Math.floor(this._party.reduce((s, c) => s + c.level, 0) / this._party.length) : 1;
      this._shopType = type;
      this._shopStock = Shop.generateStock(new PRNG(Date.now()), type, avgLevel);
    },

    _onClickShop(e) {
      // Back button
      const back = { x: CANVAS_W / 2 - 80, y: CANVAS_H - 60, w: 160, h: 40 };
      if (this._hitButton(e, back)) {
        this._shopStock = null;
        this._shopType = null;
        return;
      }

      const stock = this._shopStock || [];

      // Buy from stock
      for (let i = 0; i < stock.length; ++i) {
        const btn = { x: 40, y: 110 + i * 36, w: 320, h: 30 };
        if (this._hitButton(e, btn)) {
          const result = Shop.buyItem(stock, stock[i].id, this._gold);
          if (result) {
            this._gold = result.newGold;
            this._shopStock = result.newStock;
            this._inventory = Items.addToInventory(this._inventory, result.item);
          }
          return;
        }
      }

      // Sell from inventory
      for (let i = 0; i < this._inventory.length && i < 14; ++i) {
        const btn = { x: 600, y: 110 + i * 36, w: 380, h: 30 };
        if (this._hitButton(e, btn)) {
          const result = Shop.sellItem(this._inventory, this._inventory[i].id, this._gold);
          if (result) {
            this._gold = result.newGold;
            this._inventory = result.newInventory;
          }
          return;
        }
      }
    },

    _onKey(e) {
      if (this._crawlPrompt && (this._sm.current === GameState.DUNGEON || this._sm.current === GameState.OVERWORLD)) {
        if (e.key === 'Enter')
          this._answerCrawlPrompt(true);
        else if (e.key === 'Escape')
          this._answerCrawlPrompt(false);
        return;
      }
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')
        this._skipBattleScene();
    },

    _skipBattleScene() {
      const scene = this._combatAnim && this._combatAnim.scene;
      if (!scene || scene.done)
        return false;
      scene.skip();
      return true;
    },

    get battleSceneMode() { return this._battleSceneMode; },

    setBattleSceneMode(mode) {
      if (!BATTLE_SCENE_MODES.includes(mode))
        return;
      this._battleSceneMode = mode;
      try {
        localStorage.setItem(BATTLE_SCENE_KEY, mode);
      } catch (_) { /* private mode: setting lasts for this session */ }
      this._syncBattleSceneMenu();
    },

    _syncBattleSceneMenu() {
      if (typeof document === 'undefined' || !document.querySelectorAll)
        return;
      for (const m of BATTLE_SCENE_MODES) {
        const el = document.getElementById(`menu-scenes-${m}`);
        if (el && el.classList)
          el.classList.toggle('checked', m === this._battleSceneMode);
      }
    },

    // Turns a grid animation into a battle cut-in, or plays its impacts
    // right away when cut-ins are switched off.
    _attachBattleScene(anim) {
      if (!anim || !anim.defender)
        return anim;
      if (this._battleSceneMode === 'off' || !TR.BattleScene) {
        this._playImpacts(anim.impacts);
        anim.impacts = null;
        anim.timer = anim.duration = 0.6;
        return anim;
      }
      anim.scene = new TR.BattleScene({
        attacker: anim.attacker, defender: anim.defender, result: anim.result, type: anim.type,
        biome: this._combatBiome, plane: this._dimension, mode: this._battleSceneMode,
      });
      return anim;
    },

  });
})();
