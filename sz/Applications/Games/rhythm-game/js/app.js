/* Bootstrap: the profile (or the migrated old high scores), the date context (festival, the Daily Mix
   and Weekly Remix, quests and the weekly challenge, the play streak with its gift, the welcome-back
   gift), the requestAnimationFrame loop (cinematic, song, demo, juice, crate reveal, calibration,
   toasts, music, autosave, achievement sweep), the window menu bar, the shared sound button,
   saving when the page hides, and start-up on the title. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.RhythmGame || (SZ.RhythmGame = {});
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
    G.weekly = NS.seasons.weeklyRecipe(now);
    const p = G.profile;
    if (!p.quests || p.quests.day !== day) p.quests = P.rollQuests(day);
    const wk = NS.rng.weekKey(now);
    if (!p.weekly || p.weekly.week !== wk) p.weekly = P.rollWeekly(wk);
    const back = P.welcomeBack(p, day);
    if (back) scr.toast('Welcome back after ' + back.days + ' days! +' + back.discs + ' discs, +' + back.crystals + ' crystals' + (back.crate ? ' and a Record Crate' : ''), C.UI.gold, 'gift');
    if (P.touchStreak(p, day)) {
      const gift = P.streakGift(p.streak.count);
      p.discs += gift.discs;
      p.crystals += gift.crystals;
      p.crates.owned += gift.crate;
      scr.toast('Day ' + p.streak.count + ' streak: +' + gift.discs + ' discs' + (gift.crystals ? ', +' + gift.crystals + ' crystals' : '') + (gift.crate ? ' and a Record Crate!' : ''), C.UI.good, 'calendar');
    }
    NS.save.saveProfile(p);
  }

  function boot() {
    const loaded = NS.save.loadProfile();
    G.profile = loaded.profile;
    G.today = '';
    syncDate();
    if (loaded.migrated) scr.toast('Your old high scores are kept in the Journal (+' + (100 + loaded.migrated * 25) + ' discs)', C.UI.gold, 'trophy');
    G.ui.diff = G.profile.settings.diff || 'normal';
    NS.demo.reset();
    scr.setScreen('title');
  }

  function sweep() {
    const got = P.checkAchievements(G.profile);
    for (const a of got) { scr.toast('Achievement: ' + a.name + ' (+15 crystals)', C.UI.gold, 'trophy'); if (SZ.GameMusic) SZ.GameMusic.stinger('unlock'); }
  }

  function update(dt) {
    G.time += dt;
    ++G.frame;
    NS.fx.update(dt);
    NS.cine.update(dt);
    NS.play.update(dt);
    if (G.screen === 'title') NS.title.update(dt);
    if (G.screen === 'settings') NS.settings.update(dt);
    NS.shop.updateReveal(dt);
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
    NS.play.quit();
    NS.save.wipe();
    G.profile = P.newProfile();
    G.run = null;
    G.today = '';
    syncDate();
    NS.demo.reset();
    scr.setScreen('title');
  }

  function leaveSong() {
    if (G.screen === 'game') scr.pause();
  }

  if (SZ.MenuBar) {
    new SZ.MenuBar({
      onAction(action) {
        if (G.cine && action !== 'about' && action !== 'controls') NS.cine.end();
        if (action !== 'pause' && action !== 'music' && action !== 'about' && action !== 'controls') leaveSong();
        const from = G.screen === 'game' ? 'paused' : G.screen;
        switch (action) {
          case 'title': if (G.run && !G.run.done && G.run.mode !== 'demo') { NS.save.saveRun(G.run); NS.play.quit(); G.run = null; } scr.setScreen('title'); break;
          case 'pause': if (G.screen === 'game') scr.pause(); else if (G.screen === 'paused') scr.resume(); break;
          case 'library': scr.setScreen('library', 'title'); break;
          case 'story': scr.setScreen('map', 'title'); break;
          case 'modes': scr.setScreen('modes', 'title'); break;
          case 'tree': case 'shop': case 'wardrobe': case 'journal': case 'settings': case 'help': scr.open(action, from); break;
          case 'music': if (SZ.GameMusic) { SZ.GameMusic.toggle(); scr.toast(SZ.GameMusic.enabled ? 'Music on' : 'Music off', C.UI.text, 'music'); } break;
          case 'reset': scr.confirm('Erase all progress?', 'Your stars, tech tree, collection, scores and achievements are deleted for good.', hardReset); break;
          case 'exit': if (G.run && !G.run.done && G.run.mode !== 'demo') NS.save.saveRun(G.run); NS.save.saveProfile(G.profile); if (User32) User32.DestroyWindow(); break;
          case 'controls': SZ.Dialog.show('controlsBackdrop'); break;
          case 'about': SZ.Dialog.show('dlg-about'); break;
        }
      },
    });
  }

  if (User32) {
    if (User32.EnableVisualStyles) User32.EnableVisualStyles();
    if (User32.SetWindowText) User32.SetWindowText('Rhythm Game');
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
    if (G.run && !G.run.done && G.run.mode !== 'demo') NS.save.saveRun(G.run);
    NS.save.saveProfile(G.profile);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    if (G.screen === 'game') scr.pause();
    if (G.run && !G.run.done && G.run.mode !== 'demo') NS.save.saveRun(G.run);
    NS.save.saveProfile(G.profile);
  });
  NS.input.attach();
  boot();

  Object.assign(NS.app, { syncDate, boot, sweep, update, loop, hardReset });
  requestAnimationFrame(loop);
})();
