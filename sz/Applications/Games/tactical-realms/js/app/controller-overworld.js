;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { GameState, StateMachine, PRNG, TimeRotation, Renderer, InputHandler, SaveManager, SaveCrypto, Character, Roster, RACES, CLASSES, CombatEngine, CombatPhase, CombatUnit, CombatGrid, Terrain, D20, Pathfinding, AssetLoader, OverworldMap, OverworldTile, Spells, Shop, ShopType, Items, CombatUI } = TR;
  const { CANVAS_W, CANVAS_H, TILE_SIZE, MOVE_DURATION, COMBAT_TILE_SIZE, COMBAT_MOVE_STEP_DUR, REVEAL_TIME, CRAWL_TILE, CRAWL_STEP, DEPLOY_BUTTON, UNDERGROUND_LIGHT, TRAIT_COLORS, HAZARD_COLORS, BATTLE_SCENE_KEY, BATTLE_SCENE_MODES, loadBattleSceneMode, MENU_ACTIONS, CAMP_BUTTONS, TOWN_BUTTONS, TITLE_BUTTONS } = TR.app;
  const Controller = TR.Controller;

  Object.assign(Controller.prototype, {
    _tryMove(col, row) {
      if (!this._overworldMap || this._isMoving)
        return false;
      if (!this._overworldMap.isPassable(col, row))
        return false;
      this._moveFrom = { col: this._playerPos.col, row: this._playerPos.row };
      this._moveTarget = { col, row };
      this._moveProgress = 0;
      this._isMoving = true;
      this._moveCooldown = MOVE_DURATION * 0.5;
      return true;
    },

    _onArrivedAtTile() {
      if (!this._overworldMap)
        return;
      if (this._sm.current === GameState.COMBAT)
        return;
      // Invalidate path cache when player reaches a new tile (positions shifted)
      this._overworldMap.clearPathCache();
      const col = this._playerPos.col;
      const row = this._playerPos.row;
      const loc = this._overworldMap.getLocation(col, row);

      if (loc) {
        this._walkPath = null;
        if (loc.tile === OverworldTile.TOWN) {
          this._sm.transition(GameState.TOWN);
          return;
        }
        if (loc.tile === OverworldTile.CAMP) {
          this._sm.transition(GameState.CAMP);
          return;
        }
        if (loc.tile === OverworldTile.DUNGEON) {
          this._overworldCombat = false;
          this._enterDungeon(loc);
          return;
        }
        if (loc.tile === OverworldTile.PORTAL) {
          this._askPortal(loc);
          return;
        }
      }

      ++this._stepsSinceEncounter;
      const pacing = TR.encounterPacing ? TR.encounterPacing(this._stepsSinceEncounter) : 1;
      const chance = this._overworldMap.encounterChance(col, row) * pacing;
      if (chance > 0 && this._prng.next() < chance) {
        this._stepsSinceEncounter = 0;
        this._walkPath = null;
        const avgLevel = this._party.length > 0 ? Math.round(this._party.reduce((s, c) => s + c.level, 0) / this._party.length) : 1;
        const enemies = this._overworldMap.encounterEnemies(col, row, this._prng, avgLevel);
        const biome = this._overworldMap.encounterBiome(col, row);
        this._encounterMsg = 'Ambush!';
        this._encounterTimer = 0.5;
        this._overworldCombat = true;
        this._overworldCombatOrigin = { col, row };
        this._sm.transition(GameState.COMBAT);
        const aiTier = this._overworldMap.encounterAiTier(col, row);
        this._startOverworldCombat(enemies, biome, aiTier);
      }
    },

    // --- planes and portals ---------------------------------------------------

    // Where a portal leads: a gate home goes back to the plane the party came
    // from, any other portal to its own target.
    _portalTarget(loc) {
      if (loc.returnGate)
        return this._planeReturn[this._dimension] || 'material';
      return loc.targetPlane;
    },

    _askPortal(loc) {
      const target = this._portalTarget(loc);
      if (!target || !TR.PlaneRegistry || !TR.PlaneRegistry.has(target))
        return;
      const where = TR.PlaneWorlds ? TR.PlaneWorlds.shortName(target) : target;
      // what waits on the other side, so the step is a choice
      const traits = TR.PlaneWorlds ? TR.PlaneWorlds.traits(target).map(t => t.name).join('  ·  ') : '';
      this._crawlPrompt = {
        text: loc.name, sub: `Step through to ${where}?`, note: traits || null, yes: 'Step through',
        act: () => this._beginPlaneShift(target, !!loc.returnGate),
      };
    },

    _beginPlaneShift(target, returning) {
      if (this._planeShift || !TR.PlaneRegistry || !TR.PlaneRegistry.has(target) || !this._overworldMap)
        return;
      this._walkPath = null;
      this._planeShift = { t: 0, dur: 2.2, target, returning, switched: false };
    },

    _updatePlaneShift(dt) {
      const s = this._planeShift;
      s.t += dt;
      if (!s.switched && s.t >= s.dur / 2) {
        s.switched = true;
        this._travelToPlane(s.target, s.returning);
      }
      if (s.t >= s.dur)
        this._planeShift = null;
    },

    // Move the party to another plane: through a gate home back to where it
    // stepped off, through any other portal to the target's own gate.
    _travelToPlane(target, returning) {
      const from = this._dimension;
      this._planeMaps.set(from, this._overworldMap);
      this._planePositions[from] = { col: this._playerPos.col, row: this._playerPos.row };
      if (!returning)
        this._planeReturn[target] = from;
      let map = this._planeMaps.get(target);
      if (!map) {
        map = new OverworldMap(this._overworldMap.worldSeed, target);
        this._planeMaps.set(target, map);
      }
      this._overworldMap = map;
      this._dimension = target;
      const back = returning ? this._planePositions[target] : null;
      this._playerPos = back ? { col: back.col, row: back.row } : { col: 0, row: 0 };
      this._isMoving = false;
      this._moveTarget = null;
      this._moveFrom = null;
      this._walkPath = null;
      this._stepsSinceEncounter = 0;
      const P = TR.PlaneWorlds ? TR.PlaneWorlds.get(target) : null;
      const name = P ? P.name : (TR.PlaneRegistry.get(target) || {}).name || target;
      const traits = TR.PlaneWorlds ? TR.PlaneWorlds.traits(target) : [];
      this._toast(name, '#d8c8ff', target === 'material' ? 'Home again.' : traits.map(t => t.name).join('  ·  ') || null);
      this._autoSave(GameState.OVERWORLD);
    },

    // A swirl of the target plane's colours closing in and opening again.
    _drawPlaneShift(ctx) {
      const s = this._planeShift;
      if (!s || !ctx)
        return;
      const k = Math.max(0, 1 - Math.abs(s.t / s.dur * 2 - 1));
      const BB = TR.BattleBackdrop;
      const tint = BB && BB.PLANE_TINTS[s.target];
      const hue = tint ? tint.sky.replace(/[\d.]+\)$/, '1)') : 'rgba(150,130,230,1)';
      const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
      ctx.save();
      ctx.globalAlpha = Math.min(1, k * 1.4);
      ctx.fillStyle = 'rgba(10,6,24,0.85)';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.translate(cx, cy);
      ctx.rotate(s.t * 2.4);
      ctx.lineCap = 'round';
      // soft wide arms under bright thin ones
      for (const [width, alpha] of [[34, 0.25], [14, 0.65], [4, 1]])
        for (let arm = 0; arm < 6; ++arm) {
          ctx.globalAlpha = Math.min(1, k * 1.4) * alpha;
          ctx.lineWidth = width;
          ctx.strokeStyle = width === 4 ? '#ffffff' : arm % 2 ? hue : 'rgb(200,180,255)';
          ctx.beginPath();
          for (let i = 0; i <= 44; ++i) {
            const a = arm / 6 * Math.PI * 2 + i * 0.15;
            const rad = (1.25 - k * 0.65) * i * i * 0.42;
            if (i === 0)
              ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
            else
              ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
          }
          ctx.stroke();
        }
      // motes drawn into the eye
      ctx.globalAlpha = Math.min(1, k * 1.6);
      for (let i = 0; i < 90; ++i) {
        const a = i * 2.39996 - s.t * 3;
        const rad = ((i * 37 + (1 - s.t / s.dur) * 900) % 700) * (1.1 - k * 0.5);
        ctx.fillStyle = i % 3 ? '#ffffff' : hue;
        ctx.fillRect(Math.cos(a) * rad, Math.sin(a) * rad, 3, 3);
      }
      ctx.restore();
      // the flash as the planes change
      const flash = Math.max(0, 1 - Math.abs(s.t - s.dur / 2) * 5);
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${flash.toFixed(3)})`;
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      }
    },

    _drawPortalGlow(ctx, x, y) {
      const t = this._screenTime;
      const r = 40 * (0.85 + 0.15 * Math.sin(t * 3.1));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(190,150,255,0.5)');
      g.addColorStop(1, 'rgba(120,80,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
    },

    // The plane's traits take hold of a fight: burning air, weightless
    // bodies, stronger or weaker magic. Damage it deals floats up like a hit.
    _applyPlaneToCombat() {
      const eng = this._combatEngine;
      if (!eng || !TR.PlaneWorlds)
        return;
      eng.setPlaneTraits(TR.PlaneWorlds.traits(this._dimension));
      eng.on('planeEffect', ({ unit, amount, kind }) => {
        if (!this._combatFx)
          return;
        const ts = this._combatTileSize;
        const x = this._combatOffsetX + unit.position.col * ts + ts / 2;
        const y = this._combatOffsetY + unit.position.row * ts;
        if (amount < 0)
          this._combatFx.heal(unit.id, x, y, -amount);
        else
          this._combatFx.hit(unit.id, x, y, amount, { color: HAZARD_COLORS[kind] || '#ff8a4a' });
      });
    },

    // --- dungeon crawl ------------------------------------------------------

    _crawlKey() {
      return `${this._dimension}:${this._playerPos.col},${this._playerPos.row}`;
    },

    _enterDungeon(loc) {
      if (!TR.DungeonCrawl || !TR.DungeonThemes)
        return;
      const key = `${this._dimension}:${loc.col},${loc.row}`;
      let crawl = this._crawlCache.get(key);
      if (!crawl) {
        const world = this._overworldMap ? this._overworldMap.seed : 1;
        const seed = (world ^ Math.imul(loc.col, 73856093) ^ Math.imul(loc.row, 19349663)) >>> 0;
        crawl = new TR.DungeonCrawl({
          seed, theme: TR.DungeonThemes.themeForLocation(loc), name: loc.name,
          difficulty: loc.difficulty || 1, enemies: loc.enemies || [],
        });
        this._crawlCache.set(key, crawl);
      } else
        crawl.enterFloor(0, 'up');
      this._crawl = crawl;
      this._crawlPrompt = null;
      this._crawlTrail = [];
      this._crawlWalk = null;
      this._crawlPath = null;
      this._preloadCrawlMonsters();
      this._sm.transition(GameState.DUNGEON);
      this._toast(`${loc.name}`, '#f0d890', crawl.theme.name);
    },

    _preloadCrawlMonsters() {
      if (TR.spriteResolver && this._crawl)
        TR.spriteResolver.preloadCreatures(this._crawl.groups.flatMap(g => g.members.map(m => m.templateId)));
    },

    _leaveDungeon() {
      this._crawl = null;
      this._crawlPath = null;
      this._sm.transition(GameState.OVERWORLD);
    },

    _toast(text, color = '#f0ead8', sub = null) {
      this._toasts.push({ text, color, sub, t: 0 });
      if (this._toasts.length > 4)
        this._toasts.shift();
    },

  });
})();
