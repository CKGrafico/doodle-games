# Collection quality review

## Standing requirement

On every future new-game request, review **all** existing games and look for improvements, fix core regressions found, propagate shared improvements, and update this record. Read root AGENTS.md, MECHANICS.md and DESIGN.md first. The baseline is the shooter inspiration plus the accepted padel implementation, enriched by the best work in every later game.

## 2026-09-08: consistency and mechanics repair

| Game | Concrete findings | Changes |
| --- | --- | --- |
| Padel | Strongest established ink/rally baseline; camera movement derived from position instead of actual orientation; shortcuts could consume focused button input | Extract original ink shader into shared module; use camera-orientation movement; preserve native UI keyboard input; load shared theme |
| Football | Repeated tackles reset AI decision timers before carriers could act; click shot while Space passed; Q/E meanings diverged from padel | Give possession a recovery window and prevent instant steal-back; align Space/click, E/right-click, Q, Tab and F; preserve J/K/L aliases; share shader and theme |
| Water polo | Both keepers placed at same end; same-team passes reset clock; human keeper turnover difficult to release; goals ignored height at one crossing path; actions lost at high refresh; no player switch; inconsistent camera movement and pause behavior | Correct restart teams, possession ownership, swept goal height, goalkeeper control, attack decisions and separation; queue actions per physics step; add switch/touch aim; share lifecycle, controls, ink shader, silhouettes, target, trail and shadow |
| Golf | Next-hole button inherited pointer-events:none; touch did not explicitly aim on tap; no background pause; fixed camera still followed ball; predictive simulation and geometry rebuilt every frame | Restore callout button interaction; add touch aim, club cycling, arrows, state guards and lifecycle recovery; make overview fixed on course; cache prediction and geometry; restore ink rendering, visible swing and dispose old course resources |
| Petanca | Good turn/collision/scoring depth, but missing ? help shortcut and mouse primary action differed from Space; shader was a separate variation without the padel color-space path | Align mouse/Space and touch aim distinction, add E/style cycling, Q/shoot selection, arrows and ?; import shared ink shader and theme; retain Spanish UI and precision layout |

### Verification and limits

Validation passed: `node --test tests/*.test.mjs` (41 tests) and `node scripts/check.mjs` (57 files). The collection suite covers padel rules and complete seeded matches, petanca collisions/turns and a complete match to 13, football attacking progression at all difficulties, water polo ownership/keeper/clock/goal regressions and full quarters, golf prediction and round progression, and shared input/lifecycle behavior. Static checks cover scripts, local links/assets/imports, and the shared contracts.

A reproducible football run (seed 17, 180 seconds, club difficulty) improved from zero shots and a handful of passes to five shots per team, 67/76 attempted passes and 28/37 completed passes. This demonstrates recovery from the possession deadlock, not a claim of balanced or enjoyable AI. Separate seeds can score goals; a draw is still possible.

No browser visual or interactive playtest was performed in this repair. Mobile layout, shader appearance, camera comfort and subjective game feel still need hands-on assessment. Water polo and football remain simplified arcade AI; water polo omits detailed fouls and tournament shot-clock reset rules. No controller, online multiplayer or photorealistic sport simulation is claimed.

### Next review template

For every new game request, append the date and requested sport, an entry for **each** existing game, the issues/opportunities considered, fixes applied across affected games, any justified deferral, commands/results actually run, and whether browser/manual playtesting occurred. Update the control matrix and help together if a mapping changes.

## 2026-09-08: adding pickleball, reviewing all six games

The new request triggered a fresh review of every existing game's controls, help, simulation, renderer and tests, using the shooter principles and padel's implementation as the baseline.

