# Bubble Bobble

The bubble-trapping platformer grown into an adventure for the »SynthelicZ« Desktop: **Fizz and the Dry Lagoon**. Baron Dryspell has bottled the water of five kingdoms; Fizz the bubble newt, her cousin Pop and Grandma Tide set out to win it back - Candy Caverns, Toybox Tower, Canopy Kingdom, Cloudworks and Dryspell Castle, thirty rooms, five guardian fights and cinematics. Beside the story wait Arcade, Blitz, Zen, the Daily Challenge and Boss Rush. Shards from every game buy a 25-node tech tree, gems buy newt colours, bubbles and pop trails, and seasonal festivals, daily quests, streaks, player levels and 37 achievements bring something new every day. Every game saves itself, so Continue always picks up exactly where you left off.

## How It Works

**Play:** a single-screen room of 24 x 20 tiles. Fizz runs, jumps three tiles high and passes up through platforms from below; falling through the gap in the floor brings you back from the top. Space blows a bubble that flies a little way, then floats up and gathers where the room's wind blows. A flying bubble traps an enemy (a brute takes two); touching a trapped enemy pops it into fruit, and every bubble touching the popped one pops too - each trapped enemy in a chain is worth double the last (1,000, 2,000, 4,000 ...). Landing on a bubble with jump held bounces you off it. Trapped enemies break out angry after seven seconds; after 40 s in a room everyone turns angry and after 55 s an unbeatable shade starts hunting you.

**Enemies:** Grumble walks and jumps after you, Boing hops, Flitter flies diagonally through everything, Pebbler throws stones along its platform, Zoomer charges, Bulk needs two bubbles and Wisp drifts straight at you through walls.

**Special bubbles** drift in from the floor gap: water floods down the platforms and washes enemies away, lightning shoots a bolt in the direction you face, fire burns a platform, and five star bubbles give an extra life. **Candy** drops from chains: Swift Shoes, Rapid Gum, Long Breath, Bubble Shield, and from the tech tree Big Bubbles, Frost Pop (all enemies freeze), Fruit Magnet and Pop Bomb (every trapped enemy pops).

**Rooms:** each room is generated from a seed in its kingdom's style - long ledges with holes, steps, islands, floating clouds or castle battlements - mirrored left to right, with five platform rows three tiles apart. A breadth-first search over standing spots with the real jump reach (three tiles up and across, through platforms from below, through the floor gap) proves every enemy can be reached; a seed that fails is skipped. The same story room comes back every time.

**Engine:** a room is one plain object - map, player, bubbles, enemies, items, shots, floods, bolts, flames, timers, score, lives, stars and the seeded generator state - so it saves as JSON and replays the same, on a fixed step of 1/120 s. Every step leaves events (blow, trap, pop, chain, fruit, candy, hurry, die ...) that the game turns into sound, particles, words and call-outs. A player bot over the same engine pops trapped bubbles, hunts enemies, climbs, blows and dodges; it plays the title demo and shows in the tests that every room and guardian can be cleared.

**Story:** five kingdoms of six rooms: trap them all, beat the clock, and the guardian. Each room has three stars: finish it, beat the par time and meet its bonus goal (lose no life, pop a chain, collect fruit). Guardians bounce around the room; flying bubbles hurt them (big ones double) and lightning bubbles, which drift in often during a fight, strike for four. They throw fans of shots, call in helpers and rage at half health. Cinematics open the story, every kingdom and every guardian fight, close every victory and end the game with a finale and credits.

**Modes:** Arcade (endless generated rooms with three lives, tougher every room, top-ten table), Blitz (three minutes of endless rooms with unlimited lives), Zen (nothing can hurt you, no hurry-up), the Daily Challenge (three minutes on one seed per local day with two mutators) and Boss Rush (all five guardians back to back, opens with two guardians beaten). Mutators: Angry Mob, Short Breath, No Candy, Candy Party, Dim Rooms, Stormy, Thin Bubbles and Crowded.

**Progress without a server:** everything lives in localStorage - the profile and the snapshot of the game in progress, written every three seconds, on pause and when the page hides. The old game's top-five table moves into Arcade on first launch. The festival running on the local date tints the kingdoms, drifts its decor over every screen, collects tokens from every pop and fills a five-tier track that ends in a newt colour and a pop trail.

**Rendering:** the 1280 x 720 plane is fitted into the window with the kingdom filling any extra space. The room's tiles are painted once per room; the newt, enemies (calm, angry, frozen), bubbles, fruit, candy, shots, backdrops, guardians, portraits, icons and particle shapes are cached sprites; no blur filters. A busy frame stays under 3,000 draw calls.

