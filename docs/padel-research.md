# Research and design

Research date: 7 September 2026.

## Reference game

[Doodle District](https://doodleshooter.vercel.app/) was examined through its publicly served HTML and JavaScript. The browser reached the page but its WebGL context was disabled, preventing direct inspection of the rendered scene. Conclusions about its rendering are therefore source-based, not claims about a successful gameplay session.

The source reveals a custom Three.js renderer with a geometry data buffer, pen outlines, light-dependent hatching, paper grain, ruled notebook lines, and a margin line. Its ink palette includes blue ballpoint, red pen, graphite, and highlighter accents. Typography includes Patrick Hand and Caveat. Its perspective camera and keyboard-and-mouse input support a directly playable game surface.

The useful inspiration is the material treatment and playful contrast between an ordinary notebook and a three-dimensional game. The shooter mechanics do not map to padel. This game uses its own world-space hatch shader, edge geometry and silhouette shells, an elevated camera, legible team colors, and a compact scoreboard. It does not copy the reference's post-processing implementation, levels, characters, logo, or assets.

## Padel research

The primary source is the [FIP Rules of Padel](https://www.padelfip.com/wp-content/uploads/2025/12/FIP_Rules-of-Padel.pdf), effective 1 January 2026, linked from [FIP documents](https://www.padelfip.com/documents/).

| Rule area | Implemented interpretation |
| --- | --- |
| Court | 20 × 10 metres, service lines 6.95 metres from the net. |
| Net | 0.88 metres centrally, 0.92 at the ends. |
| Enclosure | Back glass is 3 metres with mesh above; side glass occupies the end zones. |
| Serve | Bounced, below-waist contact, diagonal service box, two attempts. |
| Reception | Designated receiver must allow the serve to bounce. |
| Live walls | Opponents' ground must precede their wall; a legal rebound remains live until bounce two. |
| Fence | A serve touching fence after its first bounce is a fault. |
| Let | Net-touching serve must otherwise land legally; fence contact still faults. |
| Scoring | One-set mode uses advantage games and a 7-point, two-clear tie-break at 6–6. |
| Rotation | All four players serve; tie-break service changes after one point, then every two. |

## Product decisions

The first screen is a game-native match setup laid over the real court. There are no marketing pages. A player should start a match in one click and see instructions without leaving the game.

An elevated camera makes the full court, both pairs, landing positions, and enclosure readable. A second view places the camera behind the baseline. Blue identifies the user's pair; red identifies the opponents. The ball is yellow-green, deliberately larger than a physical padel ball, with a ground shadow and short trail to communicate height and movement.

The same shot input covers a groundstroke or volley depending on contact. Lob trades speed for height. Smash is restricted to reachable high balls; a low-ball smash request becomes a drive. The aiming ring identifies intended landing position. Shot trajectories assist net clearance to prioritize timing and placement.

The default movement assistance predicts a return position and selects a receiving player. This keeps first play manageable. WASD, arrows, or the touch pad take control immediately; assistance can be disabled. AI players have bounded movement and per-stroke reading errors, rather than frame-by-frame random hit failures.

## Deliberate arcade adaptations

- Quick match is first to three games, with a deciding point at deuce. It is a custom short format, not a claim of full tournament equivalence.
- One-set mode ends after one set rather than a best-of-three match. Teams remain on their visual sides; end changes have no wind or sun effect in this court.
- Aiming and serving are assisted. The serve animation bounces and contacts below waist height; players do not manually time a foot-fault-sensitive service action.
- Character bodies do not cause contact faults. Manual movement stops before crossing the net or enclosure.
- Out-of-court retrieval, doors, ceiling interference, player hindrance, racket drops, and exceptional over-net retrieval are outside the prototype's scope.
- Ball bounce and wall restitution are gameplay tuning, not measured ball or glass material specifications. Fence rebounds are damped but not a full stochastic mesh model.
- This is local single-player doubles. Online matches would require an authoritative server, synchronization, reconciliation, and room management.

## Technical references

[Three.js documentation](https://threejs.org/docs/) provides the rendering APIs. [MeshToonMaterial](https://threejs.org/docs/pages/MeshToonMaterial.html) informed the comparison of conventional toon shading and a custom ink shader. A custom shader was selected because pen hatching is the defining reference characteristic. Three.js r180 is pinned and vendored with its license for a stable, self-contained browser build.

## Remaining release check

Run the game on actual WebGL-enabled browsers and assess court framing, high-ball readability, camera movement, touch control reach, and audio. The current environment validates the source and simulation but does not establish visual or device compatibility. Do not describe this prototype as browser-play-tested until that check has been performed.
