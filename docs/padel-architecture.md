# Architecture

## Data flow

`main.js` gathers input and advances `PadelGame` at 120 fixed steps per second. Each rendered frame performs at most eight steps, preventing a stalled tab from making the ball tunnel through the court. Paused and hidden tabs do not advance the simulation. `CourtView` renders the current state without determining points.

The model emits events such as `hit`, `bounce`, `wall`, `fault`, and `point`. The UI and audio consume them once. Native HTML dialogs pause the game; starting or ending a match clears held input.

## Rule isolation

`rules.js` contains court constants, service-box validation, surface classification, `Score`, and `Rally`. These are pure JavaScript and can be tested without a browser.

`Score` owns points, games, service order, tie-break state, and the winner. `Rally` tracks the last striking team, bounces since that stroke, service reception, and net contact. Rule methods return a result; the simulation resolves it once while the rally is active, so multiple collision checks cannot award a point twice.

## Physics and AI

The coordinate system uses X across the court, Y upward, and Z along its length. The near pair is team 0 at positive Z. Court dimensions are metres, but the visible ball and contact region are enlarged for readability and accessible play.

Ball motion uses gravity with a fixed integration step. Net crossing is swept between positions. The enclosing planes apply bounce restitution and consult the rally rule state before reflecting velocity. A short serve sub-state performs the ground bounce before launch.

Shot arcs solve a projectile path to the aiming point. Arc duration is increased when necessary to clear the net. Lob and smash have distinct flight-time and depth choices.

AI predicts a reachable ball position with a lightweight forward simulation including floor and wall reflections. One defender takes responsibility for each stroke; a nearby partner can rescue a ball. Difficulty changes movement speed, reaction delay, and per-stroke interception error. A seeded generator keeps test matches repeatable.

## Rendering

`render.js` owns a single Three.js renderer, camera, and scene. An original shader mixes paper and ink according to surface lighting and world-space crosshatching. `EdgesGeometry` outlines rigid structures; back-face shells outline round character shapes. Court enclosure planes are translucent and do not write depth.

The court, neighborhood, players, rackets, trajectory trail, aiming ring, and wall-impact markers are Three.js geometry. There are no generated illustration assets or copied reference meshes. The notebook UI uses a locally hosted handwriting font, CSS rules, and a simple grain filter.

GPU pixel ratio is capped. Static geometry and materials are reused; temporary wall markers dispose their geometry and material. The trail uses one preallocated geometry buffer. A WebGL failure shows a readable recovery panel.

## Extending the game

First improve feel with real device testing and measurable play-session observations. Tune values in `launch`, `predict`, and `updatePlayers` without moving scoring into the renderer.

If adding online play, keep the server authoritative over simulation, collisions, and score. Exchange timestamped inputs and snapshots, not client-declared winners. Separate network time from the local animation clock. Online play is intentionally not represented by an inactive menu option in this prototype.

For richer rule fidelity, add body contact faults, end changes, an actual service timing interaction, receiver selection for alternative deciding-point formats, and legal out-of-court retrieval as explicit tested rules.
