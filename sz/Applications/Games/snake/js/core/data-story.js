/* The story: the cast with their portrait colours, and every cinematic as a list of shots
   (an animated scene, an optional speaker and a line of dialogue). The intro, one arrival per
   chapter, one reveal per guardian, the freeing of each guardian and the finale. Pure data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.Snake || (SZ.Snake = {});

  const CAST = {
    sola: { name: 'Sola', color: '#5fd35a', role: 'a young garden snake' },
    moss: { name: 'Old Mossback', color: '#7a9a5a', role: 'tortoise, keeper of the Seed Tree' },
    pip: { name: 'Pip', color: '#ffe07a', role: 'a firefly who talks too much' },
    mole: { name: 'Grubbin', color: '#8a5a3a', role: 'the Mole King' },
    scorpion: { name: 'Sekhet', color: '#c0502a', role: 'the Scorpion Queen' },
    owl: { name: 'Hoarfrost', color: '#d8ecff', role: 'the Owl of the Lake' },
    wyrm: { name: 'Cindrax', color: '#ff6a2a', role: 'the Magma Wyrm' },
    eclipse: { name: 'The Hollow Eclipse', color: '#c08cff', role: 'a hunger without a shape' },
  };

  const CINEMATICS = {
    intro: [
      { scene: 'tree', lit: 5, text: 'In the heart of the Verdant Vale grew the Seed Tree, and in its crown hung five Sun Seeds that kept the whole land green.' },
      { scene: 'theft', text: 'Then one night the stars went out. A shadow with a hundred mouths swallowed the light and carried the seeds away.' },
      { scene: 'tree', lit: 0, grey: true, speaker: 'moss', text: 'The Hollow Eclipse... It gave a seed to each guardian of the Vale, and the seeds turned them cruel.' },
      { scene: 'wake', speaker: 'sola', text: 'Then I will bring them home. All five. I am small, but I am quick - and I am always hungry.' },
      { scene: 'wake', speaker: 'pip', text: 'And I am Pip! I light the way. Eat the fruit, grow long, never bite your own tail. Easy!' },
      { scene: 'journey', world: 0, text: 'And so Sola set out across the fading Vale.' },
    ],
    chapter0: [
      { scene: 'world', world: 0, text: 'Chapter One - Clover Meadow' },
      { scene: 'world', world: 0, speaker: 'pip', text: 'The ground keeps shaking. Something big is tunnelling under the clover. Grab the golden eggs - they are lucky!' },
    ],
    chapter1: [
      { scene: 'world', world: 1, text: 'Chapter Two - Sunscale Dunes' },
      { scene: 'world', world: 1, speaker: 'sola', text: 'Quicksand slows me down, and those spikes come and go. I will time it.' },
    ],
    chapter2: [
      { scene: 'world', world: 2, text: 'Chapter Three - Hoarfrost Lake' },
      { scene: 'world', world: 2, speaker: 'pip', text: 'Careful on the ice - once you are sliding, you cannot turn. Plan your line before you step on it!' },
    ],
    chapter3: [
      { scene: 'world', world: 3, text: 'Chapter Four - Cinder Depths' },
      { scene: 'world', world: 3, speaker: 'moss', text: 'The vents breathe in a rhythm, little one. Watch them glow, then slip through between breaths.' },
    ],
    chapter4: [
      { scene: 'world', world: 4, text: 'Chapter Five - Eclipse Grid' },
      { scene: 'world', world: 4, speaker: 'sola', text: 'This is where the light went. Laser gates, portals... and the hunger at the centre of it all.' },
    ],
    boss0: [
      { scene: 'boss', boss: 'mole', speaker: 'mole', text: 'MINE! The shiny seed is MINE! Dig, dig, dig - and you, worm, will be buried!' },
      { scene: 'boss', boss: 'mole', speaker: 'pip', text: 'Eat a glowing Sun Shard to light up, then ram him while you shine!' },
    ],
    boss1: [
      { scene: 'boss', boss: 'scorpion', speaker: 'scorpion', text: 'The desert bows to its queen. My tail strikes the length of the sands - you will see it coming, and it will not help.' },
    ],
    boss2: [
      { scene: 'boss', boss: 'owl', speaker: 'owl', text: 'Hooo dares cross my frozen lake? I see every move from above, little snake.' },
    ],
    boss3: [
      { scene: 'boss', boss: 'wyrm', speaker: 'wyrm', text: 'A snake? Then let us see which of us is longer, and which of us burns.' },
    ],
    boss4: [
      { scene: 'boss', boss: 'eclipse', speaker: 'eclipse', text: 'Light. Light. Give me your light, little one. I have been empty for so long.' },
      { scene: 'boss', boss: 'eclipse', speaker: 'sola', text: 'You cannot keep it by swallowing it. Come and get me!' },
    ],
    outro0: [
      { scene: 'freed', boss: 'mole', speaker: 'mole', text: 'Ohh, my head... I was not myself. Take the seed, little snake, it hums too loudly for an old mole.' },
      { scene: 'tree', lit: 1, text: 'The first Sun Seed flew home, and the meadow turned green again.' },
    ],
    outro1: [
      { scene: 'freed', boss: 'scorpion', speaker: 'scorpion', text: 'You are faster than the wind over the dunes. The seed is yours - the sun of the desert never needed stealing.' },
      { scene: 'tree', lit: 2, text: 'The second seed returned, and warm winds blew over the Vale.' },
    ],
    outro2: [
      { scene: 'freed', boss: 'owl', speaker: 'owl', text: 'The ice in my heart is melting. Go on - the depths below are burning, and they need you more.' },
      { scene: 'tree', lit: 3, text: 'Three seeds shone in the Tree. The lake sang as it thawed.' },
    ],
    outro3: [
      { scene: 'freed', boss: 'wyrm', speaker: 'wyrm', text: 'You won, little cousin. One last seed remains - in the hollow at the centre of everything.' },
      { scene: 'tree', lit: 4, text: 'Four seeds. Only the brightest was still missing.' },
    ],
    finale: [
      { scene: 'freed', boss: 'eclipse', speaker: 'eclipse', text: 'I... I remember now. I was the first skin a snake ever shed. Left behind. Empty. I only wanted to be warm.' },
      { scene: 'freed', boss: 'eclipse', speaker: 'sola', text: 'Then come home with me. Light is not something you swallow. It is something you share.' },
      { scene: 'bloom', text: 'The fifth seed blazed in the crown of the Tree, and the whole Vale burst into bloom.' },
      { scene: 'bloom', speaker: 'moss', text: 'Well done, little one. Every fruit you ate on the way grew into a garden behind you.' },
      { scene: 'credits', text: 'Snake - a »SynthelicZ« game. Thank you for playing. The Vale is always open: Arcade, Zen and the seasonal festivals await.' },
    ],
  };

  Object.assign(NS.story, {
    CAST, CINEMATICS
  });
})();
