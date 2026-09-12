# Doodle Games quality recovery plan

Date: 2026-09-10. Status: implementation started after the user's “implement”. The first padel candidate is implemented. Hands-on quality gates remain open.

## Implementation checkpoint

The first implementation covers padel movement and braking, stable receiver selection, render snapshots, timed racket poses, practice placement targets and immediate feeds, touch look, viewport fitting, pooled effects and batched static ink. The detailed evidence and blocked device checks live in [feel-baseline.md](feel-baseline.md).

All 123 automated tests pass. This is not acceptance of the technical performance or enjoyment targets below: browser navigation timed out, and real-device playtests have not been completed. Padel provides a developer-only `?feel=1` comparison for original movement/raw steps versus responsive movement/interpolation, with identical practice seeds and local frame statistics. This comparison retains the other new features in both modes; it is not a full copy of the previous release.

Next checkpoint: play this padel candidate in all three views, collect frame data and assess contact, assistance and touch ergonomics. Address those findings before extracting the new padel helpers or migrating the other eleven games. Golf and surf remain the next proving grounds in the sequence below. No new game is added by this delivery.

## Goal and scope

Make the existing twelve games responsive, readable and rewarding enough to invite another round. Use [Doodle District](https://doodleshooter.vercel.app/) as the reference for responsiveness, camera comfort, animation and feedback, while preserving each game's own rules and the original notebook artwork. Surf additionally uses Kelly Slater's Pro Surfer (2002) as a gameplay reference; Sheep uses Sheep (2000).

Pause new-game additions during this programme. Keep the existing games accessible. Preserve all three requested views, mouse/keyboard/touch support, explicit charge cancellation, the public repository, static Three.js architecture, GitHub Pages hosting and inspiration credits. Improve the best default camera for each sport, then validate its other two views. Shared conventions should not force identical physics or actions on unrelated sports.

The first substantial delivery is one excellent padel experience. Do not call the collection polished because a new helper, feature list or simulation test suite exists. No multiplayer, account system, engine migration or extra games are needed for this plan.

## Evidence and uncertainty

Reviewed the current repository, shared standards, input/camera code, padel simulation, renderer and character animation, and existing quality records. Remote main at planning time is `84a27989afdd4a61aff5fec650d74eee64bd106d`. The last complete suite passed 108 tests; these establish rules and progression, not enjoyable play.

Confirmed source findings:

| Finding | Why it deserves work | Starting files |
| --- | --- | --- |
| Padel advances player position directly at the requested speed and derives velocity afterward | There is no explicit acceleration/braking model to tune starts, stops or direction changes | `padel/simulation.js`, `movePlayer` |
| Padel renders the latest fixed-step positions directly | Motion can show uneven stepping when display and simulation cadence differ; measure before/after | `padel/main.js`, `padel/render.js` |
| A successful hit launches the ball before setting the swing animation timer | Visible racket contact is not the event responsible for the shot | `padel/simulation.js`, `shared/racket-player.js` |
| Padel predicts interception inside every player-update tick | This is a profiling candidate, not yet a measured bottleneck | `padel/simulation.js`, `updatePlayers` |
| Shared cameras wrap render and resize methods, update projections and read canvas bounds repeatedly | Input, simulation, presentation and camera ownership are difficult to reason about and tune together | `shared/cameras.js`, `shared/first-person.js` |
| Native game handlers and the first-person adapter both own parts of pointer aiming | Mode changes and charge/aim precedence need a simpler explicit contract | Game `main.js` files and shared input modules |
| Previous quality passes had no completed browser playtest | We have no reliable comfort, frame-pacing or novice-usability baseline | `docs/quality-review.md` |

These findings do not prove the precise cause of every complaint. The shooter webpage is a client-rendered application; retrieving it as text did not establish how it plays. Its current movement timings and performance have not been measured. Phase 0 must collect those observations rather than invent them.

## Milestone 0: establish an honest baseline

Play the shooter and every collection game. Capture comparable short sessions: moving in a circle, reversing direction, aiming while moving, charging/cancelling, interacting with a target, changing camera and restarting. Include a full representative game loop, not only a lobby screenshot. Record unfamiliar-player reactions to the objective and first action.

Use a declared device matrix: desktop Chrome/Edge at 60 Hz and a high-refresh display, a lower-powered desktop, Android Chrome and iPhone Safari. Test mobile portrait and landscape. Start from fixed desktop and phone viewport sizes for reproducibility; real-device checks remain necessary for touch, thermals and browser pointer behaviour. If access is unavailable, mark the affected checks blocked and do not award the visual/interaction quality gate.

Add developer-only local instrumentation for frame-time distribution, simulation/render/HUD costs, input-to-visible-action timing, allocation spikes and GPU draw calls. Record warm-up separately from steady gameplay. Run a ten-minute soak on representative devices. No backend or player telemetry is required.

Deliverables: `docs/feel-baseline.md`, short before recordings, a device matrix and a ranked defect list. Every issue has reproduction steps, expected behaviour, affected games and whether it is observed or inferred. Rank unusable controls first, recurring discomfort second, depth and presentation after them.

Exit: reproducible evidence identifies padel's highest-impact three defects and the worst shared regression. Do not delay a clearly broken control merely to complete every exploratory measurement.

## Milestone 1: make padel the quality reference

Build a short practice rally and one complete quick-match experience. Use these as the same repeatable scenarios for every tuning pass.

1. **Movement:** explicit, time-based acceleration and braking; responsive reversal; separate visual facing from movement; stable boundary sliding; manual control clearly wins over assistance. Tune assisted positioning and partner switching so they do not surprise the player. Start with a small set of parameters, measure them and retain before/after comparisons.
2. **Presentation timing:** previous/current simulation snapshots with render interpolation for players and ball. Keep current input and first-person mouse orientation responsive instead of adding smoothing everywhere. Reset snapshots at serves, teleports, restarts and camera switches to avoid interpolation across discontinuities.
3. **Camera:** stable court framing, readable ball height, smooth intentional follow and safe geometry handling. First-person look must not jump when the controlled partner changes. Keep the play target visible in portrait. Retain top and third-person options and test each, rather than assuming a selector establishes support.
4. **Contact:** visible preparation, contact and recovery phases; short action buffering; consistent reach; recognisable forehand, backhand, volley, lob and smash. Align the physical strike with the visible contact beat without imposing sluggish wind-ups. Explain misses through positioning, timing or height, rather than silent failure. Existing legal serves and wall rules must survive.
5. **Feedback:** distinct ball/racket, ground, glass and net audio; grounded footwork; readable shadow and restrained ball trail; subtle impact effects. Make sound and camera motion optional. Scoring feedback should confirm the outcome without covering the next action.
6. **Rally quality:** opponents and partner create reachable openings, recover to sensible positions and make understandable mistakes. Difficulty changes reaction, placement and tactical choices. Verify that assisted play still requires deliberate human shot decisions.

Exit: padel passes the technical budgets and hands-on rubric below, then is reviewed in a concrete playable preview. The player should feel a clear improvement in movement, aiming and contact before the work is propagated. This is the first user review point, not a request to approve abstract architecture.

## Milestone 2: extract only the proven shared pieces

Refactor the working padel solution into explicit modules, migrating incrementally with regression coverage:

| Component | Responsibility |
| --- | --- |
| Input state | One owner for held controls, discrete actions, device switching and charge/cancel lifecycle; sport-specific action mapping |
| Frame loop | Bounded fixed simulation steps, presentation snapshots, interpolation and lifecycle reset |
| Camera rig | Explicit top/third/first modes, viewport cache, camera-relative movement, ray/reticle aiming and optional pointer lock |
| Motion helpers | Time-based acceleration, braking and bounded steering with parameters owned by each game |
| Presentation events | Contact-timed animation, sound, particles and score feedback, independent of authoritative rules |
| UI and settings | Responsive control placement, sensitivity, reduced motion, sound and optional assistance with saved preferences |

Replace renderer interception with an explicit update order as each game migrates: capture input, advance simulation, prepare interpolated presentation, update the chosen camera, draw, then update changed HUD fields. Test aim projection against the displayed camera. Cache layout measurements until resize, avoid needless per-frame DOM writes and pool transient effects where profiling justifies it.

Do not add a heavyweight framework or general-purpose engine. Precision games do not need avatar acceleration; skiing must retain downhill momentum; sheep remain autonomous agents. Extract shared code only after the behaviour is proven in play.

Exit: padel retains its measured feel and a second representative game can adopt the modules without duplicating input logic or changing its rules.

## Milestone 3: repair the most criticised experiences

Work on golf and surf next. Each gets a complete playable revision and a before/after comparison before the next broad migration.

- **Golf:** stable aiming from the ball, comfortable fine adjustment, charge with a clear commitment/release beat, visible club contact, readable landing/roll, useful green slope information and appropriate shot-follow framing. Three holes should offer genuinely different safe and aggressive shot choices. A novice should aim and take a successful shot using the mouse without relying on arrow-key workarounds.
- **Surf:** evaluate whether the current representation can support fluid wave riding. If it still behaves like a sideways lane game, replace that movement/scene foundation. Prioritise a controllable line on a continuous wave face, speed earned through carving, readable lip transitions, believable launches and landings, and a barrel you can deliberately enter and escape. Retain combos and Special only where they support that loop. Free surf must be enjoyable before extra challenges or progression are added. Keep the original ink style and original assets.

Exit: golf and surf meet the same quality gates as padel, with sport-specific exceptions explained. More tricks, bigger scores or a new camera angle alone do not close this milestone.

## Milestone 4: bring every game to the same quality floor

Migrate in small batches. After each batch, smoke-test all already migrated games and run the full rules suite. The table states the intended depth improvement, not a claim that every listed behaviour is currently broken.

| Order | Game | Focus and playable proof |
| --- | --- | --- |
| 1 | Padel | Movement/contact reference; a complete readable rally and quick match |
| 2 | Golf | Mouse-first precision, shot weight and meaningful club/line choices across three holes |
| 3 | Surf | Continuous carving and wave interaction; a satisfying free-surf session with deliberate safe landings |
| 4 | Pickleball | Adopt proven racket movement/contact, preserve kitchen rules; distinct dink, drive and lob decisions |
| 5 | Football | Possession and first-touch feel, pass selection, purposeful off-ball runs and readable switching; one coherent build-up to a shot with all 22 players |
| 6 | Water polo | Swimming inertia, useful spacing, clear pass/shot wind-up and goalkeeper response; a purposeful attack under the clock |
| 7 | Ski | Edge control, speed management, course readability, ramp transitions and landings; different lines trade risk against race time |
| 8 | Sheep | Predictable pressure and flock response, readable panic, smooth obstacle navigation and camera tracking; solve a route through herding decisions without inexplicable sticking |
| 9 | Pool | Fine cue alignment, contact feedback, readable collision and roll, useful positional planning; a short deliberate run of shots |
| 10 | Curling | Delivery weight, sweep response and path readability; choose meaningfully between a draw, guard and take-out |
| 11 | Petanca | Tangible throw weight, clear landing/roll and distance feedback; compare placing, lobbing and displacing a rival |
| 12 | Climbing | Reach preparation, hand/foot contact, upward camera continuity and recovery; choose safe versus risky moves in a readable race |

Use two reusable migration batches where possible: racket/team movement and precision/turn-based games. Surf, ski, climbing and sheep need individual motion models and dedicated playtest scenarios. Do not flatten them into the same movement demo for consistency.

## Milestone 5: mobile and collection release gates

Mobile is part of each milestone, followed by a final collection pass. Build layouts for two-thumb play. Preserve separate ownership of movement and actions, allow interrupted gestures to cancel cleanly, and prevent HUD/actions from covering the ball, contact area or immediate route. Use at least 48 CSS pixel primary touch targets with clear separation; respect safe areas. A thumb should not need to leave movement to perform a normal primary action. Precision games should work with one-finger aiming plus an explicit charge/action control.

Offer a playable onboarding task per family: return a ball, complete a pass, land a shot, carve a turn, or bring one sheep home. Explain additional actions only when useful. Restart should resume the same challenge quickly, retaining chosen settings. Keep all games accessible from the existing homepage and label the revised experience accurately; do not claim collection-wide polish until all twelve pass.

Publish small reversible commits through the existing GitHub workflow. Use a separate preview branch/deployment or supported local preview for feel comparisons when available. Keep a known-good revision for rollback. Update `AGENTS.md`, `MECHANICS.md`, `DESIGN.md` and the quality review after validated behaviour changes, rather than repeatedly accumulating untested promises.

## Acceptance criteria

These are proposed initial budgets. Confirm them against named reference devices in Milestone 0 and document any justified adjustment. They are not measured claims about the current site or the shooter.

| Area | Required evidence before marking a game polished |
| --- | --- |
| Frame pacing | Target sustained 60 FPS on the agreed mainstream devices; after warm-up, 95th-percentile frame time at or below 20 ms and 99th at or below 33 ms in a representative five-minute run. Profile any repeated hitch over 50 ms. Define a stable reduced-quality fallback for devices that cannot meet the baseline. |
| Input response | Input feedback appears by the next rendered frame in steady play. Measure end-to-end input-to-visible response separately; target under 50 ms on the declared 60 Hz reference machine, excluding intentional charge duration. |
| High refresh | The same simulation outcomes and control rates at 30/60/120/144 Hz render schedules; no speed changes tied to render FPS. |
| Control integrity | No ghost actions, stuck movement or aim jumps through charge cancel, player switch, modal, pointer-lock loss, blur, resize and restart. |
| Camera comfort | Complete the core loop in all three views. No unexplained camera snaps or persistent geometry obstruction. Aim/movement agree with the visible view. Record actual desktop and mobile checks. |
| Contact | Animation, physical result and audiovisual feedback visibly agree. Clear misses and successes in representative slow-motion review. |
| Mobile | Complete the same core challenge in portrait and landscape on Android Chrome and iPhone Safari; controls remain reachable and do not obscure the immediate play area. |
| Learnability | In an initial small test with five unfamiliar players, at least four complete the first core action within 30 seconds using in-game guidance rather than coaching. Recruit only through an authorised channel; do not message people automatically. |
| Enjoyment | As a small-sample review gate, at least four of five prefer the revised version to the previous one for control/readability, and at least three choose another round. Record why people stop. These are qualitative gates, not statistically established retention claims. |
| Depth | Demonstrate at least two viable strategies or shot/route choices with understandable trade-offs. Waiting, holding one action or one dominant tactic must not trivialise the main challenge. |
| Regression | Full existing rules/progression suite plus targeted new tests and a recorded hands-on check. Passing tests alone cannot satisfy the feel gate. |

The user is an essential reviewer of whether the experience meets the intended direction. Small playtests complement that judgment; test counts do not override it. If a required device or browser is unavailable, continue safe implementation work but leave that quality gate explicitly incomplete.

## First implementation delivery

1. Record padel's current behaviour and the shooter reference on an available real browser.
2. Build a padel practice scene with tunable acceleration, braking and camera settings.
3. Add presentation interpolation and fix strike/animation timing.
4. Verify mouse and touch in the three views, then provide a playable before/after comparison.
5. Review that concrete result before propagating it to the other games.

Do not promise a calendar completion date before this slice is profiled and playtested. It will establish the cost of the remaining migration and which games need deeper rebuilding. The collection should advance by demonstrated improvement, one playable milestone at a time.
