# Doodle Games

Twelve original hand-drawn games built with Three.js and no build step:

- `padel/`: doubles padel with responsive footwork, interpolated motion, distinct racket strokes, glass-wall rebounds, partners, opponents, legal service/scoring, and a placement-target warm-up.
- `football/`: 11 versus 11 football with AI teams, passing, shooting, keepers, restarts, offside, and match time.
- `golf/`: nine-hole stroke play with clubs, wind, slopes, bunkers, water, penalties, and a scorecard.
- `waterpolo/`: 7 versus 7 water polo with swimming, passing, shooting, steals, goalkeepers, four quarters, and a possession clock.
- `petanca/`: singles pétanque to 13 points, three boules each, movable jack, collisions, three throwing styles, AI opponent, touch controls, and a Spanish interface.

- `pickleball/`: doubles with diagonal serves, the two-bounce rule, kitchen faults, dinks/lobs/drives/smashes, and traditional side-out scoring.

- `curling/`: eight stones each, curl, sweeping, collisions, guard protection, hammer and end scoring, AI or local two-player play.
- `pool/`: 8-ball with solids/stripes, pocket and cushion physics, fouls, ball in hand, called-eight wins, AI or local two-player play.
- `climbing/`: head-to-head 15 m climbing race with charged reaches, grip, flow, falls, false starts and three opponent levels.

- `surf/`: momentum-based wave carving, safe barrel exits, lip airs, spins/grabs, Special mode, combos and endless Free surf.
- `ski/`: four-rider races on three courses, with clean-gate streaks, ramps, boost lines, airborne tricks and recoverable falls.

- `sheep/`: sheepdog herding through three original pasture puzzles, autonomous flocking, whistles, charged barks, fences, a bridge, gate, tractor, rescue quotas and stars.

Mobile controls share a stable analogue joystick, drag aiming and larger safe-area controls. See `docs/quality-review.md` for evidence and remaining real-device testing.

## Play

Visit [doodle.ckgrafico.com](https://doodle.ckgrafico.com/) or run `npm start` locally.

Hold left click to charge, release to play, right click to cancel. Keyboard and touch alternatives remain available in all games. The menu previews use the actual illustrated game scenes.

All twelve games offer **Top view**, **3rd person** and **1st person** in the View selector. The selected view is remembered per game on this device. Surf and ski also track local personal bests and three session challenges; their in-game help explains tricks, combos and race strategy.

First-person mouse controls: golf, petanca, curling and pool use relative horizontal aiming with Shift for precision and aim locked during charge. Padel, football, water polo, pickleball and sheep use mouse look, camera-relative movement, centre aiming and optional mouse lock. Esc releases the mouse. Top and third-person aiming retain their existing controls.

The [quality recovery plan](docs/QUALITY-PLAN.md) is underway. Padel is the first playable candidate: short acceleration/braking, consistent player selection, timed contact poses, clearer ball feedback, touch drag look, fitted mobile court space and quick practice retries. Append `?feel=1` to its URL for a seeded movement/rendering comparison and local frame statistics. See [baseline evidence](docs/feel-baseline.md) for the 123 passing tests and the still-open browser/device playtest gate. The other games await the staged rollout.

## Inspiration

We are **super, super, SUPER inspired** by the visual world [Evan Milenko shared here](https://x.com/EvanMilenko/status/2096356126145015885), and by [Doodle District](https://doodleshooter.vercel.app/). All gameplay, code, shaders, models, UI, and course designs in this repository are original fan work. No affiliation or endorsement is implied.

Surf gameplay also draws on Kelly Slater’s Pro Surfer (2002), and sheep herding on Sheep (2000). These are original interpretations, not ports; no original models, characters, maps, music or source code are included.

## Standards for future games

Start with [AGENTS.md](AGENTS.md), [MECHANICS.md](MECHANICS.md), and [DESIGN.md](DESIGN.md). Every new-game request includes a review of all existing games and improvements to shared quality. See the [collection review](docs/quality-review.md) for findings and verification limits.

## Commands

```sh
npm test
npm run check
npm start
```

Three.js is vendored under its MIT license. Patrick Hand is bundled under the SIL Open Font License.
