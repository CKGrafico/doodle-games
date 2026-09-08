# Petanca District

An original Three.js singles pétanque game, with Spanish controls and instructions. It uses the shared local Three.js and Patrick Hand assets; no new dependencies or external requests are required to play.

## Rules reference

[The FEP official rules, January 2022, hosted by Federació Catalana de Petanca](https://fcpetanca.cat/wp-content/uploads/2022/02/Reglamento-Oficial-para-el-Deporte-de-la-Petanca-FEP-enero-2022.pdf) provide the baseline: singles uses three boules per player; games go to 13 points; the side without the closest boule plays next; scoring counts boules closer than the opposing best; a jack placed between 6 and 10 metres starts the end. This is an arcade adaptation, not a claim of compliance with all current tournament regulations.

The simulation uses a 4 by 15 metre lane, gravity, gravel rolling resistance, low restitution on landing, and mass-weighted 3D collision impulses. Balls entirely across the boundary become dead. A dead jack awards the remaining boules only when exactly one player has boules remaining; otherwise the end is void.

Deliberate adaptations: enlarged boule and jack radii for legibility; a fixed throwing circle; direct placement of the jack; uniform gravel; distance-based trajectory calibration; distances within 1 mm treated as tied. Tied positions alternate throws while both players have boules; a tied completed end scores zero. No referee, one-minute timer, or tournament penalty procedure.

## Controls

Tap the lane to aim, or use direction and distance sliders. A/D adjusts direction, W/S adjusts reach, Space places the jack or throws a boule. Arrimar, Lanzar alto, and Tirar vary launch angle and approach. The dotted guide is an empty-lane prediction; collisions change the result. The close view and measured distance help distinguish positions.

## Verification

The pure simulation tests cover scoring, tied and dead boules, turn selection, momentum transfer, nominal trajectories, dead-jack scoring, and a deterministic complete match reaching 13. Source checks cover JavaScript syntax and entrypoint links. Browser visual or interactive testing was not performed for this addition.
