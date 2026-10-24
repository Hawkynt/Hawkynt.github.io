;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { GameState, StateMachine, PRNG, TimeRotation, Renderer, InputHandler, SaveManager, SaveCrypto, Character, Roster, RACES, CLASSES, CombatEngine, CombatPhase, CombatUnit, CombatGrid, Terrain, D20, Pathfinding, AssetLoader, OverworldMap, OverworldTile, Spells, Shop, ShopType, Items, CombatUI } = TR;
  const { CANVAS_W, CANVAS_H, TILE_SIZE, MOVE_DURATION, COMBAT_TILE_SIZE, COMBAT_MOVE_STEP_DUR, REVEAL_TIME, CRAWL_TILE, CRAWL_STEP, DEPLOY_BUTTON, UNDERGROUND_LIGHT, TRAIT_COLORS, HAZARD_COLORS, BATTLE_SCENE_KEY, BATTLE_SCENE_MODES, loadBattleSceneMode, MENU_ACTIONS, CAMP_BUTTONS, TOWN_BUTTONS, TITLE_BUTTONS } = TR.app;
  const Controller = TR.Controller;

  Object.assign(Controller.prototype, {
    _onClickCombat(e) {
      if (this._skipBattleScene())
        return;
      if (this._deploying) {
        this._onClickDeploy(e);
        return;
      }
      const eng = this._combatEngine;
      if (!eng || this._combatAnim || this._enemyQueue.length > 0 || this._combatMovePath)
        return;

      if (this._contextMenu) {
        const menu = this._contextMenu;
        const itemH = 28;
        const menuW = 200;
        const padY = 4;
        const mx = Math.min(menu.x, CANVAS_W - menuW - 4);
        const my = Math.min(menu.y, CANVAS_H - (menu.items.length * itemH + padY * 2) - 4);
        for (let i = 0; i < menu.items.length; ++i) {
          const iy = my + padY + i * itemH;
          if (e.x >= mx && e.x <= mx + menuW && e.y >= iy && e.y <= iy + itemH) {
            const item = menu.items[i];
            this._contextMenu = null;
            this._contextMenuHover = -1;
            this._executeContextMenuItem(eng, item, menu.targetId);
            return;
          }
        }
        this._contextMenu = null;
        this._contextMenuHover = -1;
        return;
      }

      const phase = eng.phase;

      if (phase === CombatPhase.VICTORY) {
        const btn = { x: CANVAS_W / 2 - 80, y: CANVAS_H / 2 + 14, w: 160, h: 40 };
        if (this._hitButton(e, btn)) {
          this._archiveCombatLog();
          this._hideCombatLogPanel();
          this._syncPartyHpFromCombat();
          this._distributeRewards();
          if (this._crawlBattle)
            this._resolveCrawlBattle();
          this._sm.transition(GameState.VICTORY);
          this._updateHistoryButton();
        }
        return;
      }
      if (phase === CombatPhase.DEFEAT) {
        const btn = { x: CANVAS_W / 2 - 80, y: CANVAS_H / 2 + 14, w: 160, h: 40 };
        if (this._hitButton(e, btn)) {
          this._archiveCombatLog();
          this._hideCombatLogPanel();
          this._syncPartyHpFromCombat();
          this._sm.transition(GameState.DEFEAT);
          this._updateHistoryButton();
        }
        return;
      }

      const ts = this._combatTileSize;
      const ox = this._combatOffsetX;
      const oy = this._combatOffsetY;
      const menuX = ox + eng.grid.cols * ts + 20;

      const actionBtns = this._getActionButtons();
      const btnW = 170;
      const btnH = 36;
      const btnGap = 6;
      for (let i = 0; i < actionBtns.length; ++i) {
        const btn = actionBtns[i];
        if (btn.disabled)
          continue;
        const by = oy + 5 + i * (btnH + btnGap);
        if (this._hitButton(e, { x: menuX + 5, y: by, w: btnW, h: btnH })) {
          this._handleActionButton(btn.label);
          return;
        }
      }

      if (this._spellMenuOpen && eng.currentUnit) {
        const spellBtns = this._getSpellMenuButtons(eng.currentUnit);
        const smY = oy + actionBtns.length * (btnH + btnGap) + 15;
        const sBtnH = 28;
        const sGap = 3;
        for (let i = 0; i < spellBtns.length; ++i) {
          const sb = spellBtns[i];
          if (sb.disabled)
            continue;
          const sby = smY + 4 + i * (sBtnH + sGap);
          if (this._hitButton(e, { x: menuX + 4, y: sby, w: 172, h: sBtnH })) {
            this._spellMenuOpen = false;
            this._commitTentativeMove();
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
            this._startAoeSpellAnim(caster, result);
        } else {
          const targetId = eng.grid.unitAt(gridCol, gridRow);
          const target = targetId ? eng.unitById(targetId) : null;
          const result = eng.selectSpellTarget(gridCol, gridRow);
          if (result)
            this._startSpellAnim(caster, target, result);
        }
        return;
      }

      if (phase === CombatPhase.AWAITING_MOVE) {
        const clickedUnit = eng.grid.unitAt(gridCol, gridRow);
        if (clickedUnit) {
          const target = eng.unitById(clickedUnit);
          if (target && target.faction === 'enemy' && target.isAlive)
            return this._approachAndAttack(target);
        }
        const key = `${gridCol},${gridRow}`;
        if (eng.moveRange && eng.moveRange.has(key)) {
          if (eng.grid.isOccupied(gridCol, gridRow) && eng.grid.unitAt(gridCol, gridRow) !== eng.currentUnit.id)
            return;
          if (!this._combatOriginalPos)
            this._combatOriginalPos = { ...eng.currentUnit.position };
          const visualFrom = this._combatTentativePos || eng.currentUnit.position;
          const dest = { col: gridCol, row: gridRow };
          if (visualFrom.col !== dest.col || visualFrom.row !== dest.row) {
            const path = Pathfinding.findPath(eng.grid, visualFrom, dest, 'party');
            if (path && path.length > 1) {
              this._combatMoveStart = { ...visualFrom };
              this._combatMovePath = path.slice(1);
              this._combatMoveUnit = eng.currentUnit.id;
              this._combatMoveIdx = 0;
              this._combatMoveProgress = 0;
              this._combatMoveCallback = null;
            }
          }
          this._combatTentativePos = dest;
        }
      } else if (phase === CombatPhase.AWAITING_TARGET) {
        const attackerId = eng.currentUnit.id;
        const targetId = eng.grid.unitAt(gridCol, gridRow);
        const result = eng.selectTarget(gridCol, gridRow);
        if (result)
          this._startAttackAnim(attackerId, targetId, result);
      }
    },

    /* the square to stand on to act against a creature: only squares the action is
       legal from, and of those the one furthest away -- a reach weapon or a spell
       stops at the edge of its own reach instead of walking into the enemy's face.
       The cheaper walk breaks a tie, and standing still wins once it is legal. */
    _findApproachTile(eng, unit, fromPos, targetPos, legal) {
      const moveRange = Pathfinding.movementRange(eng.grid, fromPos, unit.speedTiles, unit.faction, unit.passMode);
      let best = null;
      for (const [key, cost] of moveRange) {
        const [c, r] = key.split(',').map(Number);
        if (eng.grid.isOccupied(c, r) && eng.grid.unitAt(c, r) !== unit.id)
          continue;
        if (!legal(c, r))
          continue;
        const dist = Math.abs(c - targetPos.col) + Math.abs(r - targetPos.row);
        if (!best || dist > best.dist || (dist === best.dist && cost < best.cost))
          best = { col: c, row: r, cost, dist };
      }
      return best;
    },

    /* nothing reachable this turn is in reach of the action: take the square that
       gets closest and let the action wait for the next turn */
    _closestApproachTile(eng, unit, targetPos) {
      const moveRange = Pathfinding.movementRange(eng.grid, unit.position, unit.speedTiles, unit.faction, unit.passMode);
      let best = null;
      for (const [key] of moveRange) {
        const [c, r] = key.split(',').map(Number);
        if (eng.grid.isOccupied(c, r) && eng.grid.unitAt(c, r) !== unit.id)
          continue;
        const dist = Math.abs(c - targetPos.col) + Math.abs(r - targetPos.row);
        if (!best || dist < best.dist)
          best = { col: c, row: r, dist };
      }
      return best;
    },

    /* walk to a square, then run `then` on arrival */
    _walkAndThen(eng, unit, tile, then) {
      const from = { ...unit.position };
      this._combatMoveStart = from;
      eng.selectMoveTile(tile.col, tile.row);
      eng.confirmMove();
      const path = from.col === tile.col && from.row === tile.row
        ? null : Pathfinding.findPath(eng.grid, from, tile, 'party');
      if (path && path.length > 1) {
        this._combatMovePath = path.slice(1);
        this._combatMoveUnit = unit.id;
        this._combatMoveIdx = 0;
        this._combatMoveProgress = 0;
        this._combatMoveCallback = then;
        return;
      }
      then();
    },

    _approachAndAttack(target) {
      const eng = this._combatEngine;
      const unit = eng.currentUnit;
      if (!unit || !eng.moveRange) return;
      if (this._combatTentativePos)
        this._commitTentativeMove();

      const tp = target.position;
      const reach = D20.attackReach(unit.character);
      const tile = this._findApproachTile(eng, unit, unit.position, tp,
        (c, r) => D20.isAdjacent({ col: c, row: r }, tp, reach));

      if (!tile) {
        const step = this._closestApproachTile(eng, unit, tp);
        if (step && (step.col !== unit.position.col || step.row !== unit.position.row))
          this._walkAndThen(eng, unit, step, () => {});
        return;
      }

      this._walkAndThen(eng, unit, tile, () => {
        eng.selectAttack();
        const result = eng.selectTarget(tp.col, tp.row);
        if (result)
          this._startAttackAnim(unit.id, target.id, result);
      });
    },

    _getAttackTargetsFromPos(eng, unit, pos) {
      const targets = [];
      for (const other of eng.units) {
        if (other.faction === unit.faction || !other.isAlive)
          continue;
        if (D20.isAdjacent(pos, other.position, D20.attackReach(unit.character)))
          targets.push(other.id);
      }
      return targets;
    },

    _commitTentativeMove() {
      const eng = this._combatEngine;
      if (!eng || !this._combatTentativePos)
        return;
      const pos = this._combatTentativePos;
      eng.selectMoveTile(pos.col, pos.row);
      eng.confirmMove();
      this._combatTentativePos = null;
      this._combatOriginalPos = null;
    },

    _handleActionButton(label) {
      const eng = this._combatEngine;
      if (!eng || this._combatAnim || this._combatMovePath)
        return;

      if (label === 'Wait') {
        this._spellMenuOpen = false;
        this._commitTentativeMove();
        eng.selectWait();
        eng.nextTurn();
        eng.startTurn();
        if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
          this._processEnemyTurns();
      } else if (label === 'Attack') {
        this._spellMenuOpen = false;
        this._commitTentativeMove();
        eng.selectAttack();
      } else if (label === 'Cast') {
        this._spellMenuOpen = !this._spellMenuOpen;
        this._spellMenuScroll = 0;
        this._spellMenuHover = -1;
      } else if (label === 'Undo Move') {
        this._spellMenuOpen = false;
        this._combatTentativePos = null;
        this._combatOriginalPos = null;
        eng.undoMove();
      } else if (label === 'Cancel') {
        this._spellMenuOpen = false;
        eng.cancelTarget();
      } else if (label === 'Flee') {
        this._spellMenuOpen = false;
        this._commitTentativeMove();
        this._attemptFlee();
      }
    },

    _attemptFlee() {
      const eng = this._combatEngine;
      if (!eng) return;
      const unit = eng.currentUnit;
      if (!unit) return;

      const dexMod = unit.dexMod;
      const roll = this._prng.nextInt(1, 20);
      const dc = 12;
      const total = roll + dexMod;

      const pos = this._combatTentativePos || unit.position;
      const ts = this._combatTileSize;
      const ox = this._combatOffsetX;
      const oy = this._combatOffsetY;
      const fx = ox + pos.col * ts + ts / 2;
      const fy = oy + pos.row * ts;

      if (total >= dc) {
        eng.combatLog.push(`${unit.logName} flees! (d20=${roll}+${dexMod}=${total} vs DC ${dc} - SUCCESS)`);
        if (this._combatFx)
          this._combatFx.number(fx, fy, 'Fled!', { color: '#5dd65d', size: 18 });
        // Map the fleeing unit's combat grid position back to overworld coordinates
        if (this._overworldCombatOrigin && eng.grid) {
          const gridCenterCol = Math.floor(eng.grid.cols / 2);
          const gridCenterRow = Math.floor(eng.grid.rows / 2);
          const unitPos = this._combatTentativePos || unit.position;
          const newCol = this._overworldCombatOrigin.col - gridCenterCol + unitPos.col;
          const newRow = this._overworldCombatOrigin.row - gridCenterRow + unitPos.row;
          this._playerPos = { col: newCol, row: newRow };
        }
        this._combatTentativePos = null;
        this._combatOriginalPos = null;
        this._combatMoveStart = null;
        this._combatTime = 0;
        this._syncPartyHpFromCombat();
        if (this._crawlBattle) {
          this._resolveCrawlBattle();
          this._combatEngine = null;
          this._crawlBattle = null;
          this._combatCam = null;
          this._sm.transition(GameState.DUNGEON);
          this._toast('You fall back into the dark.', '#e8c878');
          return;
        }
        this._combatEngine = null;
        this._overworldCombat = false;
        this._overworldCombatOrigin = null;
        this._sm.transition(GameState.OVERWORLD);
      } else {
        const modStr = dexMod >= 0 ? `+${dexMod}` : `${dexMod}`;
        if (this._combatFx)
          this._combatFx.number(fx, fy, `Flee failed! (${roll}${modStr}=${total} vs DC ${dc})`, { color: '#e05050', size: 15 });
        eng.combatLog.push(`${unit.logName} fails to flee! (d20=${roll}+${dexMod}=${total} vs DC ${dc} - FAIL)`);
        eng.selectWait();
        eng.nextTurn();
        eng.startTurn();
        if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
          this._processEnemyTurns();
      }
    },

    _onRightClick(e) {
      if (this._sm.current !== GameState.COMBAT)
        return;
      const eng = this._combatEngine;
      if (!eng)
        return;

      if (this._contextMenu) {
        this._contextMenu = null;
        this._contextMenuHover = -1;
        return;
      }
      if (this._spellMenuOpen) {
        this._spellMenuOpen = false;
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
        if (!unit || unit.faction !== 'party' || this._combatAnim || this._combatMovePath)
          return;

        const ts = this._combatTileSize;
        const ox = this._combatOffsetX;
        const oy = this._combatOffsetY;
        const gridCol = Math.floor((e.x - ox) / ts);
        const gridRow = Math.floor((e.y - oy) / ts);
        const effectivePos = this._combatTentativePos || unit.position;

        if (eng.grid.inBounds(gridCol, gridRow)) {
          const targetId = eng.grid.unitAt(gridCol, gridRow);
          if (targetId) {
            const target = eng.unitById(targetId);
            if (target && target.isAlive) {
              const items = this._buildContextMenuItems(eng, unit, target, effectivePos);
              if (items.length > 0) {
                this._contextMenu = { x: e.x, y: e.y, targetId: target.id, items };
                this._contextMenuHover = -1;
                return;
              }
            }
          } else {
            const items = this._buildAoeContextMenuItems(eng, unit, effectivePos, gridCol, gridRow);
            if (items.length > 0) {
              this._contextMenu = { x: e.x, y: e.y, targetId: null, targetTile: { col: gridCol, row: gridRow }, items };
              this._contextMenuHover = -1;
              return;
            }
          }
        }

        if (this._combatTentativePos && this._combatOriginalPos) {
          const from = this._combatTentativePos;
          const to = this._combatOriginalPos;
          if (from.col !== to.col || from.row !== to.row) {
            const path = Pathfinding.findPath(eng.grid, from, to, 'party');
            if (path && path.length > 1) {
              this._combatMoveStart = { ...from };
              this._combatMovePath = path.slice(1);
              this._combatMoveUnit = eng.currentUnit.id;
              this._combatMoveIdx = 0;
              this._combatMoveProgress = 0;
              this._combatMoveCallback = null;
            }
          }
          this._combatTentativePos = null;
          this._combatOriginalPos = null;
        }
      }
    },

    _buildAoeContextMenuItems(eng, unit, effectivePos, tileCol, tileRow) {
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
    },

    _buildContextMenuItems(eng, unit, target, effectivePos) {
      const items = [];
      const tPos = target.position;
      const isEnemy = target.faction !== unit.faction;

      // --- Melee Attack ---
      if (isEnemy) {
        const reach = D20.attackReach(unit.character);
        if (D20.isAdjacent(effectivePos, tPos, reach)) {
          items.push({ label: 'Attack', action: 'attack' });
        } else {
          const walkTo = this._findApproachTile(eng, unit, effectivePos, tPos,
            (c, r) => D20.isAdjacent({ col: c, row: r }, tPos, reach));
          if (walkTo)
            items.push({ label: `Attack (move ${walkTo.cost})`, action: 'attack', walkTo });
        }
      }

      // --- Spells ---
      if (Spells && unit.spells) {
        for (const spellId of unit.spells) {
          const spell = Spells.byId(spellId);
          if (!spell || !unit.canCastSpell(spell))
            continue;
          if (spell.target === 'enemy' && !isEnemy) continue;
          if (spell.target === 'ally' && isEnemy) continue;
          if (spell.target === 'self' && target.id !== unit.id) continue;

          const range = Spells.rangeTiles(spell.range);
          const aoeTag = (spell.aoe && spell.aoe > 0) ? ' (AoE)' : '';

          if (Spells.isInRange(effectivePos.col, effectivePos.row, tPos.col, tPos.row, range)) {
            // Already in range
            items.push({ label: `${spell.name}${aoeTag}`, action: 'spell', spellId: spell.id });
          } else {
            // Can we walk into range?
            const walkTo = this._findApproachTile(eng, unit, effectivePos, tPos,
              (c, r) => Spells.isInRange(c, r, tPos.col, tPos.row, range));
            if (walkTo)
              items.push({ label: `${spell.name}${aoeTag} (move ${walkTo.cost})`, action: 'spell', spellId: spell.id, walkTo });
          }
        }
      }

      return items;
    },

    _executeContextMenuItem(eng, item, targetId) {
      this._spellMenuOpen = false;
      this._commitTentativeMove();

      if (item.action === 'aoe_tile' && item.spellId) {
        const caster = eng.currentUnit;
        if (!caster) return;
        eng.selectSpell(item.spellId);
        const result = eng.selectAoeSpellTarget(item.tileCol, item.tileRow);
        if (result)
          this._startAoeSpellAnim(caster, result);
        return;
      }

      const executeAction = () => {
        const target = eng.unitById(targetId);
        if (!target || !target.isAlive)
          return;

        if (item.action === 'attack') {
          eng.selectAttack();
          const pos = target.position;
          const attackerId = eng.currentUnit.id;
          const result = eng.selectTarget(pos.col, pos.row);
          if (result)
            this._startAttackAnim(attackerId, targetId, result);
        } else if (item.action === 'spell' && item.spellId) {
          const spell = Spells ? Spells.byId(item.spellId) : null;
          if (!spell)
            return;
          const caster = eng.currentUnit;
          if (spell.aoe && spell.aoe > 0) {
            eng.selectSpell(item.spellId);
            const result = eng.selectAoeSpellTarget(target.position.col, target.position.row);
            if (result)
              this._startAoeSpellAnim(caster, result);
          } else {
            eng.selectSpell(item.spellId);
            const result = eng.selectSpellTarget(target.position.col, target.position.row);
            if (result)
              this._startSpellAnim(caster, target, result);
          }
        }
      };

      // Auto-walk with smooth animation before executing action
      if (item.walkTo) {
        const unit = eng.currentUnit;
        if (!unit) return;
        const prevPos = { ...unit.position };
        // Move on grid immediately (for pathfinding/collision)
        eng.grid.moveUnit(unit.id, item.walkTo.col, item.walkTo.row);
        unit.setPosition(item.walkTo.col, item.walkTo.row);
        unit.endMove();
        eng.combatLog.push(`${unit.logName} moves to (${item.walkTo.col},${item.walkTo.row})`);
        // Animate the walk, then execute the action on arrival
        const path = Pathfinding.findPath(eng.grid, prevPos, item.walkTo, unit.faction);
        if (path && path.length > 1) {
          this._combatMoveStart = { ...prevPos };
          this._combatMovePath = path.slice(1);
          this._combatMoveUnit = unit.id;
          this._combatMoveIdx = 0;
          this._combatMoveProgress = 0;
          this._combatMoveCallback = executeAction;
          return;
        }
      }

      executeAction();
    },

    _onDoubleClick(e) {
      if (this._sm.current !== GameState.COMBAT)
        return;
      const eng = this._combatEngine;
      if (!eng || this._combatAnim || this._combatMovePath || this._enemyQueue.length > 0)
        return;
      if (eng.phase !== CombatPhase.AWAITING_MOVE)
        return;
      const unit = eng.currentUnit;
      if (!unit || unit.faction !== 'party')
        return;

      const ts = this._combatTileSize;
      const ox = this._combatOffsetX;
      const oy = this._combatOffsetY;
      const gridCol = Math.floor((e.x - ox) / ts);
      const gridRow = Math.floor((e.y - oy) / ts);
      if (!eng.grid.inBounds(gridCol, gridRow))
        return;
      const key = `${gridCol},${gridRow}`;
      if (!eng.moveRange || !eng.moveRange.has(key))
        return;
      if (eng.grid.isOccupied(gridCol, gridRow) && eng.grid.unitAt(gridCol, gridRow) !== unit.id)
        return;

      if (!this._combatOriginalPos)
        this._combatOriginalPos = { ...unit.position };
      this._combatTentativePos = { col: gridCol, row: gridRow };

      this._spellMenuOpen = false;
      this._commitTentativeMove();
      eng.selectWait();
      eng.nextTurn();
      eng.startTurn();
      if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
        this._processEnemyTurns();
    },

    _onClickVictory(e) {
      const btnY = this._victoryBtnY || 370;
      const btn = { x: 540, y: btnY, w: 200, h: 44 };
      if (this._hitButton(e, btn)) {
        this._overworldCombat = false;
        this._overworldCombatOrigin = null;
        if (this._crawlBattle && this._crawl) {
          this._crawlBattle = null;
          this._combatCam = null;
          this._sm.transition(GameState.DUNGEON);
          return;
        }
        this._sm.transition(GameState.CAMP);
      }
    },

    _onClickDefeat(e) {
      const retreatBtn = { x: 440, y: 360, w: 160, h: 44 };
      const titleBtn = { x: 680, y: 360, w: 160, h: 44 };
      if (this._hitButton(e, retreatBtn)) {
        this._restParty();
        this._overworldCombat = false;
        this._overworldCombatOrigin = null;
        this._sm.transition(GameState.CAMP);
      } else if (this._hitButton(e, titleBtn)) {
        this._overworldCombat = false;
        this._overworldCombatOrigin = null;
        this._sm.transition(GameState.TITLE);
      }
    },

    // The tile under the cursor follows the view: recomputed every frame from
    // the cursor's screen position, so a scrolling camera never leaves the
    // highlight behind on the tile the cursor used to be over.
  });
})();
