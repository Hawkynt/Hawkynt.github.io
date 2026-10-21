# Rhythm Game

A rhythm action game where you hit falling notes in time with music using the D/F/J/K keys. Part of the SynthelicZ Desktop.

## Features

- **4-Lane Note Highway**: Notes scroll smoothly from top to bottom across 4 lanes
- **Procedural Music via Web Audio API**: Each song has a unique procedural melody, bass line, hi-hat, and kick drum generated in real-time using oscillators and noise nodes
- **Per-Song Musical Identity**: 6 different musical scales and waveform combinations for distinct song character
- **Hit/Miss Sound Effects**: Audio feedback for accurate hits and misses using Web Audio
- **Timing Accuracy**: Perfect, Great, Good, and Miss judgments based on timing precision — widened timing windows for accessible difficulty
- **Reduced Difficulty**: Slower note speed (35% reduction), lower BPMs, and wider timing windows (57-75% increase) for a more forgiving experience
- **Combo & Multiplier System**: Build combos for score multipliers (x2/x3/x4); misses reset the combo
- **Combo Milestones**: Celebratory confetti and floating notifications at 10, 30, 50, and 100 combos
- **Pulsing Combo Display**: Combo text scales on each hit with color-coded milestones (white/yellow/orange/magenta)
- **6 Built-in Songs**: Procedurally generated note patterns from melody data with real-time audio
- **Song Selection Screen**: Browse and select songs with preview info; click or keyboard to start
- **Mouse/Click Support**: Click songs to select and start, click lanes during gameplay, click to resume from pause or continue from results
- **Final Grades**: S/A/B/C/D letter grades based on performance
- **High Scores Per Song**: Persistent best scores for each track
- **Neon Glow Effects**: Lane separators, hit zone circles, notes, and combo text all rendered with bright neon glow using canvas shadowBlur/shadowColor; double-draw technique for intensified glow
- **Neon Particle Explosions**: Dramatic multi-layered particle bursts on hits -- PERFECT triggers sparkle + burst + secondary ring + white core flash; GREAT triggers burst + sparkle + glow ring; GOOD triggers burst + sparkle; all use neon colors matching the lane
- **Screen Flash on Perfect Hits**: Full-screen neon-colored flash overlay on PERFECT judgments and combo milestones, fading out rapidly
- **Pulsing Neon Combo Counter**: Combo text with elastic bounce animation, black outline stroke, neon glow shadow, and bright white core re-draw; multiplier display also scales on hit
- **Note Trail Effects**: Each falling note has a gradient comet-tail streak above it plus a separate trail particle system emitting neon-colored particles that float upward behind notes
- **Background Beat Pulse**: Background color/brightness pulses in sync with the song BPM, with a radial vignette pulse from the hit zone center; lane tints and separator glow also pulse with the beat
- **Expanding Glow Rings**: Double-ring effect on PERFECT (outer yellow + inner neon lane color), single ring on GREAT, with inner bright white line for extra depth
- **Visual Effects**: Neon lane flash column gradient on hit, neon-glowing hit zone line, escalating screen-shake on consecutive misses, floating accuracy text with multiplier display
- **Particle Effects**: Rank-scaled neon particles with physics (gravity, friction, fade); red neon burst + sparkle on miss; extra confetti + sparkle burst at combo milestones
- **Smooth Animations**: Time-based note scrolling, lane glow effects, BPM-synced combo glow on hit zone that shifts from yellow to magenta at high combos

## User Stories

### Core Gameplay
- [x] As a user, I can hit falling notes using the D/F/J/K keyboard keys across 4 lanes so that I experience rhythm game flow
- [x] As a user, I can click on lanes with the mouse to hit notes as an alternative to keyboard controls
- [x] As a user, I can select songs from a song selection screen using click or keyboard so that I choose my preferred difficulty
- [x] As a user, I can see timing accuracy feedback (Perfect, Great, Good, Miss) for each note hit so that I know how well I am performing
- [x] As a user, I can pause the game with Escape and resume so that I can take breaks during songs

### Combo & Scoring
- [x] As a user, I can build combos for score multipliers (x2/x3/x4) that reset on a miss so that accuracy is rewarded
- [x] As a user, I can see celebratory confetti and floating notifications at combo milestones (10, 30, 50, 100)
- [x] As a user, I can see a pulsing combo display with color-coded milestones (white/yellow/orange/magenta)
- [x] As a user, I can receive a final letter grade (S/A/B/C/D) based on my performance so that I have a clear goal to aim for
- [x] As a user, I can see persistent high scores per song via localStorage so that I can track my improvement
- [x] As a user, I can see a results screen after each song showing my grade, score, max combo, and hit breakdown

