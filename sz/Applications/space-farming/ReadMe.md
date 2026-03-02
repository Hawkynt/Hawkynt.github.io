# Space Farming

Casual farm simulation on a space station for the SynthelicZ Desktop. Grow crops through growth stages, tend livestock, survive space weather events, and sell produce for credits.

## User Stories

- **S-023**: As a player, I want to grow crops, tend livestock on a space station, manage resources through space weather events, and customize my farm layout, so that I experience casual space farming.
- **S-024**: As a player, I want space farming to have crop-growth sparkle effects, harvest particle bursts, weather visual overlays, and smooth planting/harvesting animations, so that farming feels relaxing and satisfying.
- **S-000**: Common infrastructure (SEO, manifest, dialogs, persistence, OS integration).

## Features

- **Grid-based farm** with 8×6 plantable tiles
- **7 crop types**: Space Wheat, Star Fruit, Nebula Berry, Lunar Lettuce, Cosmic Corn, Crystal Melon, Solar Tomato — each with unique growth times, stages, and sell prices
- **4 livestock types**: Space Cow (milk), Star Hen (eggs), Nebula Goat (wool), Crystal Chick (feathers) — feed and collect resources
- **Growth stages** with visual progression and sparkle particle effects at each stage change
- **Planting animation** with scale bounce and sparkle burst
- **Harvest particle burst** when collecting mature crops
- **Space weather events**: Solar flares boost crop growth; meteor showers damage/destroy crops
- **Weather visual overlays** with glow effects
- **Shop system**: Sell produce for credits, buy seeds and livestock
- **Floating income text** showing earnings and costs
- **High scores** tracking credits earned and days survived
- **Day/night cycle** with day counter

## Controls

| Input | Action |
|-------|--------|
| Click/Tap tile | Plant selected crop / Harvest mature crop |
| Click/Tap livestock | Feed and collect produce |
| 1-7 | Select crop type |
| S | Sell all produce |
| F2 | New game |
| Escape | Pause / Resume |

## Game Mechanics

### Crops
Each crop has a growth time, number of stages, seed cost, and sell price. Crops advance through stages automatically. When a crop reaches its final stage (mature), it can be harvested.

### Livestock
Livestock produce resources periodically. Click on a pen with a ready indicator to collect. Each animal type has a different feed interval and produce value.

### Space Weather
- **Solar Flare**: Doubles crop growth speed for the duration
- **Meteor Shower**: Randomly destroys ~20% of planted crops

### Economy
Start with 100 credits. Buy seeds to plant, purchase livestock, and sell harvested produce and collected resources for profit.

## SEO Keywords

space farming game, browser farming simulator, space station farm, crop growing game, livestock management, space weather farming, casual farming game, SynthelicZ desktop game, HTML5 farming game, idle farm game
