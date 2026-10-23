;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const K = SZ.CardGames.constants;

  /* ══════════════════════════════════════════════════════════════════
     CONSTANTS
     ══════════════════════════════════════════════════════════════════ */

    const CANVAS_W = 900;
    const CANVAS_H = 600;
    const MAX_DT = 0.05;

    /* ── Game states ── */
    const STATE_MENU = 'MENU';
    const STATE_PLAYING = 'PLAYING';
    const STATE_PAUSED = 'PAUSED';
    const STATE_ROUND_OVER = 'ROUND_OVER';
    const STATE_GAME_OVER = 'GAME_OVER';

    /* ── Storage ── */
    const STORAGE_PREFIX = 'sz-card-games';
    const STORAGE_HIGHSCORES = STORAGE_PREFIX + '-highscores';
    const STORAGE_HINTS = STORAGE_PREFIX + '-hints';
    const STORAGE_AUTOSORT = STORAGE_PREFIX + '-autosort';
    const MAX_HIGH_SCORES = 10;

    /* ── Hint mode ── */
    let hintsEnabled = true;
    try { const h = localStorage.getItem(STORAGE_HINTS); if (h !== null) hintsEnabled = h !== 'false'; } catch (_) {}

    /* ── Auto-sort hand ── */
    let autoSortHand = false;
    try { const s = localStorage.getItem(STORAGE_AUTOSORT); if (s !== null) autoSortHand = s !== 'false'; } catch (_) {}

    /* ── Variant definitions (all 72 games, grouped by category) ── */
    const VARIANTS = [
      /* Solitaire (12) */
      { id: 'solitaire',     name: 'Solitaire',       desc: 'Classic Klondike solitaire',            module: 'js/variants/solitaire-variant.js' },
      { id: 'freecell',      name: 'FreeCell',         desc: 'All cards face-up strategy',            module: 'js/variants/freecell-variant.js' },
      { id: 'spider',        name: 'Spider',           desc: 'Build runs of same-suit cards',         module: 'js/variants/spider-variant.js' },
      { id: 'yukon',         name: 'Yukon',            desc: 'Move any face-up card group freely',   module: 'js/variants/yukon-variant.js' },
      { id: 'pyramid',       name: 'Pyramid',          desc: 'Remove pairs summing to 13',            module: 'js/variants/pyramid-variant.js' },
      { id: 'golf',          name: 'Golf',             desc: 'Clear columns by playing \u00b11',      module: 'js/variants/golf-variant.js' },
      { id: 'tripeaks',      name: 'TriPeaks',         desc: 'Clear three overlapping peaks',         module: 'js/variants/tripeaks-variant.js' },
      { id: 'fortythieves',  name: 'Forty Thieves',    desc: '2-deck solitaire, single card moves',  module: 'js/variants/fortythieves-variant.js' },
      { id: 'canfield',      name: 'Canfield',         desc: 'Build up from a random start rank',    module: 'js/variants/canfield-variant.js' },
      { id: 'clock',         name: 'Clock',            desc: 'Deal into clock face, flip by rank',   module: 'js/variants/clock-variant.js' },
      { id: 'bakersdozen',   name: 'Baker\'s Dozen',   desc: '13 columns, no suit restriction',      module: 'js/variants/bakersdozen-variant.js' },
      { id: 'accordion',     name: 'Accordion',        desc: 'Compress row by suit or rank',         module: 'js/variants/accordion-variant.js' },
      /* Casino (7) */
      { id: 'poker',         name: 'Poker',            desc: 'Five-card draw with betting rounds',    module: 'js/variants/poker-variant.js' },
      { id: 'blackjack',     name: 'Blackjack',        desc: 'Get as close to 21 as you can',        module: 'js/variants/blackjack-variant.js' },
      { id: 'baccarat',      name: 'Baccarat',         desc: 'Bet on Player, Banker, or Tie',        module: 'js/variants/baccarat-variant.js' },
      { id: 'holdem',        name: 'Texas Hold\'em',   desc: 'Community cards poker with blinds',    module: 'js/variants/holdem-variant.js' },
      { id: 'faro',          name: 'Faro',             desc: 'Bet on ranks, winner vs loser',        module: 'js/variants/faro-variant.js' },
      { id: 'reddog',        name: 'Red Dog',          desc: 'Bet the next card falls between',      module: 'js/variants/reddog-variant.js' },
      { id: 'threecard',     name: 'Three Card Poker', desc: 'Ante & Play with Pair Plus bonus',    module: 'js/variants/threecard-variant.js' },
      /* Shedding (13) */
      { id: 'uno',           name: 'Uno',              desc: 'Match cards by color or number',        module: 'js/variants/uno-variant.js' },
      { id: 'unoflip',      name: 'Uno Flip',          desc: 'Double-sided light and dark cards',     module: 'js/variants/unoflip-variant.js' },
      { id: 'unowild',      name: 'Uno All Wild',      desc: 'Every card is a wild action card',      module: 'js/variants/unowild-variant.js' },
      { id: 'liarsuno',     name: 'Liar\'s Uno',       desc: 'Bluff and challenge face-down plays',   module: 'js/variants/liarsuno-variant.js' },
      { id: 'unoextreme',   name: 'Uno Extreme',       desc: 'Random card launcher draws',            module: 'js/variants/unoextreme-variant.js' },
      { id: 'unoparty',     name: 'Uno Party',          desc: '6-player party with special wilds',     module: 'js/variants/unoparty-variant.js' },
      { id: 'dos',          name: 'Dos',                desc: 'Number matching with two piles',        module: 'js/variants/dos-variant.js' },
      { id: 'ono99',        name: 'ONO 99',             desc: 'Running total \u2014 bust at 99',       module: 'js/variants/ono99-variant.js' },
      { id: 'duo',          name: '8-Color Duo',        desc: '8-color shedding card game',            module: 'js/variants/duo-variant.js' },
      { id: 'skipbo',        name: 'Skip-Bo',          desc: 'Build sequential piles 1 to 12',       module: 'js/variants/skipbo-variant.js' },
      { id: 'crazy-eights',  name: 'Crazy Eights',     desc: 'Match suit or rank, 8s are wild',      module: 'js/variants/crazy-eights-variant.js' },
      { id: 'maumau',        name: 'Mau-Mau',          desc: 'German shedding with action cards',    module: 'js/variants/maumau-variant.js' },
      { id: 'president',     name: 'President',        desc: 'Shed cards, rank President to Scum',   module: 'js/variants/president-variant.js' },
      /* Trick-Taking (11) */
      { id: 'skat',          name: 'Skat',             desc: 'German trick-taking card game',         module: 'js/variants/skat-variant.js' },
      { id: 'doppelkopf',    name: 'Doppelkopf',       desc: 'Hidden teams trick-taking game',       module: 'js/variants/doppelkopf-variant.js' },
      { id: 'hearts',        name: 'Hearts',           desc: 'Avoid hearts and Queen of Spades',     module: 'js/variants/hearts-variant.js' },
      { id: 'spades',        name: 'Spades',           desc: 'Bid tricks, spades always trump',      module: 'js/variants/spades-variant.js' },
      { id: 'euchre',        name: 'Euchre',           desc: '2v2 trump trick-taking classic',       module: 'js/variants/euchre-variant.js' },
      { id: 'pinochle',      name: 'Pinochle',         desc: 'Melds and tricks with double deck',    module: 'js/variants/pinochle-variant.js' },
      { id: 'bridge',        name: 'Bridge',           desc: 'Partnership bidding and trick-taking', module: 'js/variants/bridge-variant.js' },
      { id: 'ohhell',        name: 'Oh Hell',          desc: 'Bid exact tricks with variable hands', module: 'js/variants/ohhell-variant.js' },
      { id: 'whist',         name: 'Whist',            desc: 'Classic partnership trick-taking',     module: 'js/variants/whist-variant.js' },
      { id: 'pitch',         name: 'Pitch',            desc: 'Bid to name trump, 4 point game',     module: 'js/variants/pitch-variant.js' },
      { id: 'sixtysix',      name: 'Sixty-Six',        desc: 'Austrian two-player trick game',      module: 'js/variants/sixtysix-variant.js' },
      /* Rummy (8) */
      { id: 'canasta',       name: 'Canasta',          desc: 'Form melds of seven cards',             module: 'js/variants/canasta-variant.js' },
      { id: 'ginrummy',      name: 'Gin Rummy',        desc: 'Form melds, knock when ready',         module: 'js/variants/ginrummy-variant.js' },
      { id: 'rummy500',      name: 'Rummy 500',        desc: 'Draw, meld, and score to 500',         module: 'js/variants/rummy500-variant.js' },
      { id: 'phase10',       name: 'Phase 10',         desc: 'Complete 10 phase objectives',          module: 'js/variants/phase10-variant.js' },
      { id: 'tonk',          name: 'Tonk',             desc: 'Quick knock rummy, drop to win',       module: 'js/variants/tonk-variant.js' },
      { id: 'rummy',         name: 'Rummy',            desc: 'Classic meld and lay-off card game',   module: 'js/variants/rummy-variant.js' },
      { id: 'kalooki',       name: 'Kalooki',          desc: 'Jamaican rummy with wild jokers',      module: 'js/variants/kalooki-variant.js' },
      { id: 'yaniv',         name: 'Yaniv',            desc: 'Discard combos, call at 7 or less',   module: 'js/variants/yaniv-variant.js' },
      /* Simple/Speed (11) */
      { id: 'war',           name: 'War',              desc: 'Flip and compare, highest wins',        module: 'js/variants/war-variant.js' },
      { id: 'memory',        name: 'Memory',           desc: 'Flip pairs face-down, match to win',   module: 'js/variants/memory-variant.js' },
      { id: 'gofish',        name: 'Go Fish',          desc: 'Ask for ranks, collect sets of 4',     module: 'js/variants/gofish-variant.js' },
      { id: 'oldmaid',       name: 'Old Maid',         desc: 'Don\'t get stuck with the Queen',      module: 'js/variants/oldmaid-variant.js' },
      { id: 'snap',          name: 'Snap',             desc: 'Quick reaction card matching',          module: 'js/variants/snap-variant.js' },
      { id: 'speed',         name: 'Speed',            desc: 'Race to empty your hand \u00b11 rank',  module: 'js/variants/speed-variant.js' },
      { id: 'cheat',         name: 'Cheat',            desc: 'Play face-down and bluff your rank',   module: 'js/variants/cheat-variant.js' },
      { id: 'ratscrew',      name: 'Rat Screw',        desc: 'Slap matching patterns to win cards',  module: 'js/variants/ratscrew-variant.js' },
      { id: 'sevens',        name: 'Sevens',           desc: 'Build suit rows outward from 7s',      module: 'js/variants/sevens-variant.js' },
      { id: 'spitemalice',   name: 'Spite & Malice',   desc: 'Competitive patience for two',         module: 'js/variants/spitemalice-variant.js' },
      { id: 'beggar',        name: 'Beggar Neighbor',   desc: 'Pay court cards or lose the pile',     module: 'js/variants/beggar-variant.js' },
      /* European (10) */
      { id: 'schwimmen',     name: 'Schwimmen',        desc: 'German 31 \u2014 best hand in one suit', module: 'js/variants/schwimmen-variant.js' },
      { id: 'durak',         name: 'Durak',            desc: 'Russian attack and defense game',       module: 'js/variants/durak-variant.js' },
      { id: 'briscola',      name: 'Briscola',         desc: 'Italian trump trick-taking game',      module: 'js/variants/briscola-variant.js' },
      { id: 'scopa',         name: 'Scopa',            desc: 'Italian fishing \u2014 capture by sum', module: 'js/variants/scopa-variant.js' },
      { id: 'cribbage',      name: 'Cribbage',         desc: 'Pegging board scoring card game',      module: 'js/variants/cribbage-variant.js' },
      { id: 'piquet',        name: 'Piquet',           desc: 'Classic French declaration game',      module: 'js/variants/piquet-variant.js' },
      { id: 'bezique',       name: 'Bezique',          desc: 'French meld and trick game',           module: 'js/variants/bezique-variant.js' },
      { id: 'cassino',       name: 'Cassino',          desc: 'Capture table cards by value',         module: 'js/variants/cassino-variant.js' },
      { id: 'pishti',        name: 'Pishti',           desc: 'Turkish capture with Jack tricks',     module: 'js/variants/pishti-variant.js' },
      { id: 'belote',        name: 'Belote',           desc: 'French trick-taking with declarations', module: 'js/variants/belote-variant.js' }
    ];

    /* ── Category groupings for menu ── */
    const CATEGORIES = [
      { name: 'Solitaire',    color: '#2a6a2a', start: 0,  count: 12 },
      { name: 'Casino',       color: '#6a2a2a', start: 12, count: 7 },
      { name: 'Shedding',     color: '#2a2a6a', start: 19, count: 13 },
      { name: 'Trick-Taking', color: '#5a3a1a', start: 32, count: 11 },
      { name: 'Rummy',        color: '#4a1a4a', start: 43, count: 8 },
      { name: 'Quick & Fun',  color: '#1a4a5a', start: 51, count: 11 },
      { name: 'European',     color: '#5a1a2a', start: 62, count: 10 }
    ];

    const SORTED_CATS = CATEGORIES.map(cat => ({
      name: cat.name,
      color: cat.color,
      games: VARIANTS.slice(cat.start, cat.start + cat.count)
        .map((v, i) => ({ variant: v, index: cat.start + i }))
        .sort((a, b) => a.variant.name.localeCompare(b.variant.name))
    }));

    /* ── Menu / Hint / Sort / Style button regions ── */
    const MENU_BTN = { x: CANVAS_W - 82, y: 8, w: 72, h: 28 };
    const HINT_BTN = { x: CANVAS_W - 164, y: 8, w: 72, h: 28 };
    const SORT_BTN = { x: CANVAS_W - 246, y: 8, w: 72, h: 28 };
    const STYLE_BTN = { x: CANVAS_W - 328, y: 8, w: 72, h: 28 };

  Object.assign(K, {
    CANVAS_W, CANVAS_H, MAX_DT,
    STATE_MENU, STATE_PLAYING, STATE_PAUSED, STATE_ROUND_OVER, STATE_GAME_OVER,
    STORAGE_PREFIX, STORAGE_HIGHSCORES, STORAGE_HINTS, STORAGE_AUTOSORT, MAX_HIGH_SCORES,
    VARIANTS, CATEGORIES, SORTED_CATS,
    MENU_BTN, HINT_BTN, SORT_BTN, STYLE_BTN
  });

})();
