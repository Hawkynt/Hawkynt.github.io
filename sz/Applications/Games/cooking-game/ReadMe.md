# Cooking Game

Restaurant time-management game — in-game titled **Bistro Rush** — running inside the »SynthelicZ« Desktop. Take orders, cook multi-step dishes on a five-station line, serve guests before their patience runs out and bank the tips into a seventeen-upgrade kitchen tree, across five venues from a food truck to a grand hotel.

## How It Works

Guests walk in and sit at the counter. Clicking a guest — or the order bubble over their head — takes the order, and a ticket hangs on the rail between the pass and the kitchen. Every recipe is a run of station steps on the Grill, Stove, Oven, Prep Board and Plating station; the ticket routes itself to the first free slot of the station its next step needs, so the only decision is when to stop each step.

Each running step shows a bar with a green perfect zone and a red burn field. Clicking the station, or pressing its number key 1-5, stops the needle: inside the zone the step is perfect, outside it but before the burn it is ok, stopping more than 0.12 before the zone leaves it raw, and letting the needle pass 1.25 burns it. A dish is only as good as its worst step — one raw or burnt step ruins it.

Finished dishes arc onto the pass, four slots by default, and clicking one carries it to the guest waiting for that dish. The tip scales with dish quality (perfect ×1.0, good ×0.75), the guest's remaining patience, the guest type and a combo multiplier that grows with consecutive perfect serves up to ×2 and breaks on a walkout or a ruined dish. A trash bin beside the pass swallows ruined dishes before they reach a guest.

The career runs thirty days across five venues, six days each: every day is busier, quicker and less patient than the one before, and three dollar goals award 1-3 stars — at least one star unlocks the next day. Endless Rush rotates the venue every eight guests served and tightens the clock until three walkouts or three ruined dishes end the run; the Daily Special plays a menu seeded from the date, the same for everyone. Everything is drawn in a 1280 × 720 logical view that letterboxes to any window size.

## Architecture

- `index.html` — Entry point with SEO meta, menu bar, canvas, status bar, dialogs
- `styles.css` — Layout and theming
- `icon.svg` — Desktop icon (pan + steam + star)
- `kitchen-data.js` — Pure data and rules: the five stations, twelve recipes, five locations, the 30-day career, six customer types, the quality/tip/star math, a seeded rng and the endless-day generator; loads in node for the tests
- `kitchen-ui.js` — Shared drawing kit: one panel style, auto-fitting and wrapping text, chips, keycaps, meters and headlines
- `food-art.js` — The twelve dishes, station sprites in four animation states and ticket step icons, painted once into cached 2x canvases; the draw calls only blit
- `people-art.js` — Chibi customers in six types, the chef and the mood bubbles, assembled procedurally from a random look and cached per (look, pose, frame)
- `scene-art.js` — Five restaurant interiors painted once into a seeded 1280 × 720 canvas, with ambient layers (truck traffic, diner neon, bistro lamp glow, sakura petals, chandelier glints)
- `controller.js` — IIFE game engine: menu screens, day loop, customers, stations, serving, waiter, upgrade tree, HUD, effects, persistence and OS integration
- `tests/` — Node test scripts: `kitchen-data.test.js` (data shape, quality/tip/star rules, rng), `kitchen-ui.test.js` (text fitting against a fake context), `food-art.test.js`, `people-art.test.js` and `scene-art.test.js` (module contracts, no shadowBlur, blit-only draws)

## User Stories

### Orders & Customers
- [x] As a player, I can click a seated guest or the order bubble over their head to take the order so that a ticket appears on the rail and cooking can start
- [x] As a player, I can meet six guest types — Regular, Kid, Businessperson, Tourist, Food Critic and VIP — with patience multipliers from ×1.15 down to ×0.7 and tip multipliers from ×0.7 up to ×2.5 so that the crowd changes the strategy
- [x] As a player, I can see the better-paying guests join the mix as the career advances — critics from day 1-3, businesspeople from 1-4, tourists from 2-1 and VIPs from 3-1 — so that later days feel weightier
- [x] As a player, I can meet at most one food critic per day so that the critic stays a special event
- [x] As a player, I can watch a patience ring drain green, then yellow, then red around each order bubble so that I know how long a guest will wait
- [x] As a player, I can lose a guest when their patience hits zero — they storm out, the combo breaks and the walkout count rises — so that slow service has consequences
- [x] As a player, I can see guest moods shift from happy to impatient to angry as they wait so that the room reads at a glance
- [x] As a player, I can see orders avoid a third repeat of the same dish in a row so that the queue never reads as a broken record
- [x] As a player, I can see a VIP arrive with sparkles and a short red carpet so that the ×2.5 tipper feels big
- [x] As a player, I can see a served critic hold up a 1-5 star score card on the way out (perfect 5, good 3, otherwise 1) so that I know how the dish scored
- [x] As a player, I can watch served guests eat for two seconds, drop crumbs and wave goodbye so that service feels human

