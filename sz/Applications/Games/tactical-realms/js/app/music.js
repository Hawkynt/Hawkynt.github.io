;(function() {
  'use strict';

  /* The soundtrack through the shared SZ.GameMusic: an epic title theme, an adventurous overworld
     theme per dimension, a warm funk in town, a quiet ambient at camp, a dark synthwave in the
     dungeons and a battle theme. Each theme is arranged by the shared engine into an endless song
     (intro, groove, build-up, drop, breakdown, every pass a little different); every dungeon floor
     and every overworld plays a song of its own. Battles build up and a victory pushes the music
     into the drop. */
  const SZ = window.SZ || (window.SZ = {});
  const TR = SZ.TacticalRealms || (SZ.TacticalRealms = {});

  const S = (id, style, root, scale, prog, seed, extra) => Object.assign({ id: id, style: style, root: root, scale: scale, prog: prog, seed: seed }, extra || {});
  const THEMES = {
    title: S('tr-title', 'epic', 50, 'minor', [0, 6, 5, 4], 3, { bpm: 92 }),
    overworld: S('tr-overworld', 'epic', 55, 'mixolydian', [0, 6, 3, 4], 11, { bpm: 104 }),
    town: S('tr-town', 'funk', 57, 'major', [0, 4, 5, 3], 23, { bpm: 96 }),
    camp: S('tr-camp', 'ambient', 55, 'penta', [0, 3, 1, 4], 37, { bpm: 72 }),
    dungeon: S('tr-dungeon', 'synthwave', 50, 'phrygian', [0, 1, 6, 4], 41, { bpm: 98 }),
    combat: S('tr-combat', 'dubstep', 52, 'harmonic', [0, 5, 3, 4], 47),
  };
  const variant = (song, key) => (SZ.GameMusic ? SZ.GameMusic.variant(song, String(key)) : song);
  let battles = 0, wasCombat = false;

  function themeFor() {
    const c = TR.app && TR.app.controller;
    const st = c && c._sm ? c._sm.current : 'TITLE';
    const combat = st === 'COMBAT' || st === 'VICTORY' || st === 'DEFEAT';
    if (combat && !wasCombat) ++battles;
    wasCombat = combat;
    if (combat) return variant(THEMES.combat, 'battle-' + battles);
    if (st === 'DUNGEON') return variant(THEMES.dungeon, 'floor-' + (c._crawl ? c._crawl.floorIndex : 0));
    if (st === 'OVERWORLD') return variant(THEMES.overworld, c._dimension || 'material');
    if (st === 'TOWN') return THEMES.town;
    if (st === 'CAMP') return THEMES.camp;
    return THEMES.title;
  }

  function intensity() {
    const c = TR.app && TR.app.controller;
    const st = c && c._sm ? c._sm.current : 'TITLE';
    if (st === 'VICTORY') return 1;
    if (st === 'COMBAT') return 0.85;
    if (st === 'DUNGEON') return 0.5;
    return 0.35;
  }

  let acc = 1;
  function update(dt) {
    const Mu = SZ.GameMusic;
    if (!Mu) return null;
    acc += dt;
    if (acc < 0.4) return null;
    acc = 0;
    const song = themeFor();
    Mu.setIntensity(intensity());
    if (Mu.current !== song) Mu.play(song);
    return song;
  }

  TR.music = { THEMES, themeFor, intensity, update };
})();
