;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { GameState, StateMachine, PRNG, TimeRotation, Renderer, InputHandler, SaveManager, SaveCrypto, Character, Roster, RACES, CLASSES, CombatEngine, CombatPhase, CombatUnit, CombatGrid, Terrain, D20, Pathfinding, AssetLoader, OverworldMap, OverworldTile, Spells, Shop, ShopType, Items, CombatUI } = TR;
  const { CANVAS_W, CANVAS_H, TILE_SIZE, MOVE_DURATION, COMBAT_TILE_SIZE, COMBAT_MOVE_STEP_DUR, REVEAL_TIME, CRAWL_TILE, CRAWL_STEP, DEPLOY_BUTTON, UNDERGROUND_LIGHT, TRAIT_COLORS, HAZARD_COLORS, BATTLE_SCENE_KEY, BATTLE_SCENE_MODES, loadBattleSceneMode, MENU_ACTIONS, CAMP_BUTTONS, TOWN_BUTTONS, TITLE_BUTTONS } = TR.app;
  const Controller = TR.Controller;

  Object.assign(Controller.prototype, {
    _renderCombat() {
      const eng = this._combatEngine;
      if (!eng || !eng.grid) {
        this._renderer.drawPanel(0, 0, CANVAS_W, CANVAS_H, { bg: '#0a0a1a' });
        this._renderer.drawScreenText(CANVAS_W / 2, CANVAS_H / 2, 'Loading combat...', { color: '#888', font: '16px monospace', align: 'center' });
        return;
      }

      const ts = this._combatTileSize;
      let ox = this._combatOffsetX;
      let oy = this._combatOffsetY;
      const cfx = this._combatFx;
      const bctx = this._renderer.bufCtx;
      this._refreshHover();
      if (cfx && bctx)
        cfx.beginShake(bctx);

      if (this._overworldCombat && this._overworldMap) {
        const origin = this._overworldCombatOrigin || this._playerPos;
        this._renderer.centerOn(
          origin.col * TILE_SIZE + TILE_SIZE / 2,
          origin.row * TILE_SIZE + TILE_SIZE / 2
        );
        this._renderer.drawInfiniteMap((c, r) => this._overworldMap.getTile(c, r), this._dimension, (c, r) => this._overworldMap.groundAt(c, r));

        const cam = this._renderer.camera;
        const tileRect = this._overworldMap.extractTileRect(origin.col, origin.row, eng.grid.cols, eng.grid.rows);
        ox = tileRect.startCol * TILE_SIZE - cam.x;
        oy = tileRect.startRow * TILE_SIZE - cam.y;
        this._combatOffsetX = ox;
        this._combatOffsetY = oy;
      } else {
        // the board lies on the battle's own backdrop, framed in gold
        if (TR.ScreenArt && bctx) {
          TR.ScreenArt.stage(bctx, this._combatBiome, this._dimension, this._combatTime, { dim: 0.55 });
          TR.ScreenArt.vignette(bctx, 0.6);
        } else
          this._renderer.drawPanel(0, 0, CANVAS_W, CANVAS_H, { bg: '#0a0a1a' });
        this._renderer.drawCombatGrid(eng.grid, ts, ox, oy, this._combatBiome, this._dimension, this._crawlBattle && this._crawl ? this._crawl.theme : null);
        this._renderer.drawGridLines(eng.grid.cols, eng.grid.rows, ts, ox, oy);
        if (TR.ScreenArt && bctx)
          TR.ScreenArt.border(bctx, ox, oy, eng.grid.cols * ts, eng.grid.rows * ts);
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
          this._spellMenuOpen = false;
        }

        // Update action buttons (skip when spell menu is open to preserve spell list)
        if (!this._spellMenuOpen) {
          const actionBtns = this._getActionButtons();
          this._combatUI.updateActions(actionBtns.map(b => ({
            label: b.label, disabled: b.disabled, action: b.label
          })));
        }
      }

      const phase = eng.phase;
      if (phase === CombatPhase.AWAITING_MOVE && eng.moveRange && !this._deploying) {
        const pulseAlpha = (0.15 + 0.15 * Math.sin(this._combatTime * 3)).toFixed(3);
        this._renderer.highlightTiles(eng.moveRange, ts, ox, oy, `rgba(80,140,255,${pulseAlpha})`);
      }

      if (phase === CombatPhase.AWAITING_TARGET) {
        const targets = eng.getAttackTargets(eng.currentUnit.id);
        this._renderer.highlightAttackTargets(targets, eng.units, ts, ox, oy, this._combatTime);
      }

      if (phase === CombatPhase.AWAITING_SPELL_TARGET && eng.selectedSpell) {
        const spell = eng.selectedSpell;
        const isAoe = spell.aoe && spell.aoe > 0;
        const rangeColor = spell.target === 'ally' ? 'rgba(80,255,140,0.15)' : 'rgba(200,80,255,0.15)';
        const blastColor = spell.target === 'ally' ? 'rgba(80,255,140,0.35)' : 'rgba(200,80,255,0.35)';

        if (isAoe) {
          const rangeTiles = eng.getAoeSpellRange(eng.currentUnit.id, spell.id);
          for (const t of rangeTiles)
            this._renderer.drawScreenRect(ox + t.col * ts, oy + t.row * ts, ts, ts, rangeColor);

          const hover = this._combatHoverTile;
          if (hover) {
            const casterPos = eng.currentUnit.position;
            const hoverDist = Math.abs(hover.col - casterPos.col) + Math.abs(hover.row - casterPos.row);
            if (hoverDist <= spell.range)
              this._renderer.drawAoeRadius(ox, oy, ts, hover.col, hover.row, spell.aoe, eng.grid.cols, eng.grid.rows, blastColor);
          }
        } else {
          const targets = eng.getSpellTargets(eng.currentUnit.id, spell.id);
          for (const tid of targets) {
            const u = eng.unitById(tid);
            if (u) {
              const p = u.position;
              this._renderer.drawScreenRect(ox + p.col * ts, oy + p.row * ts, ts, ts, blastColor);
            }
          }
        }
      }

      for (const u of eng.units) {
        if (this._combatMovePath && this._combatMoveUnit === u.id) continue;
        const isActive = eng.currentUnit && eng.currentUnit.id === u.id;
        const pos = (isActive && this._combatTentativePos) ? this._combatTentativePos : u.position;
        this._renderer.drawUnitToken(pos.col, pos.row, u, ts, ox, oy, {
          active: isActive, dead: !u.isAlive, fx: cfx ? cfx.unitState(u.id, ts) : null, time: this._combatTime,
        });
      }

      if (this._combatMovePath && this._combatMoveUnit) {
        const u = eng.unitById(this._combatMoveUnit);
        if (u) {
          const idx = Math.min(this._combatMoveIdx, this._combatMovePath.length - 1);
          const from = idx > 0 ? this._combatMovePath[idx - 1] : (this._combatMoveStart || u.position);
          const to = this._combatMovePath[idx];
          const t = Math.min(1, this._combatMoveProgress);
          const vc = from.col + (to.col - from.col) * t;
          const vr = from.row + (to.row - from.row) * t;
          const isActive = eng.currentUnit && eng.currentUnit.id === u.id;
          this._renderer.drawUnitTokenAt(vc, vr, u, ts, ox, oy, { active: isActive, time: this._combatTime });
        }
      }

      // underground fights are lit only by the fighters' torches
      const dark = this._crawlBattle && this._crawl ? this._crawl.theme.darkness : UNDERGROUND_LIGHT[this._combatBiome];
      if (dark && !this._overworldCombat) {
        const lights = [];
        for (const u of eng.units)
          if (u.isAlive)
            lights.push({ x: ox + u.position.col * ts + ts / 2, y: oy + u.position.row * ts + ts / 2, radius: ts * (u.faction === 'party' ? 3.4 : 2.4) });
        this._renderer.drawLighting(ox, oy, eng.grid.cols * ts, eng.grid.rows * ts, lights, this._combatTime, dark);
      }

      // placing the party before an ambush; messages stay above the board
      if (this._deploying)
        this._drawDeployment(ox, oy, ts);
      if (this._crawlBattle && !(this._combatAnim && this._combatAnim.scene))
        this._drawToasts(this._renderer.bufCtx, true);

      if (this._combatAnim) {
        const anim = this._combatAnim;
        if (anim.scene) {
          anim.scene.draw(this._renderer.bufCtx, CANVAS_W, CANVAS_H);
        } else {
          if (anim.defender && anim.defender.position) {
            const dp = anim.defender.position;
            const dx = ox + dp.col * ts;
            const dy = oy + dp.row * ts;
            const flash = Math.sin(anim.timer * 20) > 0;
            if (flash)
              this._renderer.drawScreenRect(dx, dy, ts, ts, 'rgba(255,255,255,0.4)');
          }
          if (anim.attacker && anim.attacker.position) {
            const ap = anim.attacker.position;
            const ax = ox + ap.col * ts;
            const ay = oy + ap.row * ts;
            const pulse = 0.5 + 0.5 * Math.sin(anim.timer * 15);
            const auraColor = `rgba(255,200,0,${(pulse * 0.3).toFixed(2)})`;
            this._renderer.drawScreenRect(ax, ay, ts, ts, auraColor);
          }
        }
      }

      if (cfx && bctx) {
        cfx.drawParticles(bctx);
        cfx.drawNumbers(bctx);
        cfx.endShake(bctx);
      }

      // Canvas-rendered panels removed — now handled by CombatUI HTML overlays

      // nothing of the board's UI may show through a battle cut-in
      const inScene = !!(this._combatAnim && this._combatAnim.scene);
      if (!inScene && this._combatHoverTile && eng.grid.inBounds(this._combatHoverTile.col, this._combatHoverTile.row)) {
        const ht = this._combatHoverTile;
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
          this._renderer.drawTooltip(mx, my, lines);
        }
      }

      if (this._contextMenu && !inScene)
        this._renderer.drawContextMenu(this._contextMenu.x, this._contextMenu.y, this._contextMenu.items, this._contextMenuHover);

      if (phase === CombatPhase.VICTORY) {
        this._renderer.drawPanel(CANVAS_W / 2 - 160, CANVAS_H / 2 - 65, 320, 130, { bg: 'rgba(20,40,20,0.95)', border: '#4c4' });
        this._renderer.drawScreenText(CANVAS_W / 2, CANVAS_H / 2 - 22, 'VICTORY!', { color: '#4c4', font: 'bold 36px serif', align: 'center' });
        this._renderer.drawButton(CANVAS_W / 2 - 80, CANVAS_H / 2 + 14, 160, 40, 'Continue', { bg: '#2a4a2a', font: '15px monospace' });
      } else if (phase === CombatPhase.DEFEAT) {
        this._renderer.drawPanel(CANVAS_W / 2 - 160, CANVAS_H / 2 - 65, 320, 130, { bg: 'rgba(40,20,20,0.95)', border: '#c44' });
        this._renderer.drawScreenText(CANVAS_W / 2, CANVAS_H / 2 - 22, 'DEFEAT', { color: '#c44', font: 'bold 36px serif', align: 'center' });
        this._renderer.drawButton(CANVAS_W / 2 - 80, CANVAS_H / 2 + 14, 160, 40, 'Title Screen', { bg: '#4a2a2a', font: '15px monospace' });
      }
    },

    _getActionButtons() {
      const eng = this._combatEngine;
      if (!eng || !eng.currentUnit || eng.currentUnit.faction !== 'party' || this._combatAnim || this._combatMovePath)
        return [];
      const phase = eng.phase;
      const unit = eng.currentUnit;
      const buttons = [];

      const effectivePos = this._combatTentativePos || unit.position;
      const hasSpells = unit.spells && unit.spells.length > 0;
      const canCastAnyWithTargets = hasSpells && unit.spells.some(id => {
        const sp = Spells ? Spells.byId(id) : null;
        if (!sp || !unit.canCastSpell(sp))
          return false;
        if (this._combatTentativePos) {
          const targets = Spells.getSpellTargetsInRange(eng.grid, effectivePos, sp, unit.faction, eng.units);
          return targets.length > 0;
        }
        return eng.getSpellTargets(unit.id, sp.id).length > 0;
      });

      if (phase === CombatPhase.AWAITING_MOVE) {
        if (!this._combatTentativePos)
          buttons.push({ label: 'Click tile to move', disabled: true, bg: '#1a2a3a' });
        const targets = this._getAttackTargetsFromPos(eng, unit, effectivePos);
        if (targets.length > 0)
          buttons.push({ label: 'Attack', disabled: false, bg: '#5a2a2a' });
        if (canCastAnyWithTargets)
          buttons.push({ label: 'Cast', disabled: false, bg: '#2a2a5a' });
        buttons.push({ label: 'Wait', disabled: false, bg: '#3a3a3a' });
        buttons.push({ label: 'Flee', disabled: false, bg: '#4a3a1a' });
      } else if (phase === CombatPhase.AWAITING_ACTION) {
        const targets = this._getAttackTargetsFromPos(eng, unit, effectivePos);
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
    },

    _getSpellMenuButtons(unit) {
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
    },

    _startCombat(enemies, biome, aiTier) {
      if (this._combatFx)
        this._combatFx.clear();
      if (TR.spriteResolver)
        TR.spriteResolver.preloadCreatures(enemies.map(e => e.templateId));

      const prng = PRNG.random();
      this._combatEngine = new CombatEngine(prng);
      if (aiTier != null) this._combatEngine.setAiTier(aiTier);
      // Vary combat grid size by encounter
      const enemyCount = enemies.length;
      const gridCols = enemyCount >= 4 ? 14 : aiTier >= 3 ? 16 : 12;
      const gridRows = enemyCount >= 4 ? 12 : aiTier >= 3 ? 14 : 10;
      biome = biome || 'plains';
      this._combatBiome = biome;

      const partyWithHp = this._party.map((c, i) => {
        const hp = this._partyHp ? this._partyHp[i] : c.maxHp;
        if (hp >= c.maxHp)
          return c;
        return Object.freeze({ ...c, hp });
      });

      this._combatEngine.initCombat(partyWithHp, enemies, gridCols, gridRows, biome);
      this._applyPlaneToCombat();
      this._combatEngine.startTurn();
      // Tiles fill the canvas: reserve 36px top (active char) + 36px bottom (init bar)
      const availW = CANVAS_W - 8;
      const availH = CANVAS_H - 72;
      this._combatTileSize = Math.min(Math.floor(availW / gridCols), Math.floor(availH / gridRows));
      const gridPxW = gridCols * this._combatTileSize;
      const gridPxH = gridRows * this._combatTileSize;
      this._combatOffsetX = Math.floor((CANVAS_W - gridPxW) / 2);
      this._combatOffsetY = 36 + Math.floor((availH - gridPxH) / 2);
      this._combatMovePath = null;
      this._combatMoveUnit = null;

      if (this._combatUI) this._combatUI.show();

      if (this._combatEngine.currentUnit && this._combatEngine.currentUnit.faction === 'enemy')
        this._processEnemyTurns();
    },

    _startOverworldCombat(enemies, biome, aiTier) {
      if (this._combatFx)
        this._combatFx.clear();
      if (TR.spriteResolver)
        TR.spriteResolver.preloadCreatures(enemies.map(e => e.templateId));

      const prng = PRNG.random();
      this._combatEngine = new CombatEngine(prng);
      if (aiTier != null) this._combatEngine.setAiTier(aiTier);
      const gridCols = 14;
      const gridRows = 12;
      biome = biome || 'plains';
      this._combatBiome = biome;

      const partyWithHp = this._party.map((c, i) => {
        const hp = this._partyHp ? this._partyHp[i] : c.maxHp;
        if (hp >= c.maxHp)
          return c;
        return Object.freeze({ ...c, hp });
      });

      const origin = this._overworldCombatOrigin || this._playerPos;
      const tileRect = this._overworldMap.extractTileRect(origin.col, origin.row, gridCols, gridRows);
      const grid = CombatGrid.fromOverworldTiles(tileRect.tiles, gridCols, gridRows);
      const partyGridPos = { col: Math.floor(gridCols / 2), row: Math.floor(gridRows / 2) };

      this._combatEngine.initCombatWithGrid(partyWithHp, enemies, grid, biome, partyGridPos);
      this._applyPlaneToCombat();
      this._combatEngine.startTurn();
      // Overworld combat uses the overworld tile size since background is the actual map
      this._combatTileSize = TILE_SIZE;
      this._combatOffsetX = 0;
      this._combatOffsetY = 0;

      if (this._combatUI) this._combatUI.show();
      this._combatMovePath = null;
      this._combatMoveUnit = null;

      if (this._combatEngine.currentUnit && this._combatEngine.currentUnit.faction === 'enemy')
        this._processEnemyTurns();
    },

    _syncPartyHpFromCombat() {
      if (!this._combatEngine || !this._partyHp)
        return;
      const partyUnits = this._combatEngine.units.filter(u => u.faction === 'party');
      for (let i = 0; i < partyUnits.length && i < this._partyHp.length; ++i)
        this._partyHp[i] = partyUnits[i].currentHp;
    },

    _distributeRewards() {
      if (!this._combatEngine || !this._party || !this._partyXp)
        return;
      const rewards = this._combatEngine.getRewards();
      this._gold += rewards.gold;
      const survivors = this._combatEngine.units.filter(u => u.faction === 'party' && u.isAlive);
      const xpEach = survivors.length > 0 ? Math.floor(rewards.xp / survivors.length) : 0;
      const levelUps = [];

      for (let i = 0; i < this._party.length; ++i) {
        const unit = this._combatEngine.units.find(u => u.id === `party_${i}`);
        if (!unit || !unit.isAlive)
          continue;
        this._partyXp[i] += xpEach;
        const oldLevel = this._party[i].level;
        const newLevel = Character.levelFromXp(this._partyXp[i]);
        if (newLevel > oldLevel) {
          let c = this._party[i];
          for (let l = oldLevel; l < newLevel; ++l)
            c = Character.levelUp(c);
          const arr = [...this._party];
          arr[i] = c;
          this._party = Object.freeze(arr);
          this._partyHp[i] = c.maxHp;
          levelUps.push(c.name);
        }
      }

      if (Items && rewards.loot)
        for (const item of rewards.loot)
          this._inventory = Items.addToInventory(this._inventory, item);

      this._lastRewards = { xp: rewards.xp, xpEach, gold: rewards.gold, levelUps, loot: rewards.loot || [] };
    },

    _restParty() {
      if (!this._party || !this._partyHp)
        return;
      for (let i = 0; i < this._party.length; ++i)
        this._partyHp[i] = this._party[i].maxHp;
    },

    _processEnemyTurns() {
      this._enemyQueue = [true];
      this._executeNextEnemy();
    },

    _executeNextEnemy() {
      this._enemyQueue = [];
      const eng = this._combatEngine;
      if (!eng || eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT)
        return;

      const unit = eng.currentUnit;
      if (!unit || unit.faction !== 'enemy' || !unit.isAlive) {
        if (unit && !unit.isAlive) {
          eng.nextTurn();
          eng.startTurn();
          if (eng.currentUnit && eng.currentUnit.faction === 'enemy') {
            this._enemyQueue = [true];
            this._executeNextEnemy();
          }
        }
        return;
      }

      const prevPos = { col: unit.position.col, row: unit.position.row };
      let attackEvent = null, specialEvent = null, spellEvent = null;
      const captureAttack = (e) => { attackEvent = e; };
      const captureSpecial = (e) => { specialEvent = e; };
      const captureSpell = (e) => { spellEvent = e; };
      eng.on('attackResolved', captureAttack);
      eng.on('specialResolved', captureSpecial);
      eng.on('spellResolved', captureSpell);
      eng.executeEnemyTurn(unit.id);
      eng.off('attackResolved', captureAttack);
      eng.off('specialResolved', captureSpecial);
      eng.off('spellResolved', captureSpell);

      const newPos = unit.position;
      const moved = prevPos.col !== newPos.col || prevPos.row !== newPos.row;

      const showAttack = () => {
        if (specialEvent && specialEvent.targets.length) {
          this._showMonsterSpecial(unit, specialEvent);
          return;
        }
        if (spellEvent) {
          if (spellEvent.aoe)
            this._startAoeSpellAnim(unit, spellEvent);
          else
            this._startSpellAnim(unit, spellEvent.target, spellEvent);
          return;
        }
        if (attackEvent) {
          const def = attackEvent.defender;
          const pos = def.position;
          const ts = this._combatTileSize;
          const ox = this._combatOffsetX;
          const oy = this._combatOffsetY;
          const dmg = attackEvent.damage;
          const crit = attackEvent.critical;
          const hit = attackEvent.result.hit;

          this._combatAnim = this._attachBattleScene({
            type: 'enemy_attack',
            timer: 2.0,
            duration: 2.0,
            attacker: unit,
            defender: def,
            impacts: [hit
              ? { kind: 'hit', unit: def, from: unit, amount: dmg, crit }
              : { kind: 'miss', unit: def, from: unit },
              ...(attackEvent.effects || []).map(e => ({ kind: 'effect', unit: def, text: e.text, color: e.color }))],
            result: {
              hit,
              damage: dmg,
              critical: crit,
              effects: attackEvent.effects || [],
              flanking: attackEvent.flanking,
              d20: attackEvent.result.d20,
              total: attackEvent.result.total,
              natural1: attackEvent.result.natural1,
              natural20: attackEvent.result.natural20,
            },
          });
        } else {
          this._combatAnim = {
            type: 'enemy_move',
            timer: 0.15,
            attacker: unit,
          };
        }
      };

      if (moved) {
        const path = Pathfinding.findPath(eng.grid, prevPos, newPos, 'enemy');
        if (path && path.length > 1) {
          this._combatMoveStart = { ...prevPos };
          this._combatMovePath = path.slice(1);
          this._combatMoveUnit = unit.id;
          this._combatMoveIdx = 0;
          this._combatMoveProgress = 0;
          this._combatMoveCallback = showAttack;
          return;
        }
      }
      showAttack();
    },

    _finishCombatAnim() {
      const animType = this._combatAnim ? this._combatAnim.type : null;
      if (this._combatAnim)
        this._playImpacts(this._combatAnim.impacts);
      this._combatAnim = null;
      this._combatTentativePos = null;
      this._combatOriginalPos = null;
      const eng = this._combatEngine;
      if (!eng || eng.phase === CombatPhase.VICTORY || eng.phase === CombatPhase.DEFEAT)
        return;

      if (animType === 'player_attack' || animType === 'spell_cast') {
        eng.nextTurn();
        eng.startTurn();
        if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
          this._processEnemyTurns();
        return;
      }

      eng.nextTurn();
      eng.startTurn();
      if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
        this._processEnemyTurns();
    },

    _unitScreenCenter(unit) {
      const ts = this._combatTileSize;
      const pos = unit.position;
      return { x: this._combatOffsetX + pos.col * ts + ts / 2, y: this._combatOffsetY + pos.row * ts + ts / 2 };
    },

    // Grid feedback for one resolved action, played when its cut-in ends.
    _playImpacts(impacts) {
      const fx = this._combatFx;
      if (!fx || !impacts)
        return;
      for (const imp of impacts) {
        const u = imp.unit;
        if (!u || !u.position)
          continue;
        const c = this._unitScreenCenter(u);
        const src = imp.from && imp.from.position && imp.from !== u ? this._unitScreenCenter(imp.from) : null;
        if (imp.kind === 'hit') {
          fx.hit(u.id, c.x, c.y, imp.amount, { crit: !!imp.crit, fromX: src ? src.x : null, fromY: src ? src.y : null, color: imp.color || null });
          if (imp.spell)
            fx.spell(c.x, c.y, imp.color);
        } else if (imp.kind === 'miss')
          fx.miss(u.id, c.x, c.y);
        else if (imp.kind === 'heal')
          fx.heal(u.id, c.x, c.y, imp.amount);
        else if (imp.kind === 'effect')
          fx.number(c.x, c.y - 26, imp.text, { color: imp.color || '#f0e080', size: 15 });
        if (!u.isAlive && !fx.isDying(u.id))
          fx.death(u.id, c.x, c.y);
      }
    },

    // A monster's breath, gaze, rays, web or rock as a battle scene; every
    // creature it caught gets its numbers or effect on the grid afterwards.
    _showMonsterSpecial(unit, ev) {
      const first = ev.targets.find(t => t.damage > 0) || ev.targets[0];
      const effects = ev.targets.filter(t => t.effect).map(t => ({ unitId: t.unit.id, text: t.effect, color: '#f0e080' }));
      this._combatAnim = this._attachBattleScene({
        type: 'spell_cast',
        timer: 2.5,
        duration: 2.5,
        attacker: unit,
        defender: first.unit,
        impacts: ev.targets.flatMap(t => [
          t.damage > 0 ? { kind: 'hit', unit: t.unit, from: unit, amount: t.damage, spell: true, color: '#ff9a4a' } : null,
          t.effect ? { kind: 'effect', unit: t.unit, text: t.effect } : null,
        ].filter(Boolean)),
        result: {
          damage: first.damage,
          targets: ev.targets.map(t => ({ unitId: t.unit.id, damage: t.damage, heal: 0 })),
          spell: { id: `special_${ev.special}`, name: ev.name },
          spellName: ev.name,
          special: { kind: ev.special, element: ev.element, shape: ev.shape },
          effects,
        },
      });
    },

    _startAttackAnim(attackerId, defenderId, result) {
      const eng = this._combatEngine;
      const attacker = eng.unitById(attackerId);
      const defender = eng.unitById(defenderId);
      if (!attacker || !defender)
        return;

      this._combatAnim = this._attachBattleScene({
        type: 'player_attack',
        timer: 2.0,
        duration: 2.0,
        attacker,
        defender,
        result,
        impacts: [result.hit
          ? { kind: 'hit', unit: defender, from: attacker, amount: result.damage, crit: result.critical }
          : { kind: 'miss', unit: defender, from: attacker }],
      });
    },

    _startSpellAnim(caster, target, result) {
      if (!caster || !target)
        return;

      const spell = result.spell;
      const spellName = spell ? spell.name : 'Spell';
      const impacts = [];
      if (result.damage > 0)
        impacts.push({ kind: 'hit', unit: target, from: caster, amount: result.damage, color: '#c070ff', spell: true });
      if (result.heal > 0)
        impacts.push({ kind: 'heal', unit: target, amount: result.heal });

      this._combatAnim = this._attachBattleScene({
        type: 'spell_cast',
        timer: 2.0,
        duration: 2.0,
        attacker: caster,
        defender: target,
        impacts,
        result: { ...result, hit: true, d20: 0, total: 0, natural20: false, natural1: false, critical: false, spellName },
      });
    },

    _startAoeSpellAnim(caster, result) {
      if (!caster || !result || !result.targets)
        return;

      const eng = this._combatEngine;
      const spell = result.spell;
      const spellName = spell ? spell.name : 'AoE Spell';

      const impacts = [];
      for (const t of result.targets) {
        const u = eng ? eng.unitById(t.unitId) : null;
        if (!u) continue;
        if (t.damage > 0)
          impacts.push({ kind: 'hit', unit: u, from: caster, amount: t.damage, color: '#c070ff', spell: true });
        if (t.heal > 0)
          impacts.push({ kind: 'heal', unit: u, amount: t.heal });
      }

      const firstTarget = result.targets.length > 0 ? (eng ? eng.unitById(result.targets[0].unitId) : null) : null;
      this._combatAnim = this._attachBattleScene({
        type: 'spell_cast',
        timer: 2.0,
        duration: 2.0,
        attacker: caster,
        defender: firstTarget || caster,
        impacts,
        result: { ...result, hit: true, d20: 0, total: 0, natural20: false, natural1: false, critical: false, spellName: `${spellName} (${result.targets.length} hit)` },
      });
    },

  });
})();