### Stations & Cooking
- [x] As a player, I can work five stations — Grill (key 1), Stove (2), Oven (3), Prep Board (4), Plating (5) — so that every dish is a run of timed steps
- [x] As a player, I can see a taken ticket route itself to the first free slot of the station its next step needs so that I only decide when to stop each step
- [x] As a player, I can click a station or press its number key to stop the needle so that timing is the whole skill
- [x] As a player, I can see each step's bar with its green perfect zone and red burn field so that the target is always visible
- [x] As a player, I can land a step as perfect (inside the zone), ok (outside the zone but before the burn), raw (stopped more than 0.12 before the zone) or burnt (past 1.25) so that precision pays
- [x] As a player, I can ruin a whole dish with a single raw or burnt step so that every step of every dish matters
- [x] As a player, I can see a step past 1.0 enter a burning state — smoke, a jittering station, a blinking red frame — until it self-burns at 1.25 so that I get a warning
- [x] As a player, I can run two steps at once on upgraded stations so that the line keeps up with a busy room
- [x] As a player, I can watch the chef walk to the station I last touched and cheer, flip or chop so that the kitchen has a cook in it

### Serving & Tips
- [x] As a player, I can see finished dishes arc from plating onto the pass — four slots by default — so that finished work is visible
- [x] As a player, I can click a dish on the pass to carry it to the guest who ordered it, its owner first and any waiting guest with the same order after, so that serving is one click
- [x] As a player, I can earn tips scaled by dish quality (perfect ×1.0, good ×0.75), the guest's remaining patience (×0.6 to ×1.2), the guest type and the combo so that fast perfect service pays best
- [x] As a player, I can build a combo with consecutive perfect dishes — +1 each, +2 with Showmanship — lifting the tip multiplier up to ×2 so that a hot streak compounds
- [x] As a player, I can see the combo break on a walkout or a ruined serve so that mistakes sting
- [x] As a player, I can see COMBO ×3, ×6 and ×10 banners with a gold edge glow as the streak grows so that a run is celebrated
- [x] As a player, I can click the trash bin to toss a ruined dish so that it never reaches a guest
- [x] As a player, I can see 3 to 8 coins fly from the guest to the earnings meter with every tip so that the money feels earned
- [x] As a player, I can see a dish whose guest already left fly back to the pass with a 'Gone!' so that a mistimed serve is not wasted
- [x] As a player, I can hire the Waiter upgrade to carry matching dishes to guests automatically a beat after they land so that my hands stay on the line

### Recipes
- [x] As a player, I can cook a Burger ($14: grill patty 3.0 s, assemble 1.2 s) as the quickest two-step dish so that the first days stay easy
- [x] As a player, I can cook a Salad ($12: chop greens 1.6 s, toss 1.0 s) so that a fast board order is always available
- [x] As a player, I can cook Tacos ($18: grill meat 2.6 s, chop salsa 1.4 s, fill shells 1.2 s) so that grill and board have to alternate
- [x] As a player, I can cook Pancakes ($16: whisk batter 1.4 s, flip pancakes 2.4 s, syrup 1.0 s) so that the stove joins the rotation
- [x] As a player, I can cook Pasta ($22: boil pasta 3.2 s, simmer sauce 1.8 s, plate 1.0 s) so that two stove steps must run back to back
- [x] As a player, I can cook a Pizza ($26: knead dough 1.6 s, bake 4.0 s, slice 1.0 s) so that the oven's long bake has to be planned around
- [x] As a player, I can cook a Steak ($34: season 1.2 s, sear steak 3.6 s, garnish 1.2 s) so that a tight grill zone tests timing
- [x] As a player, I can cook a Curry ($28: chop veg 1.5 s, simmer curry 3.8 s, serve rice 1.0 s) so that a long simmer shares the stove
- [x] As a player, I can cook Sushi ($36: cook rice 2.8 s, slice fish 1.8 s, roll maki 1.4 s) so that the sushi bar has its signature dish
- [x] As a player, I can cook Ramen ($30: boil broth 3.6 s, cook noodles 2.0 s, top bowl 1.2 s) so that two stove steps and a plate finish line up
- [x] As a player, I can cook a Cake ($40: mix batter 1.6 s, bake cake 4.6 s, frost 1.6 s) so that the hotel demands the longest bake and a careful frost
- [x] As a player, I can cook a Lobster ($48: boil lobster 3.4 s, char claws 2.2 s, butter & plate 1.2 s) as the priciest dish so that the grand hotel ends on its hardest order