| Game | Review and improvement decision | Evidence / remaining limits |
| --- | --- | --- |
| Padel | Found no touch partner-switch action despite Tab support. Added SWITCH and consumed its queued input in physics steps. Added full-stick sprint. Extracted its original characters and animation for reuse by pickleball without changing their appearance. | Existing service, glass/fence and seeded full-match tests retained. Shared character extraction checked by source and import validation; no visual playtest. |
| Football | Switch/tackle input could start a kickoff because every action counted as a kick. Restrict restart activation to ball actions. Added the shared touch sprint behavior. | A regression case verifies switch and tackle leave kickoff waiting, while pass starts play. Existing attacking-progress tests still run at all difficulties. |
| Water polo | Prior possession/keeper/goal fixes remain covered. The desktop sprint option had no touch equivalent; full stick now activates faster swimming. | Shared sprint activation/release test plus existing clock, turnover, goal-height and complete-match cases. No extra AI retuning without playtest evidence. |
| Golf | Penalty messages existed in simulation but were not shown while the next shot was ready. Added a visible live status message; disable club/power inputs during ball flight. | Existing hazard, preview/landing and full-round tests retained. Source checks verify the status element. Mobile panel ergonomics still need hands-on assessment. |
| Petanca | Reviewed precision controls, help, cached trajectory, collision rules and end progression. Keep its Spanish layout and mechanics; no new concrete defect identified in this pass. | Existing collision, tie/dead-jack and complete-match tests retained. No arbitrary edits merely to touch the folder. |
| Pickleball | Added a complete doubles game with kitchen play, two-bounce openings, distinct shots, traditional service rotations and quick/classic scoring. Shared padel characters, ink style, lifecycle and movement conventions. | Dedicated rule/physics tests, all-difficulty matches, and an assisted human-input quick match. Approximate contact/momentum and net-clip behavior documented in help. |

The homepage now links six games and retains the original inspiration credit. The control matrix, minimum mechanics, shared-code guidance and research notes were updated for future sessions.

Validation passed: `node scripts/check.mjs` (66 files) and `node --test tests/*.test.mjs` (56 tests). Browser visual/interactive playtesting was not performed. Do not interpret deterministic match completion as proof of enjoyable or balanced play. Future new-game requests must repeat this collection-wide review, including pickleball.

## 2026-09-08: curling, then 8-ball pool; mouse experience and real menu scenes

Reviewed the existing controls, simulation, renderer, help and regression coverage against the shooter-inspired interaction principles and padel baseline. Implemented curling first, verified complete end progression, then implemented pool. Incorporated the user's additional request to replace flat menu sketches with actual 3D scene previews.

| Game | Finding and change | Evidence / limit |
| --- | --- | --- |
| Padel | Immediate mouse holds lacked deliberate weight. Added selectable charged drive/lob/smash, bounded release buffering and real pace variation. Kept fixed assisted serves, movement and touch controls. | Default physics unchanged; power/contact tests and existing full matches pass. Buffer remains a timing aid, not automatic hitting. |
| Football | Existing shot power parameter was unused by mouse, and pass speed ignored it. Added possession-bound charging with pass/through/loft/shoot selection, power-scaled passes and restart weight. | Pass/shot velocity tests and full attacking-progression regression tests pass. |
| Water polo | Same mouse limitation as football. Added shared charging and selection; pass speed now responds to weight while preserving possession-clock semantics. | Power, keeper, turnover, goal-height and full-quarter regression tests pass. |
| Golf | Clicking fired immediately while precision adjustments were being made. Mouse now locks aim while charging, previews the selected weight and restores prior power on cancellation. | Existing preview/landing and round tests pass; launch power verified. Swing/Space remain direct. |
| Petanca | Applied locked-direction distance charging while preserving Spanish help, sliders and direct throw. Found the closest-distance line rebuilding geometry every idle frame and cached it. | Existing collision, turn, trajectory and match-to-13 tests pass. Mouse range bounds preserve jack placement rules. |
| Pickleball | Inherited charged selectable shots, bounded release timing and pace variation. Preserved compulsory bounces, kitchen faults and service assistance. | All-difficulty and held-human-input match tests pass; power defaults unchanged. |
| Curling | Added eight-stone turns, curl/sweep physics, take-outs, hog/side/back limits, five-rock protection, house scoring, hammer/blank-end rules, extra ends, AI and local two-player play. | Scoring/boundary/guard/sweep/contact tests plus two seeded three-end matches complete. Shortened sheet and omitted no-tick/brush rules disclosed. |
| 8-ball pool | Added full rack, six pockets, cushions/collisions, group assignment, legal break, eight respot, foul/ball-in-hand flows, called-eight outcomes, geometric AI and local two-player play. | Three seeded AI racks finish with legal called-eight wins and pots by both sides. Tests cover early eight, wrong pocket, scratches, wrong first/no rail, placement and fast pocket/cushion contact. Arcade call-shot and break-placement differences disclosed. |

