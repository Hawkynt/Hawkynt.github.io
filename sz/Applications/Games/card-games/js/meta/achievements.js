/* Achievements: milestones over wins, variety, streaks, days and categories.
   Checked after every recorded round; each grants XP and some a cosmetic. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.CardGames || (SZ.CardGames = {});
  const K = NS.constants;
  const P = NS.profile;
  const AC = NS.achievements = NS.achievements || {};

  function count(pred) {
    const g = P.data().games;
    let n = 0;
    for (const id in g) if (pred(g[id], id)) ++n;
    return n;
  }

  function categoryOf(id) {
    for (const c of K.SORTED_CATS)
      if (c.games.some(x => x.variant.id === id)) return c.name;
    return '';
  }

  function categoryWins(cat) {
    let n = 0;
    const g = P.data().games;
    for (const id in g) if (categoryOf(id) === cat) n += g[id].won;
    return n;
  }

  const back = (id, name) => ({ kind: 'back', id, name });
  const table = (id, name) => ({ kind: 'table', id, name });

  AC.LIST = [
    { id: 'first_win', name: 'First Blood', desc: 'Win any game', xp: 30, icon: '★', test: d => d.totalWon >= 1 },
    { id: 'wins_10', name: 'Card Sharp', desc: 'Win 10 games', xp: 60, icon: '★', test: d => d.totalWon >= 10 },
    { id: 'wins_50', name: 'High Roller', desc: 'Win 50 games', xp: 150, icon: '★', test: d => d.totalWon >= 50, reward: back('filigree', 'Gold Filigree') },
    { id: 'wins_200', name: 'Living Legend', desc: 'Win 200 games', xp: 400, icon: '♛', test: d => d.totalWon >= 200, reward: table('emperor', 'Emperor Gold') },
    { id: 'rounds_25', name: 'Regular', desc: 'Finish 25 rounds', xp: 40, icon: '♣', test: d => d.totalPlayed >= 25 },
    { id: 'rounds_250', name: 'Night After Night', desc: 'Finish 250 rounds', xp: 200, icon: '♣', test: d => d.totalPlayed >= 250 },
    { id: 'variety_10', name: 'Curious Mind', desc: 'Play 10 different games', xp: 50, icon: '♦', test: () => count(g => g.played > 0) >= 10 },
    { id: 'variety_25', name: 'Globetrotter', desc: 'Play 25 different games', xp: 100, icon: '♦', test: () => count(g => g.played > 0) >= 25 },
    { id: 'variety_50', name: 'Encyclopedia', desc: 'Play 50 different games', xp: 200, icon: '♦', test: () => count(g => g.played > 0) >= 50, reward: back('celtic', 'Celtic Knot') },
    { id: 'variety_all', name: 'Completionist', desc: 'Play every game in the suite', xp: 500, icon: '♚', test: () => count(g => g.played > 0) >= K.VARIANTS.length },
    { id: 'winners_10', name: 'Versatile', desc: 'Win 10 different games', xp: 100, icon: '♥', test: () => count(g => g.won > 0) >= 10 },
    { id: 'winners_30', name: 'Polymath', desc: 'Win 30 different games', xp: 250, icon: '♥', test: () => count(g => g.won > 0) >= 30, reward: back('starfield', 'Starfield') },
    { id: 'all_cats', name: 'Well Rounded', desc: 'Win a game in every category', xp: 150, icon: '♠', test: () => K.SORTED_CATS.every(c => categoryWins(c.name) > 0) },
    { id: 'streak_3', name: 'Hot Hand', desc: 'Win 3 rounds in a row', xp: 40, icon: '♨', test: d => d.bestWinStreak >= 3 },
    { id: 'streak_5', name: 'On Fire', desc: 'Win 5 rounds in a row', xp: 90, icon: '♨', test: d => d.bestWinStreak >= 5, reward: back('ember', 'Ember') },
    { id: 'streak_10', name: 'Unstoppable', desc: 'Win 10 rounds in a row', xp: 250, icon: '♨', test: d => d.bestWinStreak >= 10 },
    { id: 'days_3', name: 'Coming Back', desc: 'Play on 3 days in a row', xp: 40, icon: '☼', test: d => d.bestDayStreak >= 3 },
    { id: 'days_7', name: 'Weekly Ritual', desc: 'Play on 7 days in a row', xp: 120, icon: '☼', test: d => d.bestDayStreak >= 7, reward: back('art_deco', 'Art Deco') },
    { id: 'days_30', name: 'Devotee', desc: 'Play on 30 days in a row', xp: 500, icon: '☼', test: d => d.bestDayStreak >= 30 },
    { id: 'featured_1', name: 'Today\'s Pick', desc: 'Finish a round of the featured game', xp: 30, icon: '✦', test: d => d.featuredCount >= 1 },
    { id: 'featured_7', name: 'Trend Setter', desc: 'Finish the featured game on 7 days', xp: 150, icon: '✦', test: d => d.featuredCount >= 7 },
    { id: 'level_5', name: 'Apprentice', desc: 'Reach level 5', xp: 0, icon: '↑', test: d => d.level >= 5 },
    { id: 'level_10', name: 'Journeyman', desc: 'Reach level 10', xp: 0, icon: '↑', test: d => d.level >= 10 },
    { id: 'level_20', name: 'Master', desc: 'Reach level 20', xp: 0, icon: '↑', test: d => d.level >= 20 },
    { id: 'night_owl', name: 'Night Owl', desc: 'Finish a round between midnight and 4 am', xp: 30, icon: '☾', test: () => new Date().getHours() < 4 },
    { id: 'early_bird', name: 'Early Bird', desc: 'Finish a round between 5 and 7 am', xp: 30, icon: '☀', test: () => { const h = new Date().getHours(); return h >= 5 && h < 7; } },
    { id: 'cat_solitaire', name: 'Patience', desc: 'Win 5 solitaire games', xp: 60, icon: '♠', test: () => categoryWins('Solitaire') >= 5 },
    { id: 'cat_casino', name: 'House Edge', desc: 'Win 10 casino rounds', xp: 60, icon: '◉', test: () => categoryWins('Casino') >= 10 },
    { id: 'cat_shedding', name: 'Empty Handed', desc: 'Win 5 shedding games', xp: 60, icon: '♣', test: () => categoryWins('Shedding') >= 5 },
    { id: 'cat_tricks', name: 'Trick Master', desc: 'Win 5 trick-taking games', xp: 60, icon: '♥', test: () => categoryWins('Trick-Taking') >= 5 },
    { id: 'cat_rummy', name: 'Meld Maker', desc: 'Win 5 rummy games', xp: 60, icon: '♦', test: () => categoryWins('Rummy') >= 5 },
    { id: 'cat_quick', name: 'Quick Draw', desc: 'Win 5 quick games', xp: 60, icon: '⚡', test: () => categoryWins('Quick & Fun') >= 5 },
    { id: 'cat_europe', name: 'Grand Tour', desc: 'Win 5 European games', xp: 60, icon: '♔', test: () => categoryWins('European') >= 5 }
  ];

  AC.check = function() {
    const d = P.data();
    for (const a of AC.LIST)
      if (!d.achievements[a.id] && a.test(d)) P.grantAchievement(a);
  };

  AC.earned = () => AC.LIST.filter(a => P.data().achievements[a.id]).length;
  AC.categoryOf = categoryOf;
})();
