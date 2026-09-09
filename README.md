# Doodle Games

Nine original hand-drawn sports games built with Three.js and no build step:

- `padel/`: doubles padel with glass-wall rebounds, partners, opponents, serves, rallies, and scoring.
- `football/`: 11 versus 11 football with AI teams, passing, shooting, keepers, restarts, offside, and match time.
- `golf/`: nine-hole stroke play with clubs, wind, slopes, bunkers, water, penalties, and a scorecard.
- `waterpolo/`: 7 versus 7 water polo with swimming, passing, shooting, steals, goalkeepers, four quarters, and a possession clock.
- `petanca/`: singles pétanque to 13 points, three boules each, movable jack, collisions, three throwing styles, AI opponent, touch controls, and a Spanish interface.

- `pickleball/`: doubles with diagonal serves, the two-bounce rule, kitchen faults, dinks/lobs/drives/smashes, and traditional side-out scoring.

- `curling/`: eight stones each, curl, sweeping, collisions, guard protection, hammer and end scoring, AI or local two-player play.
- `pool/`: 8-ball with solids/stripes, pocket and cushion physics, fouls, ball in hand, called-eight wins, AI or local two-player play.
- `climbing/`: head-to-head 15 m climbing race with charged reaches, grip, flow, falls, false starts and three opponent levels.

## Play

Visit [doodle.ckgrafico.com](https://doodle.ckgrafico.com/) or run `npm start` locally.

Hold left click to charge, release to play, right click to cancel. Keyboard and touch alternatives remain available in all games. The menu previews use the actual illustrated game scenes.

## Inspiration

We are **super, super, SUPER inspired** by the visual world [Evan Milenko shared here](https://x.com/EvanMilenko/status/2096356126145015885), and by [Doodle District](https://doodleshooter.vercel.app/). All gameplay, code, shaders, models, UI, and course designs in this repository are original fan work. No affiliation or endorsement is implied.

## Standards for future games

Start with [AGENTS.md](AGENTS.md), [MECHANICS.md](MECHANICS.md), and [DESIGN.md](DESIGN.md). Every new-game request includes a review of all existing games and improvements to shared quality. See the [collection review](docs/quality-review.md) for findings and verification limits.

## Commands

```sh
npm test
npm run check
npm start
```

Three.js is vendored under its MIT license. Patrick Hand is bundled under the SIL Open Font License.
