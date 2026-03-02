# Fantasy Cards

A deck-building card battler for the SynthelicZ Desktop. Collect 50+ unique magical cards, build 30-card decks, and battle AI opponents in strategic turn-based combat.

## User Stories

- **S-031**: As a player, I want to collect magical cards, build decks, and battle opponents in a strategic card game with unique abilities and synergies, so that I experience fantasy card battling.
- **S-032**: As a player, I want fantasy cards to have card-play glow effects, damage burst particles, mana shimmer, and smooth card draw/play animations, so that card battles feel dynamic.
- **S-000**: As a player, I want shared visual effects (particles, screen shake, floating text) so that the game feels polished.

## Features

- **50+ unique cards** across 5 types: Attack, Defend, Heal, Buff, Debuff
- **Mana system** with per-turn regeneration and card costs
- **Deck builder** with 30-card deck limit and card selection from collection
- **AI opponent** with 3 difficulty levels: Easy, Normal, Hard
- **Card synergies and combos** for strategic depth
- **Health bars** for player and opponent
- **Turn-based combat** with end-turn mechanic
- **Card draw animation** with smooth entry into hand
- **Card-play glow effect** on activation
- **Damage burst particles** on attack hits
- **Floating damage numbers** rising from targets
- **Mana shimmer effect** when mana is spent
- **Screen shake** on big hits and critical combos
- **High score tracking** with localStorage persistence
- **OS integration** (window title, theme, resize)

## Controls

| Input       | Action                     |
|-------------|----------------------------|
| Mouse Click | Select / play card         |
| 1-9         | Play card by hand position |
| E           | End Turn                   |
| D           | Toggle Deck Builder        |
| F2          | New Game / Restart         |
| Escape      | Pause / Resume             |

## Card Types

| Type   | Description                             |
|--------|------------------------------------------|
| Attack | Deal damage to opponent                  |
| Defend | Add shield points to block damage        |
| Heal   | Restore health points                    |
| Buff   | Boost own stats (damage, shield, mana)   |
| Debuff | Weaken opponent (reduce damage, slow)    |

## AI Difficulty

- **Easy**: Plays random valid cards
- **Normal**: Evaluates card priority by type and situation
- **Hard**: Strategic scoring with health awareness, combo seeking, and optimal mana usage

## Architecture

- IIFE pattern with `window.SZ` namespace
- Canvas-based rendering at 800x560
- Shared libraries: game-effects.js (ParticleSystem, ScreenShake, FloatingText), menu.js, dialog.js
- OS integration via SZ.Dlls.User32 (SetWindowText, RegisterWindowProc)
- localStorage persistence with try-catch for file:// compatibility

## SEO Keywords

fantasy card game, deck building, card battler, browser game, turn-based strategy, collectible cards, mana system, AI opponent, card combos, web game, SynthelicZ Desktop
