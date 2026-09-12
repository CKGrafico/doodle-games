# Padel quality milestone: baseline and candidate

Date: 2026-09-10. Planning baseline: remote commit `fae3c056608d4e2b8d384907f316811a6c77a17c`, local equivalent `0a09cca`. Scope: the first implementation milestone in QUALITY-PLAN.md. The other eleven games have not received the new motion model.

## What is actually measured

The movement values below come from the real Node-importable padel simulation at 120 ticks/second, without movement assistance. They are physics timings, not measured input-to-screen latency. The original movement profile remains available in the opt-in comparison.

| Measure | Original | Candidate |
| --- | --- | --- |
| Speed after first movement tick | 6.8 m/s | 0.65 m/s |
| Distance travelled on first tick | 0.05667 m | 0.00271 m |
| Time to reach 6.8 m/s | First tick, 8.33 ms | 91.67 ms |
| Time from key release to rest | First tick, 8.33 ms | 75 ms |
| Braking travel from 6.8 m/s | 0 m | 0.24667 m |
| Full-speed reversal | Instant sign change | Reaches opposite full speed within 150 ms |
| Selected static strokes/posts | 479 render objects | 15 batched render objects |

The new velocity starts changing on the first physics tick; it intentionally takes longer to reach top speed. Whether these short ramps feel better must be established in play. The static count is computed from the real court/district scene graph, with text sprites excluded from that count. It is not the total scene draw-call count, an FPS result or a measured GPU improvement. Animated characters, glass and other meshes remain separate.

The production fixed-step loop produced identical ball/player/scoring states under scripted 30, 60, 120, 144 and 240 Hz render schedules. The bounded catch-up test discards excess elapsed time after a long interruption. This verifies simulation cadence, not actual rendering performance at those refresh rates.

## Ranked defects and changes

| Priority | Reproduction before this change | Expected behaviour | Evidence and action |
| --- | --- | --- | --- |
| 1 | Run sideways, release, then reverse | Immediate response with a short, predictable speed change | Source and simulation: direct positional stepping replaced by acceleration, braking and faster reversal. Diagonals remain bounded; collisions remove only the velocity into a wall. |
| 1 | Move manually as the opponent returns toward the other partner, then release movement | The active player stays the one you were controlling | Source and deterministic fixture: assisted selection now happens once at the incoming stroke. Manual movement gets a 240 ms pause before assistance resumes. Holding Tab cannot repeatedly switch. |
| 1 | Change display cadence while a ball or player moves | Smooth presentation independent of physics tick boundaries | Source: previous/current snapshots interpolate ball and player positions. Serves, new matches and contact discontinuities reset snapshots. Cadence tests pass; visual smoothness remains unverified. |
| 2 | Watch a successful shot | Racket preparation before contact and a visible contact/recovery beat | Source and real hit tests: holding/charging prepares the player; a strike records a pose/event at the same simulation time. Volley, drive, lob, smash and fore/backhand poses differ. This remains an assisted reach model, not racket-surface collision or full arm IK. |
| 2 | Hold Hit while the ball is too high, too far away or still on its service flight | A useful reason for waiting | Contact status now explains distance, compulsory bounce, height, recovery and valid hit windows. No automatic human shots were added. |
| 2 | Switch partners in first person | Preserve look direction while changing position | Position eases for 180 ms; yaw/pitch remain immediate and unchanged. A serve reset snaps the pose. Camera math is tested; comfort and wall occlusion require playtesting. |
| 2 | Play first person on a phone | A deliberate way to turn while moving | Padel opts into captured one-finger drag look and a centre reticle. Other fingers cannot steal that gesture or release a held shot. Sensitivity is adjustable and stored locally. |
| 2 | Play with the touch buttons over the near court | Court and important actions stay visible | The canvas uses the area between HUD and controls; camera fitting and aiming use that exact rectangle. Named touch shots use a two-by-two arrangement, 60/78 px buttons and a separate 114 px stick. Landscape reserves side space. Geometry tests pass; CSS layout and ergonomics are not device-verified. |
| 3 | Start warm-up and complete a rally | A clear repeatable skill task and fast retry | Three alternating placement circles count the first legal bounce of a human return. Opponents let practice shots bounce. R/Next ball immediately feeds again while keeping practice totals. The ordinary post-point delay is 850 ms in practice. |
| 3 | Inspect static rendering and contact effects | Avoid needless draw submission and allocation | Static line segments batch by material, posts use instancing, impact rings use a fixed pool, and trail duration is time-based. Runtime timing awaits a browser measurement. |

## Reproducible playable comparison

1. Open the padel page with `?feel=1` appended to its URL. The lab is absent from the normal game.
2. Expand **Padel feel lab** and press **Restart identical practice**. It uses seed 4187, preserving the selected difficulty, assistance and camera.
3. Select **Original movement + raw steps** or **Responsive + interpolation**. Changing this selection restarts the same seeded warm-up. Sound, new strokes, practice targets and static batching stay enabled in both modes.
4. Compare short starts/stops, left/right reversals, motion into the side glass, aiming while moving, charged release/cancel, partner switching and a complete rally. Repeat with assistance off, then on.
5. Try all three views. In first person compare ordinary mouse motion, optional pointer lock, cancellation and touch drag look. In warm-up, land three target returns and use Next ball after a miss.
6. Reset the sample after scene/shader warm-up, then record at least five minutes of active play. For the broader plan, follow with a ten-minute soak on representative devices.

The bounded local panel reports frame interval p95/p99, long intervals, simulation/HUD CPU work, render-submission CPU work, renderer draw calls/triangles and discarded catch-up time. It retains at most 18,000 frame samples. It sends no analytics or network requests. It does not measure GPU execution, allocation spikes or end-to-end input latency; those require a browser profiler or external measurement. Paused/menu frames are excluded. Reset samples before changing scenarios.

## Device and reference matrix

| Check | Status |
| --- | --- |
| Shooter hands-on reference and comparable before recordings | Not completed; its current timing/feel has not been measured |
| Remote desktop browser | Connection succeeded; navigation to the existing padel page timed out; reading subsequent page state also timed out |
| Real 60 Hz / high-refresh desktop | Not available in this pass; only simulated cadence comparisons completed |
| Lower-powered desktop and sustained frame budgets | Not measured |
| Android Chrome portrait/landscape | Not tested on a device |
| iPhone Safari portrait/landscape | Not tested on a device |
| Pointer lock and real touch cancellation | Mocked event regressions pass; real-browser behaviour remains unverified |
| New-player first action, preference and replay rubric | Not collected; no testers contacted |

No browser screenshot, subjective playtest, 60 FPS claim or fun/comfort acceptance is implied by this delivery.

## Automated verification

`node scripts/check.mjs`, `node --test tests/*.test.mjs` and `git diff --check` pass. There are 123 passing tests, including 15 added cases for this milestone. They cover motion/reversal/braking, wall sliding, assist ownership, held switch, interpolation/reset, actual cadence-independent match progression, stroke timing and legal heights, completion of three real placement targets, quick retries, camera fitting/switch math, touch ownership/cancellation and static batching. Existing legal service positions, wall faults and full matches at all three padel difficulties still pass. The other eleven games' existing tests remain green.

The next acceptance step is a hands-on padel review and device measurements. Do not propagate this candidate as a proven quality baseline until that review is complete. The explicit shared camera/input refactor, golf, surf and the collection rollout remain pending as described in QUALITY-PLAN.md.
