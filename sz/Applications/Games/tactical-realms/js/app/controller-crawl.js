;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { GameState, StateMachine, PRNG, TimeRotation, Renderer, InputHandler, SaveManager, SaveCrypto, Character, Roster, RACES, CLASSES, CombatEngine, CombatPhase, CombatUnit, CombatGrid, Terrain, D20, Pathfinding, AssetLoader, OverworldMap, OverworldTile, Spells, Shop, ShopType, Items, CombatUI } = TR;
  const { CANVAS_W, CANVAS_H, TILE_SIZE, MOVE_DURATION, COMBAT_TILE_SIZE, COMBAT_MOVE_STEP_DUR, REVEAL_TIME, CRAWL_TILE, CRAWL_STEP, DEPLOY_BUTTON, UNDERGROUND_LIGHT, TRAIT_COLORS, HAZARD_COLORS, BATTLE_SCENE_KEY, BATTLE_SCENE_MODES, loadBattleSceneMode, MENU_ACTIONS, CAMP_BUTTONS, TOWN_BUTTONS, TITLE_BUTTONS } = TR.app;
  const Controller = TR.Controller;

  Object.assign(Controller.prototype, {
    _updateCrawl(dt) {
      if (this._crawlPrompt)
        return;
      const walk = this._crawlWalk;
      if (walk) {
        walk.t += dt / CRAWL_STEP;
        if (walk.t >= 1) {
          this._crawlWalk = null;
          this._handleCrawlEvents(walk.events);
        }
        return;
      }
      const dir = this._input ? this._input.getMovementDirection() : { dx: 0, dy: 0 };
      let dc = dir.dx, dr = dir.dy;
      if (dc && dr)
        dr = 0;
      if (dc || dr)
        this._crawlPath = null;
      else if (this._crawlPath && this._crawlPath.length > 0) {
        const next = this._crawlPath.shift();
        const p = this._crawl.position;
        dc = next.col - p.col;
        dr = next.row - p.row;
        if (Math.abs(dc) + Math.abs(dr) !== 1) {
          this._crawlPath = null;
          return;
        }
      } else
        return;
      const from = this._crawl.position;
      const res = this._crawl.step(dc, dr);
      if (!res.moved) {
        this._crawlPath = null;
        return;
      }
      // the others follow in the leader's footsteps
      this._crawlTrail.unshift(from);
      this._crawlTrail.length = Math.min(this._crawlTrail.length, 6);
      this._crawlWalk = { from, to: this._crawl.position, t: 0, events: res.events };
    },

    _handleCrawlEvents(events) {
      const c = this._crawl;
      const level = c.difficulty + c.floorIndex;
      for (const ev of events) {
        switch (ev.type) {
          case 'exit':
            this._crawlPath = null;
            this._crawlPrompt = { text: 'Leave the dungeon?', yes: 'Leave', act: () => this._leaveDungeon() };
            return;
          case 'stairs_down':
          case 'stairs_up': {
            const down = ev.type === 'stairs_down';
            this._crawlPath = null;
            this._crawlPrompt = {
              text: down ? `Descend to floor ${c.floorIndex + 2}?` : `Climb back to floor ${c.floorIndex}?`,
              yes: down ? 'Descend' : 'Climb',
              act: () => {
                c.enterFloor(c.floorIndex + (down ? 1 : -1), down ? 'up' : 'down');
                this._crawlTrail = [];
                this._screenTime = 0;
                this._preloadCrawlMonsters();
                this._toast(`Floor ${c.floorIndex + 1} of ${c.floorCount}`, '#c8d8ff', c.isLastFloor ? 'The air grows heavy...' : null);
              },
            };
            return;
          }
          case 'treasure':
          case 'hoard': {
            const hoard = ev.type === 'hoard';
            const gold = (hoard ? 120 : 15) * level + this._prng.nextInt(0, 20 * level);
            this._gold += gold;
            const loot = Items ? Items.generateLoot(this._prng, level + (hoard ? 3 : 0)) : [];
            for (const item of loot)
              this._inventory = Items.addToInventory(this._inventory, item);
            c.useFeature(ev.feature);
            const names = loot.map(i => i.name).join(', ');
            this._toast(hoard ? `The hoard: ${gold} gold!` : `Treasure: ${gold} gold`, '#ffd24a', names || null);
            if (hoard && c.cleared)
              this._toast(`${c.name} is cleared!`, '#a8ffc8');
            break;
          }
          case 'trap': {
            c.useFeature(ev.feature);
            // the sharpest eyes in the party may spot it in time
            const wis = Math.max(...this._party.map(p => p.stats ? Math.floor((p.stats.wis - 10) / 2) : 0));
            if (this._prng.nextInt(1, 20) + wis >= 12 + c.difficulty) {
              this._toast('A trap! Spotted and disarmed.', '#a8e0ff');
              break;
            }
            const i = this._prng.nextInt(0, this._party.length - 1);
            const dmg = this._prng.nextInt(1, 6) * (1 + c.floorIndex) + c.difficulty;
            this._partyHp[i] = Math.max(1, this._partyHp[i] - dmg);
            this._toast(`A trap springs! ${this._party[i].name} takes ${dmg} damage.`, '#ff8a7a');
            break;
          }
          case 'fountain':
            c.useFeature(ev.feature);
            this._partyHp = this._party.map(p => p.maxHp);
            this._toast('Cool water restores the party.', '#8affb0');
            break;
          case 'shrine':
            c.useFeature(ev.feature);
            this._partyHp = this._party.map((p, i) => Math.min(p.maxHp, this._partyHp[i] + Math.ceil(p.maxHp / 2)));
            if (this._partyXp)
              this._partyXp = this._partyXp.map(x => x + 10 * level);
            this._toast('A shrine\'s blessing settles on the party.', '#fff2b0', `+${10 * level} XP each`);
            break;
          case 'sighted': {
            const alive = c.aliveMembers(ev.group);
            const name = alive[0] ? alive[0].templateId.replace(/_/g, ' ') : 'foes';
            this._crawlPath = null;
            this._toast(alive.length > 1 ? `${alive.length} foes ahead: ${name} and more` : `A ${name} lurks ahead`, '#ffb0a0', 'They have not noticed you yet.');
            break;
          }
          case 'encounter':
            this._crawlPath = null;
            this._startCrawlBattle(ev.group, ev.ambush ? 'party' : 'enemy');
            return;
          default:
            break;
        }
      }
    },

    _crawlCamera() {
      const c = this._crawl;
      const ts = CRAWL_TILE;
      let pc = c.position.col, pr = c.position.row;
      const w = this._crawlWalk;
      if (w) {
        const t = Math.min(1, w.t);
        pc = w.from.col + (w.to.col - w.from.col) * t;
        pr = w.from.row + (w.to.row - w.from.row) * t;
      }
      return { x: pc * ts + ts / 2 - CANVAS_W / 2, y: pr * ts + ts / 2 - CANVAS_H / 2 };
    },

    _renderCrawl() {
      const ctx = this._renderer.bufCtx;
      const c = this._crawl;
      if (!ctx || !c || !TR.DungeonView)
        return;
      const cam = this._crawlCamera();
      const w = this._crawlWalk;
      TR.DungeonView.draw(ctx, c, {
        renderer: this._renderer, assets: this._renderer.assets, ts: CRAWL_TILE, cam,
        w: CANVAS_W, h: CANVAS_H, time: this._screenTime, party: this._party, trail: this._crawlTrail,
        walk: w ? { from: w.from, to: w.to, t: Math.min(1, w.t) } : null,
      });
      TR.DungeonView.minimap(ctx, c, CANVAS_W - 224, 16, 208, 150);
      const SA = TR.ScreenArt;
      if (SA) {
        SA.frame(ctx, 16, 16, 300, 58, { alpha: 0.88 });
        this._renderer.drawScreenText(32, 42, c.name, { color: '#f0d890', font: "bold 18px Georgia, 'Times New Roman', serif" });
        this._renderer.drawScreenText(32, 62, `${c.theme.name}  ·  Floor ${c.floorIndex + 1} of ${c.floorCount}`, { color: '#b8c0d8', font: '13px monospace' });
        this._drawPartyStrip(ctx, 16, CANVAS_H - 16 - 22 * this._party.length - 16);
      }
      this._drawToasts(ctx);
      if (this._crawlPrompt)
        this._drawCrawlPrompt(ctx);
      this._renderer.drawScreenText(CANVAS_W - 16, CANVAS_H - 12, 'Arrow keys / WASD to move, click to walk', { color: 'rgba(220,220,230,0.55)', font: '12px monospace', align: 'right' });
    },

    _drawPartyStrip(ctx, x, y) {
      const rowH = 22;
      TR.ScreenArt.frame(ctx, x, y, 260, rowH * this._party.length + 16, { alpha: 0.85 });
      this._party.forEach((p, i) => {
        const hp = this._partyHp ? this._partyHp[i] : p.maxHp;
        const ry = y + 10 + i * rowH;
        this._renderer.drawScreenText(x + 12, ry + 14, p.name.split(' ')[0], { color: '#e8e0c8', font: "13px Georgia, 'Times New Roman', serif" });
        const ratio = Math.max(0, Math.min(1, hp / p.maxHp));
        ctx.fillStyle = '#3a1418';
        ctx.fillRect(x + 100, ry + 6, 110, 8);
        ctx.fillStyle = ratio > 0.5 ? '#46d468' : ratio > 0.25 ? '#e8c440' : '#e84838';
        ctx.fillRect(x + 100, ry + 6, 110 * ratio, 8);
        this._renderer.drawScreenText(x + 250, ry + 14, `${hp}`, { color: '#f0ecdc', font: 'bold 11px monospace', align: 'right' });
      });
    },

    _drawToasts(ctx, bottom = false) {
      this._toasts.forEach((t, i) => {
        const a = t.t < 0.25 ? t.t / 0.25 : t.t > 2.6 ? Math.max(0, (3.2 - t.t) / 0.6) : 1;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = '13px monospace';
        const subW = t.sub ? ctx.measureText(t.sub).width : 0;
        ctx.font = "bold 20px Georgia, 'Times New Roman', serif";
        const tw = Math.max(ctx.measureText(t.text).width, subW) + 48;
        const h = t.sub ? 58 : 40;
        const y = bottom ? CANVAS_H - 150 - i * 66 : 96 + i * 66;
        if (TR.ScreenArt)
          TR.ScreenArt.frame(ctx, CANVAS_W / 2 - tw / 2, y, tw, h, { alpha: 0.9 });
        ctx.textAlign = 'center';
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, CANVAS_W / 2, y + 27);
        if (t.sub) {
          ctx.font = '13px monospace';
          ctx.fillStyle = '#c8c4d8';
          ctx.fillText(t.sub, CANVAS_W / 2, y + 47);
        }
        ctx.restore();
      });
    },

    _crawlPromptButtons() {
      const y = CANVAS_H / 2 + 10;
      return { yes: { x: CANVAS_W / 2 - 170, y, w: 160, h: 44 }, no: { x: CANVAS_W / 2 + 10, y, w: 160, h: 44 } };
    },

    _drawCrawlPrompt(ctx) {
      const b = this._crawlPromptButtons();
      const p = this._crawlPrompt;
      TR.ScreenArt.frame(ctx, CANVAS_W / 2 - 230, CANVAS_H / 2 - 80, 460, 160);
      const top = p.note ? 48 : p.sub ? 36 : 22;
      this._renderer.drawScreenText(CANVAS_W / 2, CANVAS_H / 2 - top, p.text, { color: '#f0d890', font: "bold 22px Georgia, 'Times New Roman', serif", align: 'center' });
      if (p.sub)
        this._renderer.drawScreenText(CANVAS_W / 2, CANVAS_H / 2 - top + 26, p.sub, { color: '#d8d0f0', font: "15px Georgia, 'Times New Roman', serif", align: 'center' });
      if (p.note)
        this._renderer.drawScreenText(CANVAS_W / 2, CANVAS_H / 2 - top + 46, p.note, { color: '#ffb08a', font: '12px monospace', align: 'center' });
      this._renderer.drawButton(b.yes.x, b.yes.y, b.yes.w, b.yes.h, this._crawlPrompt.yes, { bg: '#2a4a2a' });
      this._renderer.drawButton(b.no.x, b.no.y, b.no.w, b.no.h, 'Stay', { bg: '#444' });
    },

    _answerCrawlPrompt(yes) {
      const prompt = this._crawlPrompt;
      this._crawlPrompt = null;
      if (yes && prompt)
        prompt.act();
    },

    _onClickCrawl(e) {
      const c = this._crawl;
      if (!c)
        return;
      if (this._crawlPrompt) {
        const b = this._crawlPromptButtons();
        if (this._hitButton(e, b.yes))
          this._answerCrawlPrompt(true);
        else if (this._hitButton(e, b.no))
          this._answerCrawlPrompt(false);
        return;
      }
      const cam = this._crawlCamera();
      const col = Math.floor((e.x + cam.x) / CRAWL_TILE);
      const row = Math.floor((e.y + cam.y) / CRAWL_TILE);
      const path = c.pathTo(col, row);
      if (path && path.length)
        this._crawlPath = path;
    },

    // --- dungeon battles -------------------------------------------------------

    _startCrawlBattle(group, ambush) {
      const c = this._crawl;
      const setup = c.battleSetup(group);
      if (!setup.enemies.length)
        return;
      this._crawlBattle = setup;
      if (this._combatFx)
        this._combatFx.clear();
      if (TR.spriteResolver)
        TR.spriteResolver.preloadCreatures(setup.enemies.map(e => e.templateId));
      this._combatEngine = new CombatEngine(PRNG.random());
      if (TR.EnemyAI)
        this._combatEngine.setAiTier(TR.EnemyAI.difficultyToAiTier(c.difficulty + c.floorIndex));
      this._combatBiome = setup.biome;
      const partyWithHp = this._party.map((ch, i) => {
        const hp = this._partyHp ? this._partyHp[i] : ch.maxHp;
        return hp >= ch.maxHp ? ch : Object.freeze({ ...ch, hp });
      });
      this._combatEngine.initCombatAt(partyWithHp, setup.enemies, setup.grid, setup.partyPositions, setup.enemyPositions, { ambush });
      this._applyPlaneToCombat();
      this._combatEngine.startTurn();

      // tiles stay readable; boards larger than the screen scroll
      const { cols, rows } = setup.grid;
      const availW = CANVAS_W - 8, availH = CANVAS_H - 72;
      const ts = Math.max(40, Math.min(60, Math.floor(availW / cols), Math.floor(availH / rows)));
      this._combatTileSize = ts;
      const bw = cols * ts, bh = rows * ts;
      const lead = this._combatEngine.units.find(u => u.faction === 'party');
      const cx = lead ? lead.position.col * ts + ts / 2 - availW / 2 : 0;
      const cy = lead ? lead.position.row * ts + ts / 2 - availH / 2 : 0;
      this._combatCam = { x: cx, y: cy, tx: cx, ty: cy, maxX: Math.max(0, bw - availW), maxY: Math.max(0, bh - availH), bw, bh, manual: 0, lastUnit: null };
      this._updateCombatCamera(0);
      this._combatMovePath = null;
      this._combatMoveUnit = null;
      this._combatTime = 0;
      this._sm.transition(GameState.COMBAT);

      this._deploying = ambush === 'party';
      this._deploySelected = null;
      this._toasts.length = 0;
      if (this._deploying) {
        if (this._combatUI)
          this._combatUI.hide();
        this._toast('Ambush!', '#ffd24a', 'Click a hero, then a lit tile to place them. Begin when ready.');
        return;
      }
      if (this._combatUI)
        this._combatUI.show();
      this._toast(ambush === 'enemy' ? 'They spotted you!' : 'Battle!', '#ff8a7a');
      if (this._combatEngine.currentUnit && this._combatEngine.currentUnit.faction === 'enemy')
        this._processEnemyTurns();
    },

    _updateCombatCamera(dt) {
      const cam = this._combatCam;
      const eng = this._combatEngine;
      if (!cam || !eng)
        return;
      const ts = this._combatTileSize;
      const availW = CANVAS_W - 8, availH = CANVAS_H - 72;
      // arrow keys look around; the camera then stays put for a moment
      const dir = this._input && !this._deploying ? this._input.getMovementDirection() : { dx: 0, dy: 0 };
      if (dir.dx || dir.dy) {
        cam.tx += dir.dx * 700 * dt;
        cam.ty += dir.dy * 700 * dt;
        cam.manual = 2.5;
      }
      const cur = eng.currentUnit;
      if (cur && cur.id !== cam.lastUnit) {
        cam.lastUnit = cur.id;
        cam.manual = 0;
      }
      cam.manual = Math.max(0, cam.manual - dt);
      if (cam.manual <= 0 && cur && cur.position && !this._deploying) {
        cam.tx = cur.position.col * ts + ts / 2 - availW / 2;
        cam.ty = cur.position.row * ts + ts / 2 - availH / 2;
      }
      cam.tx = Math.max(0, Math.min(cam.maxX, cam.tx));
      cam.ty = Math.max(0, Math.min(cam.maxY, cam.ty));
      const k = dt > 0 ? Math.min(1, dt * 7) : 1;
      cam.x += (cam.tx - cam.x) * k;
      cam.y += (cam.ty - cam.y) * k;
      this._combatOffsetX = cam.bw <= availW ? Math.floor((CANVAS_W - cam.bw) / 2) : 4 - Math.round(cam.x);
      this._combatOffsetY = cam.bh <= availH ? 36 + Math.floor((availH - cam.bh) / 2) : 36 - Math.round(cam.y);
    },

    _onClickDeploy(e) {
      const eng = this._combatEngine;
      const setup = this._crawlBattle;
      if (!eng || !setup)
        return;
      if (this._hitButton(e, DEPLOY_BUTTON)) {
        this._deploying = false;
        this._deploySelected = null;
        this._toasts.length = 0;
        if (this._combatUI)
          this._combatUI.show();
        if (eng.currentUnit && eng.currentUnit.faction === 'enemy')
          this._processEnemyTurns();
        return;
      }
      const ts = this._combatTileSize;
      const col = Math.floor((e.x - this._combatOffsetX) / ts);
      const row = Math.floor((e.y - this._combatOffsetY) / ts);
      const uid = eng.grid.inBounds(col, row) ? eng.grid.unitAt(col, row) : null;
      const unit = uid ? eng.unitById(uid) : null;
      if (unit && unit.faction === 'party') {
        this._deploySelected = unit.id;
        return;
      }
      if (this._deploySelected && !uid && setup.deployZone.some(z => z.col === col && z.row === row)) {
        const u = eng.unitById(this._deploySelected);
        eng.grid.moveUnit(u.id, col, row);
        u.setPosition(col, row);
        this._deploySelected = null;
      }
    },

    _drawDeployment(ox, oy, ts) {
      const setup = this._crawlBattle;
      const ctx = this._renderer.bufCtx;
      if (!setup || !ctx)
        return;
      const pulse = 0.5 + 0.5 * Math.sin(this._combatTime * 4);
      ctx.save();
      ctx.fillStyle = `rgba(255,215,90,${(0.14 + 0.1 * pulse).toFixed(3)})`;
      ctx.strokeStyle = 'rgba(255,215,90,0.6)';
      for (const z of setup.deployZone) {
        ctx.fillRect(ox + z.col * ts + 2, oy + z.row * ts + 2, ts - 4, ts - 4);
        ctx.strokeRect(ox + z.col * ts + 2.5, oy + z.row * ts + 2.5, ts - 5, ts - 5);
      }
      if (this._deploySelected) {
        const u = this._combatEngine.unitById(this._deploySelected);
        if (u) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.strokeRect(ox + u.position.col * ts + 1.5, oy + u.position.row * ts + 1.5, ts - 3, ts - 3);
        }
      }
      ctx.restore();
      this._renderer.drawButton(DEPLOY_BUTTON.x, DEPLOY_BUTTON.y, DEPLOY_BUTTON.w, DEPLOY_BUTTON.h, 'Begin Battle', { bg: '#2a4a2a' });
    },

    // Monsters that fell stay dead in the dungeon.
    _resolveCrawlBattle() {
      const eng = this._combatEngine;
      const setup = this._crawlBattle;
      if (!eng || !setup || !this._crawl)
        return;
      const slain = [];
      setup.enemies.forEach((e, i) => {
        const u = eng.unitById(`enemy_${i}`);
        if (!u || !u.isAlive)
          slain.push({ groupId: e.groupId, member: e.member });
      });
      this._crawl.resolveBattle(setup, slain);
    },

  });
})();
