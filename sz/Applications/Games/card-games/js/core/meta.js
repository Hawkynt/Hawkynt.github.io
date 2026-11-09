/* The keep-coming-back layer through the shared SZ.GameGoals and SZ.GameStory, on top of the
   profile's levels and unlocks: mastery of every family of games (win each of its games once) and
   of the whole collection, daily quests, the real-date festival track and achievements paying XP,
   twelve felt tables earned by deeds and festivals (they join the Table & Cards panel), and a story
   told by the regulars of the Gilded Ace card room - the dealer Madame Lune, the old player Pete,
   the card sharp Lucky Lou and the room's owner Countess Sable: a welcome on the first deal, a word
   at the first game of every family and a finale once every family is mastered. Scenes hold the
   table (S.hold). */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const S = NS.state;

  const FAMILIES = ['solitaire', 'casino', 'shedding', 'trick', 'rummy', 'speed', 'european'];
  const FAMILY_NAME = { solitaire: 'Solitaire', casino: 'Casino', shedding: 'Shedding', trick: 'Trick-Taking', rummy: 'Rummy', speed: 'Simple & Speed', european: 'European' };

  const T = (id, name, light, base, dark, unlock) => ({ id, name, colors: [light, base, dark], unlock });
  const FELTS = [
    T('none', 'My table', '#2c7a36', '#1b5a24', '#0b2c10', { kind: 'free' }),
    T('teal', 'Lagoon Teal', '#2a9a8a', '#16645a', '#062a24', { kind: 'stat', stat: 'wins', n: 25, text: 'Win 25 games' }),
    T('wine', 'Velvet Wine', '#8a2a4a', '#5a1630', '#200610', { kind: 'stat', stat: 'variants', n: 15, text: 'Win 15 different games' }),
    T('slate', 'Slate', '#5a6478', '#3a4252', '#14181e', { kind: 'stat', stat: 'rounds', n: 200, text: 'Play 200 rounds' }),
    T('gold', 'Gilded Felt', '#c8a040', '#8a6a1a', '#3a2a06', { kind: 'stat', stat: 'families', n: 3, text: 'Master 3 families' }),
    T('night', 'Midnight Ace', '#2a3a7a', '#141e4a', '#04081a', { kind: 'stat', stat: 'wins', n: 250, text: 'Win 250 games' }),
    T('fest-frost', 'Frostfall', '#9ad8f0', '#5a9ac0', '#1a3a5a', { kind: 'festival', id: 'frost' }),
    T('fest-bloom', 'Bloom', '#e8a0c8', '#a05a80', '#3a1a2a', { kind: 'festival', id: 'bloom' }),
    T('fest-sunfest', 'Sunfest', '#e8b84a', '#b07a1a', '#4a2a06', { kind: 'festival', id: 'sunfest' }),
    T('fest-harvest', 'Harvest', '#b07030', '#7a4818', '#2a1404', { kind: 'festival', id: 'harvest' }),
    T('fest-hollow', 'Hollow Night', '#6a3a8a', '#3a1a52', '#12061e', { kind: 'festival', id: 'hollow' }),
    T('fest-starfall', 'Starfall', '#3a3a8a', '#1e1e5a', '#08081e', { kind: 'festival', id: 'starfall' }),
  ];

  const A = (id, name, stat, n, reward, desc) => ({ id, name, stat, n, reward, desc });
  const ACHIEVEMENTS = [
    A('w1', 'Beginner\'s Luck', 'wins', 1, 2, 'Win a game'), A('w50', 'Card Shark', 'wins', 50, 5, 'Win 50 games'), A('w500', 'House Legend', 'wins', 500, 12, 'Win 500 games'),
    A('r100', 'Regular', 'rounds', 100, 3, 'Play 100 rounds'), A('r1000', 'Night Owl', 'rounds', 1000, 8, 'Play 1,000 rounds'),
    A('v10', 'Explorer', 'variants', 10, 4, 'Win 10 different games'), A('v40', 'Connoisseur', 'variants', 40, 8, 'Win 40 different games'), A('v72', 'Grand Collection', 'variants', 72, 15, 'Win every game in the house'),
  ];
  const SIZES = { solitaire: 12, casino: 7, shedding: 13, trick: 11, rummy: 8, speed: 11, european: 10 };
  for (const f of FAMILIES) ACHIEVEMENTS.push(A('m-' + f, FAMILY_NAME[f] + ' Master', 'fam_' + f, SIZES[f], 8, 'Win every ' + FAMILY_NAME[f] + ' game once'));
  ACHIEVEMENTS.push(A('fam3', 'Polymath', 'families', 3, 6, 'Master 3 families'), A('st7', 'Weekly Regular', 'bestStreak', 7, 5, 'Play seven days in a row'),
    A('q10', 'House Errands', 'quests', 10, 4, 'Complete 10 daily quests'), A('f1', 'Festive Felt', 'festivals', 1, 5, 'Finish a festival track'));
  const QUESTS = [
    { id: 'q-w', kind: 'wins', n: 3, reward: 3, text: 'Win 3 games' }, { id: 'q-r', kind: 'rounds', n: 10, reward: 2, text: 'Play 10 rounds' },
    { id: 'q-v', kind: 'newGame', n: 1, reward: 3, text: 'Play a game you have never won' },
    { id: 'q-sol', kind: 'w_solitaire', n: 1, reward: 3, text: 'Win a solitaire game' }, { id: 'q-tr', kind: 'w_trick', n: 1, reward: 3, text: 'Win a trick-taking game' },
    { id: 'q-sh', kind: 'w_shedding', n: 1, reward: 3, text: 'Win a shedding game' }, { id: 'q-ru', kind: 'w_rummy', n: 1, reward: 3, text: 'Win a rummy game' },
  ];

  const CAST = {
    lune: { name: 'Madame Lune', skin: '#e8c0a0', hair: '#2a1a3a', cloth: '#4a2a6a', trim: '#ffd75a', eyes: '#3a2a5a', head: 'hood' },
    pete: { name: 'Old Pete', skin: '#c8906a', hair: '#e0e0e8', cloth: '#5a4a3a', trim: '#c8a070', eyes: '#2a1a1a', head: 'cap' },
    lou: { name: 'Lucky Lou', foe: true, skin: '#f0c8a0', hair: '#1a1410', cloth: '#1e1e26', trim: '#ff5a5a', eyes: '#1a1a1a', head: 'cap' },
    sable: { name: 'Countess Sable', skin: '#d8b0a0', hair: '#1a1a22', cloth: '#7a1a2a', trim: '#e8e8f0', eyes: '#2a1a1a', head: 'crown' },
  };
  const L = (who, text) => ({ who, text });
  const FAMILY_LINE = {
    solitaire: [L('lune', 'Patience games. Just you and the deck - and the deck never lies.')],
    casino: [L('lou', 'The casino tables! Let us see if your luck is as good as mine.'), L('pete', 'Luck runs out. Odds do not. Count them.')],
    shedding: [L('pete', 'Shedding games: get rid of your cards before anyone else. Mind the wild ones.')],
    trick: [L('sable', 'Trick-taking. The oldest games in my house. Follow suit, darling.')],
    rummy: [L('lune', 'Rummy. Sets and runs, melds and discards. Patience pays.')],
    speed: [L('lou', 'Speed games! Fast hands, faster eyes. Try to keep up.')],
    european: [L('sable', 'Games from across the old continent. Each town swears theirs is the best.')],
  };
  const scenes = {
    welcome: { title: 'The Gilded Ace', lines: [
      L('lune', 'Welcome to the Gilded Ace. Seventy-two games under one roof.'),
      L('pete', 'Pull up a chair. I have been losing here since before you were born.'),
      L('lou', 'Fresh money! I mean... a new friend.'),
      L('sable', 'Master every family of games in my house, and the house will remember your name.')] },
    finale: { title: 'Master of the House', lines: [
      L('sable', 'Every family mastered. The Gilded Ace has a new legend.'),
      L('lou', 'Fine. You are better than me. Do not tell anyone.'),
      L('pete', 'Fifty years and I never managed it. Drinks are on me.'),
      L('lune', 'The cards will keep coming. They always do.')] },
  };
  for (const f of FAMILIES) scenes['fam-' + f] = { title: FAMILY_NAME[f], lines: FAMILY_LINE[f] };

  const pause = () => { S.hold = true; };
  const resume = () => { S.hold = false; };
  const story = SZ.GameStory ? SZ.GameStory.create({ id: 'card-games', cast: CAST, scenes, pause, resume }) : null;

  /* the felts join the Table & Cards panel; equipping one lays it on the table */
  const CT = SZ.CardThemes;
  if (CT && CT.addFeltTable)
    for (const f of FELTS) if (f.id !== 'none') CT.addFeltTable('goal-' + f.id, f.name, f.colors, { goal: f.id });
  function applyFelt(id) {
    if (!CT || !CT.setTheme || id === 'none' || !CT.TABLE_THEMES['goal-' + id]) return;
    CT.setTheme({ table: 'goal-' + id });
  }

  const goals = SZ.GameGoals ? SZ.GameGoals.create({
    id: 'card-games', title: 'Card Games', accent: '#ffd54f', currency: 'XP x10',
    pay: n => { if (NS.profile && NS.profile.addXp) NS.profile.addXp(n * 10, 'Goals'); },
    achievements: ACHIEVEMENTS, quests: QUESTS, cosmetics: FELTS, cosmeticLabel: 'Felt', onEquip: applyFelt,
    tokens: { rounds: 2, wins: 6, newGame: 10 }, story, pause, resume,
  }) : null;

  const familyOf = id => (NS.music && NS.music.FAMILY_OF && NS.music.FAMILY_OF[id]) || 'solitaire';
  const key = id => 'won_' + String(id).replace(/[^a-zA-Z0-9]/g, '_');

  function onGame(id) {
    if (!story) return;
    story.play('welcome');
    story.play('fam-' + familyOf(id));
  }
  function onOutcome(id, outcome) {
    if (!goals) return;
    goals.deed('rounds', 1);
    if (outcome !== 'win') return;
    const fam = familyOf(id);
    goals.deed('wins', 1);
    goals.deed('w_' + fam, 1);
    const st = goals.state.stats;
    if (!st[key(id)]) {
      goals.deed(key(id), 1);
      goals.deed('newGame', 1);
      goals.deed('variants', 1);
      goals.deed('fam_' + fam, 1);
      if ((st['fam_' + fam] || 0) >= SIZES[fam]) {
        goals.deed('families', 1);
        if (story && st.families >= FAMILIES.length) story.play('finale');
      }
    }
  }
  function mastery(id) {
    return goals ? (goals.state.stats[key(id)] ? 1 : 0) : 0;
  }

  NS.meta = { goals, story, FELTS, onGame, onOutcome, mastery, open: tab => goals && goals.open(tab) };
})();
