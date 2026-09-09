# Doodle Games: instructions for every future change

This repository is a collection, not a sequence of unrelated demos. The user explicitly requires consistent quality across all games and wants the earlier games to improve as the collection grows. These instructions persist for future sessions.

## Mandatory rule for every new game request

**Before creating another game, inspect every existing game, compare it with the shooter inspiration and the padel baseline, and look for improvements across the collection. Do this every time the user asks for a new game, even if they name only the new sport.**

1. Read this file, [MECHANICS.md](MECHANICS.md), [DESIGN.md](DESIGN.md), and the latest [collection quality review](docs/quality-review.md).
2. Discover the current game folders from the homepage and repository. Never assume a fixed list of games. Read each game's controls, simulation, renderer, help, and tests. Compare the strongest parts of each, not just the most recently added implementation.
3. Record a short review of every existing game: concrete defects, shared inconsistencies, worthwhile improvements, and evidence. Fix regressions and broken core interactions discovered in that review as part of the task. Apply useful shared fixes to every affected game. If something is deferred, state the reason and remaining limitation. Do not invent a defect just to modify every folder.
4. Build the requested sport on the common controls, ink rendering, lifecycle, and UI conventions. Preserve sport-specific depth. A game with a similar title screen but weak mechanics does not meet the requirement.
5. Run the collection checks and all simulation tests, including the existing games. Verify meaningful play progression, not just a clock reaching zero. Review mobile controls, keyboard focus, pause/resume, next-round flows, and failure recovery in the changed source. When interaction or visual testing is available and permitted, use it to assess actual feel and layout. Never describe source checks as a browser playtest.
6. Update the review, these standards if the contract changed, in-game help, and README. Report what was improved across the collection and any unverified aspects. Commit these records alongside the code so the next session inherits the decisions.

Quality work on the existing games is part of a new-game request, not an optional follow-up. Maintain or improve the collection's quality floor with every addition.

## Sources of truth and architecture

- Visual inspiration: [Doodle District](https://doodleshooter.vercel.app/) by Evan Milenko. Preserve the prominent homepage credit and [original post link](https://x.com/EvanMilenko/status/2096356126145015885). Do not imply endorsement or copy third-party implementation/assets.
- Local implementation baseline: `padel/`. Also reuse improvements from later games, such as petanca's turn feedback and golf's cached trajectory preview.
- Shared code: `shared/ink.js`, `shared/controls.js`, `shared/theme.css`, and `shared/racket-player.js`. Charged mouse input lives in `shared/charge.js` and `shared/sports-mouse.js`; stationary games can reuse `shared/precision-app.js` and `shared/board-view.js`. Fix common behavior here instead of introducing competing copies.
- Each sport keeps its own folder with `index.html`, `main.js`, `render.js`, `simulation.js`, and optional `rules.js`. Simulations must remain importable in Node without DOM, WebGL, or audio.
- Keep the static, no-build GitHub Pages site. Use relative URLs, vendored Three.js, local fonts, and the existing `/doodle-games/<sport>/` paths. Do not migrate hosting or add a backend for a routine game addition.
- Keep authored source readable. Do not hand-minify new code. Preserve unrelated changes and inspect the remote branch before publishing. Never force-push to bypass newer work.

## Required completion evidence

Run `node scripts/check.mjs` and `node --test tests/*.test.mjs` (also exposed as `npm run check` and `npm test`). The GitHub workflow repeats these checks on pushes and pull requests.

For mechanics changes, add targeted regression tests that would have caught the defect. For a new sport, cover its defining rule, valid and invalid scoring, restarts/turn transitions, and a complete seeded game or round. Check finite coordinates and reachable actions. Do not replace real progression assertions with “no exception” or “timer ended.”

Document what was actually tested, the remaining limitations, and deployment status. Passing tests is necessary evidence; it is not proof of enjoyable gameplay or a visually correct mobile layout.

## Mouse and menu requirements for future additions

The user requires deliberate mouse interaction: hold left click to charge, show power, release once to play, right click to cancel. Preserve keyboard and touch alternatives. Reuse the existing charge lifecycle and verify that power changes physics, cancellation cannot fire, and no release leaks into another turn. Precision aiming locks during a charge; movement sports keep movement available. Review all current games, including curling, 8-ball pool and climbing race, every time another sport is requested.

The collection menu must show each game's actual illustrated 3D scene with relevant players, equipment and surroundings, following the user's supplied pickleball scene reference. Do not return to flat CSS court icons. Register new games in `menu.js` and use bounded, lazy, one-frame previews with graphics resources released after capture. A missing preview must never prevent opening the game. Verify framing visually when browser QA is requested; source checks do not prove appearance.

## Mobile and continuous movement contract

Use `shared/touch.js` for one-pointer joystick ownership, proportional movement, a stable dead zone, cancellation and surface-size observation. A second finger must not steal a held control. Preserve full-speed keyboard movement and scale physical speed with joystick magnitude. Precision touch dragging changes aim only; launching requires an explicit action. Charge cancellation, including lost capture, must never execute a move. Reserve room for safe areas, at least 44px touch targets, and primary actions reachable without scrolling away from the playing surface. Review surf and ski as well as the nine earlier sports on future tasks. Record browser limitations honestly.

## Fun and camera requirements

The user rejected the first surf and ski implementations as boring. Completing a timer or passing a simulation test does not establish fun. Build deliberate, sport-specific opportunities, meaningful risk and recovery, visible feedback and reasons to replay. Verify that active skillful play outperforms coasting; never award a good result merely for waiting. Surf's cutbacks, barrels, lip airs, spin/grab landings and bankable combos, and ski's actual rivals, gate streaks and competing ramp/boost lines are the new baseline. Do not simplify them back into interchangeable left/right obstacle demos.

Every current and future game must offer Top view, 3rd person and 1st person through `shared/cameras.js`. Aiming, movement and player-label projection must use the displayed camera; switching cancels active input, preserves simulation state and restores the controlled model after rendering. Keep original external framing for menu previews. Validate camera geometry and input alignment in tests, and identify visual or hands-on checks that have not been performed. Never claim that camera options alone make a game fun.
