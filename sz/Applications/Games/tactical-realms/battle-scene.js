;(function() {
  'use strict';
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  // Shining Force style battle cut-in. The controller hands one resolved
  // action (attack or spell) to a BattleScene; the scene plays it as a
  // side-view close-up and reports `done` when control can return to the
  // grid. Fighter placement and poses are pure functions of the timeline;
  // one-shot events (impact, numbers, shake, death) fire as time passes them.
  //
  // Staging: the party always stands on the right, their foes on the left.

  const W = 1280;
  const H = 720;
  const HOME_LEFT = 380;
  const HOME_RIGHT = 900;
  const FIGHTER_H = 288;
  const SHUTTER = 0.2;

  const clamp01 = v => v < 0 ? 0 : (v > 1 ? 1 : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeOutBack = t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
  const span = (t, a, b) => clamp01((t - a) / (b - a));

  // Beat sheets in seconds (full mode). Short mode scales them.
  const BEATS = Object.freeze({
    melee:  { windup: [0.40, 0.72], dash: [0.72, 0.98], strike: [0.98, 1.26], impact: 1.06, recoil: [1.26, 1.56], back: [1.56, 1.92], end: 2.35 },
    ranged: { draw: [0.40, 1.00], fly: [1.00, 1.28], impact: 1.28, end: 2.25 },
    spell:  { cast: [0.40, 1.30], release: 1.18, fly: [1.18, 1.52], impact: 1.52, end: 2.45 },
    special: { cast: [0.40, 1.20], release: 1.05, fly: [1.05, 1.45], impact: 1.45, end: 2.50 },
    heal:   { cast: [0.40, 1.20], light: [1.00, 2.05], impact: 1.40, end: 2.40 },
    buff:   { cast: [0.40, 1.20], light: [1.00, 1.90], impact: 1.35, end: 2.20 },
  });
  const KILL_EXTRA = 0.65;

  function titleCase(id) {
    return String(id || '').split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  class BattleScene {
    #kind;
    #element;
    #mode;
    #speed;
    #time;
    #freeze;
    #end;
    #events;
    #fired;
    #left;
    #right;
    #atk;
    #def;
    #solo;
    #result;
    #title;
    #subtitle;
    #biome;
    #plane;
    #particles;
    #shake;
    #flash;
    #numbers;
    #banner;
    #killed;
    #amount;
    #crit;
    #hit;
    #count;
    #special;
    #effect;

    constructor({ attacker, defender, result = {}, type = 'player_attack', biome = 'plains', plane = 'material', mode = 'full' } = {}) {
      this.#mode = mode === 'short' ? 'short' : 'full';
      this.#speed = this.#mode === 'short' ? 1.75 : 1;
      this.#time = 0;
      this.#freeze = 0;
      this.#fired = new Set();
      this.#numbers = [];
      this.#banner = null;
      this.#flash = 0;
      this.#biome = biome;
      this.#plane = plane;
      this.#result = result;
      const GE = SZ.GameEffects;
      this.#particles = GE ? new GE.ParticleSystem() : null;
      this.#shake = GE ? new GE.ScreenShake() : null;

      defender = defender || attacker;
      const shown = result.targets && defender ? result.targets.find(t => t.unitId === defender.id) : null;
      const damage = shown ? (shown.damage || 0) : (result.damage || 0);
      const heal = shown ? (shown.heal || 0) : (result.heal || 0);
      this.#count = result.targets ? result.targets.length : 1;

      const isSpell = type === 'spell_cast';
      // breath, gazes, rays, webs and rocks: monster specials
      this.#special = result.special || null;
      const fx = (result.effects || []).find(e => defender && e.unitId === defender.id);
      this.#effect = fx || null;
      if (this.#special)
        this.#kind = 'special';
      else if (isSpell)
        this.#kind = damage > 0 ? 'spell' : (heal > 0 ? 'heal' : 'buff');
      else
        this.#kind = this.#isRanged(attacker, defender) ? 'ranged' : 'melee';
      this.#hit = isSpell ? true : !!result.hit;
      this.#crit = !isSpell && !!result.critical;
      this.#amount = this.#kind === 'heal' ? heal : damage;
      this.#killed = this.#hit && damage > 0 && defender && defender.isAlive === false;

      const spell = result.spell || null;
      this.#element = this.#special ? (this.#special.element || 'arcane') : isSpell && TR.BattleFx ? TR.BattleFx.elementOf(spell, { heal: this.#kind === 'heal' }) : 'arcane';
      this.#title = isSpell ? (result.spellName || (spell && spell.name) || 'Spell') : (this.#kind === 'ranged' ? 'Ranged Attack' : 'Attack');
      this.#subtitle = !isSpell && result.d20 ? this.#rollText(result, defender) : '';

      // staging
      this.#solo = attacker === defender;
      const mk = (unit, side) => {
        const maxHp = unit.maxHp || 1;
        return { unit, side, facing: side === 'left' ? 1 : -1, home: this.#solo ? W / 2 : (side === 'left' ? HOME_LEFT : HOME_RIGHT), hpFrom: unit.currentHp, hpTo: unit.currentHp, hpT0: 0, maxHp };
      };
      if (this.#solo) {
        this.#atk = this.#def = mk(attacker, attacker.faction === 'party' ? 'right' : 'left');
        this.#left = this.#atk.side === 'left' ? this.#atk : null;
        this.#right = this.#atk.side === 'right' ? this.#atk : null;
      } else {
        const atkSide = attacker.faction === 'party' ? 'right' : 'left';
        this.#atk = mk(attacker, atkSide);
        this.#def = mk(defender, atkSide === 'right' ? 'left' : 'right');
        this.#left = atkSide === 'left' ? this.#atk : this.#def;
        this.#right = atkSide === 'right' ? this.#atk : this.#def;
      }
      if (this.#hit && damage > 0)
        this.#def.hpFrom = Math.min(this.#def.maxHp, defender.currentHp + damage);
      if (heal > 0)
        this.#def.hpFrom = Math.max(0, defender.currentHp - heal);
      this.#def.hpTo = defender.currentHp;

      const b = BEATS[this.#kind];
      this.#end = b.end + (this.#killed ? KILL_EXTRA : 0);
      this.#events = [
        { t: b.impact, fn: () => this.#onImpact() },
      ];
      if (this.#kind === 'melee')
        this.#events.push({ t: b.dash[0], fn: () => this.#dust(this.#atk) });
      if (this.#kind === 'spell' || this.#kind === 'heal' || this.#kind === 'buff')
        this.#events.push({ t: b.cast[0], fn: () => this.#chargeStart() });
      if (this.#killed)
        this.#events.push({ t: b.impact + 0.5, fn: () => this.#onKill() });
    }

    // --- public API ---

    get done() { return this.#time >= this.#end; }
    get time() { return this.#time; }
    get duration() { return this.#end / this.#speed; }
    get kind() { return this.#kind; }
    get element() { return this.#element; }
    get killed() { return this.#killed; }
    get mode() { return this.#mode; }

    update(dt) {
      if (this.#particles)
        this.#particles.update();
      if (this.#shake)
        this.#shake.update(dt * 1000);
      this.#flash = Math.max(0, this.#flash - dt * 3.2);
      for (let i = this.#numbers.length - 1; i >= 0; --i) {
        this.#numbers[i].t += dt;
        if (this.#numbers[i].t > 1.6)
          this.#numbers.splice(i, 1);
      }
      if (this.#banner)
        this.#banner.t += dt;
      if (this.#freeze > 0) {
        this.#freeze = Math.max(0, this.#freeze - dt);
        return;
      }
      if (this.#kind === 'spell' || this.#kind === 'heal' || this.#kind === 'buff')
        this.#chargeTick();
      this.#time = Math.min(this.#end, this.#time + dt * this.#speed);
      this.#fireEvents();
    }

    // Jump to the final state; every pending event still applies.
    skip() {
      this.#freeze = 0;
      this.#time = this.#end;
      this.#fireEvents();
    }

    // --- timeline -----------------------------------------------------------

    #fireEvents() {
      for (let i = 0; i < this.#events.length; ++i)
        if (!this.#fired.has(i) && this.#time >= this.#events[i].t) {
          this.#fired.add(i);
          this.#events[i].fn();
        }
    }

    #isRanged(a, d) {
      const weapon = TR.BattleSprites ? TR.BattleSprites.weaponOf(a) : null;
      if (weapon === 'bow')
        return true;
      if (!a.position || !d.position)
        return false;
      return Math.abs(a.position.col - d.position.col) + Math.abs(a.position.row - d.position.row) > 1;
    }

    #rollText(r, defender) {
      const bonus = (r.total || 0) - (r.d20 || 0);
      const sign = bonus >= 0 ? '+' : '-';
      const ac = defender && defender.ac != null ? `  vs AC ${defender.ac}` : '';
      return `d20 ${r.d20} ${sign} ${Math.abs(bonus)} = ${r.total}${ac}`;
    }

    #footY() {
      return TR.BattleBackdrop ? TR.BattleBackdrop.groundY(H) + 142 : 590;
    }

    #headY(f) {
      return this.#footY() - FIGHTER_H * (this.#bodyScale(f) || 1) - 10;
    }

    #bodyScale(f) {
      const look = TR.BattleSprites ? TR.BattleSprites.lookFor(f.unit) : null;
      return look ? (look.scale || 1) : 1;
    }

    // Pose, position and effects of one fighter at the current time.
    #stateOf(f) {
      const t = this.#time;
      const b = BEATS[this.#kind];
      const st = { x: f.home, y: 0, pose: 'idle', p: (t * 0.8) % 1, flash: 0, alpha: 1, rot: 0, squash: 0 };
      const isAtk = f === this.#atk;
      const isDef = f === this.#def;

      if (isAtk && !this.#solo) {
        const target = this.#def.home;
        const reach = target - f.facing * 190;
        if (this.#kind === 'melee') {
          if (t >= b.windup[0] && t < b.windup[1]) {
            st.pose = 'windup'; st.p = easeOut(span(t, ...b.windup)); st.squash = -0.06 * st.p; st.rot = -0.08 * st.p;
          } else if (t >= b.dash[0] && t < b.dash[1]) {
            const p = easeInOut(span(t, ...b.dash));
            st.pose = 'dash'; st.p = p; st.x = lerp(f.home, reach, p); st.rot = 0.12; st.y = -Math.sin(p * Math.PI) * 26;
          } else if (t >= b.strike[0] && t < b.strike[1]) {
            st.pose = 'strike'; st.p = easeOut(span(t, ...b.strike)); st.x = reach + f.facing * 14 * st.p; st.squash = 0.1 * (1 - st.p); st.rot = 0.18;
          } else if (t >= b.recoil[0] && t < b.recoil[1]) {
            st.pose = 'recoil'; st.p = span(t, ...b.recoil); st.x = reach + f.facing * 14 * (1 - st.p);
          } else if (t >= b.back[0] && t < b.back[1]) {
            const p = easeInOut(span(t, ...b.back));
            st.pose = 'ready'; st.x = lerp(reach, f.home, p); st.y = -Math.sin(p * Math.PI) * 18;
          } else if (t >= b.windup[1] && t < b.back[1]) {
            st.x = reach;
          }
        } else if (this.#kind === 'ranged') {
          if (t >= b.draw[0] && t < b.fly[0] + 0.2) {
            st.pose = 'shoot'; st.p = span(t, b.draw[0], b.draw[1]);
            st.squash = -0.05 * st.p;
          }
        } else if (t >= b.cast[0] && t < b.cast[1] + 0.15) {
          st.pose = 'cast'; st.p = easeOut(span(t, ...b.cast));
          st.y = -Math.sin(span(t, ...b.cast) * Math.PI) * 10;
        }
      } else if (isAtk && this.#solo && t >= b.cast[0] && t < b.cast[1] + 0.15) {
        st.pose = 'cast'; st.p = easeOut(span(t, ...b.cast));
      }

      if (isDef && !(this.#solo && t < b.impact)) {
        const since = t - b.impact;
        if (since >= 0 && this.#hit && this.#kind !== 'heal' && this.#kind !== 'buff') {
          if (since < 0.5) {
            st.pose = 'hit'; st.p = since / 0.5;
            st.x = f.home - f.facing * 34 * Math.sin(clamp01(since / 0.5) * Math.PI) * (this.#crit ? 1.6 : 1);
            st.flash = Math.max(0, 1 - since / 0.22);
            st.rot = -0.12 * Math.sin(clamp01(since / 0.5) * Math.PI);
          }
          if (this.#killed && since >= 0.5) {
            const k = clamp01((since - 0.5) / 0.55);
            st.pose = 'down'; st.p = k;
            st.rot = -1.35 * easeOut(k);
            st.y = 6 * k;
            st.x = f.home - f.facing * 20;
            st.alpha = 1 - clamp01((since - 0.75) / 0.45);
            st.flash = Math.abs(Math.sin(since * 30)) * (1 - k) * 0.8;
          }
        } else if (since >= -0.12 && !this.#hit && since < 0.5) {
          const p = clamp01((since + 0.12) / 0.55);
          st.pose = 'dodge'; st.p = p;
          st.x = f.home - f.facing * 70 * Math.sin(p * Math.PI);
          st.y = -Math.sin(p * Math.PI) * 30;
        } else if (since >= 0 && (this.#kind === 'heal' || this.#kind === 'buff') && since < 0.6) {
          st.flash = 0.35 * Math.sin(clamp01(since / 0.6) * Math.PI);
        }
      }
      return st;
    }

    // --- events ---------------------------------------------------------------

    #onImpact() {
      const d = this.#def;
      const x = d.home, y = this.#footY() - FIGHTER_H * 0.45;
      const P = this.#particles;
      d.hpT0 = this.#time;
      if (this.#kind === 'heal') {
        this.#number(`+${this.#amount}`, '#8affb0', d);
        if (P)
          P.sparkle(x, y, 26, { color: '#ffffff', speed: 4 });
        return;
      }
      if (this.#kind === 'buff') {
        if (P)
          P.sparkle(x, y, 22, { color: '#fff2b0', speed: 3.5 });
        this.#setBanner(this.#title, '#fff2b0');
        return;
      }
      if (this.#kind === 'special' && !this.#amount) {
        const text = this.#effect ? this.#effect.text : 'Resisted';
        this.#number(text.toUpperCase(), this.#effect && this.#effect.color || '#f0e080', d, 0.62);
        if (P)
          P.sparkle(x, y, 20, { color: TR.BattleFx ? TR.BattleFx.palette(this.#element).core : '#fff', speed: 3.5 });
        if (this.#shake)
          this.#shake.trigger(5, 220);
        return;
      }
      if (!this.#hit) {
        this.#number('MISS', '#d8dce8', d, 0.8);
        if (P)
          P.burst(x, this.#footY() - 10, 12, { speed: 3, color: 'rgba(230,220,200,0.8)', decay: 0.03, size: 3 });
        return;
      }
      const magical = this.#kind === 'spell' || this.#kind === 'special';
      const pal = TR.BattleFx ? TR.BattleFx.palette(magical ? this.#element : 'lightning') : null;
      const sparks = magical && pal ? pal.particle : ['#ffffff', '#fff27a', '#ff9a4a'];
      if (P)
        for (const c of sparks)
          P.burst(x, y, this.#crit ? 22 : 12, { speed: this.#crit ? 11 : 7, color: c, decay: 0.022, size: 3 + Math.random() * 4, friction: 0.94 });
      if (this.#shake)
        this.#shake.trigger(this.#crit ? 16 : 7, this.#crit ? 520 : 260);
      this.#flash = this.#crit ? 1 : 0.35;
      if (this.#crit) {
        this.#freeze = 0.18;
        this.#setBanner('CRITICAL!', '#ffd23a');
      }
      this.#number(String(this.#amount), this.#crit ? '#ffd23a' : '#ffffff', d, this.#crit ? 1.35 : 1);
      // riders (poisoned, paralysed, ...) follow the damage
      if (this.#effect)
        this.#setBanner(this.#effect.text, this.#effect.color || '#f0e080', true);
    }

    #onKill() {
      const d = this.#def;
      if (this.#particles)
        for (let i = 0; i < 40; ++i)
          this.#particles.trail(d.home + (Math.random() - 0.5) * 120, this.#footY() - Math.random() * FIGHTER_H, {
            vy: -1.5 - Math.random() * 2.5, vx: (Math.random() - 0.5) * 1.2,
            color: i % 3 ? '#e8e0f0' : '#8a7aa8', life: 1, decay: 0.012, size: 3 + Math.random() * 3, shape: 'square',
          });
      if (this.#shake)
        this.#shake.trigger(6, 300);
      this.#setBanner(`${d.unit.name} is defeated!`, '#ff8a7a', true);
    }

    #dust(f) {
      if (!this.#particles)
        return;
      for (let i = 0; i < 14; ++i)
        this.#particles.trail(f.home + (Math.random() - 0.5) * 40, this.#footY() - 4, {
          vx: -f.facing * (1 + Math.random() * 3), vy: -Math.random() * 1.5,
          color: 'rgba(210,200,180,0.7)', life: 0.8, decay: 0.03, size: 5 + Math.random() * 5, shrink: 0.97,
        });
    }

    #chargeStart() {
      this.#charging = true;
    }

    #charging = false;

    #chargeTick() {
      const b = BEATS[this.#kind];
      if (!this.#charging || !this.#particles || this.#time > b.cast[1])
        return;
      const f = this.#atk;
      const hx = f.home + f.facing * 40, hy = this.#footY() - FIGHTER_H * 0.58;
      const pal = TR.BattleFx ? TR.BattleFx.palette(this.#element) : { particle: ['#fff'] };
      for (let i = 0; i < 2; ++i) {
        const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 60;
        this.#particles.trail(hx + Math.cos(a) * r, hy + Math.sin(a) * r, {
          vx: -Math.cos(a) * r / 22, vy: -Math.sin(a) * r / 22,
          color: pal.particle[i % pal.particle.length], life: 0.7, decay: 0.035, size: 3, shape: 'star',
        });
      }
    }

    #number(text, color, f, scale = 1) {
      this.#numbers.push({ text, color, x: f.home, y: this.#headY(f), t: 0, scale });
    }

    #setBanner(text, color, low = false) {
      this.#banner = { text, color, t: 0, low };
    }

    // --- drawing ----------------------------------------------------------------

    draw(ctx, w = W, h = H) {
      if (!ctx)
        return;
      const t = this.#time;
      const b = BEATS[this.#kind];
      ctx.save();
      ctx.scale(w / W, h / H);
      // the grid stays visible while the shutters first close and last open
      if (t < SHUTTER || t >= this.#end - SHUTTER) {
        this.#drawShutters(ctx);
        ctx.restore();
        return;
      }

      // camera: gentle push toward the action, a punch-in on impact
      const since = t - b.impact;
      const punch = since >= 0 && since < 0.35 && this.#hit ? Math.sin((since / 0.35) * Math.PI) * (this.#crit ? 0.07 : 0.03) : 0;
      const zoom = 1 + 0.04 * easeInOut(clamp01(t / b.impact)) + punch;
      const focusX = this.#solo ? W / 2 : lerp(W / 2, this.#def.home, 0.25 * clamp01(t / b.impact));
      const camX = (focusX - W / 2) * 0.6;

      ctx.save();
      if (this.#shake)
        this.#shake.apply(ctx);
      ctx.translate(W / 2, H * 0.62);
      ctx.scale(zoom, zoom);
      ctx.translate(-W / 2 - camX * 0.4, -H * 0.62);

      if (TR.BattleBackdrop) {
        TR.BattleBackdrop.draw(ctx, this.#biome, this.#plane, camX, t, W, H);
        const L = TR.BattleBackdrop.layers(this.#biome, this.#plane);
        if (L)
          TR.BattleBackdrop.drawAmbient(ctx, L.ambient, t, W, H);
      } else {
        ctx.fillStyle = '#12121c';
        ctx.fillRect(0, 0, W, H);
      }

      this.#drawGroundFx(ctx);
      const order = [this.#left, this.#right].filter(Boolean);
      // attacker in front while it is in the defender's space
      order.sort((a, c) => (a === this.#atk ? 1 : 0) - (c === this.#atk ? 1 : 0));
      for (const f of order)
        this.#drawFighter(ctx, f);
      this.#drawActionFx(ctx);
      if (this.#particles)
        this.#particles.draw(ctx);
      this.#drawNumbers(ctx);
      ctx.restore();

      if (this.#flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${(this.#flash * (this.#crit ? 0.75 : 0.25)).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }
      this.#drawVignette(ctx);
      this.#drawHud(ctx);
      this.#drawBanner(ctx);
      this.#drawShutters(ctx);
      ctx.restore();
    }

    #drawFighter(ctx, f) {
      const st = this.#stateOf(f);
      if (st.alpha <= 0.01)
        return;
      const footY = this.#footY() + st.y;
      // shadow shrinks while airborne
      const air = clamp01(-st.y / 60);
      ctx.save();
      ctx.globalAlpha = 0.35 * st.alpha * (1 - air * 0.6);
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(st.x, this.#footY() + 4, 70 * (1 - air * 0.4), 14 * (1 - air * 0.4), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      const stone = f === this.#def && this.#effect && /petrif/i.test(this.#effect.text) && this.#time >= BEATS[this.#kind].impact;
      if (TR.BattleSprites)
        TR.BattleSprites.draw(ctx, f.unit, stone ? 'idle' : st.pose, stone ? 0 : st.p, st.x, footY, FIGHTER_H, f.facing, {
          flash: stone ? 0 : st.flash, alpha: st.alpha, rotate: stone ? 0 : st.rot, squash: st.squash, stone,
        });
    }

    #drawGroundFx(ctx) {
      if (!TR.BattleFx || (this.#kind !== 'spell' && this.#kind !== 'heal' && this.#kind !== 'buff'))
        return;
      const b = BEATS[this.#kind];
      const t = this.#time;
      const a = Math.sin(span(t, b.cast[0], b.cast[1] + 0.3) * Math.PI);
      TR.BattleFx.magicCircle(ctx, this.#atk.home, this.#footY() + 4, 120, t, this.#element, a * 0.9);
      if (this.#kind !== 'spell' && !this.#solo) {
        const a2 = Math.sin(span(t, b.impact - 0.3, b.end - 0.2) * Math.PI);
        TR.BattleFx.magicCircle(ctx, this.#def.home, this.#footY() + 4, 110, -t, this.#element, a2 * 0.8);
      }
    }

    #drawActionFx(ctx) {
      const FX = TR.BattleFx;
      if (!FX)
        return;
      const t = this.#time;
      const b = BEATS[this.#kind];
      const a = this.#atk, d = this.#def;
      const bodyY = this.#footY() - FIGHTER_H * 0.45;
      if (this.#kind === 'melee') {
        FX.speedLines(ctx, W, H, span(t, b.dash[0], b.dash[1] + 0.05), a.facing);
        if (this.#hit)
          FX.slash(ctx, d.home - a.facing * 20, bodyY, 120, span(t, b.strike[0], b.strike[1] + 0.12), a.facing, this.#crit ? '#ffd23a' : '#9ad8ff');
        else
          FX.slash(ctx, d.home - a.facing * 60, bodyY, 110, span(t, b.strike[0], b.strike[1] + 0.12), a.facing, 'rgba(200,210,230,0.6)');
        if (this.#hit)
          FX.impactStar(ctx, d.home, bodyY, this.#crit ? 130 : 80, span(t, b.impact, b.impact + 0.3), this.#crit ? '#ffd23a' : '#fff27a');
      } else if (this.#kind === 'ranged') {
        const p = span(t, ...b.fly);
        if (p > 0 && p < 1) {
          // a miss flies on past the dodging target
          const sx = a.home + a.facing * 70, ex = this.#hit ? d.home : d.home + a.facing * 260;
          const x = lerp(sx, ex, p);
          const y = bodyY - 30 - Math.sin(p * Math.PI) * 60;
          FX.arrow(ctx, x, y, Math.atan2(-Math.cos(p * Math.PI) * Math.PI * 60, ex - sx));
        }
        if (this.#hit)
          FX.impactStar(ctx, d.home, bodyY, this.#crit ? 120 : 70, span(t, b.impact, b.impact + 0.3), '#fff27a');
      } else if (this.#kind === 'spell') {
        const el = this.#element;
        if (FX.isProjectile(el)) {
          const p = span(t, ...b.fly);
          if (p > 0 && p < 1) {
            const sx = a.home + a.facing * 70, sy = this.#footY() - FIGHTER_H * 0.58;
            const x = lerp(sx, d.home, easeInOut(p)), y = lerp(sy, bodyY, p) - Math.sin(p * Math.PI) * 40;
            FX.projectile(ctx, el, x, y, a.facing > 0 ? 0 : Math.PI, t, 1.3);
          }
          FX.burst(ctx, el, d.home, bodyY, span(t, b.impact, b.impact + 0.55), 1.2);
        } else {
          FX.strikeFromAbove(ctx, el, d.home, this.#footY(), span(t, b.release, b.impact + 0.35), t);
          FX.burst(ctx, el, d.home, bodyY, span(t, b.impact, b.impact + 0.5), 1);
        }
      } else if (this.#kind === 'special') {
        this.#drawSpecialFx(ctx, FX, t, b, a, d, bodyY);
      } else {
        FX.healLight(ctx, d.home, this.#footY(), span(t, ...b.light), t);
      }
    }

    #drawSpecialFx(ctx, FX, t, b, a, d, bodyY) {
      const sp = this.#special;
      const el = this.#element;
      const mouthX = a.home + a.facing * 60, mouthY = this.#footY() - FIGHTER_H * 0.62;
      const p = span(t, b.release, b.impact + 0.4);
      switch (sp.kind) {
        case 'breath':
          FX.breath(ctx, el, mouthX, mouthY, d.home, bodyY, p, sp.shape || 'cone', t);
          break;
        case 'mindblast':
          for (let i = 0; i < 4; ++i)
            FX.burst(ctx, 'psychic', lerp(mouthX, d.home, clamp01(p * 1.4 - i * 0.12)), lerp(mouthY, bodyY, clamp01(p * 1.4 - i * 0.12)), clamp01(p * 1.3 - i * 0.1), 0.5);
          break;
        case 'gaze':
          FX.beam(ctx, el, mouthX, mouthY - 10, d.home, bodyY - 40, p, 6);
          break;
        case 'rays':
          ['fire', 'frost', 'necrotic'].forEach((ray, i) =>
            FX.beam(ctx, ray, mouthX, mouthY - 20 + i * 14, d.home + (i - 1) * 24, bodyY - 30 + i * 18, clamp01(p * 1.2 - i * 0.12), 5));
          break;
        case 'rock': {
          const q = span(t, ...b.fly);
          if (q > 0 && q < 1)
            FX.rock(ctx, lerp(mouthX, d.home, q), lerp(mouthY, bodyY, q) - Math.sin(q * Math.PI) * 120, 40, t * 8);
          break;
        }
        default: {
          // web, spit: a glob in flight
          const q = span(t, ...b.fly);
          if (q > 0 && q < 1)
            FX.projectile(ctx, el, lerp(mouthX, d.home, easeInOut(q)), lerp(mouthY, bodyY, q) - Math.sin(q * Math.PI) * 50, a.facing > 0 ? 0 : Math.PI, t, 0.9);
          break;
        }
      }
      FX.burst(ctx, el, d.home, bodyY, span(t, b.impact, b.impact + 0.5), 1);
    }

    #drawNumbers(ctx) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      for (const n of this.#numbers) {
        const pop = n.t < 0.22 ? easeOutBack(n.t / 0.22) : 1;
        const bounce = n.t < 0.5 ? Math.abs(Math.sin(n.t * 12)) * 18 * (1 - n.t / 0.5) : 0;
        const alpha = n.t > 1.2 ? 1 - (n.t - 1.2) / 0.4 : 1;
        const size = Math.max(1, 72 * n.scale * pop);
        ctx.globalAlpha = clamp01(alpha);
        ctx.font = `900 ${size | 0}px Georgia, 'Times New Roman', serif`;
        const y = n.y - bounce - n.t * 16;
        ctx.lineWidth = Math.max(4, size * 0.14);
        ctx.strokeStyle = '#140a18';
        ctx.strokeText(n.text, n.x, y);
        ctx.fillStyle = n.color;
        ctx.fillText(n.text, n.x, y);
      }
      ctx.restore();
    }

    #drawVignette(ctx) {
      const g = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    #drawHud(ctx) {
      const t = this.#time;
      // title ribbon
      const ribbonIn = easeOut(span(t, 0.12, 0.45));
      if (ribbonIn > 0) {
        const tw = 420;
        ctx.save();
        ctx.globalAlpha = ribbonIn;
        ctx.translate(W / 2, 30 + (1 - ribbonIn) * -30);
        this.#frame(ctx, -tw / 2, 0, tw, this.#subtitle ? 64 : 44);
        ctx.textAlign = 'center';
        ctx.fillStyle = this.#kind === 'heal' ? '#a8ffc8' : (this.#kind === 'spell' ? '#e0c8ff' : '#fff2c8');
        ctx.font = "bold 24px Georgia, 'Times New Roman', serif";
        const title = this.#count > 1 ? `${this.#title}  ×${this.#count}` : this.#title;
        ctx.fillText(title, 0, 30);
        if (this.#subtitle) {
          ctx.fillStyle = '#b8c0d8';
          ctx.font = '15px monospace';
          ctx.fillText(this.#subtitle, 0, 52);
        }
        ctx.restore();
      }
      // fighter panels
      const slide = easeOut(span(t, 0.05, 0.4));
      if (this.#left)
        this.#panel(ctx, this.#left, 24 - (1 - slide) * 560, H - 104, 520);
      if (this.#right)
        this.#panel(ctx, this.#right, W - 544 + (1 - slide) * 560, H - 104, 520);
    }

    #panel(ctx, f, x, y, w) {
      const u = f.unit;
      const h = 84;
      this.#frame(ctx, x, y, w, h);
      const hp = this.#hpShown(f);
      const party = u.faction === 'party';
      ctx.textAlign = 'left';
      ctx.fillStyle = party ? '#a8d0ff' : '#ffb0a0';
      ctx.font = "bold 22px Georgia, 'Times New Roman', serif";
      ctx.fillText(u.name || '?', x + 18, y + 32);
      const ch = u.character || {};
      ctx.fillStyle = '#c8c0a8';
      ctx.font = '14px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${ch.level ? 'Lv ' + ch.level + '  ' : ''}${titleCase(ch.class)}`, x + w - 18, y + 30);
      // hp bar
      const bx = x + 18, by = y + 46, bw = w - 150, bh = 16;
      ctx.fillStyle = '#0a0610';
      ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = '#3a1418';
      ctx.fillRect(bx, by, bw, bh);
      const ratio = clamp01(hp / f.maxHp);
      const trail = clamp01(Math.max(hp, f.hpFrom) / f.maxHp);
      ctx.fillStyle = '#ffec9a';
      ctx.fillRect(bx, by, bw * trail, bh);
      ctx.fillStyle = ratio > 0.5 ? '#46d468' : ratio > 0.25 ? '#e8c440' : '#e84838';
      ctx.fillRect(bx, by, bw * ratio, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(bx, by, bw * ratio, 5);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f0ecdc';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`HP ${Math.max(0, Math.round(hp))}/${f.maxHp}`, x + w - 18, by + 15);
    }

    // HP counts from the old to the new value after the impact.
    #hpShown(f) {
      if (f.hpFrom === f.hpTo)
        return f.hpTo;
      const b = BEATS[this.#kind];
      if (this.#time < b.impact)
        return f.hpFrom;
      const p = easeOut(span(this.#time, b.impact + 0.08, b.impact + 0.75));
      return lerp(f.hpFrom, f.hpTo, p);
    }

    #frame(ctx, x, y, w, h) {
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(26,30,64,0.94)');
      g.addColorStop(1, 'rgba(10,12,30,0.94)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#c8a24e';
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      ctx.strokeStyle = 'rgba(255,236,170,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 6.5, y + 6.5, w - 13, h - 13);
    }

    #drawBanner(ctx) {
      const bn = this.#banner;
      if (!bn || bn.t > 1.4)
        return;
      const inP = easeOutBack(clamp01(bn.t / 0.25));
      const alpha = bn.t > 1.0 ? 1 - (bn.t - 1.0) / 0.4 : 1;
      ctx.save();
      ctx.globalAlpha = clamp01(alpha);
      ctx.translate(W / 2, bn.low ? H - 150 : 150);
      ctx.scale(inP, inP);
      ctx.textAlign = 'center';
      ctx.font = `900 ${bn.low ? 40 : 64}px Georgia, 'Times New Roman', serif`;
      ctx.lineWidth = 10;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#140a18';
      ctx.strokeText(bn.text, 0, 0);
      ctx.fillStyle = bn.color;
      ctx.fillText(bn.text, 0, 0);
      ctx.restore();
    }

    // Cinematic shutters close over the grid at the start and end.
    // Closing over the grid, opening onto the scene; the reverse at the end.
    #drawShutters(ctx) {
      const s = SHUTTER, t = this.#time, e = this.#end;
      let cover = 0;
      if (t < s)
        cover = t / s;
      else if (t < 2 * s)
        cover = 1 - (t - s) / s;
      else if (t >= e - s)
        cover = 1 - (t - (e - s)) / s;
      else if (t >= e - 2 * s)
        cover = (t - (e - 2 * s)) / s;
      cover = easeInOut(clamp01(cover));
      if (cover <= 0)
        return;
      ctx.fillStyle = '#05040a';
      const half = (H / 2) * cover;
      ctx.fillRect(0, 0, W, half);
      ctx.fillRect(0, H - half, W, half);
      ctx.fillStyle = '#c8a24e';
      ctx.fillRect(0, half - 2, W, 2);
      ctx.fillRect(0, H - half, W, 2);
    }
  }

  TR.BattleScene = BattleScene;
  TR.BattleScene.BEATS = BEATS;
})();