### Visual Effects & Particles
- [x] As a user, I can see neon glow effects on lane separators, hit zone circles, notes, and combo text using canvas shadowBlur
- [x] As a user, I can see neon lane flash column gradients on successful note hits
- [x] As a user, I can see expanding double glow rings on Perfect-rated hits (outer yellow + inner neon lane color)
- [x] As a user, I can see dramatic multi-layered neon particle explosions on note hits, scaled by rating
- [x] As a user, I can see a full-screen neon flash on Perfect hits and combo milestones
- [x] As a user, I can see an elastic-bouncing pulsing neon combo counter with outline stroke and white core glow
- [x] As a user, I can see gradient comet-tail trails and neon trail particles behind falling notes
- [x] As a user, I can see the background pulse in sync with the song BPM (color shift, radial vignette, lane tint pulse)
- [x] As a user, I can see screen-shake on misses that escalates on consecutive misses
- [x] As a user, I can see floating accuracy text with multiplier display
- [x] As a user, I can see smooth time-based note scrolling and BPM-synced lane glow effects

### Audio
- [x] As a user, I can hear procedural music via Web Audio API with unique melody, bass line, hi-hat, and kick drum per song
- [x] As a user, I can hear hit/miss sound effects providing audio feedback for timing accuracy

### Planned
- [ ] As a user, I can import custom song files to play with my own music
- [ ] As a user, I can adjust note scroll speed in settings for a personalized difficulty
- [ ] As a user, I can see hold notes that require sustained key presses for long tones
- [ ] As a user, I can play songs with increasing difficulty tiers that unlock as I achieve higher grades
- [ ] As a user, I can see a practice mode that slows down specific sections of a song

## Controls

| Key | Action |
|-----|--------|
| D / F / J / K | Hit notes in lanes 1-4 |
| Enter / Click | Select song / Continue |
| Arrow Up/Down | Navigate song list |
| Mouse Click | Click song rows, click lanes during gameplay |
| F2 | New game / Back to song select |
| Escape | Pause / Resume |

## How It Works

1. Select a song from the song selection screen
2. Notes fall from the top toward the hit zone at the bottom
3. Press the correct key (D/F/J/K) when a note reaches the hit zone
4. Timing determines your judgment: Perfect > Great > Good > Miss
5. Build combos for higher score multipliers
6. After the song ends, receive a letter grade (S/A/B/C/D)

## Architecture

- `index.html` -- Page structure, canvas, menu bar and dialogs
- `js/` -- the game under `SZ.RhythmGame`, one module per domain, loaded in dependency order:
  - `js/core/namespace.js` -- pre-creates the module objects; `js/core/constants.js` -- canvas size, lane geometry, timing windows, neon palettes, state names, storage keys; `js/core/state.js` -- the one shared state object with counters, lane flash and effect timers; `js/core/dom.js` -- canvas/context and the particle/shake/text singletons; `js/core/os.js` -- canvas scaling, window-title updates and the window-procedure plus resize registration
  - `js/data/songs.js` -- the song table with scales and per-song note frequencies
  - `js/systems/audio.js` -- the Web Audio synth engine: music voices, hit sounds, mute sync; `js/systems/scoring.js` -- hit judgement and miss handling with combo and multiplier effects; `js/systems/song.js` -- song start/end, selection and the new-game reset; `js/systems/flow.js` -- the per-frame playing update: note spawning, scrolling and miss expiry
  - `js/core/rules.js` -- note generation, lane positions, multiplier and grade math; `js/render/lanes.js` -- lane background and hit zone; `js/render/notes.js` -- falling notes, glow rings and the combo display; `js/render/screens.js` -- song select, results and pause overlay; `js/render/board.js` -- one frame in order
  - `js/ui/highscores.js` -- high-score persistence and dialog; `js/ui/status.js` -- the status bar; `js/ui/input.js` -- auto-pause, keyboard and pointer control; `js/ui/menu.js` -- menu bar and dialog wiring
  - `js/app.js` -- loaded last: canvas setup, mute sync, the reset to song select and the requestAnimationFrame game loop
- `styles.css` -- Layout and theming
- `icon.svg` -- Desktop icon
- `tests/` -- a Node harness runs the whole page in a recorded fake DOM with a seeded RNG and a virtual clock; the boot test pins the entire session (song select, a full played song, pause, results, menu actions) by effect digest

## SEO Keywords

rhythm game, music game, note highway, timing game, beat game, D/F/J/K keys, combo system, score multiplier, letter grade, browser game, web game, canvas game, SynthelicZ, WebOS game, rhythm action