Shared charge tests cover 30/60/144 Hz timing, one-shot release, pointer capture/release outside, stale turn, right-click cancellation, lost capture, blur, hidden tabs and disabled input. Physics tests verify power changes all eight sports. The homepage uses lazy, sequential one-frame captures of real game renderers, with per-sport framing, image alt text, a clickable fallback and resource disposal. No constantly running homepage match loops.

Validation: `node scripts/check.mjs` and `node --test tests/*.test.mjs` pass. The suite currently has 76 tests. No browser visual or interactive playtest was performed. Actual preview framing, mobile ergonomics, charge timing feel and AI enjoyment still need hands-on assessment; source/seeded simulation evidence does not establish those qualities. Root standards, both new games' help and references, all six earlier help screens and README were updated for future sessions. The user's remote CNAME change is preserved.

## 2026-09-08: climbing race and nine-game review

Reviewed all eight existing games before adding climbing race, including controls, rule simulations, help, renderers, menu previews and the 76-test baseline. The shooter-inspired principles and padel remain the interaction baseline. No concrete regression was found in the existing sports after the previous shared charging pass, so they were not changed merely to touch every folder.

| Game | Review decision | Evidence / remaining limit |
| --- | --- | --- |
| Padel | Preserve charged shot choice, buffered contact, walls and service order. | Existing full-match, service, wall and mouse-power tests retained. |
| Football | Preserve possession-bound charge, all 22 players, restarts and offside. | Existing full-match attack/possession tests retained. |
| Golf | Preserve aim-lock charging and cached trajectory. | Existing preview-to-landing and complete-round tests retained. |
| Water polo | Preserve possession clock, opposing keepers and power-scaled passing. | Existing goal-height, turnover and full-quarter tests retained. |
| Petanca | Preserve Spanish controls, distance charging and cached previews. | Existing collision, end scoring and match-to-13 tests retained. |
| Pickleball | Preserve buffered charged shots, kitchen and two-bounce rules. | Existing assisted-human and all-difficulty match tests retained. |
| Curling | Preserve sweeping, guard restoration, hammer and house scoring. | Existing seeded end completion and rule tests retained. |
| 8-ball pool | Preserve full rack, fouls, ball in hand and called-eight outcomes. | Existing fast collision and three seeded complete-rack tests retained. |
| Climbing race | Added two identical original lanes on a 15 m illustrated wall, charged hold-to-hold moves, safe and skip routes, grip cost, Flow combo, false starts, recoverable auto-belay falls, upward camera tracking and three AI levels. | Dedicated tests cover reach/power, false start, recovery, complete human route and seeded AI completion. The route is original and not a licensed standard wall. |

The homepage registers the climbing renderer and uses the same lazy one-frame scene capture as every other card. The preview contains the actual wall, holds, two climbers, ropes, pads and event structure. Root standards, README, control contract, help and sport research were updated so future additions must also review climbing.

Validation passed with `node scripts/check.mjs` and all 81 tests in the complete `node --test tests/*.test.mjs` suite. No browser visual or interactive playtest was performed. Camera framing, hold selection comfort, mobile button ergonomics and difficulty feel remain subjective and need hands-on assessment; seeded completion proves progression, not balance or enjoyment.

