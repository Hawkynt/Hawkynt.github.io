/* Bootstrap: loading (or migrating) the save, offline baking since the last visit, the day and
   season, the requestAnimationFrame loop (simulation, juice, smooth counter, treat spring,
   once-a-second progression sweep, autosave every few seconds and on page hide), the window
   menu bar, the full reset, and start-up on the title screen. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const G = NS.state;
  const C = NS.constants;
  const E = NS.economy;
  const scr = NS.screens;
  const User32 = SZ.Dlls && SZ.Dlls.User32;

  function syncDate() {
    const now = new Date();
    const today = NS.calendar.dayKey(now);
    G.season = NS.calendar.seasonOf(now);
    if (today !== G.today) {
      G.today = today;
      G.modifier = NS.calendar.dailyModifier(today);
      if (G.run) NS.progression.newDay();
    }
  }

  /* bake for the seconds the page was away, capped and at the offline efficiency */
  function offline(seconds) {
    if (!(seconds > C.OFFLINE_MIN_SECONDS) || !G.run) return null;
    NS.production.refresh(true);
    const r = E.offlineGain(G.stMain.cps, seconds, G.profile);
    for (let i = G.run.buffs.length - 1; i >= 0; --i) {
      G.run.buffs[i].t -= seconds;
      if (G.run.buffs[i].t <= 0) G.run.buffs.splice(i, 1);
    }
    G.run.combo = 0;
    NS.production.earn(G.run, r.cookies);
    ++G.profile.stats.offlineReturns;
    if (r.cookies > 0) G.ui.offline = { away: seconds, cookies: r.cookies, capped: r.capped, cap: r.cap, efficiency: r.efficiency };
    return r;
  }

  function boot() {
    const loaded = NS.save.load();
    if (loaded) {
      G.profile = loaded.profile;
      G.run = loaded.run;
      G.bake = loaded.bake;
    } else {
      G.profile = E.newProfile();
      G.run = E.newRun('classic', G.profile);
    }
    syncDate();
    NS.progression.newDay();
    NS.production.refresh(true);
    if (loaded && loaded.savedAt) offline((Date.now() - loaded.savedAt) / 1000);
    if (loaded && loaded.migrated)
      scr.toast('Your old bakery moved in: ' + NS.format.short(G.run.cookies) + ' cookies, ' + G.profile.crystals + ' crystals and +' + G.profile.migrated.notes + ' recipe notes', C.UI.gold, 'trophy');
    G.ui.displayCookies = G.active().cookies;
    NS.progression.checkAchievements();
    NS.progression.checkUnlocks();
    scr.setScreen('title');
    NS.save.write(G);
  }

  function hardReset() {
    NS.save.wipe();
    G.profile = E.newProfile();
    G.run = E.newRun('classic', G.profile);
    G.bake = null;
    G.cine = null;
    G.pendingCine = null;
    G.today = '';
    syncDate();
    NS.golden.clearAll();
    NS.fx.clear();
    NS.production.refresh(true);
    G.ui.displayCookies = 0;
    NS.save.write(G);
    scr.setScreen('title');
  }

  function update(dt) {
    G.time += dt;
    ++G.frame;
    const gdt = NS.fx.update(dt);
    NS.cinematics.update(dt);
    NS.production.tick(gdt);
    NS.golden.update(gdt);
    NS.backdrop.update(dt);
    if (G.screen === 'title') NS.title.update(dt);
    if (G.screen === 'zen') NS.modes.zenTick(dt);
    scr.updateToasts(dt);
    /* treat spring */
    G.treatSquashV += -G.treatSquash * 260 * dt;
    G.treatSquashV *= Math.max(0, 1 - 14 * dt);
    G.treatSquash += G.treatSquashV * dt * 8;
    G.ui.lastBuyT = Math.max(0, G.ui.lastBuyT - dt * 2.5);
    /* smooth counter in log space */
    const run = G.active();
    const target = run.cookies, shown = G.ui.displayCookies;
    if (!isFinite(shown) || Math.abs(target - shown) <= Math.max(1, target * 1e-4)) G.ui.displayCookies = target;
    else {
      const a = Math.log10(Math.max(1, shown)), b = Math.log10(Math.max(1, target));
      const k = Math.min(1, dt * 9);
      G.ui.displayCookies = target < 1 ? target * k + shown * (1 - k) : Math.pow(10, a + (b - a) * k);
      if (target > shown) G.ui.pulse = Math.min(1, G.ui.pulse + dt * 2);
    }
    G.ui.pulse = Math.max(0, G.ui.pulse - dt * 3);
    G.checkT += dt;
    if (G.checkT >= 1) {
      G.checkT = 0;
      syncDate();
      NS.progression.sweep(1);
    }
    G.autoSaveT += dt;
    if (G.autoSaveT >= C.AUTOSAVE_SECONDS) {
      G.autoSaveT = 0;
      NS.save.write(G);
    }
    NS.statusBar.tick(dt);
  }

  let last = 0;
  function loop(ts) {
    if (!last) last = ts;
    const elapsed = (ts - last) / 1000;
    last = ts;
    if (elapsed > 5) offline(elapsed);
    update(Math.min(C.MAX_DT, Math.max(0, elapsed)));
    const t0 = performance.now();
    NS.frame.draw();
    NS.app.drawMs = performance.now() - t0;
    requestAnimationFrame(loop);
  }

  if (SZ.MenuBar) {
    new SZ.MenuBar({
      onAction(action) {
        if (G.cine && action !== 'about' && action !== 'controls') NS.cinematics.skip();
        switch (action) {
          case 'title': NS.save.write(G); scr.setScreen('title'); break;
          case 'pause': if (G.screen === 'game') scr.pause(); else if (G.screen === 'paused') scr.resume(); break;
          case 'tree': scr.openTree(G.screen === 'title' ? 'title' : G.screen === 'paused' ? 'paused' : 'game'); break;
          case 'collection': scr.openCollection(G.screen === 'title' ? 'title' : 'game'); break;
          case 'journal': scr.openJournal(G.screen === 'title' ? 'title' : 'game'); break;
          case 'save': NS.save.write(G); scr.toast('Saved', C.UI.good, 'scroll'); break;
          case 'tutorial': scr.openHelp(G.screen === 'title' ? 'title' : 'game'); break;
          case 'exit': NS.save.write(G); if (User32) User32.DestroyWindow(); break;
          case 'controls': SZ.Dialog.show('controlsBackdrop'); break;
          case 'about': SZ.Dialog.show('dlg-about'); break;
        }
      },
    });
  }

  if (User32) {
    if (User32.EnableVisualStyles) User32.EnableVisualStyles();
    if (User32.SetWindowText) User32.SetWindowText('Cookie Clicker');
  }
  if (SZ.GameAudio) {
    const btn = SZ.GameAudio.attachMuteButton(document.querySelector('.status-bar'));
    if (btn && btn.style) {
      btn.style.position = 'static';
      btn.style.margin = '0 0 0 auto';
      btn.style.width = btn.style.height = '18px';
      btn.style.font = '11px/16px sans-serif';
    }
  }
  /* autosave when the page goes away; the bakery keeps baking offline */
  window.addEventListener('pagehide', () => NS.save.write(G));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      NS.save.write(G);
      if (G.screen === 'game' && G.bake) scr.pause();
    }
  });
  NS.input.attach();
  boot();

  Object.assign(NS.app, { syncDate, offline, boot, hardReset, update, loop, drawMs: 0 });
  requestAnimationFrame(loop);
})();