### Locations & Career
- [x] As a player, I can run five venues — Food Truck (3 seats: burger, salad, tacos), Corner Diner (4: + pancakes, pasta), Le Bistro (4: salad, pasta, pizza, steak, curry, pancakes), Sakura Bar (5: sushi, ramen, curry, salad, tacos, steak) and Grand Hotel (5: cake, lobster, steak, sushi, pasta, pizza, ramen, curry) — so that each stop has its own menu and room
- [x] As a player, I can play 30 career days, six per venue, where guests grow from 6 to 24 a day, the spawn interval tightens from 5.2 s to 2.55 s and patience drops from 30 s to 14.5 s so that the pressure ramps steadily
- [x] As a player, I can chase three dollar goals per day that award 1-3 stars — day 1-1 asks for $50 / $70 / $100, day 5-6 for $480 / $670 / $870 — so that each day has a graded target
- [x] As a player, I can unlock the next day with at least one star, and a locked venue tells me which day to win first, so that the career is a gated path
- [x] As a player, I can see day 3 of every venue marked as a critic day and day 6 as a rush day with a pulsing red vignette so that special days stand out on the map
- [x] As a player, I can see my stars and best earnings on every day button of the career map so that progress is legible
- [x] As a player, I can keep a day's money even when the day fails so that a bad run still feeds the upgrade tree

### Modes
- [x] As a player, I can play the 30-day Career across the five venues so that the game has a campaign
- [x] As a player, I can play Endless Rush, where the venue rotates every 8 guests served, the spawn interval tightens from 4.6 s toward a 2.2 s floor and patience from 28 s toward 16 s, until 3 walkouts or 3 ruined dishes end the run, so that skill has no ceiling
- [x] As a player, I can play the Daily Special — one seeded menu of 20 guests per calendar date, the same kitchen, guests and orders for everyone — so that a day is comparable between players

### Kitchen Upgrades
- [x] As a player, I can buy Second Grill ($300) so that the grill runs two steps at once
- [x] As a player, I can buy Second Burner ($350) so that the stove holds two pots
- [x] As a player, I can buy Prep Helper ($400, needs Second Grill) so that a second prep board runs alongside the first
- [x] As a player, I can buy Double Oven ($650, needs Second Burner) so that two dishes bake at once
- [x] As a player, I can buy Hot Burners ($150 / $320 / $650) so that every step runs 10% faster per level
- [x] As a player, I can buy Precision Timers ($200 / $450) so that every perfect zone is 15% wider per level
- [x] As a player, I can buy Non-stick Pans ($380, needs Hot Burners) so that the burn point moves from 1.25 to 1.45
- [x] As a player, I can buy Comfy Seats ($150 / $320 / $650) so that guests wait 12% longer per level
- [x] As a player, I can buy Extra Stool ($800, needs Comfy Seats II) so that one more guest fits at the counter
- [x] As a player, I can buy the Waiter ($1200, needs Comfy Seats I) so that finished dishes are served to matching guests automatically
- [x] As a player, I can buy Charm School ($200 / $450 / $900) so that tips grow +10% per level
- [x] As a player, I can buy Showmanship ($600, needs Charm School I) so that a perfect dish adds 2 combo instead of 1
- [x] As a player, I can buy Fancy Decor ($900, needs Charm School II) so that plain regulars are re-rolled once toward critics and VIPs
- [x] As a player, I can buy Warming Shelf ($250) so that the pass holds two more dishes
- [x] As a player, I can buy Pre-chopped ($300) so that prep board and plating steps run 30% faster
- [x] As a player, I can buy Second Chance ($700, needs Pre-chopped) so that once per day a step about to burn is saved as ok
- [x] As a player, I can buy the Rush Hour Bell ($1000, needs Warming Shelf and Hot Burners) so that once per day I can press B and run every station 50% faster for 10 seconds

