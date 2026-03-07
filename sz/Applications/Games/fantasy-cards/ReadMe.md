# Fantasy Cards

A deck-building card battler for the SynthelicZ Desktop. Collect from 55 unique magical cards across five types, build a 30-card deck, choose a difficulty level, and battle an AI opponent in strategic turn-based combat with mana management, elemental combos, buffs, debuffs, and shields.

## How It Works

Each match pits the player against an AI opponent. Both sides start with 50 HP, a 30-card deck, and 3 starting mana. Each turn, mana regenerates (maximum grows by 1 per turn up to 10), a card is drawn, and the active player can play cards from their hand as long as they have enough mana. Cards deal damage, add shield, heal HP, buff own stats, or debuff the opponent. Playing two cards of the same elemental combo type in one turn triggers a synergy bonus of +2 power. The match ends when either side's HP reaches zero. Three AI difficulty levels control how the opponent selects cards.

## User Stories

### Card Collection
- [x] As a user, I can browse a collection of 55 unique cards across 5 types: Attack (15 cards), Defend (10), Heal (10), Buff (10), Debuff (10)
- [x] As a user, I can see each card with its mana cost, power value, type icon, color-coded background, description, and flavor text
- [x] As a user, I can see card types color-coded: Attack (red), Defend (blue), Heal (green), Buff (gold), Debuff (purple)
- [x] As a user, I can hover over any card to see a detailed tooltip with full card information including mana cost, power, type, and flavor text

### Deck Building
- [x] As a user, I can open a deck builder from the menu screen to customize a 30-card deck from the full collection
- [x] As a user, I can add cards to the deck by clicking available cards and remove cards by clicking deck slots
- [x] As a user, I can start with a default deck of the first 30 cards if no custom deck is built
- [x] As a user, I can see card counts and visual type distinctions in the deck builder

### Combat Mechanics
- [x] As a user, I can play Attack cards to deal damage to the AI (damage = card power + combo bonus + damage buff), reduced by opponent shield first
- [x] As a user, I can play Defend cards to gain shield points that absorb incoming damage before HP
- [x] As a user, I can play Heal cards to restore HP up to the maximum of 50
- [x] As a user, I can play Buff cards to increase own ATK and DEF stats, gain bonus mana (Mana Surge), or draw extra cards (Swift Feet)
- [x] As a user, I can play Debuff cards to strip ATK and DEF buffs from the opponent
- [x] As a user, I can trigger elemental combo synergy (+2 bonus power) when playing two cards of the same combo type (fire, storm, frost, shadow, holy, nature, arcane) in one turn

### Mana System
- [x] As a user, I can start each game with 3 maximum mana, growing by 1 each turn up to a cap of 10
- [x] As a user, I can see my mana fully refill at the start of each turn
- [x] As a user, I can only play cards whose cost does not exceed current mana
- [x] As a user, I can see mana shimmer particles when mana is spent

### Turn System
- [x] As a user, I can draw one card at the start of each turn (hand limit of 7 cards)
- [x] As a user, I can play any number of cards per turn as long as mana permits
- [x] As a user, I can end my turn manually by pressing E or clicking the End Turn button
- [x] As a user, I can watch the AI take its turn with a visible delay between card plays for readability
- [x] As a user, I can start with a 5-card opening hand drawn from a shuffled deck

### AI Difficulty
- [x] As a user, I can select Easy difficulty where the AI plays random valid cards
- [x] As a user, I can select Normal difficulty where the AI evaluates card priority by type and situation
- [x] As a user, I can select Hard difficulty where the AI uses strategic scoring with health awareness, combo seeking, and optimal mana usage

### Visual Effects
- [x] As a user, I can see card-play glow sparkle particles in the card's color when a card is played
- [x] As a user, I can see damage burst particles on the target when attack cards hit
- [x] As a user, I can see floating damage/heal/shield/buff numbers rising from the affected character
- [x] As a user, I can see shield sparkle particles when defend cards are played
- [x] As a user, I can see screen shake on big damage hits (10+) and on victory/defeat
- [x] As a user, I can see mana shimmer effect near the mana bar when mana is spent
- [x] As a user, I can see buff indicators displayed visually during combat
- [x] As a user, I can see turn transition text ("Opponent Turn" / "Your Turn") animate between turns

### Menu and UI
- [x] As a user, I can start the game from a menu screen with card type legend and game info
- [x] As a user, I can view a multi-page How to Play tutorial overlay
- [x] As a user, I can choose difficulty level from the menu screen
- [x] As a user, I can see health bars for both player and AI with shield indicators
- [x] As a user, I can see a mana bar showing current and maximum mana
- [x] As a user, I can see the deck pile with remaining card count
- [x] As a user, I can see AI cards face-down in the opponent's hand area

### Persistence and OS Integration
- [x] As a user, I can see my top 10 high scores persist via localStorage
- [x] As a user, I can view and reset high scores from the dialog
- [x] As a user, I can see the window title update to reflect game state (playing, victory, defeat)
- [x] As a user, I can access Game menu (New Game F2, Pause Esc, Deck Builder, High Scores, Exit) and Help menu
- [x] As a user, I can see the game respond to window resize and theme changes

### Planned
- [ ] As a user, I can hear sound effects for card plays, damage, healing, and victory/defeat
- [ ] As a user, I can save my custom deck selections across sessions via localStorage
- [ ] As a user, I can unlock new cards through a progression system with card rarity tiers
- [ ] As a user, I can see status effects with duration tracking (e.g., poison ticks with visible timer)
- [ ] As a user, I can customize the AI opponent's deck to create varied matchups

## Controls

| Input | Action |
|---|---|
| Mouse Click | Select / play card, end turn, navigate menus |
| Mouse Hover | Show card tooltip with full details |
| 1-9 | Play card by hand position (left to right) |
| E | End Turn |
| D | Toggle Deck Builder |
| F2 | New Game / Restart |
| Escape | Pause / Resume |

## Technical Details

- Canvas-based rendering at 800x560 logical pixels with devicePixelRatio scaling
- IIFE pattern with `window.SZ` namespace; no build step required
- requestAnimationFrame game loop with delta-time capped at 50ms
- 55 cards defined as data objects with id, name, type, cost, power, color, description, flavor text, and combo affinity
- 7 combo element types: fire, storm, frost, shadow, holy, nature, arcane
- AI turn processing uses a timer-based delay (0.5-0.8s) between card plays for visual clarity
- Shared effects library: ParticleSystem, ScreenShake, FloatingText
- OS integration via SZ.Dlls.User32 (SetWindowText, RegisterWindowProc for WM_SIZE, WM_THEMECHANGED)
- localStorage persistence with `sz-fantasy-cards-` key prefix
- Deck reshuffles discard pile when draw pile is empty

## Known Limitations

- No audio or sound effects
- Custom deck selections do not persist across sessions
- No multiplayer or online play; single-player vs AI only
- No card rarity system or progression unlocks
- AI always uses a default deck; cannot customize AI decks
- No status effect duration tracking (poison ticks down by 1 each turn)
