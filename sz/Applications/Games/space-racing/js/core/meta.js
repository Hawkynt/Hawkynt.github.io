/* The keep-coming-back layer through the shared SZ.GameGoals and SZ.GameStory: achievements, daily
   quests, the streak and the festival track paying credits, liveries earned by deeds and festivals
   (they repaint the player's ship), the Daily Race (the same track and direction for everyone all
   day, the best time kept), and the cups told by a cast - the young racer Nova, her mechanic Gus,
   the commentator Max Volume and the champion Vex who rules the circuit: a prologue, a word before
   every cup, a rival's taunt after a defeat and a championship finale. Scenes hold the race. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.SpaceRacing;

  const LV = (id, name, c, a, e, unlock) => ({ id, name, colors: [c, a, e], unlock });
  const LIVERIES = [
    LV('none', 'Factory paint', '#c8d0e0', '#5a6a8a', '#f80', { kind: 'free' }),
    LV('racing-red', 'Racing Red', '#e83a3a', '#ffd75a', '#ff8a2a', { kind: 'stat', stat: 'races', n: 10, text: 'Finish 10 races' }),
    LV('mint', 'Mint Rocket', '#5ae0b0', '#1a6a5a', '#7affd8', { kind: 'stat', stat: 'wins', n: 5, text: 'Win 5 races' }),
    LV('carbon', 'Carbon', '#2a2a32', '#5ad0ff', '#5ad0ff', { kind: 'stat', stat: 'boosts', n: 200, text: 'Fire 200 boosts' }),
    LV('chrome', 'Chrome', '#e8ecf4', '#8a96b0', '#ffffff', { kind: 'stat', stat: 'laps', n: 100, text: 'Drive 100 laps' }),
    LV('champion', 'Champion Gold', '#ffd75a', '#8a5e14', '#fff2b0', { kind: 'stat', stat: 'cups', n: 2, text: 'Win 2 cups' }),
    LV('fest-frost', 'Frostfall', '#bff4ff', '#5aa0d8', '#ffffff', { kind: 'festival', id: 'frost' }),
    LV('fest-bloom', 'Bloom', '#ff9ad0', '#7ae08a', '#ffe0f0', { kind: 'festival', id: 'bloom' }),
    LV('fest-sunfest', 'Sunfest', '#ffc23a', '#ff8a2a', '#fff2b0', { kind: 'festival', id: 'sunfest' }),
    LV('fest-harvest', 'Harvest', '#c8702a', '#4a2a10', '#ffd23a', { kind: 'festival', id: 'harvest' }),
    LV('fest-hollow', 'Hollow Night', '#ff7a1a', '#4a1a6a', '#b06aff', { kind: 'festival', id: 'hollow' }),
    LV('fest-starfall', 'Starfall', '#2a2a7a', '#ffd23a', '#fff2a0', { kind: 'festival', id: 'starfall' }),
  ];

  const A = (id, name, stat, n, reward, desc) => ({ id, name, stat, n, reward, desc });
  const ACHIEVEMENTS = [
    A('r1', 'Lights Out', 'races', 1, 2, 'Finish a race'), A('r25', 'Regular', 'races', 25, 5, 'Finish 25 races'), A('r100', 'Veteran Racer', 'races', 100, 10, 'Finish 100 races'),
    A('w1', 'First Win', 'wins', 1, 3, 'Win a race'), A('w15', 'Winning Streak', 'wins', 15, 6, 'Win 15 races'), A('w50', 'Untouchable', 'wins', 50, 12, 'Win 50 races'),
    A('p10', 'On the Podium', 'podiums', 10, 4, 'Finish on the podium 10 times'),
    A('c1', 'Silverware', 'cups', 1, 5, 'Win a cup'), A('c4', 'Grand Champion', 'cups', 4, 12, 'Win all four cups'),
    A('l50', 'Lap Counter', 'laps', 50, 2, 'Drive 50 laps'), A('l500', 'Long Haul', 'laps', 500, 8, 'Drive 500 laps'),
    A('b100', 'Nitro', 'boosts', 100, 3, 'Fire 100 boosts'),
    A('dl1', 'Daily Race', 'dailies', 1, 2, 'Drive a Daily Race'), A('dl10', 'Daily Driver', 'dailies', 10, 6, 'Drive 10 Daily Races'),
    A('sk7', 'Seven Grands Prix', 'bestStreak', 7, 5, 'Play seven days in a row'), A('q10', 'Pit Orders', 'quests', 10, 4, 'Complete 10 daily quests'),
    A('f1', 'Festival Paint', 'festivals', 1, 5, 'Finish a festival track'),
  ];
  const QUESTS = [
    { id: 'q-r', kind: 'races', n: 3, reward: 2, text: 'Finish 3 races' }, { id: 'q-w', kind: 'wins', n: 1, reward: 4, text: 'Win a race' },
    { id: 'q-p', kind: 'podiums', n: 2, reward: 3, text: 'Finish on the podium twice' }, { id: 'q-l', kind: 'laps', n: 12, reward: 2, text: 'Drive 12 laps' },
    { id: 'q-b', kind: 'boosts', n: 20, reward: 2, text: 'Fire 20 boosts' }, { id: 'q-d', kind: 'dailies', n: 1, reward: 3, text: 'Drive the Daily Race' },
  ];

  const CAST = {
    nova: { name: 'Nova', skin: '#e8b890', hair: '#5ad0ff', cloth: '#e83a3a', trim: '#ffd75a', eyes: '#2a3a5a', head: 'visor' },
    gus: { name: 'Gus', skin: '#8a5a3a', hair: '#a8a8b0', cloth: '#3a5a8a', trim: '#ffb03a', eyes: '#1a1a1a', head: 'goggles' },
    max: { name: 'Max Volume', skin: '#f0c8a0', hair: '#ffd75a', cloth: '#b06aff', trim: '#ff5aff', eyes: '#2a1a3a', head: 'cap' },
    vex: { name: 'Vex', foe: true, skin: '#c8b0d8', hair: '#1a1220', cloth: '#1e1e26', trim: '#ff3a5a', eyes: '#ff5a3a', head: 'visor' },
  };
  const S = (who, text) => ({ who, text });
  const CUP = [
    [S('max', 'Welcome to the Bronze Cup! Four tracks, eight pilots, one rookie with a dream!'), S('gus', 'Easy on the barriers, kid. I just painted her.')],
    [S('max', 'The Silver Cup! Ion storms, comet canyons and the field is getting faster!'), S('vex', 'Silver suits you, rookie. Second place is a lovely colour.')],
    [S('gus', 'Gold Cup runs the tracks backwards. Your brain will hate you.'), S('nova', 'My brain can keep up. Can the ship?')],
    [S('max', 'THE PLATINUM CUP! The champion herself is on the grid!'), S('vex', 'I have not lost a race in three seasons. Do not take it personally.')],
  ];
  const scenes = {
    prologue: { title: 'Prologue', lines: [
      S('nova', 'Gus, is she ready? The Bronze Cup starts in five minutes.'),
      S('gus', 'Engine purring, thrusters tuned. Bring her back in one piece.'),
      S('max', 'Ladies and gentlemen, a brand new pilot on the grid! Let us see what she has got!'),
      S('vex', 'Another rookie. They come, they spin, they go home.'),
      S('nova', 'Not this one. Lights out!')] },
    taunt: { title: 'Rival', lines: [
      S('vex', 'Not bad. Not good either. See you at the next line.'),
      S('gus', 'Ignore her. Take the inside line on the next corner and use the boost after the turn.')] },
    finale: { title: 'Championship', lines: [
      S('max', 'UNBELIEVABLE! The rookie takes the Platinum Cup!'),
      S('vex', 'Three seasons... Fine. Rematch. Any track, any day.'),
      S('gus', 'You brought her back in one piece. I could cry.'),
      S('nova', 'Daily Race tomorrow, Vex. Bring your best lap.')] },
  };
  for (let i = 0; i < 4; ++i) scenes['cup-' + i] = { title: ['Bronze', 'Silver', 'Gold', 'Platinum'][i] + ' Cup', lines: CUP[i] };

  let held = false;
  const pause = () => { held = true; NS.state.hold = true; };
  const resume = () => { held = false; NS.state.hold = false; };
  const story = SZ.GameStory ? SZ.GameStory.create({ id: 'space-racing', cast: CAST, scenes, pause, resume }) : null;

  let livery = null;
  function applyLivery(id) {
    const l = LIVERIES.find(x => x.id === id);
    livery = !l || id === 'none' ? null : l.colors;
  }

  const goals = SZ.GameGoals ? SZ.GameGoals.create({
    id: 'space-racing', title: 'Space Racing', accent: '#5ad0ff', currency: 'credits x25',
    pay: n => { const G = NS.state; if (G.save) { G.save.credits += n * 25; if (NS.save && NS.save.writeSave) NS.save.writeSave(); } },
    achievements: ACHIEVEMENTS, quests: QUESTS, cosmetics: LIVERIES, cosmeticLabel: 'Livery', onEquip: applyLivery,
    tokens: { races: 12, wins: 15, laps: 2, cups: 40, dailies: 20 }, story, pause, resume,
    daily: {
      label: 'Daily Race',
      describe(r) {
        const D = NS.defs, idx = r.seed % D.TRACKS.length, rev = (r.seed >> 8) % 2 === 1;
        return { title: 'Today\'s Daily Race', lines: [D.TRACKS[idx].name + (rev ? ' (Reverse)' : ''), 'Everyone drives the same track today. Your best time is kept.'] };
      },
      start(r) {
        const D = NS.defs, G = NS.state, idx = r.seed % D.TRACKS.length, rev = (r.seed >> 8) % 2 === 1;
        G.dailyRace = { day: r.day };
        G.raceCup = null;
        G.currentTrackIndex = idx;
        G.currentVariant = D.trackVariant(idx, rev);
        NS.raceSetup.resetGame();
      },
    },
  }) : null;

  function deed(kind, n) { if (goals) goals.deed(kind, n); }

  function onRaceStart(G) {
    if (!story || G.raceCup === null || G.raceCup === undefined) return;
    const cp = G.save.cupProgress;
    if (cp && cp.race === 0) {
      if (G.raceCup === 0) story.play('prologue');
      story.play('cup-' + G.raceCup);
    }
  }
  function onBoost() { deed('boosts', 1); }
  function onLap() { deed('laps', 1); }
  function onFinish(G, place) {
    deed('races', 1);
    if (place === 1) deed('wins', 1);
    if (place <= 3) deed('podiums', 1);
    if (G.dailyRace && goals) {
      goals.dailyResult(Math.max(1, Math.round(100000 - G.raceTime * 100)));
      G.dailyRace = null;
    }
    if (story && place > 1 && G.raceCup !== null) story.play('taunt');
  }
  function onCup(cupIndex, won) {
    if (!won) return;
    deed('cups', 1);
    if (story && cupIndex === 3) story.play('finale');
  }

  NS.meta = { goals, story, LIVERIES, deed, onRaceStart, onBoost, onLap, onFinish, onCup, livery: () => livery,
    open: tab => goals && goals.open(tab) };
})();
