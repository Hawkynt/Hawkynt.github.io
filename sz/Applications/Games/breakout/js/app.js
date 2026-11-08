/* Bootstrap: the profile (or the migrated old high scores), the date context (festival, daily
   recipe, quests and the play streak with its gift), the requestAnimationFrame loop (cinematic,
   play, demo, juice, toasts, music, autosave, achievement sweep), the window menu bar, the shared
   sound button, autosave when the page hides, and start-up on the title. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Breakout || (SZ.Breakout = {});
  const G = NS.state;
  const C = NS.constants;
  const P = NS.progress;
  const scr = NS.screens;
  const User32 = SZ.Dlls && SZ.Dlls.User32;

  function syncDate() {
    const now = new Date();
    const day = NS.rng.dayKey(now);
    G.season = NS.seasons.seasonFor(now);
    if (day === G.today) return;
    G.today = day;
    G.daily = NS.seasons.dailyRecipe(now);
    const p = G.profile;
    if (!p.quests || p.quests.day !== day) p.quests = P.rollQuests(day);
    if (P.touchStreak(p, day)) {
      const gift = P.streakGift(p.streak.count);
      p.shards += gift.shards;
      p.gems += gift.gems;
      scr.toast('Day ' + p.streak.count + ' streak: +' + gift.shards + ' shards' + (gift.gems ? ' and ' + gift.gems + ' gems' : ''), C.UI.good, 'calendar');
    }
    NS.save.saveProfile(p);
  }

  function boot() {
    const loaded = NS.save.loadProfile();
    G.profile = loaded.profile;
    G.today = '';
    syncDate();
    if (loaded.migrated) scr.toast('Your ' + loaded.migrated + ' old high scores moved into Arcade (+' + loaded.migrated * 50 + ' shards)', C.UI.gold, 'trophy');
    NS.demo.reset();
    scr.setScreen('title');
  }

  function sweep() {
    const got = P.checkAchievements(G.profile);
    for (const a of got) scr.toast('Achievement: ' + a.name + ' (+10 gems)', C.UI.gold, 'trophy');
  }

  function update(dt) {
    G.time += dt;
    ++G.frame;
    const gdt = NS.fx.update(dt);
    NS.cine.update(dt);
    NS.play.update(gdt);
    if (G.screen === 'title' || G.screen === 'modes') NS.title.update(dt);
    NS.backdrop.update(dt);
    scr.updateToasts(dt);
    NS.music.update(dt);
    NS.play.autosave(dt);
    G.checkT += dt;
    if (G.checkT >= 2) {
      G.checkT = 0;
      syncDate();
      if (G.screen !== 'game') sweep();
    }
    NS.statusBar.tick(dt);
  }

  let last = 0;
  function loop(ts) {
    if (!last) last = ts;
    const dt = Math.min(C.MAX_DT, Math.max(0, (ts - last) / 1000));
    last = ts;
    update(dt);
    NS.frame.draw();
    requestAnimationFrame(loop);
  }

  function hardReset() {
    NS.save.wipe();
    G.profile = P.newProfile();
    G.run = null;
    G.today = '';
    syncDate();
    scr.setScreen('title');
  }

  if (SZ.MenuBar) {
    new SZ.MenuBar({
      onAction(action) {
        if (G.cine && action !== 'about' && action !== 'controls') NS.cine.end();
        switch (action) {
          case 'title': if (G.run && !G.run.done) NS.save.saveRun(G.run); scr.setScreen('title'); break;
          case 'pause': if (G.screen === 'game') scr.pause(); else if (G.screen === 'paused') scr.resume(); break;
          case 'story': scr.setScreen('map', 'title'); break;
          case 'modes': scr.setScreen('modes', 'title'); break;
          case 'tree': scr.open('tree', G.screen === 'game' ? 'paused' : G.screen); if (G.run && !G.run.done) NS.save.saveRun(G.run); break;
          case 'wardrobe': scr.open('wardrobe', G.screen === 'game' ? 'paused' : G.screen); break;
          case 'journal': scr.open('journal', G.screen === 'game' ? 'paused' : G.screen); break;
          case 'music': if (SZ.GameMusic) { SZ.GameMusic.toggle(); scr.toast(SZ.GameMusic.enabled ? 'Music on' : 'Music off', C.UI.text, 'music'); } break;
          case 'reset': scr.confirm('Erase all progress?', 'Your stars, tech tree, collection, scores and achievements are deleted for good.', hardReset); break;
          case 'help': scr.open('help', G.screen === 'game' ? 'paused' : G.screen); break;
          case 'exit': if (G.run && !G.run.done) NS.save.saveRun(G.run); NS.save.saveProfile(G.profile); if (User32) User32.DestroyWindow(); break;
          case 'controls': SZ.Dialog.show('controlsBackdrop'); break;
          case 'about': SZ.Dialog.show('dlg-about'); break;
        }
        if (G.screen === 'game' && action !== 'pause' && action !== 'music') scr.pause();
      },
    });
  }

  if (User32) {
    if (User32.EnableVisualStyles) User32.EnableVisualStyles();
    if (User32.SetWindowText) User32.SetWindowText('Breakout');
  }
  if (SZ.GameAudio && SZ.GameAudio.attachMuteButton) {
    const btn = SZ.GameAudio.attachMuteButton(document.querySelector('.status-bar'));
    if (btn && btn.style) {
      btn.style.position = 'static';
      btn.style.margin = '0 0 0 auto';
      btn.style.width = btn.style.height = '18px';
      btn.style.font = '11px/16px sans-serif';
    }
  }
  window.addEventListener('pagehide', () => {
    if (G.run && !G.run.done) NS.save.saveRun(G.run);
    NS.save.saveProfile(G.profile);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (G.screen === 'game') scr.pause();
    if (G.run && !G.run.done) NS.save.saveRun(G.run);
    NS.save.saveProfile(G.profile);
  });
  NS.input.attach();
  boot();

  Object.assign(NS.app, { syncDate, boot, sweep, update, loop, hardReset });
  requestAnimationFrame(loop);
})();
