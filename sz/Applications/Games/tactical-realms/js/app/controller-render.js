;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});
  const { GameState, StateMachine, PRNG, TimeRotation, Renderer, InputHandler, SaveManager, SaveCrypto, Character, Roster, RACES, CLASSES, CombatEngine, CombatPhase, CombatUnit, CombatGrid, Terrain, D20, Pathfinding, AssetLoader, OverworldMap, OverworldTile, Spells, Shop, ShopType, Items, CombatUI } = TR;
  const { CANVAS_W, CANVAS_H, TILE_SIZE, MOVE_DURATION, COMBAT_TILE_SIZE, COMBAT_MOVE_STEP_DUR, REVEAL_TIME, CRAWL_TILE, CRAWL_STEP, DEPLOY_BUTTON, UNDERGROUND_LIGHT, TRAIT_COLORS, HAZARD_COLORS, BATTLE_SCENE_KEY, BATTLE_SCENE_MODES, loadBattleSceneMode, MENU_ACTIONS, CAMP_BUTTONS, TOWN_BUTTONS, TITLE_BUTTONS } = TR.app;
  const Controller = TR.Controller;

  Object.assign(Controller.prototype, {
    _syncCinematic() {
      const scene = this._combatAnim && this._combatAnim.scene;
      const on = this._sm.current === GameState.COMBAT && !!scene && !scene.done;
      if (on !== this._cinematic && typeof document !== 'undefined' && document.body && document.body.classList) {
        document.body.classList.toggle('tr-cinematic', on);
        this._cinematic = on;
      }
    },


    _render() {
      this._syncCinematic();
      this._renderer.beginFrame();

      switch (this._sm.current) {
        case GameState.TITLE:
          this._renderTitle();
          break;
        case GameState.CHARACTER_SELECT:
          this._renderCharacterSelect();
          break;
        case GameState.OVERWORLD:
          this._renderOverworld();
          break;
        case GameState.DUNGEON:
          this._renderCrawl();
          break;
        case GameState.CAMP:
          this._renderCamp();
          break;
        case GameState.TOWN:
          this._renderTown();
          break;
        case GameState.COMBAT:
          this._renderCombat();
          break;
        case GameState.VICTORY:
          this._renderVictory();
          break;
        case GameState.DEFEAT:
          this._renderDefeat();
          break;
        default:
          this._renderTitle();
      }

      // every screen change is revealed by a diagonal wipe
      if (this._screenTime < REVEAL_TIME && TR.ScreenArt && this._sm.current !== GameState.TITLE)
        TR.ScreenArt.reveal(this._renderer.bufCtx, this._screenTime / REVEAL_TIME);

      this._renderer.endFrame();
    },

    _renderTitle() {
      this._renderer.drawTitleScreen(this._screenTime);

      const daily = this._timeRotation.dailyBonusStat();
      const season = this._timeRotation.currentSeason();
      const holiday = this._timeRotation.isHoliday();

      if (TR.ScreenArt && this._renderer.bufCtx)
        TR.ScreenArt.frame(this._renderer.bufCtx, CANVAS_W / 2 - 200, 244, 400, 34, { alpha: 0.8 });
      this._renderer.drawScreenText(CANVAS_W / 2, 266, `Daily Bonus: ${daily}  |  Season: ${season}`, { color: '#e8e0c8', font: '15px monospace', align: 'center' });
      if (holiday)
        this._renderer.drawScreenText(CANVAS_W / 2, 295, `\u2605 ${holiday.name} \u2605`, { color: '#ffd700', font: 'bold 18px serif', align: 'center' });

      const hasSave = this._saveManager.hasSave();
      this._renderer.drawButton(TITLE_BUTTONS[0].x, TITLE_BUTTONS[0].y, TITLE_BUTTONS[0].w, TITLE_BUTTONS[0].h, 'New Game', { bg: '#2a4a2a', font: '16px monospace' });
      if (hasSave)
        this._renderer.drawButton(TITLE_BUTTONS[1].x, TITLE_BUTTONS[1].y, TITLE_BUTTONS[1].w, TITLE_BUTTONS[1].h, 'Continue', { bg: '#2a2a4a', font: '16px monospace' });
    },

    _renderCharacterSelect() {
      this._renderer.drawPanel(0, 0, CANVAS_W, CANVAS_H, { bg: '#1a1e2a' });
      this._renderer.drawScreenText(CANVAS_W / 2, 38, 'SELECT YOUR PARTY', { color: '#c8a84e', font: 'bold 32px serif', align: 'center' });

      const daily = this._timeRotation.dailyBonusStat();
      const season = this._timeRotation.currentSeason();
      this._renderer.drawScreenText(CANVAS_W / 2, 62, `Daily Bonus: ${daily}  |  Season: ${season}`, { color: '#88a', font: '13px monospace', align: 'center' });

      if (!this._roster)
        return;

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
        const char = this._roster[i];

        const raceDef = RACES.find(r => r.id === char.race);
        const classDef = CLASSES.find(c => c.id === char.class);
        const debugAllSeasons = this._timeRotation._debugAllSeasons === true;
        const raceLocked = !debugAllSeasons && raceDef && raceDef.season && raceDef.season !== season;
        const classLocked = !debugAllSeasons && classDef && classDef.season && classDef.season !== season;
        const locked = raceLocked || classLocked;
        const selected = this._selectedSlots.has(i);

        this._renderer.drawCharacterCard(x, y, cardW, cardH, char, { selected, locked });
      }

      if (this._partyFullFlash > 0) {
        this._renderer.drawScreenText(CANVAS_W / 2, CANVAS_H - 76, 'Party Full (max 4)', { color: '#f44', font: 'bold 16px monospace', align: 'center' });
        this._partyFullFlash = Math.max(0, this._partyFullFlash - 0.016);
      }

      const selCount = this._selectedSlots.size;
      // beside the button: the second card row reaches down to y = 676
      this._renderer.drawScreenText(528, CANVAS_H - 18, `Selected: ${selCount} / 4`, { color: selCount > 0 ? '#e8e0c8' : '#888', font: '15px monospace', align: 'right' });

      if (selCount >= 1 && selCount <= 4)
        this._renderer.drawButton(540, CANVAS_H - 42, 200, 36, 'Begin Adventure', { bg: '#2a4a2a', font: '15px monospace' });
    },

    _renderOverworld() {
      const ts = TILE_SIZE;
      const visualCol = this._isMoving
        ? this._moveFrom.col + (this._moveTarget.col - this._moveFrom.col) * Math.min(1, this._moveProgress)
        : this._playerPos.col;
      const visualRow = this._isMoving
        ? this._moveFrom.row + (this._moveTarget.row - this._moveFrom.row) * Math.min(1, this._moveProgress)
        : this._playerPos.row;

      this._renderer.centerOn(
        visualCol * ts + ts / 2,
        visualRow * ts + ts / 2
      );

      if (this._overworldMap) {
        const tile = (c, r) => this._overworldMap.getTile(c, r);
        this._renderer.drawInfiniteMap(tile, this._dimension, (c, r) => this._overworldMap.groundAt(c, r));
        this._renderer.drawOverworldAmbience(tile, this._screenTime, this._dimension);
      }

      if (this._overworldMap) {
        const cam = this._renderer.camera;
        const locs = this._overworldMap.getVisibleLocations(cam.x, cam.y, CANVAS_W, CANVAS_H, ts);
        const ctx = this._renderer.bufCtx;
        for (const loc of locs) {
          const s = this._renderer.worldToScreen(loc.col * ts + ts / 2, loc.row * ts);
          if (loc.tile === OverworldTile.CAMP && ctx)
            this._drawCampGlow(ctx, s.x, s.y + ts * 0.6);
          else if (loc.tile === OverworldTile.PORTAL && ctx)
            this._drawPortalGlow(ctx, s.x, s.y + ts * 0.55);
          this._drawLocationPlate(ctx, s.x, s.y - 6, loc);
        }
      }

      const px = visualCol * ts;
      const py = visualRow * ts;
      const camX = this._renderer.camera.x;
      const camY = this._renderer.camera.y;
      let drawnSprite = false;
      const leaderClass = (this._party && this._party[0] && this._party[0].class) || 'paladin';
      if (TR.spriteResolver) {
        const sprite = TR.spriteResolver.resolve(leaderClass, 'party');
        if (sprite) {
          const ctx = this._renderer.bufCtx;
          ctx.imageSmoothingEnabled = false;
          if (sprite.tint)
            this._renderer.compositor.drawComposite(ctx,
              [{ img: sprite.img, rect: { x: sprite.srcX, y: sprite.srcY, w: sprite.srcW, h: sprite.srcH }, tint: sprite.tint }],
              ts - 4, px - camX + 2, py - camY + 2);
          else
            ctx.drawImage(sprite.img, sprite.srcX, sprite.srcY, sprite.srcW, sprite.srcH,
              px - camX + 2, py - camY + 2, ts - 4, ts - 4);
          drawnSprite = true;
        }
      }
      if (!drawnSprite) {
        const assets = this._renderer.assets;
        const playerSprite = (TR.resolveSprite && TR.resolveSprite(leaderClass, 'party')) || TR.PLAYER_SPRITE;
        const playerSheet = (playerSprite && playerSprite.sheet) || 'dungeon';
        if (assets && assets.ready && assets.has(playerSheet) && playerSprite)
          drawnSprite = assets.drawSprite(this._renderer.bufCtx, playerSheet, playerSprite, px - camX + 2, py - camY + 2, ts - 4);
      }
      if (!drawnSprite)
        this._renderer.drawRect(px + 4, py + 4, ts - 8, ts - 8, '#ff4444');

      if (this._walkPath && this._walkPath.length > 0)
        for (const step of this._walkPath)
          this._renderer.highlightTile(step.col, step.row, 'rgba(255,255,100,0.2)');

      this._refreshHover();
      if (this._hoverTile && this._overworldMap) {
        const passable = this._overworldMap.isPassable(this._hoverTile.col, this._hoverTile.row);
        const color = passable ? 'rgba(255,255,0,0.3)' : 'rgba(255,100,100,0.15)';
        this._renderer.highlightTile(this._hoverTile.col, this._hoverTile.row, color);
      }

      this._renderOverworldPartyStatus();
      this._drawPlaneBanner();
      if (this._renderer.bufCtx) {
        this._drawToasts(this._renderer.bufCtx);
        if (this._crawlPrompt)
          this._drawCrawlPrompt(this._renderer.bufCtx);
        this._drawPlaneShift(this._renderer.bufCtx);
      }

      if (this._encounterTimer > 0 && this._encounterMsg) {
        this._renderer.drawScreenText(CANVAS_W / 2, CANVAS_H / 2, this._encounterMsg, { color: '#f44', font: 'bold 28px serif', align: 'center' });
      }

      this._renderer.drawScreenText(10, CANVAS_H - 8, 'Arrow keys / WASD to move, Click to walk', { color: 'rgba(200,200,200,0.5)', font: '12px monospace' });
    },

    // Where the party is when it is not at home: the plane's name.
    _drawPlaneBanner() {
      const ctx = this._renderer.bufCtx;
      const P = TR.PlaneWorlds && this._dimension !== 'material' ? TR.PlaneWorlds.get(this._dimension) : null;
      if (!ctx || !P || !TR.ScreenArt)
        return;
      ctx.save();
      ctx.font = "bold 16px Georgia, 'Times New Roman', serif";
      const w = Math.max(220, Math.ceil(ctx.measureText(P.name).width) + 32);
      ctx.restore();
      TR.ScreenArt.frame(ctx, 8, 8, w, 46, { alpha: 0.85 });
      this._renderer.drawScreenText(24, 30, P.name, { color: '#f0d890', font: "bold 16px Georgia, 'Times New Roman', serif" });
      const kind = { transitive: 'Transitive Plane', inner: 'Inner Plane', outer: 'Outer Plane' }[P.category] || 'Plane';
      this._renderer.drawScreenText(24, 46, kind, { color: '#b8c0d8', font: '11px monospace' });
      // the plane's traits, one line each
      const traits = TR.PlaneWorlds.traits(this._dimension);
      if (!traits.length)
        return;
      const lineH = 30;
      ctx.save();
      ctx.font = '11px monospace';
      const tw = Math.max(w, ...traits.map(t => Math.ceil(ctx.measureText(t.text).width) + 28));
      ctx.restore();
      TR.ScreenArt.frame(ctx, 8, 58, tw, 12 + traits.length * lineH, { alpha: 0.8 });
      traits.forEach((t, i) => {
        const y = 58 + 8 + i * lineH;
        this._renderer.drawScreenText(20, y + 12, t.name, { color: TRAIT_COLORS[t.id] || '#e8dcc0', font: "bold 12px Georgia, 'Times New Roman', serif" });
        this._renderer.drawScreenText(20, y + 25, t.text, { color: '#b8c0d8', font: '11px monospace' });
      });
    },

    _renderOverworldPartyStatus() {
      if (!this._party || !this._partyHp)
        return;
      const x = CANVAS_W - 200;
      const y = 8;
      const w = 192;
      const lineH = 22;
      const h = 40 + this._party.length * lineH;

      if (TR.ScreenArt && this._renderer.bufCtx)
        TR.ScreenArt.frame(this._renderer.bufCtx, x, y, w, h, { alpha: 0.85 });
      else
        this._renderer.drawPanel(x, y, w, h, { bg: 'rgba(0,0,0,0.75)' });
      this._renderer.drawScreenText(x + w / 2, y + 16, `Party  Gold: ${this._gold}`, { color: '#c8a84e', font: 'bold 12px monospace', align: 'center' });

      for (let i = 0; i < this._party.length; ++i) {
        const c = this._party[i];
        const hp = this._partyHp[i];
        const sy = y + 24 + i * lineH;
        const hpColor = hp >= c.maxHp ? '#4a4' : hp > c.maxHp * 0.25 ? '#aa4' : '#a44';
        this._renderer.drawScreenText(x + 6, sy + 14, `${c.name.substring(0, 8)} L${c.level}`, { color: '#ccc', font: '11px monospace' });
        this._renderer.drawScreenText(x + w - 6, sy + 14, `${hp}/${c.maxHp}`, { color: hpColor, font: '11px monospace', align: 'right' });
      }
    },

    // Name plate above a map location, coloured by its kind.
    _drawLocationPlate(ctx, x, y, loc) {
      const name = loc.name || '';
      if (!ctx || !name)
        return;
      const accent = loc.tile === OverworldTile.DUNGEON ? '#e0604a' : loc.tile === OverworldTile.TOWN ? '#e8c85a' : loc.tile === OverworldTile.PORTAL ? '#b88aff' : '#6ad0e0';
      ctx.save();
      ctx.font = "bold 12px Georgia, 'Times New Roman', serif";
      const w = Math.ceil(ctx.measureText(name).width) + 16;
      const h = 18;
      const bx = Math.round(x - w / 2), by = Math.round(y - h);
      ctx.fillStyle = 'rgba(14,16,34,0.82)';
      ctx.fillRect(bx, by, w, h);
      ctx.fillStyle = accent;
      ctx.fillRect(bx, by, w, 2);
      ctx.fillRect(bx, by + h - 1, w, 1);
      ctx.fillStyle = 'rgba(14,16,34,0.82)';
      ctx.beginPath();
      ctx.moveTo(x - 5, by + h); ctx.lineTo(x + 5, by + h); ctx.lineTo(x, by + h + 5); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f0ead8';
      ctx.textAlign = 'center';
      ctx.fillText(name, x, by + 13);
      ctx.restore();
    },

    _drawCampGlow(ctx, x, y) {
      const t = this._screenTime;
      const r = 46 * (0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.7));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(255,170,70,0.45)');
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
    },

    _renderCamp() {
      const SA = TR.ScreenArt;
      const ctx = this._renderer.bufCtx;
      if (!SA || !ctx) {
        this._renderer.drawPanel(0, 0, CANVAS_W, CANVAS_H, { bg: '#1a1a1a' });
        return;
      }
      const t = this._screenTime;
      // night in the woods, the party gathered around the fire
      SA.stage(ctx, 'forest', this._dimension, t, { night: true });
      const fireX = 520, footY = 640;
      SA.campfire(ctx, fireX, footY - 4, t);
      if (this._party)
        SA.partyLine(ctx, this._party, { x: fireX, footY, gap: 130, spacing: 150, height: 180, time: t });
      SA.vignette(ctx, 0.55);
      SA.banner(ctx, 'Camp', 24, { sub: 'Rest and manage your party' });
      SA.rosterPanel(ctx, this._party, this._partyHp, 24, 24);
      SA.menu(ctx, CAMP_BUTTONS, { title: 'Actions' });
    },

    _renderTown() {
      const SA = TR.ScreenArt;
      const ctx = this._renderer.bufCtx;
      if (!SA || !ctx) {
        this._renderer.drawPanel(0, 0, CANVAS_W, CANVAS_H, { bg: '#1e1a14' });
        return;
      }
      const t = this._screenTime;
      SA.stage(ctx, 'town', this._dimension, t, { dim: this._shopStock ? 0.55 : 0 });
      if (this._shopStock) {
        this._renderShop();
        return;
      }
      if (this._party)
        SA.partyLine(ctx, this._party, { x: 560, footY: 660, spacing: 130, height: 180, time: t, facing: 1 });
      SA.vignette(ctx, 0.35);
      SA.banner(ctx, 'Town', 24, { sub: `Gold: ${this._gold}   |   Inventory: ${this._inventory.length} items` });
      SA.rosterPanel(ctx, this._party, this._partyHp, 24, 24);
      SA.menu(ctx, TOWN_BUTTONS, { title: 'Visit' });
    },

    _renderShop() {
      const SA = TR.ScreenArt;
      const ctx = this._renderer.bufCtx;
      const cfg = Shop && ShopType ? TR.SHOP_CONFIGS[this._shopType] : null;
      const title = cfg ? cfg.name : 'Shop';
      SA.banner(ctx, title, 12, { size: 30, sub: `Gold: ${this._gold}` });

      const stock = this._shopStock || [];
      const assets = this._renderer.assets;
      const tierColors = TR.TIER_COLORS || {};
      const row = (x, y, w, item, right, rightColor, enabled) => {
        ctx.fillStyle = enabled ? 'rgba(40,48,90,0.85)' : 'rgba(30,30,40,0.7)';
        ctx.fillRect(x, y, w, 30);
        ctx.strokeStyle = tierColors[item.tier] || 'rgba(200,162,78,0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 29);
        SA.itemIcon(ctx, assets, item, x + 4, y + 3, 24);
        ctx.globalAlpha = enabled ? 1 : 0.5;
        this._renderer.drawScreenText(x + 36, y + 20, `${item.name}${item.quantity > 1 ? ' x' + item.quantity : ''}`, { color: '#e8e0c8', font: '13px monospace', align: 'left' });
        this._renderer.drawScreenText(x + w - 10, y + 20, right, { color: rightColor, font: 'bold 13px monospace', align: 'right' });
        ctx.globalAlpha = 1;
      };

      SA.frame(ctx, 24, 84, 352, Math.max(80, 44 + stock.length * 36));
      this._renderer.drawScreenText(200, 106, 'For Sale', { color: '#a8e0a0', font: "bold 18px Georgia, 'Times New Roman', serif", align: 'center' });
      for (let i = 0; i < stock.length; ++i) {
        const price = Shop ? Shop.buyPrice(stock[i]) : stock[i].value;
        row(40, 110 + i * 36, 320, stock[i], `${price}g`, '#ffd24a', this._gold >= price);
      }

      const inv = this._inventory.slice(0, 14);
      SA.frame(ctx, 584, 84, 412, Math.max(80, 44 + inv.length * 36));
      this._renderer.drawScreenText(790, 106, 'Your Pack', { color: '#a8c8ff', font: "bold 18px Georgia, 'Times New Roman', serif", align: 'center' });
      for (let i = 0; i < inv.length; ++i) {
        const sell = Shop ? Shop.sellPrice(inv[i]) : Math.floor(inv[i].value * 0.5);
        row(600, 110 + i * 36, 380, inv[i], `Sell ${sell}g`, '#e8b070', true);
      }

      this._renderer.drawButton(CANVAS_W / 2 - 80, CANVAS_H - 60, 160, 40, 'Back', { bg: '#444', font: '15px monospace' });
    },

  });
})();