## 2026-09-09: collection touch review, surf and ski

| Game | Improvement / review result |
| --- | --- |
| Padel | Shared one-pointer joystick, proportional physical speed, larger touch targets, safe areas. Existing wall and match rules retained. |
| Football | Shared joystick and proportional speed; preserves the full 22-player match, passing, restarts and offside. |
| Golf | Drag-to-aim, surface size observation, compact lower mobile shot panel and larger input targets. |
| Water polo | Shared joystick and proportional speed, safe-area controls, existing possession and keeper rules retained. |
| Petanca | Drag-to-aim, surface size observation, bounded scrollable detail panel and reachable launch button. |
| Pickleball | Shared joystick and proportional speed preserve its acceleration and kitchen momentum rules. |
| Curling | Drag-to-aim, corrected start-time resize order, surface observer, field and controls fit a bounded mobile viewport. Sweeping retained. |
| Pool | Same precision improvements; drag supports ball placement and aiming without firing. Existing full-rack rules retained. |
| Climbing | Fixed cancellation incorrectly firing a MOVE; blocked target changes during charge, added touch dragging and surface observer. |
| Surf | Added three-wave heat, best-two scoring, pocket, cutbacks, pumps, lip airs, balance, energy and recoverable wipeouts. |
| Ski | Added twenty-gate downhill course, brakes, charged hops, collision, penalties and completed-run timing. |

Reviewed control implementations and physical movement across the existing collection. Added tests for actual analogue player speeds, dead-zone and diagonal limits, multi-finger ownership, surf heat scoring and air recovery, and full ski progression through all twenty gates. Shared input changes preserve the existing mouse charge contract. The menu registers both new renderers for bounded scene previews.

Validation: source checks and all 89 tests pass. Browser interaction and screenshots were not performed: the Sites environment has no compatible supervised preview for this plain static project. Touch ergonomics, camera framing and subjective difficulty need real-device testing. No claim of a browser playtest is made.

## 2026-09-09: surf/ski redesign and three views across all eleven games

The user found the original surf and ski games boring. The concrete weaknesses were passive surf scoring, nearly identical continuous movement loops, sparse obstacles, no ski competitors, weak trick feedback and mouse steering that kept pushing toward a boundary. Rebuilt both games around different choices and consequences rather than only adjusting their speeds. Padel's deliberate actions and pickleball's explicit feedback remain the collection baseline.

Surf now has committed cutbacks and snaps, timed barrel sections, charged pumps and right-lip launches, rotations and grabs, assisted landing alignment, unbanked combos that can be lost, repetition penalties, three wave layouts, whitewater, wave breaks, session challenges and local best heats. Idle play earns no score. Ski now has three AI rivals using the same rider physics, three courses, gate streaks, optional ramp and boost lines, charged jump preparation, airborne tricks, boost rewards, rock/near-miss handling and actual finish-order ranking. There are no invisible time penalties. HUD events, sounds, trails, spray, rider poses, feature labels and course previews were rebuilt with the existing ink materials.

The user then required Top view, 3rd person and 1st person everywhere. All eleven games use the same selector, camera adapter and per-game device-local preference. Existing third-person renderers remain the external-view baseline. The top view fits each playing area; climbing looks down the wall from above to retain visible holds. First person follows the athlete or delivery/shot position. The visible camera is also used for movement, ray aiming and projected labels; switching clears input, and the controlled model is hidden only during the first-person draw.

