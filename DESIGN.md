# The notebook design language

## References and original work

The visual reference is [Doodle District](https://doodleshooter.vercel.app/), with the user's explicit credit to [Evan Milenko's post](https://x.com/EvanMilenko/status/2096356126145015885). The inspected shooter renderer uses pen outlines, hatching, paper grain, ruled lines, and a red page margin. Its action presentation separates menus from play and makes feedback visible.

Padel translates that idea into this collection's own elevated 3D sports scene: cream paper behind blue-ink geometry, muted red opposition, sketch outlines and crosshatching, handwritten titles, restrained interface chrome, a visible ball/aim/active-player system, and a notebook lobby beside the playing area.

Keep these principles without copying the shooter's source, assets, multiplayer, first-person camera, or weapon mechanics. The shared shader is the original padel world-space shader from this repository, extracted into `shared/ink.js`; it is not the shooter's screen-space rendering implementation.

## Shared palette and type

| Role | Token / value | Use |
| --- | --- | --- |
| Paper | `--paper`, `#f7f4e9` | Page, panels, shader background |
| Blue ink | `--ink`, `#2a42ad` | Primary player/team, outlines, primary action |
| Dark ink | `--ink-dark`, `#172867` | Readable body text |
| Red ink | `--red`, `#c94b59` | Opposition, annotations, warnings, focus |
| Handwriting | `--hand`, bundled Patrick Hand | Titles, scores, short expressive labels |
| Utility text | `--sans`, Trebuchet/system sans | Instructions, settings, controls |
| Sport accents | Muted gold, green, sand, water blue | Ball/jack, terrain and relevant affordances |

Every game loads `shared/theme.css` after its sport stylesheet. This is the common token and interaction layer. Keep fonts and Three.js local and preserve their licenses. Sport accents must not overwhelm the ink/paper identity or obscure the active ball.

## Geometry and illustration

Use `penMaterial` from `shared/ink.js` for opaque illustrated geometry. Add silhouettes/edge strokes to players, equipment, buildings, and court boundaries where needed. The hatching stays in world space so it remains attached to surfaces as the camera moves. Keep color-space handling in the shared shader; do not fork a subtly different copy for each sport.

Transparent water, glass, shadows, trajectory lines, and markers are deliberate overlays. They may use simpler materials. A whole flat-color sport scene does not satisfy the style just because it sits on a ruled CSS background.

Use proportion and movement to make the sport legible: rackets and glass in padel, a full football team and pitch, caps/treading arms/goals in water polo, a golfer/club/pin/terrain in golf, and metallic boules, the jack, gravel and throwing circle in petanca. Preserve relevant equipment and physical boundaries. Prioritize the playable scene over decorative spectators.

## Screen composition

The collection has one recognizable hierarchy:

1. A small notebook identity and accessible home link, plus sound/help/pause utilities.
2. A lobby with a handwritten sport title, short invitation, minimal setup, and one strong start action.
3. A playing area with readable boundaries, ball, active-player or turn indicator, and aim feedback.
4. A compact scoreboard and relevant information: time/possession, hole/par/wind, or remaining boules and closest measurement.
5. A consistent control strip and explicit state feedback for score, restart, end of hole/end, and final results.

Padel/football/water polo share the team-game composition. Golf's shot panel and petanca's Spanish precision sidebar are valid sport-specific layouts. Consistency means common hierarchy, control meanings, ink style, feedback, and quality, not forcing a precision sport into a team scoreboard.

## Interaction and accessibility

Match labels to MECHANICS.md. Space and left click must represent the same primary action. The primary touch button uses the strongest ink treatment. Alternative actions use lighter treatment and clear text, not unexplained icons.

Use native buttons, inputs, selects and dialogs, visible keyboard focus, descriptive labels, and readable contrast. Keep action targets at least 44 CSS pixels on touch layouts. Preserve native keyboard behavior in UI controls. Clear input when menus or background tabs interrupt play. Optional sound needs a visible, accurate pressed state.

A decorative callout may ignore pointer events, but its next-hole/next-end buttons must remain clickable. Disabled or loading controls must communicate their state. Do not leave a modal over a simulation that is still consuming input or time.

Adapt the scene and controls to small screens; preserve access to the ball, objective, score, and primary action. Do not shrink everything until the instructions are unreadable. Respect reduced-motion preferences for CSS effects. Camera framing and transitions need specific visual review; source tests alone cannot establish that they feel good.

## Quality review for every new game

Inspect all existing games before adding another, as required by AGENTS.md. Compare the lobby, play HUD, help, touch controls, visual materials, camera framing, ball tracking and feedback. Reuse the best established parts and improve shared inconsistencies together. Record concrete findings, fixes, validation and deferred visual checks in `docs/quality-review.md`.

Preserve the homepage's prominent **SUPER, SUPER, SUPER INSPIRED.** credit and original post link. Keep a discoverable way back to the collection from every game.
