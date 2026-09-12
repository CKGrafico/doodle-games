# The notebook design language

## References and original work

The visual reference is [Doodle District](https://doodleshooter.vercel.app/), with the user's explicit credit to [Evan Milenko's post](https://x.com/EvanMilenko/status/2096356126145015885). The inspected shooter renderer uses pen outlines, hatching, paper grain, ruled lines, and a red page margin. Its action presentation separates menus from play and makes feedback visible.

Padel translates that idea into this collection's own elevated 3D sports scene: cream paper behind blue-ink geometry, muted red opposition, sketch outlines and crosshatching, handwritten titles, restrained interface chrome, a visible ball/aim/active-player system, and a notebook lobby beside the playing area.

Keep these principles without copying the shooter's source, assets, multiplayer or weapon mechanics. The collection's first-person cameras use original sport-specific positioning. Padel and pickleball share their original animated characters through `shared/racket-player.js`; pickleball uses a solid paddle and a perforated ball, with an open court and red kitchen zones. The shared shader is the original padel world-space shader from this repository, extracted into `shared/ink.js`; it is not the shooter's screen-space rendering implementation.

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

The first padel quality candidate reserves a canvas rectangle between the scoreboard and controls. Its court fit, ray aiming and projected labels use that rectangle, including mobile offsets. The ball has a bounded minimum visual size, a floor shadow and a subtle height guide; this visual scaling does not alter collision radius. The 180 ms partner-eye transition keeps a stable look direction and respects reduced motion. Court strokes/posts batch before animated models are added, preserving the same ink materials. Footwork follows distance travelled; contact rings use a bounded pool and trails expire by elapsed time. These are candidate improvements awaiting the hands-on gate in `docs/feel-baseline.md`, not evidence of validated mobile comfort.

Match labels to MECHANICS.md. Space and left click must represent the same primary action. The primary touch button uses the strongest ink treatment. Alternative actions use lighter treatment and clear text, not unexplained icons.

Use native buttons, inputs, selects and dialogs, visible keyboard focus, descriptive labels, and readable contrast. Keep action targets at least 44 CSS pixels on touch layouts. Preserve native keyboard behavior in UI controls. Clear input when menus or background tabs interrupt play. Optional sound needs a visible, accurate pressed state.

A decorative callout may ignore pointer events, but its next-hole/next-end buttons must remain clickable. Disabled or loading controls must communicate their state. Do not leave a modal over a simulation that is still consuming input or time.

Adapt the scene and controls to small screens; preserve access to the ball, objective, score, and primary action. Do not shrink everything until the instructions are unreadable. Respect reduced-motion preferences for CSS effects. Camera framing and transitions need specific visual review; source tests alone cannot establish that they feel good.

## Quality review for every new game

Inspect all existing games before adding another, as required by AGENTS.md. Compare the lobby, play HUD, help, touch controls, visual materials, camera framing, ball tracking and feedback. Reuse the best established parts and improve shared inconsistencies together. Record concrete findings, fixes, validation and deferred visual checks in `docs/quality-review.md`.

Preserve the homepage's prominent **SUPER, SUPER, SUPER INSPIRED.** credit and original post link. Keep a discoverable way back to the collection from every game.

## Real scene previews and precision sports

Homepage game cards now render a bounded preview from their actual Three.js scene, including relevant equipment, characters and scenery. Match the user’s supplied pickleball game scene, with an elevated camera and the collection’s blue/red ink on paper. Do not replace these previews with flat diagram-like court sketches. `menu.js` loads near-visible cards sequentially, renders one frame, retains the resulting image, and releases GPU resources. Keep an accessible text fallback and working game link if graphics fail.

Curling and pool reuse a shared precision layout: notebook sidebar, turn/score summary, power meter, clear primary action, and a large playable surface. On small screens the surface comes first and controls remain full-size underneath. Curling shows handled stones, house rings, hog lines, a delivery path and a moving broom while sweeping. Pool shows numbered solids/stripes, cushions, six numbered pockets, a cue and first-contact guide. The darker cloth and stone accents are subordinate to the shared paper/ink treatment.

Every charged shot has visible progress and cancellation instructions. The originals use a compact mouse strip; new precision games incorporate the meter into the shot panel. Respect the same interaction semantics, even where the layout differs. Menus, background tabs and restarts cancel gestures and input. New shared UI and new game assets must be reviewed alongside the existing collection for every future addition.

Climbing race uses a tall, near-frontal composition derived from the user's supplied outdoor competition reference: two full-height parallel lanes, large red/blue holds, start pads, finish buzzers, ropes, two animated climbers and restrained event scaffolding. The player target ring and grip/power feedback must remain readable while the camera follows upward. The homepage preview uses this actual scene, not a flat wall icon.

## Mobile controls and the riding games

Keep the notebook paper, blue/red ink, real 3D menu previews and character silhouettes. Mobile movement controls use larger separated targets, safe-area padding and a stable joystick. Precision games dedicate a bounded viewport to the field and let the detail panel scroll separately; primary launch/move actions stay accessible at the bottom. Golf uses a compact lower shot panel. Small landscape touch screens hide redundant keyboard legends and reduce HUD size.

Surf now shows a rising wave face, transparent barrel sections, labelled launch zones, spray and a wake. Ski shows three visible opponents, labelled ramps and boost lines, flags, rocks, pines and a finish banner. Trick rotation, grab poses, falls, event callouts, optional sounds and restrained camera feedback explain the result of each input. The HUD shows upcoming features, energy, charge, combo or gate streak, and three session goals. Following cameras use time-based damping and pull farther back in portrait. Actual mobile appearance remains to be verified in a compatible browser; source inspection does not prove framing.

Every game has the same View selector: Top view, 3rd person, 1st person. Reuse existing camera-control locations where available; otherwise float it within the game surface above touch actions. First-person rendering must hide the controlled model and its own floating player label. Keep the default third-person scenes for homepage previews; preview creation must never insert camera controls into the homepage. Top-view framing must account for portrait aspect ratio. The climbing overhead view is angled down the wall to retain visible holds. Respect reduced-motion settings for ride camera shake and speed effects.

First-person mouse controls add a small centre ring and readable control hint with an optional Lock mouse button. The ring is non-interactive, aligned to the actual canvas centre and hidden in menus and other views. Precision sensitivity and aim locking must make small adjustments predictable. Do not silently consume the first shot to request pointer lock. Surf's default camera now sits lower and beside the rider to show the rising wave face, broad water and moving breaking crest; the HUD exposes curl distance, barrel balance and Special. Mobile layouts retain separate action targets.

Sheep District extends the notebook arcade beyond sports. Render large, rounded wool tufts, contrasting white/dark sheep, a blue sheepdog, blue fences, red pen and gate controls, a wooden bridge, barn, trees and a moving red tractor. Animate legs from actual speed. Bark/whistle rings show range. The menu must capture the actual flock and farm scene. Top view fits the pasture; third person follows the dog from above; first person sits at dog-eye height with mouse look. Keep original level layouts and characters, with discoverable credits for the user's reference.
