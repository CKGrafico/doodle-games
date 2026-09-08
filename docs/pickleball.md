# Pickleball District

Playable at [Doodle Games / pickleball](https://ckgrafico.github.io/doodle-games/pickleball/).

## Sport references

[USA Pickleball's rules summary](https://usapickleball.org/rules/summary/) establishes diagonal service beyond the kitchen, the opening two bounces, and the restriction on volleying from the non-volley zone. A bounced ball may be played from inside that zone. This game offers doubles, with distinct drive, lob, smash and soft-dink actions.

The [2026 official rulebook](https://usapickleball.org/docs/rules/USAP-Official-Rulebook.pdf), sections 3, 5 and 11, supplies the 20 × 44 foot court, 7 foot kitchen, net dimensions, player positions, and momentum restrictions. Code uses metres, a player foot radius, and stopping-distance checks after volleys. The ball is enlarged for readability, and line calls use its centre at floor contact.

The [LTA rules explanation](https://www.lta.org.uk/play/ways-to-play/pickleball/pickleball-rules/) also explains traditional doubles scoring: only the serving team earns points; both partners serve before side out, except on the opening rotation, called 0–0–2. Games to 11 require a two-point lead. A shorter first-to-five option keeps that same margin.

## Implementation choices

The simulation and rule objects are independent of Three.js. Physics runs at 120 Hz. AI reads one imperfect predicted landing per shot, covers the other half of the court, respects compulsory bounces, and mixes dinks, drives, lobs and high-ball smashes. Movement help changes positioning, not human shot selection.

Serve and shot arcs are assisted. Held strokes wait through compulsory bounces rather than creating accidental beginner faults. Footprints and stopping distance approximate kitchen momentum. Net clips end rallies; spin, incidental body/paddle/net contact and around-post recovery are not fully simulated. These simplifications are visible in the game's help.

The renderer shares padel's character models and animations, the common ink shader and theme, and camera-relative movement. Solid paddles, a perforated yellow ball, visible service boxes, red kitchen markings, an active-player ring, ball shadow and trail distinguish the sport while preserving the notebook family.

All core actions have touch controls. F performs a dink; the other mappings follow the shared racket-game controls in MECHANICS.md. Desktop click/Space serves or drives, E/right-click lobs, Q smashes, and Tab switches partners. Tap the court to aim on touch, then hold a named shot button. Full joystick deflection sprints.

## Verification

Tests cover scoring and service/receiver order, opening two bounces, valid/invalid serves, kitchen volleys and momentum, out and second-bounce outcomes, all physical service positions, swept net collisions, all-difficulty complete matches with shot variety, and a human-input-style assisted quick match. Collection checks also cover the older games.

Source and simulation verification were performed. Browser visual/interactive playtesting was not performed; camera framing, touch ergonomics and subjective game balance remain unverified by hands-on play.