**Soundtrack:** the shared `SZ.GameMusic` composes a bouncy theme per kingdom and a faster one per guardian, a menu theme, calm Zen and driving Blitz; the hurry-up, the shade and the last life bring drums and lead in. Pops climb a scale with the chain.

## Architecture

- `index.html`, `styles.css`
- `js/` -- the game under `SZ.BubbleBobble`, one module per concern:
  - `js/core/namespace.js`, `constants.js` (room, physics, bubbles, enemy kinds, candy, palette), `rng.js`
  - `js/core/levels.js` -- the seeded room generator and the reachability search
  - `js/core/data-worlds.js` -- five kingdoms, 30 rooms, five guardians, the room of a stage
  - `js/core/engine.js` -- the pure room engine (platform physics, bubbles, trapping, chains, enemies, hurry-up, shade, elements, candy, lives)
  - `js/core/bot.js` -- the player bot
  - `js/core/data-story.js`, `data-meta.js` (tech tree, newts, bubbles, trails, modes, achievements, quests), `seasons.js`, `progress.js`, `state.js`, `save.js`, `audio.js`, `music.js`
  - `js/systems/fx.js`, `boss.js` (guardians), `run.js` (sessions, endless rooms, objectives, stars, revives, Boss Rush), `play.js` (on screen, juice, results, autosave), `cine.js`, `demo.js`
  - `js/render/view.js`, `art-kit.js`, `sprites.js`, `backdrop.js`, `boss-art.js`, `field-render.js`, `fx-render.js`, `hud.js`, `cine-render.js`, `frame.js`
  - `js/ui/kit.js`, `widgets.js`, `screens.js`, `title.js`, `map.js`, `panels.js`, `input.js`, `status-bar.js`
  - `js/app.js`
- `tests/` -- node tests: `harness.js`, `run.test.js` (reachability of every room, movement, trapping, chains, bounces, escapes, hurry-up and shade, elements, stars, candy, lives, the bot clearing every room and guardian, stars, guardian shots, rage and bolts, endless rooms, timed modes, Zen, Boss Rush, revive, JSON), `scene.test.js` (boot, story, keyboard play, pause, results, every screen, cinematic, mode and kingdom, draw-call budget, no shadowBlur, warm frames paint nothing new), `meta.test.js` (migration, saving, Continue, tree, candy list, cosmetics, quests, streak, festivals, daily, XP, achievements, payouts)

## User Stories

### Play
- [x] As a player, I can run, jump up through platforms and wrap through the floor
- [x] As a player, I can blow bubbles that trap enemies, pop them in chains for doubling points and bounce on them
- [x] As a player, I can use water, lightning, fire and star bubbles and eat eight kinds of candy
- [x] As a player, I must hurry: angry enemies after 40 s and a shade after 55 s

### Story
- [x] As a player, I can follow Fizz, Pop and Grandma Tide through five kingdoms with cinematics, a map and dialogue
- [x] As a player, I can play thirty rooms with three stars each
- [x] As a player, I can fight five guardians with shots, helpers and rage, and see a finale and credits

### Modes
- [x] As a player, I can play Arcade, Blitz, Zen, the Daily Challenge and Boss Rush

### Progress
- [x] As a player, I can spend shards on a 25-node tech tree that changes my next game
- [x] As a player, I can collect newt colours, bubbles and pop trails
- [x] As a player, I can finish daily quests, keep a streak, level up and earn achievements
- [x] As a player, I can join seasonal festivals that change the look and pay out a reward track
- [x] As a player, I can leave at any time and Continue the same game after a reload, and keep my old high scores

### Controls and Window
- [x] As a player, I can play with the keyboard or touch buttons, switch on auto-blow, and resize or maximize the window

## Controls

| Input | Action |
|---|---|
| Left / Right, A / D | Run |
| Up / W / Z | Jump (hold to bounce on bubbles) |
| Space / X | Blow bubbles |
| Esc / P | Pause |
| Touch | Left, right, jump and blow buttons in the bottom corners |
| Click / any key | Next cinematic line (Esc skips) |
| F2 | Title screen (the game is saved) |

## SEO Keywords

bubble bobble, bubble shooter platformer, free online arcade game, trap enemies in bubbles, chain pops, boss fights, story mode, daily challenge, tech tree, seasonal events, »SynthelicZ« game