| Game | Camera and control review |
| --- | --- |
| Padel | Full-court top view and controlled-player eye view; camera-relative movement and shot aiming share the rendered camera. |
| Football | Full-pitch top view and active-player eye view facing the current direction of attack. |
| Golf | Hole overview and golfer-position first person, following the ball after a shot. |
| Water polo | Full-pool top view and swimmer-eye view facing the attacking end. |
| Petanca | Lane overview and throwing-circle first person; existing drag and slider aiming retained. |
| Pickleball | Court overview and active-player eye view; kitchen physics and shot buffering retained. |
| Curling | Sheet overview and delivery-position first person; sweeping and stone rules retained. |
| Pool | Table overview and a first-person pose behind the cue ball; native placement/shot controls retained. |
| Climbing | Overhead wall inspection and climber-eye view aimed at the next stretch of wall. |
| Surf | Rebuilt wave, trick and scoring loop; all three cameras track the same game. |
| Ski | Rebuilt race and route decisions with actual opponents; all three cameras preserve race state. |

Validation: `node scripts/check.mjs` and all 97 tests pass. New assertions cover idle versus active scoring, barrel dwell and uniqueness, combo loss/banking, actual 360 landings and failures, all three completed ski races with progressing rivals, gates, ramps, pickups, rocks, and charge/steering concurrency. Camera tests cover finite poses in all eleven sports, a ray-to-ground projection round trip, hidden/restored player geometry, movement orientation, and camera switching/resizing. All existing match and sport-rule regressions remain green.

No browser visual or interactive playtest was performed in this pass. The static project still lacks a compatible supervised preview in this environment. Tests establish progression and camera/input consistency, not enjoyment or perfect mobile framing. Real-device feel, first-person visibility in dense scenes and touch-overlay placement remain hands-on validation items. Future work must retain the user's three-view requirement and avoid treating more camera options as a substitute for meaningful gameplay.

## 2026-09-09: first-person mouse repair, surf reference redesign and Sheep

The user reported unusable first-person golf aiming and missing mouse look in movement games, rejected surf again and named Kelly Slater's Pro Surfer (2002), then requested a herding game inspired by Sheep (2000). These requests were handled together. The new-game review includes all twelve games and retains the shooter/padel baseline, common lifecycle, charge cancellation, touch controls and actual-scene menu previews.

| Game | Findings and action |
| --- | --- |
| Padel | Added relative yaw/pitch, centre aiming and opt-in mouse lock. Movement uses the rotated camera; aim remains movable while charging. Existing rally/service/wall rules retained. |
| Football | Same first-person mouse look and finite bounded aim target. Existing 22-player, possession, offside and restart rules retained. |
| Golf | Removed the first-person absolute-ray/rotating-camera feedback loop. Relative horizontal mouse aiming, Shift refinement, wheel power and locked direction during charge. First-person keyboard direction follows screen orientation. |
| Water polo | Shared mouse look and centre aiming, including an above-horizon finite target. Clock, keeper and ownership tests retained. |
| Petanca | Bounded relative heading with lower sensitivity, Shift refinement, wheel distance, preserved charge locking and Spanish help. |
| Pickleball | Shared look/movement/aim alignment, preserving charged contact timing, kitchen and bounce rules. |
| Curling | Fine relative first-person heading within existing bounds. Sweeping remains available during stone motion; no changes to scoring or guards. |
| Pool | Relative first-person aiming without reprojecting the moving cue camera, matching keyboard direction. Ball placement retains the ordinary table ray. |
| Climbing | Reviewed its hold-selection, locked charge, false-start and recovery paths. Existing touch/arrow targeting and three camera poses retained. No new defect identified. |
| Surf | Board heading and momentum replace direct lateral sliding. Descending builds speed; climbing spends it. A breaking curl catches slow lines. Barrels require balance and safe exit to score. Off-the-lip snaps, linked bottom turns, earned eight-second Special and endless Free surf extend the loop. Mouse steering is screen-relative, independent of camera rays. Lower side camera, broad ocean, breaking crest and new meters explain wave state. |
| Ski | Retains rivals, ramp/boost choices and physical race results. Shared ride input now allows W/up without cancelling a charge. Full-course tests still pass. No unsupported extra AI changes. |
| Sheep | Original three-level herding puzzle: autonomous flocking, dog pressure, renewable calming whistles, power/risk-scaled directional barks, obstructed calls, fence gaps, bridge, gate switch, tractor, quota and full-flock scoring, timed/relaxed modes, local stars and next/retry flows. All three views, first-person mouse look and real 3D menu scene. |

