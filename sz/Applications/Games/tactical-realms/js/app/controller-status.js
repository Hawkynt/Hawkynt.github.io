;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { GameState, StateMachine, PRNG, TimeRotation, Renderer, InputHandler, SaveManager, SaveCrypto, Character, Roster, RACES, CLASSES, CombatEngine, CombatPhase, CombatUnit, CombatGrid, Terrain, D20, Pathfinding, AssetLoader, OverworldMap, OverworldTile, Spells, Shop, ShopType, Items, CombatUI } = TR;
  const { CANVAS_W, CANVAS_H, TILE_SIZE, MOVE_DURATION, COMBAT_TILE_SIZE, COMBAT_MOVE_STEP_DUR, REVEAL_TIME, CRAWL_TILE, CRAWL_STEP, DEPLOY_BUTTON, UNDERGROUND_LIGHT, TRAIT_COLORS, HAZARD_COLORS, BATTLE_SCENE_KEY, BATTLE_SCENE_MODES, loadBattleSceneMode, MENU_ACTIONS, CAMP_BUTTONS, TOWN_BUTTONS, TITLE_BUTTONS } = TR.app;
  const Controller = TR.Controller;

  Object.assign(Controller.prototype, {
    _refreshHover() {
      const m = this._mouse;
      if (!m)
        return;
      if (this._sm.current === GameState.OVERWORLD && this._overworldMap)
        this._hoverTile = this._input.screenToTile(m.x, m.y, this._renderer.camera);
      else if (this._sm.current === GameState.COMBAT && this._combatEngine) {
        const ts = this._combatTileSize;
        const col = Math.floor((m.x - this._combatOffsetX) / ts);
        const row = Math.floor((m.y - this._combatOffsetY) / ts);
        this._combatHoverTile = this._combatEngine.grid.inBounds(col, row) ? { col, row } : null;
      }
    },

    _onHover(e) {
      this._mouse = { x: e.x, y: e.y };
      if ((this._sm.current === GameState.OVERWORLD || this._sm.current === GameState.DUNGEON) && this._overworldMap) {
        this._hoverTile = this._input.screenToTile(e.x, e.y, this._renderer.camera);
      } else if (this._sm.current === GameState.COMBAT && this._combatEngine) {
        const ts = this._combatTileSize;
        const ox = this._combatOffsetX;
        const oy = this._combatOffsetY;
        const col = Math.floor((e.x - ox) / ts);
        const row = Math.floor((e.y - oy) / ts);
        if (this._combatEngine.grid.inBounds(col, row))
          this._combatHoverTile = { col, row };
        else
          this._combatHoverTile = null;

        const menuX = ox + this._combatEngine.grid.cols * ts + 20;
        const actionBtns = this._getActionButtons();
        const btnH = 36;
        const btnGap = 6;
        this._combatActionHover = -1;
        for (let i = 0; i < actionBtns.length; ++i) {
          const by = oy + 5 + i * (btnH + btnGap);
          if (e.x >= menuX + 5 && e.x <= menuX + 175 && e.y >= by && e.y <= by + btnH) {
            this._combatActionHover = i;
            break;
          }
        }

        this._spellMenuHover = -1;
        if (this._spellMenuOpen && this._combatEngine.currentUnit) {
          const spellBtns = this._getSpellMenuButtons(this._combatEngine.currentUnit);
          const smY = oy + actionBtns.length * (btnH + btnGap) + 15;
          const sBtnH = 28;
          const sGap = 3;
          for (let i = 0; i < spellBtns.length; ++i) {
            const sby = smY + 4 + i * (sBtnH + sGap);
            if (e.x >= menuX + 4 && e.x <= menuX + 176 && e.y >= sby && e.y <= sby + sBtnH) {
              this._spellMenuHover = i;
              break;
            }
          }
        }

        this._contextMenuHover = -1;
        if (this._contextMenu) {
          const cmW = 200;
          const cmItemH = 28;
          const cmPadY = 4;
          const cmX = Math.min(this._contextMenu.x, CANVAS_W - cmW - 4);
          const cmY = Math.min(this._contextMenu.y, CANVAS_H - (this._contextMenu.items.length * cmItemH + cmPadY * 2) - 4);
          for (let i = 0; i < this._contextMenu.items.length; ++i) {
            const iy = cmY + cmPadY + i * cmItemH;
            if (e.x >= cmX && e.x <= cmX + cmW && e.y >= iy && e.y <= iy + cmItemH) {
              this._contextMenuHover = i;
              break;
            }
          }
        }
      } else {
        this._hoverTile = null;
        this._combatHoverTile = null;
      }
    },

    async _onTransition(e) {
      this._screenTime = 0;
      if (e.to === GameState.OVERWORLD && e.from !== GameState.COMBAT)
        this._stepsSinceEncounter = 0;
      if (e.to !== GameState.COMBAT) {
        this._hideCombatLogPanel();
        if (this._combatUI) this._combatUI.hide();
      }
      this._updateHistoryButton();
      if (e.autoSave)
        await this._autoSave(e.to);
    },

    async _autoSave(state) {
      try {
        await this._saveManager.save({
          lastState: state,
          playerPos: this._playerPos,
          plane: this._dimension,
          planePositions: { ...this._planePositions },
          planeReturn: { ...this._planeReturn },
          overworldSeed: this._overworldMap ? this._overworldMap.worldSeed : null,
          party: this._party ? this._party.map(c => Character.serialize(c)) : null,
          partyHp: this._partyHp ? this._partyHp.slice() : null,
          partyXp: this._partyXp ? this._partyXp.slice() : null,
          gold: this._gold,
          inventory: Items ? Items.serializeInventory(this._inventory) : [],
          crawl: this._crawl && state === GameState.DUNGEON ? { key: this._crawlKey(), data: this._crawl.serialize() } : null,
          timestamp: Date.now()
        });
      } catch (err) {
        console.warn('Auto-save failed:', err);
      }
    },

    _updateStatus() {
      if (!this._statusEls)
        return;
      if (this._statusEls.state)
        this._statusEls.state.textContent = `State: ${this._sm.current}`;
      if (this._statusEls.pos)
        this._statusEls.pos.textContent = `Pos: (${this._playerPos.col}, ${this._playerPos.row})`;
    },
  });
})();