### Visual Effects
- [x] As a player, I can see grill sparks, pot steam, wood chips on every knife stroke and grey smoke while a step burns so that the kitchen breathes
- [x] As a player, I can feel a screen shake when a step burns so that failure lands physically
- [x] As a player, I can see step verdicts pop at the station — PERFECT!, Oops!, Good, Saved! — and tips float up from guests so that feedback is immediate
- [x] As a player, I can see up to 9 tickets on the rail with step icons, done-steps ticked and the current step's key highlighted so that the whole queue is readable
- [x] As a player, I can see the combo chip grow a flame at ×3, ×6 and ×10 so that the streak is visible without looking at numbers
- [x] As a player, I can see the Rush Hour bell count down and a gold glow ring the screen while it runs so that the boost is unmistakable
- [x] As a player, I can see a red tension vignette pulse on rush days and whenever three guests wait at once so that pressure shows at the screen edge
- [x] As a player, I can see confetti, sparkles, crumbs, expanding rings and coins flying to the HUD so that every event has a flourish
- [x] As a player, I can see all food, people and room art pre-rendered into cached 2x canvases and blitted per frame — no blur filters anywhere in the art — so that the whole show stays smooth

### Sound
- [x] As a player, I can hear synthesized sound effects built from oscillators and filtered noise — no sound files — so that the kitchen has audio without downloads
- [x] As a player, I can hear a different arrival call for each station kind and chopping thuds in step with the knife animation so that the line sounds like work
- [x] As a player, I can hear the same effect never fire more than once per 40 ms so that coin showers and chopping stay a rhythm instead of a wall of noise
- [x] As a player, I can hear the coin chirp rise in pitch with the size of the tip so that big tips sound big
- [x] As a player, I can hear a win or lose jingle at the end of every day and a score-card sting when a critic leaves so that the day's verdict is audible
- [x] As a player, I can mute through the shared speaker button — remembered across games — and the audio goes quiet while the page is hidden so that sound never fights the player

### Menus & Controls
- [x] As a player, I can start from a title screen offering Career, Endless Rush, Daily Special, Kitchen, Recipe Book and Help so that every mode is one click away
- [x] As a player, I can navigate every screen with mouse hover or the arrow keys and Enter so that the game is fully playable without a mouse
- [x] As a player, I can press Escape to pause and resume, and F2 to return to the title for a new game so that the flow is always controllable
- [x] As a player, I can press 1-5 during a day to stop the matching station and B to ring the Rush Hour Bell so that the hands never leave the keys
- [x] As a player, I can press H on any menu for a four-page help book — orders, cooking, serving, modes & upgrades — and page through it with the arrows so that the rules are in-game
- [x] As a player, I can browse the Recipe Book, where recipes from venues I have not reached yet show as silhouettes with a question mark so that the full menu teases the career
- [x] As a player, I can find Resume, Restart Day and Menu on the pause panel so that a bad day is never a dead end
- [x] As a player, I can trust the game to auto-pause when the window hides or loses focus so that real life never costs me a day

### Persistence
- [x] As a player, I can bank coins from every day — won or lost — into a save that carries into every mode so that the upgrade tree always grows
- [x] As a player, I can keep my best star rating and best earnings for each career day so that the map reflects my best run
- [x] As a player, I can keep a best score for Endless Rush and a best per date for the Daily Special so that the challenge modes have records
- [x] As a player, I can accumulate lifetime stats — days played, dishes served, perfect dishes — so that long-term progress is tracked
- [x] As a player, I can open the top 10 high scores by tips from the Game menu so that personal records are reviewable
- [x] As a player, I can have the save — coins, stars, upgrades, bests and stats — kept in localStorage so that the empire survives a reload