The sheep completion tests exposed an avoidable following gap: the whistle effect expired before its cooldown, and sheep close to the dog immediately fled again. Renewed following now overlaps cooldown and calm sheep can stay near the dog. The gate cannot close on sheep occupying its opening. The third level's successful route avoids the tractor's travel lane; blindly leading a flock into traffic can fail. This is deliberate route choice, not invisible scoring.

Validation passed: `node scripts/check.mjs` checked 123 files; `node --test tests/*.test.mjs` passed all 108 tests; `git diff --check` passed. New tests verify first-person input/camera/aim alignment, fine aiming, charge freeze, touch preservation, lock-loss cancellation, momentum and speed changes, safe and failed tube exits, earned/expired Special, endless surf, sheep pressure/calls/obstacles, exactly-once rescues/losses, gate safety, and complete seeded wins in every pasture using actual dog movement and whistles. Passing seeded play is evidence of reachable mechanics, not proof of fun.

Browser QA was attempted through the browser skill. Navigation timed out, then automatic approval review rejected recovery because the account usage limit was reached. No screenshot or interactive playtest is claimed. Pointer-lock behaviour in real browsers, mobile layout and subjective feel remain unverified. The supplied Sheep video could not be retrieved; the separate reference note identifies the accessible sources used instead. These limitations supersede the older blanket statement that this project has no possible browser path.

## 2026-09-10: first padel quality implementation

Implemented the first candidate from `docs/QUALITY-PLAN.md` after the user's instruction to implement. The detailed baseline, reproduction steps, device matrix and remaining gates are in `docs/feel-baseline.md`.

Padel now has short acceleration/braking and reversal ramps, boundary sliding, one assisted receiver decision per incoming stroke, predictable deliberate switching, interpolated player/ball snapshots and reset handling. Holding or charging prepares the racket; a strike records its contact pose and event together, followed by a distinct volley/drive/lob/smash recovery. Contextual hints explain range, bounce and height constraints. Warm-up adds three legal placement targets, preserved practice totals and immediate next-ball feeds.

The camera fits the usable canvas rectangle; mouse aiming and player-label projection account for its offset. First-person partner changes ease position without resetting yaw; padel adds one-finger touch look and persistent sensitivity. Touch shots keep ownership through extra fingers and cancellation. A two-by-two touch layout and separate stick reserve the court's space. Distance-driven footwork, a bounded ball-size aid, height guide, timed trail and pooled contact rings improve readability. Static court strokes and posts are grouped from 479 render objects into 15; this is a scene-graph count, not measured FPS.

The new motion, presentation and batching code stays in `padel/` until its quality gate is reviewed. Shared changes are small opt-in hooks for padel's render snapshot, touch look, sensitivity and stroke poses, plus a read-only selected-shot getter. Existing callers retain their defaults. Football, golf, water polo, petanca, pickleball, curling, pool, climbing, surf, ski and sheep have not been migrated to the new motion model; their existing rule and progression tests all pass.

Verification: all 123 tests, the 132-file source/resource check and `git diff --check` pass. New cases include the production fixed-step loop at five simulated display cadences, actual practice target completion, movement/assist ownership, contact timing, touch cancellation, camera geometry and preservation of static line segments. No camera comfort, frame-budget or fun acceptance is claimed.

Browser connection succeeded in this pass, but navigation and subsequent page inspection timed out. A fresh desktop playtest, Android/iPhone portrait and landscape checks, GPU/frame profiling and unfamiliar-player feedback remain open. The opt-in `?feel=1` panel provides a same-seed comparison and bounded local CPU/frame statistics without analytics. Padel needs that hands-on review before the planned shared extraction, golf/surf proving stages and collection rollout.
