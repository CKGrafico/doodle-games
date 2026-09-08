# Shared mechanics and controls

## The common feel

Doodle District provides the action-game reference: immediate player agency, visible targets and consequences, responsive feedback, separate game/menu states, and explicit help. Its first-person shooter camera and pointer-lock input are specific to that game. They are not requirements for these sports.

Padel is the local gameplay baseline: move and aim independently, use a small set of distinct shots, see the active player and ball, receive clear point/restart feedback, play against functioning teammates/opponents, and finish or restart a match. Its rules live in a deterministic simulation rather than the renderer.

Every game must offer a complete loop: understand the objective, make a deliberate input, see a predictable physical result, understand the score/turn change, and reach the next playable state. Match depth comes from positioning, timing, placement, and sport rules, not from an ever-growing set of keys.

## Canonical controls

The canvas must have focus for gameplay shortcuts. Inputs, links, buttons, and selects retain their native keyboard behavior. In-game help and visible controls must match this table.

| Intent | Padel | Football | Water polo | Golf | Petanca | Pickleball |
| --- | --- | --- | --- | --- | --- | --- |
| WASD / arrows | Move | Move | Swim | A/D aim, W/S power | A/D direction, W/S distance | Move |
| Mouse movement | Aim on court | Aim pass/shot | Aim pass/shot | Aim shot | Aim throw | Aim on court |
| Space / primary action | Drive / serve | Pass / restart | Pass | Swing | Place jack / throw | Drive / serve |
| E / right click | Lob | Loft / cross | Lead pass | Cycle club | Cycle throwing style | Lob |
| Q | Smash | Shoot | Shoot | Unassigned | Select shooting style | Smash |
| Tab | Switch partner | Switch player | Switch player | Native focus | Native focus | Switch partner |
| F | Unassigned | Tackle | Steal | Unassigned | Unassigned | Dink |
| Shift | Sprint | Sprint | Faster swim | Unassigned | Unassigned | Sprint |
| Esc / P | Pause | Pause | Pause | Pause | Pause | Pause |
| ? | Help | Help | Help | Help | Help | Help |

Pickleball adds F = dink, a soft shot toward the kitchen. All movement games support sprinting by pushing the touch stick fully; the shared threshold is 85%. Padel and pickleball both expose a touch partner-switch button.

Football retains J = shoot, K = through pass, L = loft. Water polo retains J = shoot and K/L = lead pass. Golf retains 1–4 = driver, iron, wedge, putter. These are aliases, not different primary controls.

Two intentional exceptions preserve the sport:

- Golf and petanca are stationary precision games. WASD changes the shot, not an avatar's location. Their UI shows power/distance and the selected club/style. A separate click on Swing/Lanzar works after aiming with sliders.
- Padel and pickleball support held shots for contact timing and continuous rallies. Football and water polo actions are discrete attempts. Consume a queued action once in a fixed simulation step, never once per rendered frame; do not repeat it through multiple catch-up steps.

On touch screens, tap the playing surface to aim without firing. Movement games provide a captured joystick and named action buttons. Precision games provide sliders/selects and a separate primary button. Every desktop core action needs a touch equivalent, including player switching and defense. Touch cancellation and loss of pointer capture must release movement/actions.

## Movement, aiming, and AI

- Convert screen movement using the current camera orientation, including camera transitions. Normalize diagonals. Never hard-code a camera angle for a view that can change.
- Manual movement overrides movement assistance. Assistance positions a player; it does not silently choose and execute the human's shot. Show the assist state accurately after restart.
- Mark the controlled player and provide a visible aim marker, trajectory, or projected landing information appropriate to the sport. Keep the ball readable through height cues, contrast, and motion feedback.
- AI must create playable opportunities: support positions, receivers, defensive coverage, attempts on goal, or legal turn-based throws. Avoid everyone pursuing the same point.
- Give possession changes and tackles a coherent recovery window. An instant steal-back loop that resets decision time before a carrier can act is a failure, even if the match clock completes.
- Clamp movement to legal space and stop at a target rather than stepping past it every frame. Random AI choices must use a seed for repeatable regression tests.

## Simulation and lifecycle

Use a bounded fixed timestep (currently 1/120 second for padel, pickleball and petanca; 1/60 for football, golf and water polo), with rendering separate from physics. Pause/help/results stop gameplay time and input. Blur and hidden tabs clear input and pause an active game. Closing a dialog clears stale actions before returning to play. Restart/rematch clears the previous game's state, timers, input, and score.

Use swept crossings for fast goals and cup contact. Score from the ball's position and height at crossing, not from its later resting position. Define whether the whole ball must cross and account for its radius at posts/crossbars.

Loading must not allow a broken start. WebGL failure or context loss must stop the loop, disable starting, and present a reload/recovery action. Audio is optional and begins from user interaction; play cannot depend on audio availability.

## Minimum depth by sport

