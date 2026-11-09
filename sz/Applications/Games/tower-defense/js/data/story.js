/* data/story.js -- the story told between the battles: the cast (Warden Maren who holds the
   realm's keeps, Tinker Bram who builds the towers, the scout Lio who reads the roads, and the
   Ashen Sovereign who sends the hordes), the prologue, an arrival and a farewell for every region,
   a line from every boss when it first marches in, and the epilogue. Plain data. */
;(function() {
  'use strict';

  const SZ = window.SZ || (window.SZ = {});
  const NS = SZ.TowerDefense || (SZ.TowerDefense = {});

  /* portrait looks: skin, hair, outfit, trim, eyes and a headpiece */
  const CAST = {
    maren: { name: 'Warden Maren', skin: '#f0c8a0', hair: '#3a2a1e', cloth: '#3a6ad8', trim: '#e8ecf8', eyes: '#2a3a5a', head: 'helm' },
    bram: { name: 'Tinker Bram', skin: '#d8a070', hair: '#8a5a2a', cloth: '#8a6a3a', trim: '#ffd75a', eyes: '#3a2a1a', head: 'goggles' },
    lio: { name: 'Lio the Scout', skin: '#c88a5a', hair: '#1e1a14', cloth: '#3e8a4a', trim: '#c8e070', eyes: '#1e2a1a', head: 'hood' },
    sovereign: { name: 'The Ashen Sovereign', skin: '#6a5a7a', hair: '#1a1220', cloth: '#3a1a4a', trim: '#c04cff', eyes: '#ff5a3a', head: 'crown' },
  };

  const L = (who, text) => ({ who, text });

  const PROLOGUE = [
    L('maren', 'Greenvale has kept the peace for a hundred summers. That ends today.'),
    L('lio', 'Warden! Torches on every road from the east. Goblins, wolves, more than I can count.'),
    L('sovereign', 'Little keepers of little keeps. Every road leads to me in the end.'),
    L('bram', 'Then we build where the roads bend. Give me gold and I will give you towers.'),
    L('maren', 'Hold each map until the horn sounds. Nothing reaches the keep. Nothing.'),
  ];

  const REGION_IN = {
    meadow: [L('lio', 'The meadows are open ground - they will come fast and straight.'), L('bram', 'Archers on the bends, cannons where they bunch up. Simple as bread.')],
    swamp: [L('lio', 'Mirewood. The roads float on planks and the bogs swallow whatever we drop.'), L('maren', 'Build on the dry ground and let the swamp slow them for us.')],
    desert: [L('bram', 'Sand in the gears already. The Sunscar does not love machines.'), L('lio', 'Mesas everywhere. The roads fork around them - watch both sides.'), L('sovereign', 'The sun burns your walls. I will bury what is left.')],
    cavern: [L('lio', 'The caverns glitter, but the chasms have no bottom. Nowhere to build over the dark.'), L('bram', 'Crystal sings when lightning runs through it. My tesla coils will love it here.')],
    tundra: [L('maren', 'Frostreach. If the keeps fall here, the north has no shelter left.'), L('lio', 'Frozen lakes cut the roads in two. They will come from more than one gate.'), L('sovereign', 'Your breath freezes, warden. Your courage will follow.')],
    volcano: [L('lio', 'The Ashen Wastes. This is where the hordes are born.'), L('sovereign', 'You walked all the way to my hearth. How thoughtful.'), L('maren', 'We did not come to visit. We came to end it.')],
  };

  const REGION_OUT = {
    meadow: [L('maren', 'Greenvale holds. Rest the archers - the swamp is next.')],
    swamp: [L('bram', 'Mud in my boots, mud in my beard... but Mirewood stands.'), L('lio', 'The tracks lead south. Into the sun.')],
    desert: [L('lio', 'The dunes are quiet again. Something below them is not.'), L('maren', 'Then we follow it down.')],
    cavern: [L('bram', 'I will miss the singing crystal. I will not miss the chasms.'), L('maren', 'North now. Winter will not wait for us.')],
    tundra: [L('maren', 'The north is safe. One road left, and it smokes.'), L('sovereign', 'Come, then. My fire is patient.')],
    volcano: [L('maren', 'It is done.')],
  };

  const BOSS = {
    boss: [L('boss', 'Your walls are paper. My axe is not.'), L('sovereign', 'Meet my Warlord. He has never once retreated.'), L('maren', 'Then today he learns how.')],
    slimeking: [L('boss', 'Blorp. BLORP. Blorrrp!'), L('lio', 'That is... a very large slime. And it splits!'), L('bram', 'Then hit it while it is still one piece!')],
    lich: [L('boss', 'I have buried kings older than your keep.'), L('sovereign', 'Death is only a delay for my Lich King. Kill him if you can.'), L('maren', 'Fire and holy light. Keep it burning.')],
    troll: [L('boss', 'TROLL SMASH LITTLE TOWERS!'), L('lio', 'Troll Chieftain! It smashes towers as it walks!'), L('bram', 'Keep the repairs coming - I will patch, you shoot.')],
    dragon: [L('boss', 'Your arrows tickle. Your keep will burn.'), L('maren', 'A dragon. It flies over every wall we have.'), L('bram', 'Not over every bolt. Snipers and missiles - aim for the sky!')],
    sandworm: [L('boss', 'Hssss... the sand remembers every bone.'), L('lio', 'The ground is moving... it is under the road!'), L('sovereign', 'The desert has teeth, keeper.')],
    colossus: [L('boss', 'SHIELDS RAISED. ADVANCE.'), L('sovereign', 'My Aegis Colossus. Iron, shield and patience. Like me.'), L('bram', 'Every shield has a seam. Break it, then pour it on.')],
  };

  const EPILOGUE = [
    L('sovereign', 'The fire... goes out?'),
    L('maren', 'The roads are ours again. Every keep stands.'),
    L('bram', 'I will build one more tower. Just a small one. For the view.'),
    L('lio', 'And the hordes? Some are still out there.'),
    L('maren', 'Then the waves keep coming, and so do we. Hold every map as long as you like, warden.'),
  ];

  NS.story = { CAST, PROLOGUE, REGION_IN, REGION_OUT, BOSS, EPILOGUE };
})();
