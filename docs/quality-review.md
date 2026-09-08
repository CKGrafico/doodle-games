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