| Game | Mechanics that must survive future changes | Meaningful verification |
| --- | --- | --- |
| Padel | Four players, diagonal underarm service, two-bounce limit, legal glass/fence distinctions, drive/lob/smash, service order and scoring | Legal serves from all positions, wall faults, lets, rallies, match completion at each difficulty |
| Football | 22 players, passing/through/loft/shoot, possession, goalkeepers, halves/change of ends, restarts and offside | Both teams complete passes and attempt goals; valid/invalid goals; possession recovery; restarts and full time |
| Water polo | 14 players, swimming, pass/lead/shoot/steal/switch, opposing goalkeepers, four quarters and possession clock | Keepers at opposite ends; clock survives same-team passes; turnovers can restart; high shots miss; both teams attack |
| Golf | Club differences, power and aim, wind, terrain, bounce/roll, cup, penalties, hole progression and score | Preview matches physics; hazards penalize; cup contact scores once; all selected holes can advance |
| Pickleball | Four players, diagonal serve, two-bounce rule, kitchen volleys/momentum, drive/lob/smash/dink, two-server side-out scoring | Service order and receiver positions, kitchen and net faults, first versus second bounce out, win-by-two and complete matches |
| Petanca | Three boules each, jack placement, point/lob/shoot, boule/jack collisions, closest-side turn logic, end scoring to 13 | Collisions transfer momentum; ties/dead jack; legal turns; complete seeded match |

Pickleball uses classic doubles to 11 or quick games to 5, win by two. Held shots wait for compulsory bounces. It uses an enlarged ball/reach, point-centre line calls, assisted underarm serves/arcs and a foot/stopping-distance approximation of volley momentum. Net clips end the rally; spin, body/net contact and around-post play are not fully modeled. See [pickleball research](docs/pickleball.md).

These are arcade adaptations, not full tournament simulators. Document omitted rules in each game's help. The water polo implementation deliberately uses a simple 30-second team-possession timer, reset on an opponent gaining possession or a restart, with no shot-rebound reset, exclusions, fouls, or penalty throws. It does not claim to implement current tournament regulations. Padel uses the scoring options described in its help; petanca is singles; golf uses simplified stroke-and-distance penalties.

## Performance and future additions

Do not run a complete predictive simulation and allocate a new geometry every idle animation frame. Cache prediction by the inputs that change it. Reuse materials, buffers, and shared shader logic; dispose resources when replacing a course or scene.

Every future new-game task must include the collection review in AGENTS.md. Compare control meaning, responsiveness, feedback, AI progression, sport depth, pause/restart, and touch accessibility across all games. Improve common weaknesses together and record the evidence in `docs/quality-review.md`.

## Charged mouse input across all eight games

Left click on the playing surface now starts a bounded 1.1-second charge; release executes the selected action once. A short click gives a soft attempt. The visible meter caps at full power and never auto-fires. Right click during charging cancels; right click while idle keeps the sport’s existing secondary action. Keyboard and touch retain their explicit actions and selected power. Game buttons, sliders, links and native focus keep their ordinary behavior.

Padel and pickleball offer a mouse shot selector and a 220 ms release buffer, cleared on contact or rally transition. Power changes pace while preserving the target and assisted net clearance; service pace remains assisted and fixed. Football and water polo offer pass/shoot choices, require possession to begin charging, and consume releases only in physics steps. Pass and shot speed respond to power. Movement keys remain usable while charging. Golf and petanca lock aim and update the trajectory during charging; cancellation restores the previous selected power/distance. Petanca maps the meter to 2–13 m, or 6–10 m while placing the jack.

Charges use pointer capture, are tied to the current game/turn/possession, and are cancelled by pause/help, blur, hidden tabs, pointer cancellation, restart, relevant keyboard actions and loss of capture. No pending release may carry into another point or turn. The shared implementation is `shared/charge.js`; the original six use `shared/sports-mouse.js`, and curling/pool use `shared/precision-app.js`.

| Intent | Curling | 8-ball pool |
| --- | --- | --- |
| Mouse move / touch tap | Aim delivery | Aim cue; position cue when ball in hand |
| Hold left click, release | Charge and deliver | Charge and strike |
| A/D or left/right | Fine direction | Fine direction |
| W/S or up/down; wheel | Selected weight | Selected power |
| Space / main button | Deliver selected weight; hold Space while sliding to sweep | Strike selected power; confirm cue placement when in hand |
| E / idle right click | Reverse handle rotation | Cycle called eight-ball pocket |
| Touch extra controls | Rotation, power, direction, hold SWEEP | Power, direction, called pocket, placement sliders and confirm |
| P / Escape; ? | Pause; help | Pause; help |

Curling: eight stones each, alternating turns, scoring stones touching the house, hammer transfer and blank ends, ties require extra ends, curl, friction, sweeping, take-outs, hog/side/back limits and five-rock guard protection. It uses a shortened sheet, enlarged stones, automatic release and the same camera direction every end; no no-tick, team-position or equipment regulation model. Choose 1/3/6 ends and AI or local two-player play.

Pool: a full 15-object-ball rack, cue ball, six pockets, rolling friction, elastic collisions, cushions, break legality, open table/group assignment, own-group continuation, wrong-first/no-contact/no-rail/scratch fouls, legal cue placement, and called-eight wins/losses. Eight on break is respotted; an illegal break reracks for the opponent. Deliberate arcade rules: only the eight requires a called pocket, ordinary pots may be uncalled, break scratches grant unrestricted ball in hand, planar balls cannot jump, and spin/physical stance/push fouls are omitted. AI and local two-player play are available. No online multiplayer is claimed.

Both new simulations use 1/120-second steps; pool adds four collision microsteps. Use the physics for trajectories and AI shots. Regression evidence must include actual potting/scoring and full seeded completion, not merely elapsed time. See [sport references and adaptations](docs/curling-pool.md).
