# Curling and 8-ball pool

Research checked on 2026-09-08 before implementation:

- [World Curling, What is curling?](https://worldcurling.org/about/curling/): alternating deliveries, house scoring, last-stone advantage, draws/guards/take-outs, and sweeping's effects on travel and curl.
- [Curling Canada, Rules of Curling](https://www.curling.ca/rules/): opponent free guards cannot be removed by the first five deliveries.
- [WPA rules page](https://wpapool.com/rules/) and [linked rulebook](https://wpapool.com/wp-content/uploads/2026/01/2026.01.02-WPA-Rules.pdf): break, open table, groups, ball in hand, fouls, called shots and eight-ball outcomes. The document identifies its effective date as 2025-09-15.

These are arcade adaptations. The full implemented control contract and omissions are recorded in MECHANICS.md and in each game's help. In particular pool accepts uncalled ordinary pots and unrestricted placement after break scratches; curling compresses the sheet and does not model no-tick or team/brush regulations. They should not be presented as exact competition simulators.

Use the tested simulation functions rather than duplicating scoring or collision decisions in a renderer. `shared/discs.js` handles equal-mass planar contact, while each sport owns its boundary, friction, scoring and turn rules. `shared/charge.js` owns mouse lifecycle. Seeded AI uses the same physics as human shots.
