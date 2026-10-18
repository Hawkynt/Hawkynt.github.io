/* world/boss-rewards.js -- boss tower unlocks and relics with their icons.
   Reads: constants, pixelArt, research, progress, cinematics and the shared state G. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});
  const G = NS.state;
  const { TWO_PI } = NS.constants;
  const { ICONS } = NS.pixelArt;
  const { techLevel, grantResearch } = NS.research;

  /* ══════════════════════════════════════════════════════════════════
     BOSS REWARDS -- some towers are only unlocked by defeating a
     particular boss; beyond that bosses may drop relics, rare permanent
     items with strong effects (no duplicates until all are found)
     ══════════════════════════════════════════════════════════════════ */

  const BOSS_UNLOCKS = { slimeking: 'wind', lich: 'arcane', dragon: 'storm' };

  const RELICS = [
    { id: 'quiver', name: "Fletcher's Quiver", icon: 'r_quiver', color: '#c8a070', desc: 'Archer towers shoot one more target.' },
    { id: 'coil', name: 'Storm Coil', icon: 'r_coil', color: '#7ae8ff', desc: 'Tesla lightning jumps to 2 more enemies.' },
    { id: 'seal', name: "Merchant's Seal", icon: 'r_seal', color: '#ffd75a', desc: '+15% gold for every kill.' },
    { id: 'frostheart', name: 'Frost Heart', icon: 'r_frost', color: '#9ae4ff', desc: 'Your gatehouse chills enemies near it: 40% slower.' },
    { id: 'lens', name: 'Hawk-Eye Lens', icon: 'r_lens', color: '#ff8a8a', desc: 'Archers and Snipers gain 10% crit chance.' },
    { id: 'hammer', name: "Master's Hammer", icon: 'r_hammer', color: '#d8d8e8', desc: 'Tower upgrades cost 20% less.' },
    { id: 'hourglass', name: 'Hourglass of Ages', icon: 'r_glass', color: '#e0c890', desc: 'Ability cooldowns are 25% shorter.' },
    { id: 'scale', name: 'Dragon Scale', icon: 'r_scale', color: '#ff6a4a', desc: '+5 lives on every map.' },
    { id: 'ember', name: 'Ember Core', icon: 'r_ember', color: '#ff8a2a', desc: 'Burns deal 50% more damage.' },
    { id: 'steel', name: 'Starforged Steel', icon: 'r_steel', color: '#b8c8ff', desc: 'All towers deal 10% more damage.' }
  ];
  const RELIC_BY_ID = {};
  for (const r of RELICS) RELIC_BY_ID[r.id] = r;

  function hasRelic(id) {
    return !!(G.meta && G.meta.relics && G.meta.relics.indexOf(id) >= 0);
  }

  // Relic chance per boss kill: half of all first kills of a boss kind, rarely afterwards
  function rollBossReward(e) {
    const type = e.type;
    G.meta.bossKills = G.meta.bossKills || {};
    const first = !G.meta.bossKills[type];
    G.meta.bossKills[type] = (G.meta.bossKills[type] || 0) + 1;
    const fam = BOSS_UNLOCKS[type];
    if (fam && techLevel('unlock_' + fam) <= 0) {
      G.meta.tree['unlock_' + fam] = 1;
      NS.progress.saveMeta();
      NS.cinematics.queueReward({ kind: 'tower', fam, boss: type });
      return;
    }
    if (Math.random() < (first ? 0.5 : 0.12)) {
      const left = RELICS.filter(r => !hasRelic(r.id));
      if (left.length) {
        const r = left[Math.floor(Math.random() * left.length)];
        G.meta.relics.push(r.id);
        for (const t of G.towers) t.stats = null;
        ++G.towerVersion;
        if (r.id === 'scale') { G.lives += 5; G.runStartLives += 5; G.livesPulse = 1; }
        NS.progress.saveMeta();
        NS.cinematics.queueReward({ kind: 'relic', id: r.id, boss: type });
      } else {
        grantResearch(10);
        NS.cinematics.queueReward({ kind: 'research', rp: 10, boss: type });
      }
    } else
      NS.progress.saveMeta();
  }

  /* ── Relic icons (16 x 16) ── */
  Object.assign(ICONS, {
    r_quiver: (g) => {
      g.fillStyle = '#7a4e2c'; g.fillRect(4, 5, 7, 10); g.fillStyle = '#9a663a'; g.fillRect(4, 5, 2, 10);
      g.fillStyle = '#d8b07a'; for (const x of [5, 7, 9]) g.fillRect(x, 1, 1, 5);
      g.fillStyle = '#e8e8f0'; for (const x of [4, 6, 8]) g.fillRect(x, 0, 3, 2);
      g.fillStyle = '#ffd75a'; g.fillRect(4, 9, 7, 1);
    },
    r_coil: (g) => {
      g.fillStyle = '#9a4c1c'; for (let i = 0; i < 4; ++i) g.fillRect(4, 4 + i * 3, 8, 2);
      g.fillStyle = '#e8984a'; for (let i = 0; i < 4; ++i) g.fillRect(4, 4 + i * 3, 8, 1);
      g.fillStyle = '#7ae8ff'; g.fillRect(7, 0, 2, 3); g.fillRect(2, 1, 1, 2); g.fillRect(13, 1, 1, 2);
    },
    r_seal: (g) => {
      g.fillStyle = '#b8801a'; g.beginPath(); g.arc(8, 8, 7, 0, TWO_PI); g.fill();
      g.fillStyle = '#ffd34a'; g.beginPath(); g.arc(8, 8, 5.5, 0, TWO_PI); g.fill();
      g.fillStyle = '#8a5a14'; g.fillRect(5, 6, 6, 1); g.fillRect(7, 4, 2, 8); g.fillRect(5, 10, 6, 1);
    },
    r_frost: (g) => {
      g.fillStyle = '#3f7eb0'; g.beginPath(); g.moveTo(8, 15); g.lineTo(1, 6); g.arc(4.6, 4.8, 3.6, Math.PI * 0.85, Math.PI * 1.9); g.arc(11.4, 4.8, 3.6, Math.PI * 1.1, Math.PI * 0.15); g.closePath(); g.fill();
      g.fillStyle = '#b0dcf6'; g.fillRect(3, 3, 3, 2); g.fillStyle = '#ffffff'; g.fillRect(7, 6, 2, 5); g.fillRect(5, 8, 6, 1);
    },
    r_lens: (g) => {
      g.strokeStyle = '#c8a070'; g.lineWidth = 2; g.beginPath(); g.arc(7, 7, 5, 0, TWO_PI); g.stroke();
      g.fillStyle = 'rgba(150,220,255,0.9)'; g.beginPath(); g.arc(7, 7, 4, 0, TWO_PI); g.fill();
      g.fillStyle = '#ffffff'; g.fillRect(5, 4, 2, 2);
      g.fillStyle = '#7a4e2c'; g.save(); g.translate(11, 11); g.rotate(Math.PI / 4); g.fillRect(0, -1.5, 6, 3); g.restore();
    },
    r_hammer: (g) => {
      g.save(); g.translate(8, 8); g.rotate(-Math.PI / 4);
      g.fillStyle = '#8a5a30'; g.fillRect(-1, -1, 2, 9);
      g.fillStyle = '#ffd34a'; g.fillRect(-6, -6, 12, 6); g.fillStyle = '#fff2a0'; g.fillRect(-6, -6, 12, 1);
      g.restore();
    },
    r_glass: (g) => {
      g.fillStyle = '#8a5a30'; g.fillRect(3, 1, 10, 2); g.fillRect(3, 13, 10, 2);
      g.fillStyle = 'rgba(200,230,255,0.85)'; g.beginPath(); g.moveTo(4, 3); g.lineTo(12, 3); g.lineTo(8, 8); g.lineTo(12, 13); g.lineTo(4, 13); g.lineTo(8, 8); g.fill();
      g.fillStyle = '#e8c068'; g.beginPath(); g.moveTo(5.5, 13); g.lineTo(10.5, 13); g.lineTo(8, 10); g.fill(); g.fillRect(7.5, 8, 1, 3);
    },
    r_scale: (g) => {
      g.fillStyle = '#a82a12'; g.beginPath(); g.moveTo(8, 1); g.quadraticCurveTo(15, 6, 8, 15); g.quadraticCurveTo(1, 6, 8, 1); g.fill();
      g.fillStyle = '#f06a3a'; g.beginPath(); g.moveTo(8, 3); g.quadraticCurveTo(12, 7, 8, 12); g.quadraticCurveTo(5, 7, 8, 3); g.fill();
      g.fillStyle = '#ffb07a'; g.fillRect(7, 5, 1, 4);
    },
    r_ember: (g) => {
      g.fillStyle = '#d03c0a'; g.beginPath(); g.arc(8, 9, 6, 0, TWO_PI); g.fill();
      g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(8, 9, 4, 0, TWO_PI); g.fill();
      g.fillStyle = '#ffe48a'; g.beginPath(); g.arc(8, 9, 2, 0, TWO_PI); g.fill();
      g.fillStyle = '#ff6a14'; g.fillRect(7, 0, 2, 4); g.fillRect(3, 2, 1, 3); g.fillRect(12, 2, 1, 3);
    },
    r_steel: (g) => {
      g.save(); g.translate(8, 8); g.rotate(Math.PI / 4);
      g.fillStyle = '#c4ccdc'; g.fillRect(-1.5, -8, 3, 11); g.fillStyle = '#ffffff'; g.fillRect(-1.5, -8, 1, 11);
      g.fillStyle = '#7a8ac8'; g.fillRect(-4, 3, 8, 2); g.fillStyle = '#5a4a3a'; g.fillRect(-1, 5, 2, 3);
      g.restore();
      g.fillStyle = '#b8c8ff'; g.fillRect(2, 2, 1, 1); g.fillRect(12, 12, 1, 1);
    },
    gift: (g) => {
      g.fillStyle = '#7a4e2c'; g.fillRect(2, 6, 12, 9); g.fillStyle = '#9a663a'; g.fillRect(1, 4, 14, 4);
      g.fillStyle = '#ffd75a'; g.fillRect(7, 4, 2, 11); g.fillRect(1, 6, 14, 1);
      g.fillStyle = '#ffd75a'; g.fillRect(5, 1, 2, 3); g.fillRect(9, 1, 2, 3);
    }
  });

  NS.bossRewards = { BOSS_UNLOCKS, RELICS, RELIC_BY_ID, hasRelic, rollBossReward };

})();
