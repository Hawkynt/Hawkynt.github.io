/* The per-second sweeps: achievement unlocks over a state snapshot (each unlock
   feeds the global CPS bonus) and the lifetime-cookie milestone confetti. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CookieClicker || (SZ.CookieClicker = {});
  const S = NS.state;
  const { CANVAS_W, MILESTONES, CONFETTI_COLORS } = NS.constants;
  const ACHIEVEMENT_DEFS = NS.achievementDefs;
  const particles = NS.dom.particles;
  const floatingText = NS.dom.floatingText;
  /* ── Achievement Check ── */
  function checkAchievements() {
    const totalBuildings = Object.values(S.buildings).reduce((a, b) => a + b, 0);
    const totalUpgrades = Object.values(S.upgradePurchased).filter(Boolean).length;
    const snapshot = {
      cookiesBakedAllTime: S.cookiesBakedAllTime,
      totalClicks: S.totalClicks,
      buildings: S.buildings,
      cps: S.cps,
      prestigeCount: S.prestigeCount,
      totalBuildings,
      totalUpgrades
    };
    let newUnlock = false;
    for (const def of ACHIEVEMENT_DEFS) {
      if (!S.achievementUnlocked[def.id] && def.condition(snapshot)) {
        S.achievementUnlocked[def.id] = true;
        newUnlock = true;
        floatingText.add(CANVAS_W / 2, 40, '\u{1F3C6} ' + def.name, { color: '#ffd700', decay: 0.01 });
      }
    }
    if (newUnlock) {
      NS.economy.recalcCPS();
      SZ.GameAudio.play('levelup');
    }
  }
  function checkMilestones() {
    for (const m of MILESTONES) {
      if (S.cookiesBakedAllTime >= m && S.lastMilestone < m) {
        S.lastMilestone = m;
        S.confettiTimer = 2;
        SZ.GameAudio.play('win');
        for (let i = 0; i < 50; ++i)
          particles.burst(Math.random() * CANVAS_W, -10, 3, CONFETTI_COLORS[i % CONFETTI_COLORS.length], 2);
      }
    }
  }

  Object.assign(NS.achievements, { checkAchievements, checkMilestones });
})();
