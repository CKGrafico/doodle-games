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
